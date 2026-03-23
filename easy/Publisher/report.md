---
layout: writeup
title: "Publisher"
platform: THM
os: "Linux"
date: 2026-03-23
techniques: ["Service Enumeration","Web Exploitation","CVE Exploitation","Reverse Shell","SSH Pivot","Restricted Shell Bypass","SUID Abuse","Writable Script Hijack","Privilege Escalation"]
cve: ["CVE-2023-27372"]
description: "An exposed SPIP 4.2.0 instance was exploited via CVE-2023-27372 to gain unauthenticated RCE as www-data inside a container, pivot to the host user via an exposed SSH private key, and escalate to root through a SUID binary that executed a world-writable script."
---

# Publisher Technical Report

> **Platform:** TryHackMe \
> **Difficulty:** `Easy` \
> **Date:** 2026-03-23 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only

---

## 0. Executive Summary

> The Publisher machine was found to contain multiple high-impact weaknesses that allowed a full compromise from unauthenticated web access to root-level control of the host. The initial entry point was a vulnerable SPIP 4.2.0 password reset page affected by CVE-2023-27372, which allowed remote code execution without valid credentials. That access landed inside a container as the `www-data` user, from which an exposed SSH private key for the host user `think` was recovered. Final privilege escalation was achieved through a dangerous local misconfiguration: a SUID-root binary executed a world-writable script, allowing arbitrary code execution as root. Immediate remediation should focus on patching SPIP, removing exposed private keys, and eliminating unsafe SUID/script execution paths.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Publisher"** machine on TryHackMe.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined in `methodology.md`.

---

## 2. Attack Chain

```text
Nmap/Gobuster → SPIP 4.2.0 Identification → CVE-2023-27372 (spip_pass / oubli) → RCE as www-data in container → Exposed SSH private key → SSH as think on host → Restricted shell bypass → SUID run_container + writable /opt/run_container.sh → Root
````

---

## 3. Tools Used

| Tool                  | Purpose                                |
| --------------------- | -------------------------------------- |
| `nmap`                | Port scanning and service detection    |
| `gobuster`            | Directory enumeration                  |
| `curl` / browser      | Manual web inspection                  |
| `python3`             | Running and adjusting public PoC code  |
| `nc` / `rlwrap`       | Reverse shell listener                 |
| `ssh`                 | Host pivot using recovered private key |
| `find` / `ls` / `cat` | Local enumeration                      |
| `base64`              | Safer in-band command output handling  |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**

```bash
nmap -sC -sV -oA initial <target-ip>
nmap -sC -sV -p- -oA all_ports <target-ip>
```

**Findings:**

| Port | Service | Version          | Notes                                  |
| ---- | ------- | ---------------- | -------------------------------------- |
| 22   | SSH     | OpenSSH          | Potential post-exploitation pivot path |
| 80   | HTTP    | Apache / web app | Main attack surface                    |
| 80   | Web App | SPIP 4.2.0       | Identified as vulnerable CMS           |

**Key Observations:**

* The attack surface was small but high value: SSH and a web service.
* Directory enumeration exposed `/spip/`, strongly suggesting a SPIP deployment.
* Publicly accessible metadata disclosed the exact SPIP version and plugin set.

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Tools Used:** `gobuster`, manual inspection, browser-based review

**Findings:**

* `/spip/` was accessible and clearly hosted a SPIP CMS.
* `/spip/spip.php?page=backend` exposed RSS content and author metadata.
* A configuration-related response disclosed:

  * `SPIP 4.2.0`
  * installed plugins
* `/spip/spip.php?page=spip_pass` exposed the password reset form and anti-CSRF token.
* The password reset form used the `oubli` parameter, which matched public exploit research for CVE-2023-27372.

### 5.2 Additional Services

#### SSH

* SSH was exposed on port 22 but no valid credentials were initially available.
* It later became relevant after recovering a private key from the compromised environment.

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** Unauthenticated SPIP remote code execution
**Location:** `/spip/spip.php?page=spip_pass`
**CVE:** `CVE-2023-27372`

**Reasoning:**

The target publicly disclosed **SPIP 4.2.0**, which is affected by CVE-2023-27372. The vulnerable password reset workflow was exposed and included the expected form fields:

* `formulaire_action=oubli`
* `formulaire_action_args=<token>`
* `oubli=<user input>`

Manual testing confirmed that crafted serialized input in the `oubli` field caused injected PHP to execute during server-side rendering.

### 6.2 Exploitation

A public PoC was adjusted to:

* remove obsolete `urllib3` cipher handling that failed on newer Python environments
* print the HTTP response body for verification
* support command execution tests through the vulnerable `oubli` parameter

**Sanitized example workflow:**

```bash
python3 exploit.py -u http://<target>/spip -c "echo TEST" -v
python3 exploit.py -u http://<target>/spip -c "whoami" -v
```

**Validation Indicators:**

* Command output was reflected into the returned HTML.
* `whoami` returned `www-data`.

**Result:** User-level code execution obtained as `www-data`.

---

## 7. Lateral Movement

**From:** `www-data`
**To:** `think`

**Method:**

* A reverse shell was established from the vulnerable SPIP instance to improve interaction.
* Shell context indicated execution inside a containerized SPIP environment.
* Local enumeration of `/home/think/` revealed:

  * a readable `user.txt`
  * an accessible `.ssh/` directory
  * a readable private SSH key
* The recovered private key was written locally and used to authenticate over SSH as `think`.

**Sanitized commands:**

```bash
# Reverse shell trigger (sanitized)
python3 exploit.py -u http://<target>/spip -c "<reverse-shell-command>" -v

