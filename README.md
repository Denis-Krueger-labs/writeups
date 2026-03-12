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
| [CCTV](easy/CCTV/report.md) | HTB | Linux | SQLi (CVE-2024-51428), motionEye command injection, HMAC bypass, sh/bash pitfalls | 2026-03-08 |
| [Facts](easy/Facts/report.md) | HTB | Linux | Mass assignment CVE-2025-2304, S3 credential abuse, sudo facter exploitation | 2026-03-08 |
| [WingData](easy/WingData/report.md) | HTB | Linux | Wing FTP unauthenticated RCE (CVE-2025-47812), tarfile symlink CVE-2025-4517 | 2026-03-09 |
| [Eighteen](easy/Eighteen/report.md) | HTB | Windows DC | MSSQL impersonation, BadSuccessor CVE-2025-53779, dMSA abuse, Kerberos tunneling | 2026-03-10 |
| [Conversor](easy/Conversor/report.md) | HTB | Linux | Source code disclosure, path traversal file upload, cronjob hijack, sudo needrestart | 2026-03-08 |
| [Bashed](easy/bashed/report.md) | HTB | Linux | Exposed phpbash webshell, sudo misconfiguration, cronjob hijack | 2026-03-07 |
| [Shocker](easy/shocker/report.md) | HTB | Linux | ShellShock CVE-2014-6271 (CGI), sudo perl GTFOBins | 2026-03-07 |
| [All In One](easy/all-in-one/report.md) | THM | Linux | LFI (mail-masta plugin), credential discovery, sudo socat | 2026-02-20 |

### Medium

| Box | Platform | OS | Key Techniques | Date |
|-----|----------|----|----|------|
| [Cronos](medium/Cronos/report.md) | HTB | Linux | DNS zone transfer, SQLi auth bypass, command injection, cronjob hijack | 2026-03-07 |
| [Rabbit Store](medium/Rabbit%20Store/report.md) | THM | Linux | Business logic flaw, SSTI (Jinja2), RabbitMQ Erlang cookie abuse | 2026-02-22 |
| [CTF Collection Vol.2](medium/ctf-collection-vol-2/report.md) | THM | Web Challenges | Multi-layer encoding, cookie tampering, time-based SQLi, HTTP method abuse | Learning exercise |
| [Hammer](medium/Hammer/report.md) | THM | Linux | Rate limit bypass (X-Forwarded-For), JWT kid exploitation, session-specific code brute force | 2026-03-11 |) | THM | Linux | Rate limit bypass (X-Forwarded-For), JWT kid exploitation, session-specific code brute force | 2026-03-11 |
| [Pterodactyl](./medium/Pterodactyl/report.md) | HTB | Linux | CVE-2025-49132 + PEAR RCE, CVE-2025-6018/6019 PAM/udisks chain | 2026-03-12 |

### Hard

| Box | Platform | OS | Key Techniques | Date |
|-----|----------|----|----|------|
| [Rabbit Hole](hard/rabbit-hole/report.md) | THM | Linux | Second-order SQLi, information_schema.processlist credential interception | 2026-03-09 |

---

## Report Structure

Each writeup follows a standardized format:

- **Executive Summary** — High-level overview and impact assessment
- **Attack Chain** — Visual flow from reconnaissance to root
- **Detailed Walkthrough** — Step-by-step technical analysis with commands and reasoning
- **Findings Table** — Vulnerabilities with severity ratings (Critical/High/Medium/Low/Info)
- **Defensive Considerations** — IOCs, hardening recommendations, detection opportunities
- **Lessons Learned** — Technical insights and methodology improvements

See [METHODOLOGY.md](mythology.md) for the full assessment framework.

---

## Methodology Highlights

- **Enumeration-first approach** — exhaustive service discovery before exploitation attempts
- **Source code analysis** — read actual implementation when documentation isn't enough
- **Defensive thinking** — every exploit includes detection & hardening guidance
- **Documentation rigor** — reproducible steps, sanitized outputs, proper CVE attribution
- **Root cause analysis** — understand *why* vulnerabilities exist, not just *how* to exploit them

