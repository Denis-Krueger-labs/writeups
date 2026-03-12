---
layout: writeup
title: "CTF Collection Vol.2"
platform: THM
os: Web
techniques: ["multi-layer encoding", "cookie tampering", "time-based SQLi", "HTTP method abuse"]
description: "Multi-challenge CTF covering encoding layers, cookie manipulation, blind SQLi, and HTTP verb tampering."
---

# Reflection - Lessons Learned from CTF Collection Vol.2

CTF Collection Vol.2 was an extremely valuable learning experience, but it presented unique challenges when considering it as a structured portfolio write-up.

## What I Learned

This room forced me to practice and combine multiple web exploitation techniques, including:

- Multi-layer encoding analysis (Base64, URL decoding, hex)
- Inspecting and manipulating HTTP headers
- Cookie tampering
- Custom request crafting using curl and Burp Suite
- Time-based blind SQL injection
- Database enumeration using sqlmap
- Hash cracking (MD5)
- Authentication testing
- HTTP method abuse (POST vs GET logic flaws)
- Analyzing page source and hidden HTML elements
- Understanding how server-side logic reacts to custom headers and parameters

Most importantly, this room strengthened my ability to:
- Think laterally when standard exploitation methods failed
- Pivot between techniques when stuck
- Manually inspect and manipulate HTTP traffic
- Recognize how small logic flaws can expose sensitive information

It reinforced the idea that web exploitation is not always about one critical vulnerability, but often about chaining small weaknesses together.

---

## Why It Was Great for Skill Development

This challenge encouraged experimentation. Many of the flags required:

- Testing assumptions
- Observing server behavior closely
- Trying unconventional approaches (custom headers, hidden parameters)
- Moving between automation (sqlmap) and manual testing

It simulated real-world web application testing in the sense that:
- Not everything is obvious
- Vulnerabilities can be subtle
- Enumeration and patience are critical

It significantly improved my confidence in interacting directly with web applications at the HTTP level.

---

## Why It Is Difficult to Present as a Clean Report

Although the room was highly educational, it is difficult to structure as a polished portfolio case study for several reasons:

1. The room is heavily “Easter egg” driven rather than following a linear exploitation path.
2. The challenges are fragmented into many small, independent discoveries.
3. There is no single coherent attack chain (e.g., recon → exploit → privilege escalation).
4. Many flags are obtained through isolated logic puzzles rather than realistic vulnerability exploitation.
5. The overall narrative can appear chaotic when documented step-by-step.

For a professional portfolio, clarity and structured methodology are important. Employers typically look for:

- Clear enumeration methodology
- Vulnerability identification
- Exploitation explanation
- Impact assessment
- Remediation suggestions

CTF Collection Vol.2 excels as a skill-building sandbox but does not naturally translate into a clean, linear penetration testing case study.

---

## Conclusion

CTF Collection Vol.2 was highly effective for strengthening practical web exploitation skills and building confidence in HTTP-level testing.

However, due to its non-linear and puzzle-based structure, it is better suited as a learning exercise rather than a flagship portfolio report.

For future portfolio pieces, I plan to focus on challenges that demonstrate a clearer end-to-end exploitation workflow and structured methodology.
