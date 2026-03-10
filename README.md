# HTB & THM Writeups — 0N1S3C2

> Technical documentation of HackTheBox and TryHackMe machines solved during my Information Security degree and red team certification prep.

Structured reports demonstrating methodical penetration testing, privilege escalation techniques, and defensive analysis.

**Author:** Denis (0N1S3C2) | Information Security @ THWS Würzburg  
**HTB Handle:** 0N1S3C2 | **THM Handle:** 0N1S3C  
**Focus:** Red teaming, web exploitation, Active Directory, Linux/Windows privilege escalation  
**Cert Path:** CWES → CWEE → CPTS

---

## Boxes Completed

### Easy

| Box | Platform | OS | Key Techniques | Date |
|-----|----------|----|----|------|
| [CCTV](./easy/cctv/) | HTB | Linux | SQLi (CVE-2024-51428), motionEye command injection, HMAC bypass, sh/bash pitfalls | 2026-03-08 |
| [Facts](./easy/facts/) | HTB | Linux | Mass assignment CVE-2025-2304, S3 credential abuse, sudo facter exploitation | 2026-03-08 |
| [WingData](./easy/wingdata/) | HTB | Linux | Wing FTP unauthenticated RCE (CVE-2025-47812), tarfile symlink CVE-2025-4517 | 2026-03-08 |
| [Eighteen](./easy/eighteen/) | HTB | Windows DC | MSSQL impersonation, BadSuccessor CVE-2025-53779, dMSA abuse, Kerberos tunneling | 2026-03-08 |
| [Conversor](./easy/conversor/) | HTB | TBD | TBD | TBD |
| [Bashed](./easy/bashed/) | HTB | Linux | TBD | TBD |
| [Shocker](./easy/shocker/) | HTB | Linux | TBD | TBD |
| [All In One](./easy/all-in-one/) | THM | Linux | TBD | TBD |

### Medium

| Box | Platform | OS | Key Techniques | Date |
|-----|----------|----|----|------|
| [Cronos](./medium/cronos/) | HTB | Linux | TBD | TBD |
| [Rabbit Store](./medium/rabbit-store/) | THM | TBD | TBD | TBD |
| [CTF Collection Vol.2](./medium/ctf-collection-vol-2/) | THM | CTF | TBD | TBD |

### Hard

| Box | Platform | OS | Key Techniques | Date |
|-----|----------|----|----|------|
| [Rabbit Hole](./hard/rabbit-hole/) | THM | TBD | TBD | TBD |

---

## Report Structure

Each writeup follows a standardized format:

- **Executive Summary** — High-level overview and impact assessment
- **Attack Chain** — Visual flow from reconnaissance to root
- **Detailed Walkthrough** — Step-by-step technical analysis with commands and reasoning
- **Findings Table** — Vulnerabilities with severity ratings (Critical/High/Medium/Low/Info)
- **Defensive Considerations** — IOCs, hardening recommendations, detection opportunities
- **Lessons Learned** — Technical insights and methodology improvements

See [METHODOLOGY.md](./METHODOLOGY.md) for the full assessment framework.

---

## Methodology Highlights

- **Enumeration-first approach** — exhaustive service discovery before exploitation attempts
- **Source code analysis** — read actual implementation when documentation isn't enough
- **Defensive thinking** — every exploit includes detection & hardening guidance
- **Documentation rigor** — reproducible steps, sanitized outputs, proper CVE attribution
- **Root cause analysis** — understand *why* vulnerabilities exist, not just *how* to exploit them

---

## Key Lessons Learned (So Far)

- **Motion uses `/bin/sh` not `/bin/bash`** — reverse shell redirect operators matter (CCTV)
- **Wrong VPN network breaks everything** — Starting Point ≠ Labs VPN (Facts)
- **Read the exploit source code** — parameter names matter; `password[role]` not `user[role]` (Facts)
- **HMAC keys can be hashes themselves** — don't always need plaintext passwords (CCTV)
- **`--custom-dir` bypasses env var restrictions** — blocking `FACTERLIB` doesn't help when CLI flags exist (Facts)
- **Port 88 filtering requires creative tunneling** — chisel + socat for Kerberos over SSH (Eighteen)
- **BadSuccessor is absurdly powerful** — CreateChild on any OU = domain admin on WS2025 (Eighteen)

---

## Stats

- **HTB:** Premium member, 4+ boxes solved (Easy machines, preparing for Medium)
- **THM:** Top 1%, Gold League #1 (1,069 points), 211+ rooms completed
- **Current Goal:** CWES certification → CWEE → CPTS path
- **Training Focus:** Red teaming, privilege escalation, Active Directory attacks

---

## Disclaimer

All activities documented in this repository were conducted exclusively within authorized lab environments (HackTheBox and TryHackMe). No real-world systems were accessed or harmed. Flags and sensitive credential values have been redacted from all reports.

---

## Contact

- **HTB Profile:** [0N1S3C2](https://app.hackthebox.com/users/XXXXX)
- **THM Profile:** [0N1S3C](https://tryhackme.com/p/0N1S3C)

---

*"Always verify the VPN network before troubleshooting connectivity for 30 minutes." — Lessons learned the hard way*
