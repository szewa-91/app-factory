#!/bin/bash
# App Factory - Bootstrap Script
# Usage: ./bootstrap.sh <app-name> <domain>

set -Eeuo pipefail
IFS=$'\n\t'

WORKSPACE_DIR="/home/szewa/app-factory"
DB_FILE="$WORKSPACE_DIR/factory.db"
GEMINI_BIN="/home/szewa/.npm-global/bin/gemini"
CODEX_BIN="/home/szewa/.npm-global/bin/codex"
APP_PORT=3000

APP_NAME="${1:-}"
DOMAIN="${2:-}"
APP_DIR="$WORKSPACE_DIR/apps/$APP_NAME"
PROJECT_REGISTERED=0
APP_DIR_CREATED=0
BOOTSTRAP_SUCCESS=0

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*"
}

usage() {
    echo "Usage: ./bootstrap.sh <app-name> <domain>"
    echo "Optional: APP_FACTORY_SKIP_AI_DECOMPOSITION=1 to always seed baseline SPECS/tasks."
    echo "Optional: APP_FACTORY_BOOTSTRAP_SMOKE_VERIFY=1 to run deploy+verify before final commit."
    echo "Optional: APP_FACTORY_SKIP_PUBLIC_HTTPS_PROBE=1 to skip external TLS probe during smoke verify."
    exit 1
}

require_cmd() {
    local cmd="$1"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "ERROR: Required command not found: $cmd"
        exit 1
    fi
}

sql_escape() {
    printf "%s" "$1" | sed "s/'/''/g"
}

sed_escape() {
    printf "%s" "$1" | sed -e 's/[\\/&]/\\&/g'
}

ensure_file_exists() {
    local file="$1"
    if [ ! -f "$file" ]; then
        echo "ERROR: Required file missing: $file"
        exit 1
    fi
}

assert_no_template_tokens() {
    local file="$1"
    if grep -Eq '\$\{(APP_NAME|DOMAIN|APP_PORT)\}' "$file"; then
        echo "ERROR: Unresolved template token detected in $file"
        exit 1
    fi
}

add_gitignore_line() {
    local line="$1"
    if ! grep -qxF "$line" .gitignore; then
        echo "$line" >> .gitignore
    fi
}

ensure_git_identity() {
    if ! git config user.name >/dev/null 2>&1; then
        git config user.name "App Factory"
    fi
    if ! git config user.email >/dev/null 2>&1; then
        git config user.email "app-factory@local"
    fi
}

validate_smoke_prereqs() {
    if [ "${APP_FACTORY_BOOTSTRAP_SMOKE_VERIFY:-0}" != "1" ]; then
        return
    fi

    require_cmd docker
    if ! docker compose version >/dev/null 2>&1; then
        echo "ERROR: APP_FACTORY_BOOTSTRAP_SMOKE_VERIFY=1 requires the docker compose plugin."
        exit 1
    fi
    if ! docker network inspect coolify >/dev/null 2>&1; then
        echo "ERROR: APP_FACTORY_BOOTSTRAP_SMOKE_VERIFY=1 requires Docker network 'coolify'."
        exit 1
    fi
}

insert_task() {
    local title="$1"
    local priority="$2"
    local description="$3"
    local depends_on="${4:-}"
    local now title_esc desc_esc dep_esc project_esc dep_sql

    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    title_esc=$(sql_escape "$title")
    desc_esc=$(sql_escape "$description")
    project_esc=$(sql_escape "$APP_NAME")

    if [ -n "$depends_on" ]; then
        dep_esc=$(sql_escape "$depends_on")
        dep_sql="'$dep_esc'"
    else
        dep_sql="NULL"
    fi

    sqlite3 "$DB_FILE" "
        INSERT INTO tasks (
            project_name, title, status, priority, description,
            created_at, updated_at, retry_count, depends_on
        ) VALUES (
            '$project_esc', '$title_esc', 'CREATED', $priority, '$desc_esc',
            '$now', '$now', 0, $dep_sql
        );
        SELECT last_insert_rowid();
    "
}

