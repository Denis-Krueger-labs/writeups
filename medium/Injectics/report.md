---
layout: writeup
title: "Injectics"
platform: THM
os: "Linux"
date: 2026-03-14
techniques: ["SQL Injection", "Authentication Bypass", "Server-Side Template Injection", "Twig Sandbox Escape", "Database Manipulation"]
cve: []
description: "Multi-stage injection room exploiting SQLi authentication bypass, database restoration logic, and Twig SSTI sandbox escape via overlooked sort filter"
---

# Injectics — Technical Report

> **Platform:** TryHackMe \
> **Difficulty:** `Medium` \
> **Date:** 2026-03-14 \
> **Author:** 0N1S3C \
> **Scope:** Authorized lab environment only 

---

## 0. Executive Summary

The "Injectics" machine was found to contain multiple critical injection vulnerabilities across authentication, database logic, and template rendering layers. An unauthenticated attacker could exploit SQL injection in the login mechanism to bypass authentication, manipulate database state to trigger credential restoration, and achieve remote code execution through Server-Side Template Injection (SSTI) in Twig. The attack chain demonstrates how layered vulnerabilities can be chained together to achieve complete system compromise. Immediate remediation of input validation, parameterized queries, and template engine sandboxing is required.

---

## 1. Introduction

This report documents the structured analysis and controlled exploitation of the **"Injectics"** machine on TryHackMe.

**Objectives:**
- Bypass authentication mechanisms
- Obtain administrative panel access
- Retrieve hidden flag files via SSTI

**Methodology:** Assessments follow the standardized approach defined in `methodology.md`.

---

## 2. Attack Chain
