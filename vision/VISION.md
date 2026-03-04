# App Factory - Core Vision & Principles

This document is the absolute anchor for the App Factory project. It defines what this system is, what it must remain, and what boundaries must never be crossed by autonomous agents modifying the system.

## 🌟 The Core Objective
App Factory is a fully autonomous, VPS-hosted environment designed to bootstrap, develop, deploy, and maintain Next.js web applications. It operates via headless AI agents coordinated by a centralized, local task scheduler.

## ⚓ Unchangeable Principles (The Anchor)
1. **Local & Self-Contained:** The system must run entirely on the provided VPS using local tools (Bash, SQLite, Docker, native Gemini CLI). It must NOT depend on external proprietary orchestration services (no external CI/CD pipelines, no cloud databases).
2. **Zero-Port & Traefik First:** All applications must run within Docker, listening internally on port 3000, and exposed securely via Traefik labels using the `coolify` network.
3. **SQLite Task Queue:** The single source of truth for all work is `factory.db`. This database orchestrates what happens and when. It must remain simple and file-based.
4. **Resilience over Complexity:** The system should favor simple, robust bash scripts (`scheduler.sh`, `bootstrap.sh`, `deploy.sh`) over complex Node.js or Python daemons for core operations.
5. **Continuous Documentation:** The system must actively maintain its own documentation (`README.md`, `GEMINI.md`, `docs/`) to reflect its current state.

## 🛡️ The Git Safety Net
To prevent catastrophic drift during self-improvement:
- Every completed task MUST result in an atomic Git commit.
- If a system-level task fails verification (e.g., breaks the scheduler or core UI), the system MUST revert the offending commit to return to a known good state.

*Agents reading this: You may evolve the HOW, but you must never change the WHAT defined in this document without explicit human authorization.*