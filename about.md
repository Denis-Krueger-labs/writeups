---
layout: default
title: About
description: "About 0N1S3C2 — Denis, Information Security student at THWS Würzburg, red teamer, HTB/THM top-tier."
---

<div class="about-page">

<header class="about-header reveal">
  <div class="about-header-inner">
    <div class="about-moth" aria-hidden="true">{% include moth.svg %}</div>
    <div class="about-intro">
      <div class="about-handle">0N1S3C2</div>
      <h1 class="about-name">Denis</h1>
      <p class="about-bio">Information Security student at THWS Würzburg. I document every machine I solve — not just the flags, but <em>why</em> vulnerabilities exist and how defenders can detect them.</p>
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

## Focus Areas

- **Web Exploitation** — SQLi, SSTI, LFI/RFI, business logic flaws, authentication bypasses
- **Privilege Escalation** — sudo misconfigurations, SUID binaries, cronjob hijacking, GTFOBins
- **Active Directory** — Kerberoasting, Pass-the-Hash, BadSuccessor, MSSQL impersonation chains
- **CVE Research** — understanding root causes, not just running PoCs
- **Defensive Analysis** — every exploit comes with IOCs and hardening recommendations

</section>

<section class="about-section reveal">

## Report Format

Every writeup follows the same structured methodology — reproducible, technical, and defensive-minded:

| Section | Purpose |
|---------|---------|
| Executive Summary | High-level impact assessment |
| Attack Chain | Visual flow from recon to root |
| Detailed Walkthrough | Step-by-step with commands and reasoning |
| Findings Table | Severity-rated vulnerability list |
| Defensive Considerations | IOCs, detection opportunities, hardening |
| Lessons Learned | What I got wrong, what I learned |

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

## Stats

| Platform | Status |
|----------|--------|
| HackTheBox | Premium member · 10+ boxes solved |
| TryHackMe | Top 1% · Gold League #1 · 1,069 pts · 211+ rooms |

</section>

<section class="about-section reveal">

## Methodology

The full assessment framework I use is documented in [methodology.md](https://github.com/Denis-Krueger-labs/writeups/blob/main/mythology.md) in this repository.

**Core principles:**

- **Enumeration-first** — exhaustive service discovery before exploitation
- **Source code analysis** — read actual implementations when documentation isn't enough
- **Defensive thinking** — every exploit includes detection and hardening guidance
- **Documentation rigor** — reproducible steps, sanitized outputs, proper CVE attribution
- **Root cause analysis** — understand *why* vulnerabilities exist, not just *how* to exploit them

</section>

<section class="about-section reveal">

## Disclaimer

All activities documented in this repository were conducted exclusively within authorized lab environments (HackTheBox and TryHackMe). No real-world systems were accessed or harmed. Flags and sensitive credential values have been redacted from all reports.

*Full versions with flags are published after box retirement.*

</section>

</div>
</div>

<style>
.about-page { padding-top: 64px; }

.about-header {
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(46,16,101,0.6) 0%, transparent 70%),
    #0d0d1a;
  border-bottom: 1px solid rgba(168,85,247,0.18);
  padding: 4rem 1.5rem 3rem;
}
.about-header-inner {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 3rem;
  @media (max-width: 640px) { flex-direction: column; text-align: center; }
}
.about-moth {
  flex-shrink: 0;
  opacity: 0.7;
  filter: drop-shadow(0 0 20px rgba(147,51,234,0.5));
  animation: mothFloat 6s ease-in-out infinite;
  .moth-hero { width: 180px; height: auto; }
  @media (max-width: 640px) { .moth-hero { width: 120px; } }
}
.about-handle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  color: #a855f7;
  margin-bottom: 0.4rem;
  &::before { content: '> '; color: #d946ef; }
}
.about-name {
  font-family: 'Cinzel', serif;
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 700;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, #f0e6ff, #c084fc, #d946ef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
}
.about-bio {
  color: #b8a0d0;
  font-size: 1rem;
  line-height: 1.7;
  margin-bottom: 1.5rem;
  max-width: 520px;
}
.about-links { display: flex; gap: 0.75rem; flex-wrap: wrap; }

.about-content {
  max-width: 860px;
  margin: 0 auto;
  padding: 3rem 1.5rem 5rem;
}

.about-section {
  margin-bottom: 3rem;

  h2 {
    font-family: 'Cinzel', serif;
    font-size: 1.3rem;
    letter-spacing: 0.05em;
    color: #c084fc;
    margin-bottom: 1.25rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(168,85,247,0.18);
  }
  p, li { color: #b8a0d0; font-size: 0.94rem; line-height: 1.75; }
  strong { color: #f0e6ff; }
  em { color: #c084fc; font-style: italic; }

  ul {
    list-style: none;
    padding: 0;
    li {
      padding: 0.35rem 0;
      padding-left: 1.25rem;
      position: relative;
      &::before { content: '◆'; position: absolute; left: 0; color: #7c3aed; font-size: 0.5rem; top: 0.6rem; }
    }
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    font-size: 0.88rem;
    th {
      background: rgba(74,28,122,0.25);
      color: #c084fc;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 0.65rem 1rem;
      text-align: left;
      border-bottom: 1px solid rgba(168,85,247,0.18);
    }
    td {
      padding: 0.6rem 1rem;
      color: #b8a0d0;
      border-bottom: 1px solid rgba(168,85,247,0.06);
    }
    tr:last-child td { border-bottom: none; }
  }

  pre {
    background: #0a0618;
    border: 1px solid rgba(109,40,217,0.35);
    border-radius: 10px;
    padding: 1.25rem;
    overflow-x: auto;
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
      color: #c4b5fd;
    }
  }

  a { color: #a855f7; &:hover { color: #c084fc; } }
}
</style>