create_default_prd_if_missing() {
    if [ -f "$WORKSPACE_DIR/PRD.md" ] || [ -f "PRD.md" ]; then
        return
    fi

    log "📄 No PRD.md found in root/app. Creating an app-local PRD baseline."
    cat > PRD.md <<'PRD'
# Product Requirements Document - __APP_NAME__

## Vision
Build a production-ready MVP for **__DOMAIN__** with a conversion-focused landing page and durable waitlist capture.

## MVP Scope
- Branded landing page with clear value proposition.
- Email waitlist capture form with validation and duplicate protection.
- Persist signups to SQLite via Prisma.
- Reliable deployment and verification pipeline for autonomous execution.

## Non-Goals (MVP)
- Authentication and user dashboards.
- Payments and billing.
- Multi-tenant administration.

## Success Metrics
- Waitlist API accepts valid emails and rejects invalid/duplicate requests.
- `./deploy.sh` and `./verify.sh` pass in clean environments.
- The public app is reachable over HTTPS on __DOMAIN__.
PRD
    local prd_app_escaped prd_domain_escaped
    prd_app_escaped=$(sed_escape "$APP_NAME")
    prd_domain_escaped=$(sed_escape "$DOMAIN")
    sed -i "s/__APP_NAME__/$prd_app_escaped/g" PRD.md
    sed -i "s/__DOMAIN__/$prd_domain_escaped/g" PRD.md
}

create_baseline_specs_and_tasks() {
    log "🧩 Seeding deterministic SPECS.md and atomic task set."

    cat > SPECS.md <<'SPECS'
# SPECS - __APP_NAME__

## Architecture
- Framework: Next.js App Router (TypeScript) in standalone mode.
- Database: SQLite (`data/prod.db`) via Prisma.
- Deployment: Docker Compose with Traefik labels on `coolify` network.
- Verification: `./verify.sh` as single entrypoint for internal health, unit tests, and E2E.

## Database Schema
- `WaitingList(id Int @id @default(autoincrement()), email String @unique, createdAt DateTime @default(now()))`

## API Endpoints
- `POST /api/waitlist`
  - Body: `{ "email": string }`
  - Responses:
    - `201` created
    - `400` invalid email
    - `409` duplicate email
    - `500` server error

## UI Components
- Landing hero and value proposition.
- Waitlist form with loading/success/error states.

## Task Decomposition
1. Finalize Prisma schema and migration.
2. Implement waitlist API route with validation and duplicate handling.
3. Build landing page form flow and API integration.
4. Expand unit and E2E tests for core journey.
5. Verify deploy/verify scripts in Docker + HTTPS path.
6. Prepare launch notes and usage guidance.
SPECS
    local specs_app_escaped
    specs_app_escaped=$(sed_escape "$APP_NAME")
    sed -i "s/__APP_NAME__/$specs_app_escaped/g" SPECS.md

    local existing_count
    existing_count=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM tasks WHERE project_name = '$(sql_escape "$APP_NAME")';")
    if [ "$existing_count" -gt 0 ]; then
        log "ℹ️ Tasks already exist for $APP_NAME; keeping existing decomposition."
        return
    fi

    local t1 t2 t3 t4 t5
    t1=$(insert_task "Finalize Prisma schema and migration" 8 "Create and validate baseline migration for waitlist persistence.")
    t2=$(insert_task "Implement waitlist API route" 8 "Implement POST /api/waitlist with input validation and duplicate protection." "$t1")
    t3=$(insert_task "Build landing page waitlist UX" 7 "Implement client form states and API integration without placeholder copy." "$t2")
    t4=$(insert_task "Expand automated tests" 7 "Add unit and Playwright tests for waitlist happy-path and failure cases." "$t3")
    t5=$(insert_task "Validate deployment and verification flow" 9 "Run deploy and verify workflows and document operational checks." "$t4")
    insert_task "Prepare launch guidance" 5 "Update LAUNCH.md with user-facing release notes." "$t5" >/dev/null
}

