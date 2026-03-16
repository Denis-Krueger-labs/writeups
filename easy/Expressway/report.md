---
layout: writeup
title: "Expressway"
platform: HTB
os: "Linux"
date: 2026-03-15
techniques: ["UDP enumeration","IKE aggressive mode enumeration","offline PSK cracking","TFTP configuration disclosure","credential reuse","SSH access","custom sudo analysis","proxy log analysis","policy bypass","privilege escalation"]
cve: []
description: "UDP enumeration exposed IKE and TFTP, allowing retrieval of a router configuration and cracking of the IKE pre-shared key; reused credentials granted SSH access, and a custom sudo client was then redirected to a permissive remote policy server to obtain root."
---

# Expressway - Technical Report

> **Platform:** Hack The Box \
> **Difficulty:** `Easy` \
> **Date:** 2026-03-15 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only

---

## 0. Executive Summary

> The **Expressway** machine was compromised through a chain of weak network exposure, credential reuse, and broken distributed authorization design. Initial TCP enumeration showed only SSH, but UDP enumeration revealed IKE/IPsec and TFTP services. Aggressive Mode on IKE allowed extraction of a crackable authentication exchange, and TFTP exposed a Cisco router configuration file containing useful identity information. The recovered pre-shared key was reused as the SSH password for the local user, resulting in user-level access. For privilege escalation, a **custom sudo implementation** in `/usr/local/bin/sudo` was found to rely on a **remote policy decision point**. By forcing the client to query the host `offramp.expressway.htb` using the `-h` flag, the attacker received a permissive policy response of **`(root) NOPASSWD: ALL`**, allowing execution of a root shell. Immediate priorities are disabling unsafe IKE Aggressive Mode exposure, removing sensitive configuration files from TFTP, enforcing unique credentials, and aligning centralized policy decisions with local enforcement behavior.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Expressway"** machine on Hack The Box.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:**  
The assessment followed a standard workflow of reconnaissance, service enumeration, credential analysis, controlled exploitation, and privilege escalation. The structure and tone of this report were based on the provided write-up template and adapted to reflect the actual attack path observed on this target.

---

## 2. Attack Chain

> Full exploitation path reconstructed from the assessment.

```text
Nmap TCP/UDP scan → IKE Aggressive Mode enumeration → offline PSK cracking → TFTP config disclosure → credential reuse over SSH → custom sudo analysis → Squid log review → discovery of remote PDP host → host-directed policy bypass → root shell
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | TCP/UDP scanning and NSE-based service enumeration |
| `ike-scan` | IKE/IPsec Aggressive Mode enumeration |
| `psk-crack` | Offline cracking of captured IKE PSK material |
| `tftp` | Retrieval of exposed configuration file |
| `ssh` | Authenticated shell access |
| `id`, `groups` | Local user and group enumeration |
| `strings`, `nm`, `file` | Static analysis of the custom sudo binary |
| `cat`, `less`, `grep` | Review of Squid logs and local configuration artifacts |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV -Pn -p- <target-ip>
nmap -sU --top-ports 20 <target-ip>
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22/tcp | SSH | OpenSSH 10.0p2 Debian 8 | Only visible TCP service |
| 69/udp | TFTP | Not fingerprinted | Exposed and later used to retrieve config |
| 161/udp | SNMP | open\|filtered | Did not respond to default community strings |
| 500/udp | ISAKMP | IKE/IPsec | Returned Aggressive Mode handshake |
| 4500/udp | NAT-T-IKE | open\|filtered | Consistent with IPsec/NAT traversal |

**Key Observations:**
- The host presented a very small TCP attack surface, which made deeper UDP enumeration necessary.
- UDP services were far more valuable than the TCP results suggested.
- IKE on UDP/500 and TFTP on UDP/69 ultimately became the path to initial access.

---

## 5. Service Enumeration

> Each exposed service was analyzed for likely attack vectors.

### 5.1 SSH Enumeration

**Findings:**
- SSH was externally accessible on port 22.
- No direct service vulnerability was identified during enumeration.
- SSH later became the initial access path after valid credentials were recovered from other services.

### 5.2 IKE / IPsec Enumeration

**Tool Used:** `ike-scan`

**Findings:**
- The target responded to an IKE Aggressive Mode handshake.
- The response exposed an ID value of `ike@expressway.htb`.
- The handshake indicated PSK-based authentication and was suitable for offline cracking.
- The captured exchange was exported and cracked successfully with a wordlist attack.

**Notable Output Characteristics:**
- Aggressive Mode enabled
- Authentication: PSK
- Group: DH Group 2 / modp1024
- XAUTH support advertised

### 5.3 TFTP Enumeration

**Tools Used:** `nmap` NSE, `tftp`

**Findings:**
- The `tftp-enum` NSE script identified an accessible file: `ciscortr.cfg`.
- The file contained Cisco-style configuration data including hostname, IKE-related information, username references, and operational context.
- This configuration materially supported the attack by confirming identity and credential-reuse possibilities.

### 5.4 SNMP Enumeration

**Tools Used:** `snmp-check`, `snmpwalk`, `onesixtyone`

**Findings:**
- Default/community-based SNMP enumeration did not yield useful output.
- SNMP was not required for compromise and was not part of the successful attack path.

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** Weak IKE deployment combined with exposed configuration data and credential reuse  
**Location:** UDP/500 (IKE), UDP/69 (TFTP), SSH  
**Reasoning:**

The target initially appeared reasonably hardened because TCP exposure was minimal. However, UDP enumeration revealed two high-value services. IKE Aggressive Mode allowed a crackable handshake to be captured, and TFTP exposed a router configuration file. Most importantly, the cracked pre-shared key was later found to be reused as the SSH password for the user `ike`, providing a direct and reliable path to shell access.

### 6.2 Exploitation

> Sensitive values are omitted from this public report.

```bash
# Enumerate IKE Aggressive Mode
ike-scan -M -A <target-ip>

