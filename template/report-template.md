# <Room Name> — Technical Report

> **Platform:** Name \
> **Difficulty:** `Easy` / `Medium` / `Hard` \
> **Date:** YYYY-MM-DD \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only 

---

## 0. Executive Summary

> One paragraph — plain English. What was the target, what was found,
> how severe is it, what needs fixing first. Write this for a
> non-technical reader.

**Example:**
> The "Room Name" machine was found to contain [X] critical
> vulnerabilities. An unauthenticated attacker could exploit [key
> finding] to achieve full system compromise. Immediate remediation
> of [top priority] is recommended.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation
of the **"<Room Name>"** machine on TryHackMe.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined
in `methodology.md`.

---

## 2. Attack Chain

> One-line summary of the full exploitation path. Fill this in last.

```
[Initial Recon] → [Vector] → [Initial Access] → [Lateral Movement] → [Privesc] → [Root]
```

**Example:**
```
Nmap → LFI (mail-masta) → wp-config creds → SSH → sudo socat → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `gobuster` | Directory enumeration |
| `burpsuite` | Request interception & analysis |
| | |

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
| | | | |
| | | | |

**Key Observations:**
- 
- 
- 

---

## 5. Service Enumeration

> Analyze each exposed service individually for attack vectors.

### 5.1 Web Enumeration

**Tools Used:** `gobuster`, `ffuf`, `wpscan`, `burpsuite`, manual inspection

**Findings:**
- 
- 

### 5.2 Additional Services

> SMB, FTP, SSH, RabbitMQ, databases, etc. Add subsections as needed.

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** 
**Location:** 
**Reasoning:**

> Why was this vector chosen? What made it exploitable?

### 6.2 Exploitation

> Conceptual description of steps taken.
> ⚠️ Sensitive values (passwords, flags, hashes, tokens) are omitted
> from this public report.

```bash
# Commands / payloads used (sanitized)
```

**Result:** User-level access obtained as `<username>`.

---

## 7. Lateral Movement *(if applicable)*

> Skip this section if you went directly from initial access to root.

**From:** `<initial user>`
**To:** `<target user>`

**Method:**
- 
- 

**Result:** Access obtained as `<new user>`.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [ ] `sudo -l`
- [ ] SUID binaries — `find / -perm -4000 2>/dev/null`
- [ ] Cron jobs — `cat /etc/crontab`
- [ ] Writable files/dirs
- [ ] Capabilities — `getcap -r / 2>/dev/null`
- [ ] Running processes / internal ports
- [ ] Bash history / config files
- [ ] LinPEAS

**Key Findings:**
- 
- 

### 8.2 Escalation Vector

**Vector:** 
**Root Cause:**

> Why was this escalation possible? What misconfiguration enabled it?

```bash
# Exploitation commands (sanitized)
```

**Result:** Root/system-level access achieved.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | | 🔴 Critical | |
| 2 | | 🟠 High | |
| 3 | | 🟡 Medium | |
| 4 | | 🔵 Low | |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

> What would appear in logs / alerts during this attack?

- 
- 
- 

### 10.2 Security Weaknesses

- 
- 
- 

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | | |
| Short-term | | |
| Long-term | | |

---

## 11. Lessons Learned

> What did THIS specific box teach you? Don't use the same text for
> every room — make it specific and honest.

- 
- 
- 

---

*End of Report*
*Classification: Public — flags and sensitive values omitted*
