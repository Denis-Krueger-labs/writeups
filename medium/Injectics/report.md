---
layout: writeup
title: "Injectics"
platform: THM 
os: Linux
difficulty: medium
date: 2026-03-14
description: "A deep dive into bypassing a hardened Twig Server-Side Template Injection (SSTI) sandbox by exploiting an overlooked filter callback to achieve Remote Code Execution."
techniques:
  - "SSTI (Server-Side Template Injection)"
  - "Sandbox Escape"
  - "PHP Filter Callback Abuse"
cve: []
---

# Injectics — Technical Report

> **Platform:** TryHackMe \
> **Difficulty:** `Medium` \
> **Date:** 2026-03-14 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only 

---

## 0. Executive Summary

The **Injectics** machine features a web application vulnerable to a critical **Server-Side Template Injection (SSTI)** flaw within its admin profile functionality. While the developers implemented a hardened Twig Sandbox to prevent common exploitation methods (blocking standard tags and functional filters), a specific oversight in the template engine's filter whitelist allowed for a complete bypass. By abusing the `sort` filter, an attacker could force the application to evaluate strings as native PHP functions, leading to unauthenticated Remote Code Execution (RCE) and full compromise of the application's underlying data. Immediate updates to the template engine's security policy are required to prevent callback abuse.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Injectics"** machine on TryHackMe. 

**Objectives:**
- Confirm and enumerate the extent of the template injection vulnerability.
- Map the restrictions of the custom Twig Sandbox.
- Achieve a sandbox escape to execute arbitrary system commands.
- Retrieve the hidden system flag.

**Methodology:** Assessments follow a standard web-tier penetration testing approach, heavily focusing on manual payload crafting, error-message analysis, and sandbox mapping.

---

## 2. Attack Chain

```text
[Initial Recon] → [SSTI Confirmation ({{7*7}})] → [Sandbox Restriction Mapping] → [Callback Analysis] → [Filter Bypass via `sort`] → [RCE] → [Flag Exfiltration]

```

---

## 3. Tools Used

| Tool | Purpose |
| --- | --- |
| `nmap` | Port scanning & service detection |
| `Burp Suite` | Intercepting requests and rapidly iterating SSTI payloads |
| `Wappalyzer` | Identifying the underlying tech stack (PHP/Twig) |
| Manual Enumeration | Crafting bespoke payloads to map sandbox constraints |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**

```bash
nmap -sC -sV -p- -oA injectics_full <target-ip>

```

**Findings:**

| Port | Service | Version | Notes |
| --- | --- | --- | --- |
| 80 | HTTP | Apache/2.4.41 | Main web application portal; hosts the Admin Dashboard. |
| 22 | SSH | OpenSSH 8.2p1 | Secure Shell access; requires credentials or keys. |

**Key Observations:**

* The primary attack surface is the web application on Port 80.
* The site features an "Edit Profile" or dashboard section where user input (like `fname`) is reflected directly back to the user on the page.

---

## 5. Service Enumeration

### 5.1 Web Enumeration & SSTI Discovery

**Tools Used:** `Burp Suite`, manual inspection

**Findings:**

* **Input Reflection:** The `fname` parameter was found to be evaluated by the backend template engine rather than just safely escaped and rendered.
* **Confirmation:** Injecting the classic Twig/Jinja2 payload `{{ 7*7 }}` resulted in the page rendering `Welcome, 49!`. This confirmed Server-Side Template Injection (SSTI).

---

## 6. Initial Access: The Sandbox Escape

### 6.1 Vulnerability Identification & Sandbox Mapping

Once SSTI was confirmed, standard RCE payloads were attempted. However, the application was protected by a strict **Twig SecurityPolicy**.

**The Sandbox Wall:**

1. **Blocked Core Methods:** Attempting the "nuclear option" for Twig (`{{ _self.env.registerUndefinedFilterCallback('exec') }}`) failed. The application blocked method calls on the `_self` object.
2. **Context Enumeration Blocked:** The `keys` filter and `{% for %}` loops were restricted, preventing basic array iteration to find hidden variables. Injecting `{{ _context }}` simply returned `Welcome, Array!`.
3. **The Closure Constraint:** Attempting to use functional filters like `map`, `reduce`, or `filter` to execute commands (e.g., `{{ ['id']|map('passthru') }}`) returned a fatal error: *"Must be a Closure"*. The sandbox was explicitly configured to prevent strings from being interpreted as callable functions for these specific filters.