run_design_phase() {
    local project_esc start_count end_count prompt
    local design_ok=0

    if [ "${APP_FACTORY_SKIP_AI_DECOMPOSITION:-0}" == "1" ]; then
        log "🧩 APP_FACTORY_SKIP_AI_DECOMPOSITION=1; using deterministic SPECS/task baseline."
        create_baseline_specs_and_tasks
        return
    fi

    project_esc=$(sql_escape "$APP_NAME")
    start_count=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM tasks WHERE project_name = '$project_esc';")

    prompt="You have just bootstrapped app '$APP_NAME' for '$DOMAIN'. Read PRD.md (workspace root or current dir if present). Create SPECS.md with database schema, API endpoints, and a detailed task breakdown. Insert 5-10 atomic tasks into ../../factory.db for project '$APP_NAME' with status 'CREATED' and dependency sequencing in depends_on."

    if [ -x "$GEMINI_BIN" ]; then
        log "🧠 Design phase: attempting Gemini decomposition."
        if timeout 12m "$GEMINI_BIN" --yolo "$prompt"; then
            design_ok=1
        else
            log "⚠️ Gemini decomposition failed; trying fallback."
        fi
    fi

    if [ "$design_ok" -eq 0 ] && [ -x "$CODEX_BIN" ]; then
        log "🧠 Design phase: using Codex fallback decomposition."
        if timeout 12m "$CODEX_BIN" exec --dangerously-bypass-approvals-and-sandbox -C "$(pwd)" "$prompt"; then
            design_ok=1
        else
            log "⚠️ Codex decomposition failed; applying deterministic baseline."
        fi
    fi

    end_count=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM tasks WHERE project_name = '$project_esc';")

    if [ "$design_ok" -eq 1 ] && [ -s "SPECS.md" ] && [ "$end_count" -gt "$start_count" ]; then
        log "✅ AI design phase generated SPECS and task decomposition."
        return
    fi

    create_baseline_specs_and_tasks
}

rollback() {
    local exit_code=$?
    if [ "$BOOTSTRAP_SUCCESS" -eq 1 ]; then
        return
    fi

    set +e
    log "❌ Bootstrap failed. Starting failure-atomic rollback..."

    if [ "$PROJECT_REGISTERED" -eq 1 ]; then
        local app_esc
        app_esc=$(sql_escape "$APP_NAME")
        sqlite3 "$DB_FILE" "DELETE FROM tasks WHERE project_name = '$app_esc';"
        sqlite3 "$DB_FILE" "DELETE FROM projects WHERE name = '$app_esc';"
        log "🧹 Rolled back project/tasks from factory.db."
    fi

    if [ "$APP_DIR_CREATED" -eq 1 ] && [ -d "$APP_DIR" ]; then
        rm -rf "$APP_DIR"
        log "🧹 Removed scaffolded app directory $APP_DIR."
    fi

    exit "$exit_code"
}

trap rollback ERR INT TERM

if [ -z "$APP_NAME" ] || [ -z "$DOMAIN" ]; then
    usage
fi

if ! [[ "$APP_NAME" =~ ^[a-z0-9][a-z0-9-]{1,62}$ ]]; then
    echo "ERROR: app-name must match ^[a-z0-9][a-z0-9-]{1,62}$"
    exit 1
fi

if ! [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
    echo "ERROR: domain must look like example.com"
    exit 1
fi

if [ -d "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
    echo "ERROR: $APP_DIR already exists and is not empty."
    exit 1
fi

require_cmd sqlite3
require_cmd git
require_cmd npm
require_cmd npx
validate_smoke_prereqs

log "🚀 Bootstrapping $APP_NAME for $DOMAIN (internal port $APP_PORT)..."

mkdir -p "$APP_DIR"
APP_DIR_CREATED=1
cd "$APP_DIR"

log "🛠️ Initializing Next.js application..."
npx create-next-app@latest . \
    --typescript \
    --tailwind \
    --eslint \
    --app \
    --no-src-dir \
    --import-alias "@/*" \
    --use-npm \
    --yes

log "📦 Installing runtime and testing dependencies..."
npm install @prisma/client@6
npm install -D prisma@6 vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test

log "🧪 Installing Playwright browser..."
npx playwright install chromium

# Testing baseline
cat > vitest.config.ts <<'VITEST'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
VITEST

cat > vitest.setup.ts <<'VITEST_SETUP'
import '@testing-library/jest-dom'
VITEST_SETUP

mkdir -p __tests__ e2e lib app/api/waitlist prisma data

cat > __tests__/home.test.tsx <<'UNIT_TEST'
import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import Home from '@/app/page'

test('renders waitlist call-to-action', () => {
  render(<Home />)
  expect(screen.getByRole('heading', { level: 1 })).toBeDefined()
  expect(screen.getByRole('button', { name: /join waitlist/i })).toBeDefined()
})
UNIT_TEST

cat > playwright.config.ts <<'PLAYWRIGHT_CONFIG'
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:__APP_PORT__'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:__APP_PORT__',
        reuseExistingServer: !process.env.CI,
      },
})
PLAYWRIGHT_CONFIG
sed -i "s/__APP_PORT__/$APP_PORT/g" playwright.config.ts

