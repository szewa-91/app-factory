# TRIAGE Status & Agent Role Assignment - Implementation Complete

**Date**: 2026-03-04
**Status**: ✅ Fully Implemented & Tested

## Overview
Successfully implemented a TRIAGE status and intelligent agent role assignment system that automatically classifies new tasks based on difficulty and type, then routes them to the most appropriate agent.

## What Was Implemented

### 1. New Task Status: TRIAGE
- **Flow**: CREATED → TRIAGE → READY/PENDING_APPROVAL
- Tasks are automatically promoted from CREATED to TRIAGE during scheduler cycles
- Triage engine evaluates each task and assigns an appropriate agent role
- High-difficulty tasks are moved to PENDING_APPROVAL for human review

### 2. New Agent Roles
Three agent roles with optimized model chains:

#### ui-developer
- For UI/frontend tasks with low-to-medium difficulty
- Chain: Claude Sonnet 4.6 (low effort) → Gemini 3-Flash
- Identified by keywords: ui, frontend, component, css, style, button, layout, modal, form, page, design

#### architect
- For complex architecture, infrastructure, and system design tasks
- Chain: GPT-5.3-Codex (high effort) → Claude Sonnet 4.6 (high effort) → Gemini 3.1 Pro
- Identified by: architect, schema, database, migration, infrastructure, deploy, docker, api design, system, integration, security, auth
- Required for high-difficulty + priority ≥8 tasks

#### developer (default)
- For general implementation tasks
- Chain: Claude Sonnet 4.6 → GPT-5.2-Codex → Gemini 3.1 Pro

### 3. Intelligent Triage Algorithm
**Difficulty Scoring**:
- **Low**: Priority 0-3 AND description < 200 characters
- **High**: Priority ≥8 OR description > 800 characters OR contains complex keywords (complex, refactor, migrate, architecture, redesign)
- **Medium**: Everything else

**Role Assignment**:
- If UI keywords + low/medium difficulty → `ui-developer`
- If Architecture keywords + (high difficulty OR priority ≥8) → `architect`
- Otherwise → `developer`

## Files Modified

### Scheduler (TypeScript)
- `scripts/scheduler/src/types.ts` - Added TRIAGE status enum
- `scripts/scheduler/src/agent-runner.ts` - Added ui-developer and architect role chains
- `scripts/scheduler/src/db.ts` - Added assigned_agent field, triage queries, and assignment methods
- `scripts/scheduler/src/scheduler.ts` - Updated task promotion flow to handle TRIAGE
- `scripts/scheduler/src/triage.ts` (**NEW**) - Core triage classification logic

### Dashboard
- `apps/factory-dashboard/prisma/schema.prisma` - Added assigned_agent and audit_notes fields
- `apps/factory-dashboard/app/components/KanbanBoard.tsx` - Added TRIAGE column (indigo), separated CREATED column
- `apps/factory-dashboard/app/components/TaskDetailModal.tsx` - Display assigned_agent in task details

### Database
- `factory.db` - Updated tasks table schema with TRIAGE status and assigned_agent column

## Testing Results

### Test 1: UI Task (Medium Difficulty)
```
Task: "Test UI Component"
Description: "Create a beautiful button component..." (medium length)
Priority: 5
Result: difficulty=medium, role=ui-developer, status=READY ✅
```

### Test 2: Architecture Task (High Difficulty)
```
Task: "Architect Database Schema Migration"
Description: Long description with architecture/migration/infrastructure keywords (>800 chars)
Priority: 10
Result: difficulty=high, role=architect, status=PENDING_APPROVAL ✅
```

## System Behavior

1. **Task Creation**: New task inserted with status=CREATED
2. **Promotion Phase**: Scheduler promotes CREATED → TRIAGE
3. **Triage Phase**: Scheduler evaluates task and assigns agent role
4. **Assignment**: `assigned_agent` field set, task moved to READY or PENDING_APPROVAL
5. **Execution**: Agent selected at runtime from assigned_agent field
6. **Audit**: All changes audited and logged

## Dashboard Updates
- TRIAGE column displays pending triage tasks (indigo)
- CREATED column shows newly created tasks awaiting promotion (gray)
- TaskDetailModal shows assigned agent role
- All existing columns maintained (TODO, PENDING_APPROVAL, IN_PROGRESS, AUDITING, SUCCESS, FAILURE)

## Backward Compatibility
✅ Fully backward compatible:
- Existing tasks continue to work
- CREATED status still supported
- All previous agent roles (developer, auditor, launchNotes) maintained
- Database migration preserves all existing data

## Next Steps / Monitoring
1. Monitor scheduler logs for triage classifications
2. Track agent role distribution to optimize model chains
3. Adjust difficulty thresholds based on task execution patterns
4. Consider adding user feedback for triage accuracy improvement

## Commits
- `197ea29` - feat: Add TRIAGE status and agent role assignment system (scheduler)
- `604cf96` - feat: Add TRIAGE column and assigned_agent display to dashboard