### 6.2 The Filter Analysis: Blocked vs. Allowed

The breakthrough came from analyzing *how* the developer hardened the sandbox.

* **The Defense:** The developer manually created a blacklist/whitelist in the `SecurityPolicy` that strictly enforced closures on well-known dangerous filters (`map`, `filter`, `reduce`).
* **The Flaw:** They overlooked the **`sort`** filter. In Twig, `sort` also accepts a callback to define how an array should be ordered. Because it wasn't hardened to require a PHP Closure, it could accept a raw string matching a native PHP function.

### 6.3 Exploitation & Payload Crafting

To exploit this oversight, an array containing the desired system command and an empty string was passed to the `sort` filter, using `passthru` as the sorting callback.

**Payload Evolution:**

1. *Attempt 1:* `{{[‘ls -la flags’,””]|sort(‘passthru’)}}`
* *Result:* Syntax Error. The use of typographical "smart quotes" (`‘` and `’`) caused the Twig lexer to fail.


2. *Attempt 2:* `{{['ls -la flags', '']|sort('passthru')}}`
* *Result:* Success. The payload successfully executed the directory listing, revealing a randomized flag file: `5d8af1dc14503c7e4bdc8e51a3469f48.txt`.



**Final Exfiltration Payload:**

```twig
{{ ['cat flags/5d8af1dc14503c7e4bdc8e51a3469f48.txt', '']|sort('passthru') }}

```

**Result:** The application evaluated the command, bypassed the sandbox, and returned the system flag directly to the web page as the `www-data` user: `Welcome, THM{5735172b6c147f4dd649872f73e0fdea} Array!`

---

## 7. Privilege Escalation

*(Note: For this specific CTF objective, obtaining the flag via the web-tier RCE fulfilled the room requirements. Extensive local privilege escalation was not strictly necessary to complete the primary goal, as the flag was readable by `www-data`.)*

---

## 8. Findings Summary

| # | Finding | Severity | Location |
| --- | --- | --- | --- |
| 1 | Server-Side Template Injection (SSTI) | 🔴 Critical | Profile Edit Form (`fname` parameter) |
| 2 | Incomplete Sandbox Security Policy | 🟠 High | Backend Twig Configuration |
| 3 | Excessive File Read Permissions | 🟡 Medium | `/flags` directory accessible by web user |

---

## 9. Defensive Considerations

### 9.1 Indicators of Compromise

* Web access logs containing URL-encoded curly braces (`%7B%7B` and `%7D%7D`).
* Application error logs showing `Twig\Sandbox\SecurityError` exceptions, indicating enumeration attempts.
* Spikes in child processes spawned by the web server (e.g., `sh -c ls`, `cat`) executed by the `www-data` user account.

### 9.2 Security Weaknesses

* **Incomplete Whitelisting:** The custom `SecurityPolicy` relied on an incomplete understanding of which Twig filters accept callbacks, leaving a critical function (`sort`) unprotected.
* **Unsafe Template Architecture:** User input should be passed into templates as *variables* to be rendered safely, rather than being evaluated as raw template code.

### 9.3 Hardening Recommendations

| Priority | Recommendation | Details |
| --- | --- | --- |
| Immediate | **Fix Template Logic** | Refactor the application so user input is never parsed as a Twig template. Use `{{ user_input }}` instead of `render(user_input)`. |
| Short-term | **Enforce Strict Callbacks** | If sandbox mode must be used, set `allow_callbacks` to `false` in the Twig Security configuration to kill all string-to-function vectors. |
| Long-term | **Least Privilege** | Restrict the `www-data` user from reading sensitive files outside the immediate `/var/www/html/` application scope. |

---

## 10. Lessons Learned

This machine was an excellent exercise in **Sandbox Escape methodology**. It taught me that:

1. **Syntax matters:** Copy-pasting payloads often introduces smart quotes or hidden characters that can derail an otherwise perfect exploit. Pay careful attention to raw text.
2. **Developers miss edge cases:** A sandbox is only as strong as its weakest policy. While the "famous" SSTI vectors (`map`, `registerUndefinedFilterCallback`) were heavily guarded, auxiliary functions like `sort` provide an identical execution path if left unmonitored.
3. **Error messages are a roadmap:** The specific error `"Must be a Closure"` was the breadcrumb that proved the injection was working, but the route was blocked, prompting the search for alternative callback filters.

---

*End of Report*
*Classification: Public — flags and sensitive values omitted in public distributions.*