cat > e2e/example.spec.ts <<'E2E_TEST'
import { test, expect } from '@playwright/test'

test('shows a working waitlist form', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByPlaceholder('you@company.com')).toBeVisible()
})
E2E_TEST

npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm pkg set scripts.test:e2e="playwright test"

add_gitignore_line ""
add_gitignore_line "# Testing"
add_gitignore_line "playwright-report/"
add_gitignore_line "test-results/"
add_gitignore_line "blob-report/"
add_gitignore_line "playwright/.cache/"
add_gitignore_line "# Local data"
add_gitignore_line "data/prod.db"

cat > next.config.ts <<'NEXT_CONFIG'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
NEXT_CONFIG

cat > prisma/schema.prisma <<'PRISMA_SCHEMA'
datasource db {
  provider = "sqlite"
  url      = "file:../data/prod.db"
}

generator client {
  provider = "prisma-client-js"
}

model WaitingList {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  createdAt DateTime @default(now())
}
PRISMA_SCHEMA

cat > lib/prisma.ts <<'PRISMA_CLIENT'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
PRISMA_CLIENT

cat > app/api/waitlist/route.ts <<'WAITLIST_API'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const email = String(payload?.email ?? '').trim().toLowerCase()

    if (!emailPattern.test(email)) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
    }

    await prisma.waitingList.create({ data: { email } })
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json({ error: 'Email already registered.' }, { status: 409 })
    }

    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
WAITLIST_API

cat > app/page.tsx <<'UI'
'use client'

