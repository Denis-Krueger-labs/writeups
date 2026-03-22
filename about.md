---
layout: default
title: About
description: "Denis Krüger — Information Security student at THWS Würzburg, focused on offensive security and attack chain construction."
---

<div class="about-page">

<header class="about-header reveal">
  <div class="about-header-inner">
    <div class="about-moth" aria-hidden="true">{% include moth.svg %}</div>
    <div class="about-intro">
      <div class="about-handle">0N1S3C</div>
      <h1 class="about-name">Denis Krüger</h1>
      <p class="about-bio">Information Security student at THWS Würzburg, focused on offensive security and understanding how attack chains are constructed end-to-end. I value understanding <em>why</em> an exploit works — not just how to reproduce it.</p>
      <div class="about-links">
        <a href="{{ site.author.htb }}" class="btn btn-ghost" target="_blank" rel="noopener">HackTheBox</a>
        <a href="{{ site.author.thm }}" class="btn btn-ghost" target="_blank" rel="noopener">TryHackMe</a>
        <a href="{{ site.author.github }}" class="btn btn-ghost" target="_blank" rel="noopener">GitHub</a>
      </div>
    </div>
  </div>
</header>

<div class="about-content" markdown="1">

<section class="about-section reveal" markdown="1">

## About

I approach security through structured reconnaissance, deep enumeration, and controlled exploitation in lab environments.

Currently working through TryHackMe and HackTheBox alongside my studies, with a focus on building practical skills in web application testing, privilege escalation, and attack documentation.

**Interests:**
- Web Application Exploitation
- Linux & Windows Privilege Escalation
- Wireless & Network Attack Surface Analysis
- Embedded & IoT Security
- Active Directory Fundamentals

</section>

<section class="about-section reveal" markdown="1">

## Projects

### [pwgen-lite](https://github.com/Denis-Krueger-labs/pwgen-lite) — Python

Minimal CLI password generator built around secure randomness and cryptographic correctness. Implements `secrets`-based generation, HMAC-SHA256 deterministic mode with rejection sampling to avoid modulo bias, entropy estimation, and brute-force time modelling. Includes a full pytest suite and proper exit codes.

### [mfind](https://github.com/Denis-Krueger-labs/mfind) — C

Simplified reimplementation of the Unix `find` utility, written in C as part of a university systems programming project. Supports recursive directory traversal, name/type/size/depth filtering, and optional parallel traversal across start directories using POSIX threads. Verified memory-safe with Valgrind (zero leaks).

### [writeups](https://github.com/Denis-Krueger-labs/writeups)

Structured technical reports documenting lab-based security assessments. Each writeup follows a standardized methodology covering reconnaissance, exploitation, privilege escalation, and defensive considerations.

</section>

<section class="about-section reveal" markdown="1">

## Assessment Workflow

```
Reconnaissance → Enumeration → Vulnerability ID → Exploitation → Privesc → Documentation
```

</section>

<section class="about-section reveal" markdown="1">

## Practice Platforms

<a href="https://tryhackme.com/p/0N1S3C">
  <img src="https://tryhackme-badges.s3.amazonaws.com/0N1S3C.png?v=5"
       alt="TryHackMe Badge"
       width="350" />
</a>
<br><br>
<a href="https://app.hackthebox.com/public/users/3188353">
  <img src="https://www.hackthebox.eu/badge/image/3188353"
       alt="HackTheBox Badge"
       width="350" />
</a>

</section>

<section class="about-section reveal" markdown="1">

## Tools & Technologies

| Category | Tools |
|----------|-------|
| Languages | Python · C · Bash · Java · SQL |
| Security | Kali Linux · Burp Suite · Nmap · Gobuster · ffuf · SQLMap · Metasploit · Wireshark |
| Systems | Linux · Git |

</section>

<section class="about-section reveal" markdown="1">

## Certification Path

```
[Current]  Bachelor of Information Security @ THWS Würzburg
           ↓
[Next]     CWES (Certified Web Exploitation Specialist)
           ↓
[Then]     CWEE (Certified Web Exploitation Expert)
           ↓
[Goal]     CPTS (Certified Penetration Testing Specialist)
```

</section>

<section class="about-section reveal" markdown="1">

## Disclaimer

All activities documented in this repository were conducted exclusively within authorized lab environments (HackTheBox and TryHackMe). No real-world systems were accessed or harmed. Flags and sensitive credential values have been redacted from all reports.

*Full versions with flags are published after box retirement.*

> ᓚ₍⑅^..^₎♡ just enumerating quietly

</section>

</div>
</div>
