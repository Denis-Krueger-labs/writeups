---
layout: writeup
title: "Forgotten"
platform: HTB
os: "Linux"
date: 2026-03-24
techniques: ["Nmap Enumeration","Directory Busting","LimeSurvey Enumeration","Authenticated Plugin Upload Abuse","Container Enumeration","Credential Reuse","SSH Pivoting","Docker Bind Mount Abuse","Privilege Escalation"]
cve: ["CVE-2021-44967"]
description: "A vulnerable LimeSurvey instance allowed authenticated malicious plugin upload, resulting in code execution inside a Docker container; leaked environment credentials enabled SSH access to the host, and a writable bind mount allowed container-root to plant a SUID bash binary for full host compromise."
---

# Forgotten  Technical Report

> **Platform:** Hack The Box \
> **Difficulty:** `Medium` \
> **Date:** 2026-03-24 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only

---

## 0. Executive Summary

> The target exposed SSH and a web service running Apache. Although the web root initially returned an HTTP 403 response, further enumeration revealed a LimeSurvey instance hosted under `/survey`. The application was vulnerable to authenticated remote code execution via the plugin upload and installation functionality (CVE-2021-44967). Exploitation yielded a shell inside a Docker container as the application user. Sensitive credentials exposed in environment variables were then reused to obtain SSH access on the host system. Finally, privilege escalation to root was achieved by abusing a bind-mounted directory shared between the container and the host, allowing a SUID-enabled bash binary to be planted from a root shell inside the container and executed locally on the host. Immediate remediation should focus on patching LimeSurvey, removing secrets from environment variables, eliminating password reuse, and hardening Docker isolation.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation
of the **"Forgotten"** machine on Hack The Box.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow a structured workflow of reconnaissance,
service enumeration, exploit validation, controlled exploitation, lateral
movement, and privilege escalation.

---

## 2. Attack Chain

```text
Nmap → Web enumeration → LimeSurvey discovery → Authenticated plugin upload (CVE-2021-44967) → Reverse shell in Docker container → Environment variable credential leak → SSH to host as limesvc → Root in container via sudo → Bind-mounted SUID bash drop → Root
````

---

## 3. Tools Used

| Tool                                 | Purpose                                         |
| ------------------------------------ | ----------------------------------------------- |
| `nmap`                               | Port scanning and service detection             |
| `gobuster` / `dirbuster`             | Directory enumeration                           |
| `ffuf`                               | Fuzzing for additional paths and content        |
| `docker`                             | Local exploit preparation / MySQL backend setup |
| `nc`                                 | Reverse shell listener                          |
| `ssh`                                | Pivot from container credentials to host access |
| `find`, `grep`, `mount`, `ps`, `env` | Local enumeration on container and host         |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**

```bash
nmap -sC -sV -oA initial <target-ip>
nmap -sC -sV -p- -oA all_ports <target-ip>
```

**Findings:**

| Port | Service | Version       | Notes                             |
| ---- | ------- | ------------- | --------------------------------- |
| 22   | SSH     | OpenSSH 8.9p1 | Password authentication available |
| 80   | HTTP    | Apache 2.4.56 | Web root returned `403 Forbidden` |

**Key Observations:**

* SSH was exposed but no initial credentials were available.
* Apache on port 80 did not present a browsable default site.
* Enumeration was required to identify hidden application paths.
* During directory scanning, `/survey` was discovered and redirected to a LimeSurvey application/setup flow.

---

## 5. Service Enumeration

> Analyze each exposed service individually for attack vectors.

### 5.1 Web Enumeration

**Tools Used:** `gobuster`, `ffuf`, `burpsuite`, manual inspection

**Findings:**

* Initial fuzzing for alternate prefixes/suffixes did not immediately expose useful content.
* Directory brute forcing revealed a `/survey` path.
* Accessing `/survey` redirected into a LimeSurvey installation/application workflow.
* The application version was identified as `6.3.7+231127`.
* The instance was confirmed vulnerable to **CVE-2021-44967**, allowing authenticated remote code execution through the plugin upload/install functionality.

### 5.2 Additional Services

#### SSH

* OpenSSH 8.9p1 was reachable on port 22.
* SSH was not useful during initial recon.
* It later became the pivot mechanism after credentials were recovered from the container environment.

---

## 6. Initial Access

### 6.1 Vulnerability Identification

**Vulnerability:** Authenticated LimeSurvey plugin upload leading to remote code execution
**Location:** `/survey`
**Reasoning:**

After identifying the LimeSurvey instance and confirming its version, the
plugin upload/install capability was tested as an authenticated attack vector.
This functionality accepted a crafted plugin archive containing attacker-controlled
PHP code. Because uploaded plugin files became reachable under the web path,
server-side execution could be triggered directly after installation.

### 6.2 Exploitation

To validate and prepare the exploitation workflow locally, a MySQL backend
container was created for LimeSurvey:

```bash
sudo docker run --name limesurvey-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpass123 \
  -e MYSQL_DATABASE=limesurvey \
  -e MYSQL_USER=limeuser \
  -e MYSQL_PASSWORD=limepassword \
  -p 3306:3306 \
  -d mysql:8.4