# Local enumeration from compromised shell
ls -la /home/think
ls -la /home/think/.ssh
cat /home/think/.ssh/id_rsa

# SSH pivot
chmod 600 think_id_rsa
ssh -i think_id_rsa think@<target-ip>
```

**Result:** Interactive host-level access obtained as `think`.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**

* [x] `sudo -l`
* [x] SUID binaries  `find / -perm -4000 2>/dev/null`
* [ ] Cron jobs  `cat /etc/crontab`
* [x] Writable files/dirs
* [ ] Capabilities  `getcap -r / 2>/dev/null`
* [ ] Running processes / internal ports
* [x] Bash history / config files
* [ ] LinPEAS

**Key Findings:**

* The login shell for `think` was `/usr/sbin/ash`, a restricted shell.
* `/usr/sbin/run_container` was SUID root.
* `/opt/run_container.sh` was world-writable.
* The combination strongly suggested a script-hijacking privilege escalation path.

### 8.2 Escalation Vector

**Vector:** SUID-root helper executing a world-writable script
**Root Cause:** Insecure local privilege design: a root-owned SUID executable relied on a script that could be modified by unprivileged users.

A direct overwrite attempt from the restricted `ash` shell failed despite the file’s mode, indicating shell-level restrictions rather than filesystem permissions. This was bypassed by launching `bash` through the dynamic loader, escaping the restricted shell context.

**Sanitized exploitation flow:**

```bash
# Restricted shell bypass
/lib64/ld-linux-x86-64.so.2 /bin/bash

# Confirm unrestricted shell
echo $0
id

# Hijack executed script
echo '/bin/bash -p' > /opt/run_container.sh

# Trigger SUID helper
/usr/sbin/run_container

# Select existing container ID when prompted
<container-id>

# Verify escalation
id
```

**Result:** Root-level access achieved.

---

## 9. Findings Summary

| # | Finding                                                       | Severity    | Location                                            |
| - | ------------------------------------------------------------- | ----------- | --------------------------------------------------- |
| 1 | SPIP 4.2.0 vulnerable to unauthenticated RCE (CVE-2023-27372) | 🔴 Critical | Web application on port 80                          |
| 2 | Exposed SSH private key for host user                         | 🔴 Critical | `/home/think/.ssh/id_rsa`                           |
| 3 | SUID-root binary executes world-writable script               | 🔴 Critical | `/usr/sbin/run_container` + `/opt/run_container.sh` |
| 4 | Restricted shell provided weak containment and was bypassable | 🟠 High     | `think` shell environment                           |
| 5 | Sensitive metadata leakage via public CMS responses           | 🟡 Medium   | SPIP backend/config exposure                        |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

* Requests to `/spip/spip.php?page=spip_pass` containing malformed serialized input in `oubli`
* Repeated password reset form submissions with suspicious payloads
* Outbound network connections from the web container to attacker-controlled listener ports
* Access to `/home/think/.ssh/id_rsa` by the web service account
* Execution of `/usr/sbin/run_container` by non-admin users
* Modification timestamps or content changes in `/opt/run_container.sh`

### 10.2 Security Weaknesses

* Unpatched public-facing CMS
* Excessive trust in user-controlled form input
* Poor isolation between containerized web application and host-user secrets
* Insecure SUID design
* World-writable privileged execution path
* Weak reliance on a restricted shell for containment

### 10.3 Hardening Recommendations

| Priority   | Recommendation                                                                                                                      | Finding                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Immediate  | Upgrade SPIP to a fixed version and remove vulnerable public exposure                                                               | CVE-2023-27372          |
| Immediate  | Rotate and revoke exposed SSH keys; enforce proper file permissions                                                                 | Exposed private key     |
| Immediate  | Remove SUID bit from `run_container` or redesign it to avoid script execution                                                       | SUID abuse              |
| Immediate  | Change permissions on `/opt/run_container.sh` to root-only and validate execution paths                                             | Writable script hijack  |
| Short-term | Strengthen container isolation and prevent host secret exposure to container users                                                  | Container-to-host pivot |
| Short-term | Add monitoring for anomalous password reset requests and outbound web-shell traffic                                                 | IoCs                    |
| Long-term  | Review all privileged utilities for unsafe trust boundaries and replace restricted-shell-only controls with real policy enforcement | Defense in depth        |

---

## 11. Lessons Learned

* Version disclosure in public CMS metadata can turn a “small” attack surface into a very fast compromise path.
* In-band HTML-reflected command output is enough to prove RCE, but a reverse shell dramatically speeds up post-exploitation.
* Container access is not the same as host access, but poor secret separation can erase that boundary quickly.
* Restricted shells are not a real privilege boundary when other interpreters or loaders are available.
* A single world-writable script tied to a SUID-root binary is game over.

---

*End of Report*
*Classification: Public  flags and sensitive values omitted*
