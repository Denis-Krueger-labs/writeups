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
      <div class="about-handle">0N1S3C2</div>
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

<div class="about-content">

<section class="about-section reveal">

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

<section class="about-section reveal">

## Projects

### [pwgen-lite](https://github.com/Denis-Krueger-labs/pwgen-lite) — Python

Minimal CLI password generator built around secure randomness and cryptographic correctness. Implements `secrets`-based generation, HMAC-SHA256 deterministic mode with rejection sampling to avoid modulo bias, entropy estimation, and brute-force time modelling. Includes a full pytest suite and proper exit codes.

### [mfind](https://github.com/Denis-Krueger-labs/mfind) — C

Simplified reimplementation of the Unix `find` utility, written in C as part of a university systems programming project. Supports recursive directory traversal, name/type/size/depth filtering, and optional parallel traversal across start directories using POSIX threads. Verified memory-safe with Valgrind (zero leaks).

### [writeups](https://github.com/Denis-Krueger-labs/writeups)

Structured technical reports documenting lab-based security assessments. Each writeup follows a standardized methodology covering reconnaissance, exploitation, privilege escalation, and defensive considerations.

</section>

<section class="about-section reveal">

## Assessment Workflow

```
Reconnaissance → Enumeration → Vulnerability ID → Exploitation → Privesc → Documentation
```

</section>

<section class="about-section reveal">

## Practice Platforms

<div class="platform-badges">
  <a href="https://tryhackme.com/p/0N1S3C" target="_blank" rel="noopener">
    <img src="https://tryhackme-badges.s3.amazonaws.com/0N1S3C.png?v=3" alt="TryHackMe Badge" />
  </a>
  <a href="https://app.hackthebox.com/public/users/3188353" target="_blank" rel="noopener">
    <img src="https://www.hackthebox.eu/badge/image/3188353" alt="HackTheBox Badge" />
  </a>
</div>

</section>

<section class="about-section reveal">

## Tools & Technologies

| Category | Tools |
|----------|-------|
| Languages | Python · C · Bash · Java · SQL |
| Security | Kali Linux · Burp Suite · Nmap · Gobuster · ffuf · SQLMap · Metasploit · Wireshark |
| Systems | Linux · Git |

</section>

<section class="about-section reveal">

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

<section class="about-section reveal">

## Disclaimer

All activities documented in this repository were conducted exclusively within authorized lab environments (HackTheBox and TryHackMe). No real-world systems were accessed or harmed. Flags and sensitive credential values have been redacted from all reports.

*Full versions with flags are published after box retirement.*

> ᓚ₍⑅^..^₎♡ just enumerating quietly

</section>

</div>
</div>

<style>
.about-page { padding-top: 64px; }

.about-header {
  background: #010103;
  border-bottom: 1px solid rgba(90,40,160,0.5);
  border-top: 2px solid rgba(61,16,112,0.8);
  padding: 4rem 1.5rem 3rem;
}
.about-header-inner {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 3rem;
}
@media (max-width: 640px) {
  .about-header-inner { flex-direction: column; text-align: center; }
}
.about-moth {
  flex-shrink: 0;
  opacity: 0.55;
  filter: drop-shadow(0 0 16px rgba(100,30,200,0.4));
  animation: mothFloat 9s ease-in-out infinite;
}
.about-moth .moth-hero { width: 160px; height: auto; }
@media (max-width: 640px) { .about-moth .moth-hero { width: 100px; } }
.about-handle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #5b21b6;
  margin-bottom: 0.6rem;
}
.about-handle::before { content: '// '; color: #3d1070; }
.about-name {
  font-family: 'Cinzel', serif;
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ede8ff;
  margin-bottom: 1rem;
}
.about-bio {
  color: #9d8ab8;
  font-size: 0.92rem;
  line-height: 1.75;
  margin-bottom: 1.5rem;
  max-width: 520px;
  font-family: 'JetBrains Mono', monospace;
  border-left: 2px solid #3d1070;
  padding-left: 1rem;
}
.about-links { display: flex; gap: 0; flex-wrap: wrap; border: 1px solid rgba(90,40,160,0.5); width: fit-content; }
.about-links .btn { border: none; border-right: 1px solid rgba(90,40,160,0.5); }
.about-links .btn:last-child { border-right: none; }

.platform-badges {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  align-items: flex-start;
  margin-top: 0.5rem;
}
.platform-badges img {
  filter: brightness(0.9) contrast(1.05);
  border: 1px solid rgba(90,40,160,0.3);
  max-width: 350px;
}

.about-content {
  max-width: 860px;
  margin: 0 auto;
  padding: 3rem 1.5rem 5rem;
}

.about-section {
  margin-bottom: 3rem;
  padding-bottom: 3rem;
  border-bottom: 1px solid rgba(61,16,112,0.25);
}
.about-section:last-child { border-bottom: none; }

.about-section h2 {
  font-family: 'Cinzel', serif;
  font-size: 1.1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #9d8ab8;
  margin-bottom: 1.25rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(61,16,112,0.4);
  padding-left: 0.75rem;
  border-left: 3px solid #3d1070;
}
.about-section h3 {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.88rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #a855f7;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}
.about-section p { color: #9d8ab8; font-size: 0.92rem; line-height: 1.8; }
.about-section li { color: #9d8ab8; font-size: 0.92rem; line-height: 1.8; }
.about-section strong { color: #ede8ff; }
.about-section em { color: #a855f7; font-style: italic; }

.about-section ul {
  list-style: none;
  padding: 0;
}
.about-section ul li {
  padding: 0.3rem 0;
  padding-left: 1.25rem;
  position: relative;
}
.about-section ul li::before {
  content: '◆';
  position: absolute;
  left: 0;
  color: #3d1070;
  font-size: 0.45rem;
  top: 0.65rem;
}

.about-section table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.86rem;
  border: 1px solid rgba(61,16,112,0.4);
}
.about-section th {
  background: rgba(26,8,64,0.6);
  color: #5a4d6e;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.65rem 1rem;
  text-align: left;
  border-bottom: 1px solid rgba(90,40,160,0.4);
}
.about-section td {
  padding: 0.6rem 1rem;
  color: #9d8ab8;
  border-bottom: 1px solid rgba(61,16,112,0.15);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.82rem;
}
.about-section tr:last-child td { border-bottom: none; }

.about-section pre {
  background: #050510;
  border: 1px solid rgba(61,16,112,0.4);
  border-left: 3px solid #3d1070;
  border-radius: 0;
  padding: 1.25rem;
  overflow-x: auto;
}
.about-section pre code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.81rem;
  color: #b39ddb;
}
.about-section a { color: #7c3aed; }
.about-section a:hover { color: #a855f7; }

blockquote {
  border-left: 2px solid #3d1070;
  padding: 0.6rem 1rem;
  margin: 1.5rem 0 0;
  background: transparent;
}
blockquote p {
  color: #5a4d6e !important;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.82rem !important;
}
</style>
