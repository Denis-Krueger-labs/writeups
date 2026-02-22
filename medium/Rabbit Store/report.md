# Rabbit Store --- Technical Report

> Platform: TryHackMe\
> Difficulty: Medium\
> Date: 2026-02-22\
> Author: 0N1S3C\
> Scope: Authorized TryHackMe lab environment only

------------------------------------------------------------------------

## 1. Introduction

This report documents the structured analysis and controlled
exploitation of the "Rabbit Store" machine on TryHackMe.

The objective was to: 
- Obtain user-level access
- Obtain root/system-level access

The target presented a multi-stage attack chain combining: - Business
logic flaws - Server-Side Template Injection (SSTI) - RabbitMQ
misconfiguration - Credential derivation weaknesses

------------------------------------------------------------------------

## 2. Reconnaissance

### 2.1 Initial Network Scan

**Commands Used:**

``` bash
nmap -sC -sV <target-ip>
nmap -T4 -n -sC -sV -Pn -p- <target-ip>
```

**Summary of Findings:**


| Port | Service | Version | Notes |
|------|---------|----------|-------|
|22|SSH|OpenSSH 8.9p1|Standard Ubuntu SSH service|
|80|HTTP|Apache 2.4.52|Redirected to cloudsite.thm|
|4369|epmd|Erlang Port Mapper|Indicates Erlang/RabbitMQ|
|25672|Erlang Distribution|RabbitMQ Node|Inter-node communication|

Key observations: 
- Web application hosted on Apache.
- Full scan revealed Erlang distribution services.
- RabbitMQ present in backend infrastructure.

------------------------------------------------------------------------

## 3. Service Enumeration

### 3.1 Web Enumeration

Tools Used: 
- Nmap
- Gobuster
- Burp Suite
- Manual source inspection
- rabbitmq

Findings: 
- Port 80 redirected to `cloudsite.thm`.
- Storage application located at `storage.cloudsite.thm`.
- JWT-based authentication implemented.

Identified endpoints:

**POST** 
- `/api/register`
- `/api/login`
- `/api/upload`
- `/api/store-url`
- `/api/fetch_messeges_from_chatbot`

**GET** 
- `/api/uploads/<filename>`
- `/dashboard/inactive`
- `/dashboard/active`

The application used a JWT-based authentication cookie.

### 3.2 Additional Services
Erlang and RabbitMQ services were identified via full port scan:
- EPMD on port 4369
- Erlang distribution on port 25672
- Node name identified as rabbit
This indicated backend message queue infrastructure.

------------------------------------------------------------------------

## 4. Initial Access

### 4.1 Vulnerability Identification

A business logic flaw was identified during user registration. The
backend trusted a client-supplied `"subscription"` field.

By modifying the registration JSON to include:

``` json
"subscription": "active"
```

The server issued a JWT reflecting an active subscription state.

Additionally, the chatbot endpoint `/api/fetch_messeges_from_chatbot`
was vulnerable to Jinja2 SSTI.

Test payload:

``` jinja2
{{7*7}}
```

Returned `49`, confirming template injection.

------------------------------------------------------------------------

### 4.2 Controlled Exploitation

Using Jinja2 object traversal:

``` jinja2
{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}
```

Command execution was confirmed.

A reverse shell was obtained as user `azrael`.

**Result:** User-level access achieved.

------------------------------------------------------------------------

## 5. Privilege Escalation

### 5.1 Local Enumeration
Actions performed:
- Checked sudo privileges
- Enumerated SUID binaries
- Reviewed home directories
- Inspected /var/lib
- Investigated running services
- Checked exposed ports
Key findings:
- RabbitMQ detected via open ports.
- Erlang node confirmed via:

``` Bash
epmd -names
```

 - Erlang cookie located at:
``` Code
/var/lib/rabbitmq/.erlang.cookie
```

The cookie was readable by the compromised user, representing a serious trust boundary violation.

------------------------------------------------------------------------

### 5.2 Escalation Vector

## Step 1 RabbitMQ Node Authentication
Using the exposed Erlang cookie, authentication to the RabbitMQ node succeeded.
Administrative enumeration revealed:
- A root RabbitMQ user
- A hint indicating Linux root password derivation
- Exported definitions containing password hashes
RabbitMQ stores passwords as:
``` Code
Base64( Salt || SHA256(Salt || Password) )
```
Decoding the stored password hash revealed:
- 4-byte salt
- 32-byte SHA-256 digest
The room hint indicated:
> The Linux root password equals the SHA-256 hashed value of the RabbitMQ root user's password.
Using the derived digest value, switching to root succeeded.
Proof:
```bash 
id
uid=0(root) gid=0(root) groups=0(root)
```

Result:
Root/system-level access achieved.
------------------------------------------------------------------------

## 6. Defensive Considerations

### 6.1 Indicators of Compromise

-   Abnormal JWT claims during registration
-   Suspicious template rendering patterns
-   Unexpected outbound connections from chatbot service
-   Erlang node CLI interactions
-   Unauthorized RabbitMQ control operations

### 6.2 Security Weaknesses

-   Business logic flaw in subscription assignment
-   Server-Side Template Injection
-   Insecure upload-by-URL implementation
-   Erlang cookie readable by unprivileged user
-   Credential derivation relationship between application and system root

### 6.3 Hardening Recommendations

-   Enforce server-side authorization controls.
-   Never render unsanitized user input directly in templates.
-   Restrict upload-by-URL functionality.
-   Lock down Erlang distribution to localhost.
-   Restrict `.erlang.cookie` permissions to 400.
-   Avoid credential derivation across services.

------------------------------------------------------------------------

## 7. Lessons Learned

-   Business logic flaws can be more impactful than cryptographic weaknesses.
-   SSTI testing with simple arithmetic is an effective detection method.
-   Full port scans are critical; backend services may expose escalation paths.
-   Message queue infrastructure can form unintended privilege bridges.
-   Structured enumeration prevents missed attack chains.
This assessment reinforced the importance of structured enumeration and systematic analysis.
------------------------------------------------------------------------

End of Report.
