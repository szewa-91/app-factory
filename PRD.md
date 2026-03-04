# PRD - App Factory Infrastructure (Canonical Root Context)

## 1. Problem
Scheduler prompts for `app-factory` tasks frequently reference root `PRD.md` for context. When root docs drift into a one-off initiative, agents lose canonical intent and produce inconsistent infrastructure changes.

## 2. Goal
Maintain root-level `PRD.md` and `SPECS.md` as the stable product and technical source of truth for App Factory infrastructure.

## 3. Users
- Platform owner operating the VPS-hosted factory.
- Headless Developer/Auditor agents executing `factory.db` tasks.

## 4. In Scope
- Canonical root context for scheduler/bootstrap/dashboard/verification systems.
- Explicit runtime contracts for task lifecycle, safety rails, and documentation sync.
- Security baseline for dashboard authentication and admin credential handling.

## 5. Out of Scope
- Per-application product requirements (these belong in each app's own `PRD.md`/`SPECS.md`).
- Redesign of task statuses, deployment topology, or vision principles.

## 6. Functional Requirements
1. Root `PRD.md` describes App Factory infrastructure mission, boundaries, and outcomes.
2. Root `SPECS.md` defines canonical architecture, schema, API contracts, and task decomposition flow.
3. Dashboard authentication must use signed session verification, not cookie presence checks.
4. Dashboard login must fail closed when `ADMIN_PASSWORD` is unset.
5. Root docs must capture deterministic API error behavior (for example, `PATCH /api/projects/:name` returns `404` for missing projects).
6. If infrastructure behavior changes, `README.md` and `GEMINI.md` are updated in the same task.

## 7. Non-Functional Requirements
- Security: no predictable auth tokens or insecure default credentials in production paths.
- Reliability: scheduler flow and verification entrypoints remain deterministic and auditable.
- Maintainability: root docs remain concise, implementation-linked, and aligned with runtime behavior.

## 8. Success Criteria
- Root `PRD.md` and `SPECS.md` consistently describe the factory control plane.
- Scheduler prompt assumption "Refer to PRD.md for full context" remains valid.
- Audits find no critical contract drift between docs and runtime behavior for infra changes.