import { FormEvent, useState } from 'react'

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('submitting')
    setMessage('')

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        setState('error')
        setMessage(payload.error ?? 'Unable to process your request.')
        return
      }

      setState('success')
      setMessage('You are on the list. We will contact you soon.')
      setEmail('')
    } catch {
      setState('error')
      setMessage('Network error. Please try again.')
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">__DOMAIN__</p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">__APP_NAME__</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-300">
          Launching a focused MVP experience. Join the waitlist to get first access and product updates.
        </p>

        <form className="mt-10 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
          />
          <button
            type="submit"
            disabled={state === 'submitting'}
            className="rounded-md bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state === 'submitting' ? 'Submitting...' : 'Join Waitlist'}
          </button>
        </form>

        {message && (
          <p className={`mt-4 text-sm ${state === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
            {message}
          </p>
        )}
      </div>
    </main>
  )
}
UI
APP_NAME_ESCAPED_FOR_UI=$(sed_escape "$APP_NAME")
DOMAIN_ESCAPED_FOR_UI=$(sed_escape "$DOMAIN")
sed -i "s/__APP_NAME__/$APP_NAME_ESCAPED_FOR_UI/g" app/page.tsx
sed -i "s/__DOMAIN__/$DOMAIN_ESCAPED_FOR_UI/g" app/page.tsx

log "💎 Generating Prisma client and baseline migration..."
npx prisma generate
npx prisma migrate dev --name init --skip-seed

echo "📝 Creating project-specific GEMINI.md..."
cat > GEMINI.md <<'PROJECT_GEMINI'
# Project Mandates

This project is managed by App Factory. Agents working here must follow these rules:

## Execution
- Start every task by updating `PLAN.md` with an actionable checklist.
- If retrying a failed task, read `PREVIOUS_FAILURE.log` first.
- Never leave placeholder code; ship functional behavior and tests.

## Deployment and Verification
- After code changes, run `./deploy.sh`.
- Validation entrypoint is `./verify.sh`; do not split checks across ad-hoc scripts.
- Public verification targets HTTPS only and should not bypass TLS checks.

## Data and Architecture
- SQLite database is persisted at `./data/prod.db`.
- Keep Prisma schema and API contracts synchronized with implementation.
PROJECT_GEMINI

# Render deployment templates
APP_NAME_ESCAPED=$(sed_escape "$APP_NAME")
DOMAIN_ESCAPED=$(sed_escape "$DOMAIN")
APP_PORT_ESCAPED=$(sed_escape "$APP_PORT")

render_template() {
    local template_path="$1"
    local output_path="$2"

    sed -e "s/\${APP_NAME}/$APP_NAME_ESCAPED/g" \
        -e "s/\${DOMAIN}/$DOMAIN_ESCAPED/g" \
        -e "s/\${APP_PORT}/$APP_PORT_ESCAPED/g" \
        "$template_path" > "$output_path"
}

run_optional_smoke_validation() {
    if [ "${APP_FACTORY_BOOTSTRAP_SMOKE_VERIFY:-0}" != "1" ]; then
        return
    fi

    local smoke_log="$WORKSPACE_DIR/bootstrap_smoke_${APP_NAME}.log"
    : > "$smoke_log"

    {
        log "🧪 Running bootstrap smoke validation (deploy + verify)..."
        ./deploy.sh

        if [ "${APP_FACTORY_SKIP_PUBLIC_HTTPS_PROBE:-0}" == "1" ]; then
            log "⚠️ Smoke mode: skipping public HTTPS probe (SKIP_PUBLIC_HTTPS_PROBE=1)."
            SKIP_PUBLIC_HTTPS_PROBE=1 ./verify.sh
        else
            ./verify.sh
        fi

        log "✅ Smoke validation passed."
        log "🧾 Smoke evidence recorded at $smoke_log."
    } 2>&1 | tee -a "$smoke_log"
}

log "📋 Applying deployment templates..."
ensure_file_exists "$WORKSPACE_DIR/templates/default/Dockerfile.template"
ensure_file_exists "$WORKSPACE_DIR/templates/default/.dockerignore.template"
ensure_file_exists "$WORKSPACE_DIR/templates/default/docker-compose.yml.template"
ensure_file_exists "$WORKSPACE_DIR/templates/default/deploy.sh.template"
ensure_file_exists "$WORKSPACE_DIR/templates/default/verify.sh.template"

render_template "$WORKSPACE_DIR/templates/default/Dockerfile.template" "Dockerfile"
render_template "$WORKSPACE_DIR/templates/default/.dockerignore.template" ".dockerignore"
render_template "$WORKSPACE_DIR/templates/default/docker-compose.yml.template" "docker-compose.yml"
render_template "$WORKSPACE_DIR/templates/default/deploy.sh.template" "deploy.sh"
render_template "$WORKSPACE_DIR/templates/default/verify.sh.template" "verify.sh"

assert_no_template_tokens "Dockerfile"
assert_no_template_tokens ".dockerignore"
assert_no_template_tokens "docker-compose.yml"
assert_no_template_tokens "deploy.sh"
assert_no_template_tokens "verify.sh"

chmod +x deploy.sh verify.sh
bash -n deploy.sh verify.sh

# Register project in DB
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
APP_SQL=$(sql_escape "$APP_NAME")
DOMAIN_SQL=$(sql_escape "$DOMAIN")

sqlite3 "$DB_FILE" "INSERT INTO projects (name, port, domain, created_at) VALUES ('$APP_SQL', $APP_PORT, '$DOMAIN_SQL', '$NOW');"
PROJECT_REGISTERED=1

create_default_prd_if_missing

log "🧠 Starting technical design phase..."
run_design_phase

run_optional_smoke_validation

log "🗃️ Initializing app repository..."
git init
ensure_git_identity
git add .
git commit -m "chore: bootstrap app with deploy, verify, and deterministic design baseline"

BOOTSTRAP_SUCCESS=1
trap - ERR INT TERM

log "✅ App $APP_NAME bootstrapped successfully with resilient defaults."