```

A malicious plugin ZIP archive was then prepared for the target LimeSurvey
instance. The archive contained a PHP payload file and the minimal plugin
metadata required for installation.

**Conceptual contents:**

```text
payload.zip
├── payload.php
└── demo.xml
```

After uploading and installing the plugin through the LimeSurvey administrative
interface, the payload was triggered directly through the web-accessible plugin path:

```text
/survey/upload/plugins/ExampleSettings/payload.php
```

A reverse shell listener was prepared on the attack machine:

```bash
nc -lvnp <port>
```

Triggering the uploaded payload returned an interactive shell inside the target
environment.

**Result:** User-level access obtained as `limesvc` inside a Docker container.

---

## 7. Lateral Movement

**From:** `limesvc` (container)
**To:** `limesvc` (host)

**Method:**

* Post-exploitation enumeration showed the initial shell was inside a Docker container rather than on the host.
* The container environment exposed sensitive variables, including application credentials.
* The leaked password was reused successfully for SSH access to the underlying host as `limesvc`.

**Result:** Host-level shell obtained as `limesvc` via SSH.

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**

* [x] `sudo -l`
* [x] SUID binaries  `find / -perm -4000 2>/dev/null`
* [x] Cron jobs  `cat /etc/crontab`
* [x] Writable files/dirs
* [x] Capabilities  `getcap -r / 2>/dev/null`
* [x] Running processes / internal ports
* [x] Bash history / config files
* [ ] LinPEAS

**Key Findings:**

* On the host, `limesvc` did not have direct `sudo` rights.
* Docker was running on the host, but the Docker socket was not accessible to the host user.
* Enumeration of both the container and host revealed a shared application path:

  * **Container:** `/var/www/html/survey`
  * **Host:** `/opt/limesurvey`
* This was confirmed by creating a test file in the container and observing the same file on the host.
* Inside the container, the `limesvc` user could reuse the leaked password with `sudo`, enabling root access inside the container.

### 8.2 Escalation Vector

**Vector:** Privilege escalation through a writable Docker bind mount
**Root Cause:**

The LimeSurvey application directory was bind-mounted between the host and the
container. After obtaining root access inside the container, it was possible to
create files in the shared directory that would appear on the host. By copying
`/bin/bash` into the shared mount and setting the SUID bit as container root,
the binary became executable from the host with preserved elevated privileges.

**Exploitation steps (sanitized):**

Inside the container:

```bash
echo '<redacted>' | sudo -S id
sudo -s

cp /bin/bash /var/www/html/survey/0N1S3C
chmod 4755 /var/www/html/survey/0N1S3C
ls -l /var/www/html/survey/0N1S3C
```

On the host:

```bash
ls -l /opt/limesurvey/0N1S3C
/opt/limesurvey/0N1S3C -p
id
```

This yielded a root shell on the host.

**Result:** Root/system-level access achieved.

---

## 9. Findings Summary

| # | Finding                                                                                            | Severity    | Location                                   |
| - | -------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------ |
| 1 | Vulnerable LimeSurvey instance allowed authenticated plugin upload abuse leading to code execution | 🔴 Critical | `/survey`                                  |
| 2 | Sensitive credentials exposed through container environment variables                              | 🔴 Critical | Container runtime environment              |
| 3 | Credential reuse enabled pivoting from container context to host SSH access                        | 🟠 High     | SSH / host authentication                  |
| 4 | Writable bind mount between container and host broke isolation boundaries                          | 🔴 Critical | `/var/www/html/survey` ↔ `/opt/limesurvey` |
| 5 | Root in container could plant a SUID binary for full host compromise                               | 🔴 Critical | Shared host-mounted application directory  |

**Severity Scale:**
`🔴 Critical` → `🟠 High` → `🟡 Medium` → `🔵 Low` → `⚪ Info`

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

* Access to the LimeSurvey administrative interface followed by plugin upload activity.
* Installation of an untrusted plugin archive.
* Direct HTTP requests to `/survey/upload/plugins/ExampleSettings/payload.php`.
* Reverse shell traffic from the container to an external IP/port.
* SSH authentication as `limesvc` from an unusual source.
* Use of `sudo` by the application account inside the container.
* Creation of an unexpected SUID binary under `/opt/limesurvey`.

### 10.2 Security Weaknesses

* Internet-facing vulnerable LimeSurvey deployment.
* Dangerous authenticated plugin upload functionality left exploitable.
* Sensitive secrets stored in container environment variables.
* Credential reuse between application/container and host accounts.
* Insecure writable bind mount between host and container.
* Excessive privileges available to the application user inside the container.

### 10.3 Hardening Recommendations

| Priority   | Recommendation                                                                                | Finding       |
| ---------- | --------------------------------------------------------------------------------------------- | ------------- |
| Immediate  | Patch or remove the vulnerable LimeSurvey instance; disable plugin abuse paths where possible | Finding 1     |
| Immediate  | Rotate all exposed credentials and remove secrets from environment variables                  | Findings 2, 3 |
| Immediate  | Eliminate password reuse between app, container, and host accounts                            | Finding 3     |
| Immediate  | Remove or restrict writable bind mounts between host and container                            | Findings 4, 5 |
| Short-term | Remove unnecessary `sudo` access inside containers                                            | Findings 4, 5 |
| Short-term | Enforce least privilege on host-mounted application directories                               | Findings 4, 5 |
| Long-term  | Implement container hardening, secret management, and runtime monitoring                      | All findings  |

---

## 11. Lessons Learned

* A container foothold is not the same as host compromise, but shared writable bind mounts can completely destroy that boundary.
* Environment variable leaks are often more dangerous than config-file leaks because they expose live credentials that may be reused elsewhere.
* Authenticated plugin functionality in web applications is high-risk and should be treated as a code-execution surface, especially in administrative panels.
* Dockerized deployments still require host-side permission hygiene; isolation is only as strong as the mount and privilege model.

---
*End of Report*
*Classification: Public  flags and sensitive values omitted*