---

## Key Lessons Learned (So Far)

### Technical Insights
- **Motion uses `/bin/sh` not `/bin/bash`** — reverse shell redirect operators matter; `>&` fails in sh (CCTV)
- **Wrong VPN network breaks everything** — Starting Point ≠ Labs VPN, always verify before troubleshooting (Facts)
- **Read the exploit source code** — parameter names matter; `password[role]` not `user[role]` (Facts)
- **HMAC keys can be hashes themselves** — don't always need plaintext passwords (CCTV)
- **`--custom-dir` bypasses env var restrictions** — blocking `FACTERLIB` doesn't help when CLI flags exist (Facts)
- **Port 88 filtering requires creative tunneling** — chisel + socat for Kerberos over SSH (Eighteen)
- **BadSuccessor is absurdly powerful** — CreateChild on any OU = domain admin on WS2025 (Eighteen)
- **Vhost enum isn't always the answer** — sometimes it's just in the page source (WingData)
- **Static salts are almost as bad as no salts** — "WingFTP" for every user means standard wordlist attacks work perfectly (WingData)
- **`filter="data"` is not sufficient** — CVE-2025-4517 shows Python's tarfile filter doesn't protect against symlink+hardlink chaining (WingData)
- **PBKDF2 at 600k iterations defeats GPU cracking** — hashcat was impractical, custom CPU-based Python script was the correct tool (Eighteen)

### Enumeration & Methodology
- **Gobuster extensions matter** — using `-x sh,cgi,pl` finds scripts that default scans miss (Shocker)
- **Port 53 is an attack surface** — DNS zone transfer hands you the entire subdomain structure instantly (Cronos)
- **Source code disclosure is critical** — entire attack chains can start with downloading exposed archives (Conversor)
- **Second-order SQLi requires patience** — injection fires at query time, not insert time (Rabbit Hole)
- **Double quotes matter** — single-quoted injection sanitized, `/"` prefix bypassed it (Rabbit Hole)
- **`information_schema.processlist` is a real attack surface** — overprivileged DB users expose live queries including credentials (Rabbit Hole)

### Privilege Escalation Patterns
- **Cronjob hijacking appears EVERYWHERE** — Bashed, Cronos, Conversor all used this; always check `/etc/crontab` and writable script directories
- **GTFOBins for sudo privesc** — sudo + unusual binary = check GTFOBins immediately (Shocker, All-in-One, Conversor)
- **File ownership reveals who runs scripts** — `test.txt` owned by root despite script owned by scriptmanager = root runs it (Bashed)

### Rabbit Holes & Mindset
- **The box name is the hint** — "Rabbit Hole" literally told us to avoid over-engineering (Rabbit Hole)
- **Don't stop at the first working vector** — exploring alternatives after solving teaches the most
- **Difficulty ratings don't always match reality** — "Easy" boxes can require MSSQL chains, custom hash cracking, and 2025 CVEs (Eighteen)

---

## Stats

- **HTB:** Premium member, 10 boxes solved (8 Easy, 2 Medium, preparing for more Medium/Hard)
- **THM:** Top 1%, Gold League #1 (1,069 points), 211+ rooms completed (including 3 documented challenge boxes)
- **Current Goal:** CWES certification → CWEE → CPTS path
- **Training Focus:** Red teaming, privilege escalation, Active Directory attacks

---

## Disclaimer

All activities documented in this repository were conducted exclusively within authorized lab environments (HackTheBox and TryHackMe). No real-world systems were accessed or harmed. Flags and sensitive credential values have been redacted from all reports.

---

## Contact

- **HTB Profile:** [0N1S3C2](https://app.hackthebox.com/users/3188353)
- **THM Profile:** [0N1S3C](https://tryhackme.com/p/0N1S3C)
- **Location:** Würzburg, Germany
- **University:** THWS Würzburg (Bachelor of Information Security)

---

*"Always verify the VPN network before troubleshooting connectivity for 30 minutes." — Lessons learned the hard way*
# Updated Thu Mar 12 19:52:25 CET 2026