# Export crackable handshake material
ike-scan -M -A --id=<redacted> -P<output-file> <target-ip>

# Crack PSK offline
psk-crack -d <wordlist> <output-file>

# Enumerate TFTP files
nmap -sU -p 69 --script tftp-enum.nse <target-ip>

# Retrieve exposed configuration
tftp <target-ip> -c get ciscortr.cfg

# Reuse recovered secret for SSH
ssh ike@<target-ip>
```

**Result:**  
User-level access obtained as `ike`.

---

## 7. Lateral Movement *(if applicable)*

No lateral movement was required.

**Result:**  
Initial access as `ike` led directly to the local privilege escalation phase.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

After obtaining a shell as `ike`, local enumeration initially appeared routine, but two unusual artifacts quickly stood out:

- The user `ike` was a member of the **`proxy`** group.
- A non-standard sudo binary existed at **`/usr/local/bin/sudo`**.

These findings suggested that privilege escalation might not follow a traditional path such as SUID abuse or kernel exploitation.

**Commands used:**
```bash
id
groups
ls -l /usr/local/bin/sudo
file /usr/local/bin/sudo
strings /usr/local/bin/sudo | less
nm /usr/local/bin/sudo | less
```

**Findings:**

| Finding | Significance |
|---------|--------------|
| `ike` in group `proxy` | Allowed read access to Squid logs/configuration |
| `/usr/local/bin/sudo` present | Indicated a custom privilege mediation mechanism |
| Binary contained Protobuf/gRPC-related symbols | Suggested remote policy evaluation instead of local-only sudoers |
| Running `/usr/local/bin/sudo id` returned a custom denial | Confirmed authorization logic was being handled differently |

**Observed behavior:**
```bash
/usr/local/bin/sudo id
```

Returned:
```text
ike is not allowed to run sudo on expressway
```

This error differed from standard sudo behavior and strongly implied that the binary was not simply parsing `/etc/sudoers`, but acting as a **client** in a distributed authorization workflow.

### 8.2 Analyzing the Custom Sudo Client

Static inspection of the custom binary revealed symbols associated with remote policy checks.

**Relevant symbols identified:**
- `intercept_token`
- `CheckPolicyRequest`
- `CheckPolicyResponse`

These names indicated that the binary was constructing a request, sending it to an external decision point, and receiving an authorization verdict in return.

This strongly suggested a **Policy-as-Code** architecture, where the local host delegated privilege decisions to a remote service rather than relying solely on local sudoers configuration.

**Assessment:**
- `/usr/local/bin/sudo` functioned as a policy enforcement client
- Authorization decisions were likely made by an external **Policy Decision Point (PDP)**
- The `-h` option appeared to influence which host or policy context was queried

### 8.3 Following the Proxy Trail

Because the user `ike` belonged to the `proxy` group, Squid telemetry became accessible. Reviewing the proxy logs exposed denied requests to an internal hostname:

```text
TCP_DENIED/403 ... GET http://offramp.expressway.htb
```

This was a critical pivot point in the investigation.

**Interpretation:**
- `offramp.expressway.htb` was likely an internal service used by the custom sudo client
- The hostname matched the expected role of a **remote policy server**
- The environment appeared to implement centralized authorization, but local and remote policy states were not aligned

This moved the escalation path away from classic local privilege escalation and toward a **distributed trust failure**.

### 8.4 Policy Bypass via Host-Directed Authorization

The key realization was that the vulnerability was **architectural**, not memory-corruption-based.

In standard sudo, the `-h` flag is related to host-based sudoers matching. In this custom implementation, it appears to have been repurposed or trusted in a way that let the client select which backend policy context to query.

Running:

```bash
/usr/local/bin/sudo -h offramp.expressway.htb -l
```

returned a permissive policy:

```text
(root) NOPASSWD: ALL
```

This proved that while the default local decision path denied `ike`, the remote policy server `offramp.expressway.htb` held an authorization record that allowed `ike` to execute commands as root without a password.

The client trusted the backend response and did not adequately restrict or validate which policy source should govern the local machine.

### 8.5 Exploitation

Once the permissive policy context was identified, exploitation was straightforward.

**Command:**
```bash
/usr/local/bin/sudo -h offramp.expressway.htb bash
```

**Result:**
- A root shell was obtained
- The attacker was able to access `root.txt`
- Full system compromise was achieved

This was not a conventional software exploit but a **policy-routing / trust-boundary failure** caused by inconsistent authorization data between the local enforcement path and the remote policy service.

### 8.6 Root Cause

The privilege escalation was caused by a combination of:

- A **custom sudo wrapper** that delegated authorization to a remote service
- Insufficient restriction of the **host-selection mechanism**
- A centralized policy server containing a more permissive rule set than the local default path
- Trust in backend authorization responses without ensuring they were scoped correctly for the local host

In short, the system failed because the **Policy Enforcement Point (PEP)** and **Policy Decision Point (PDP)** were not consistently aligned.

### 8.7 Security Impact

This issue allowed a low-privileged local user to escalate to root by querying a more permissive authorization source. In enterprise environments using Zero Trust or centralized authorization, this kind of flaw is especially dangerous because it does not require a traditional exploit payload—only a mismatch between distributed policy components.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | IKE Aggressive Mode exposed crackable authentication material | 🔴 Critical | UDP/500 |
| 2 | TFTP exposed sensitive router configuration data | 🔴 Critical | UDP/69 |
| 3 | Credential reuse between VPN material and SSH account | 🟠 High | SSH / local account `ike` |
| 4 | Custom sudo client trusted a remote policy server with inconsistent authorization rules | 🔴 Critical | `/usr/local/bin/sudo` |
| 5 | Membership in the `proxy` group exposed telemetry useful for internal trust mapping | 🟡 Medium | Local group permissions / Squid logs |

**Severity Scale:**  
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- UDP reconnaissance activity against ports 69, 161, 500, and 4500
- Repeated IKE handshake attempts consistent with `ike-scan`
- TFTP retrieval of configuration files such as `ciscortr.cfg`
- Successful SSH login for user `ike`
- Local inspection of `/usr/local/bin/sudo` using `strings`, `nm`, or similar tooling
- Access to Squid proxy logs by the `ike` account
- Invocation of `/usr/local/bin/sudo` with `-h offramp.expressway.htb`
- Root shell execution spawned through the custom sudo client

### 10.2 Security Weaknesses

- Use of IKE Aggressive Mode exposed offline-crackable authentication material
- Sensitive configuration file exposed over unauthenticated TFTP
- Password reuse across security domains
- Over-privileged local group membership (`proxy`) exposed valuable internal telemetry
- Centralized authorization architecture was inconsistently enforced
- Custom privilege mediation trusted backend policy responses without sufficient scoping or validation

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Disable IKE Aggressive Mode and move to stronger IPsec authentication controls | IKE PSK exposure |
| Immediate | Remove sensitive files from TFTP or disable TFTP entirely if operationally unnecessary | Exposed `ciscortr.cfg` |
| Immediate | Enforce unique credentials across VPN, SSH, and infrastructure services | Credential reuse |
| Immediate | Remove or tightly restrict host-selectable policy behavior in the custom sudo client | Remote policy bypass |
| Immediate | Ensure the PDP only returns policies valid for the requesting host and identity context | Policy inconsistency |
| Short-term | Review group membership such as `proxy` and limit access to operational telemetry | Excessive local visibility |
| Short-term | Log and alert on unusual invocations of custom privilege tooling, especially host-targeted requests | Detection gap |
| Long-term | Perform architecture reviews of Zero Trust / Policy-as-Code implementations to verify PEP/PDP consistency | Trust-boundary failure |

---

## 11. Lessons Learned

- A machine with almost no TCP exposure can still be highly vulnerable through UDP services.
- IKE Aggressive Mode remains dangerous because it can expose material for offline cracking.
- TFTP is still a serious risk when it exposes operational configuration files.
- Credential reuse turns one service compromise into another.
- The most important lesson from this box is that **centralized authorization systems fail catastrophically when policy enforcement and policy decision points disagree**.
- “Zero Trust” does not help if the wrong system is being trusted.
- Local group memberships like `proxy` can provide exactly the visibility an attacker needs to map internal trust relationships.

---

## 12. Conclusion

Expressway combined legacy-style network weaknesses with a more modern infrastructure failure. Initial compromise came from exposed UDP services, poor secret hygiene, and credential reuse. Root compromise, however, came from something much more subtle: a distributed authorization model in which the local enforcement point and the centralized decision point did not agree. By redirecting the custom sudo client to a permissive backend host, a low-privileged user was able to obtain unrestricted root access. The box is a strong example of how both old and new security design mistakes can chain together into full system compromise.

---

*End of Report*  
*Classification: Public — flags and sensitive values omitted*
