# 🏭 App Factory

> **Autonomiczny system do bootstrappingu, tworzenia, audytu i deploymentu Next.js aplikacji na VPS-ie przy pomocy AI agentów.**

App Factory to zaawansowany system automatyzacji, który pozwala na szybkie prototypeowanie i budowanie produkcyjnych aplikacji webowych bez ręcznych interwencji. System bazuje na wspólnej pracy AI agentów (Claude, GPT, Gemini) z lokalną bazą danych SQLite i orkestruje całą ścieżkę od idei do deploymentu na produkcji.

---

## 🎯 Po Co To Komu?

### Dla Startup'owców & Przedsiębiorców
- **Szybkie prototypowanie**: Od idei do działającej aplikacji w godziny, nie dni
- **Brak obaw o tech**: System zajmuje się architekturą, kodem, testami, deploymentem
- **Koszt infrastruktury**: Wszystko na jednym skromnym VPS-ie z Traefik + Docker

### Dla AI Developerów
- **Laboratorium dla agentów**: Testuj autonomiczne prace AI na realnych projektach
- **Multi-agent orchestration**: Różne role (developer, architect, auditor) specjalizują się w swoim zadaniu
- **Self-healing workflow**: Jeśli agent się pomyli, system automatycznie powtarza z kontekstem błędu

### Dla DevOps/Infrastructure Engineers
- **Infrastructure as Code**: Docker, docker-compose, SQLite - wszystko reproducible
- **Centralized task queue**: Jedno źródło prawdy o stanie wszystkich projektów
- **Audit trail**: Każda zmiana jest zarejestrowana z logiką agenta i failure context'iem

---

## 🏗️ Jak To Działa?

### 1️⃣ Definiujesz Ideę
```
PRD.md (Product Requirements Document)
  ↓ (AI generates)
SPECS.md (Technical Specifications)
```

### 2️⃣ System Bootstrap'uje Aplikację
```bash
./scripts/bootstrap.sh my-app example.com
```
- Tworzy folder `/apps/my-app` z pełnym Next.js stack'iem
- Konfiguruje Docker, Traefik labels, database
- Rozbija pracę na atomowe taski w `factory.db`

### 3️⃣ Scheduler Orkestruje Pracę
```
TRIAGE (ocena trudności + przypisanie agenta)
  ↓
READY (czeka na wykonanie)
  ↓
IN_PROGRESS (AI agent implementuje)
  ↓
AUDITING (auditor sprawdza bezpieczeństwo + jakość)
  ↓
DONE (aplikacja wdrożona) ✅
```

### 4️⃣ Monitorujesz z Dashboarda
```
Dashboard UI → Kanban board, logi, deploy buttons, git history
```

### 5️⃣ Deploy & Weryfikacja
```
docker compose up -d --build  (na VPS-ie)
./verify.sh  (health checks, E2E testy)
```

---

## 📊 Factory Dashboard

Interfejs do zarządzania projektami i zadaniami **bez dotykania terminala**:

### Funkcje
- **Kanban Board** 📋
  - Kolumny: TRIAGE → TODO → IN_PROGRESS → AUDITING → DONE/FAILED
  - Drag & drop (przesuwanie zadań)
  - Kolory wg statusu (indigo dla TRIAGE, zielony dla DONE, czerwony dla FAILED)

- **Projects Table** 🔧
  - Edycja domeny (auto-sync do docker-compose.yml, verify.sh, CLAUDE.md)
  - Deploy button (rebuild & restart container)
  - Port, domain, created date

- **Task Details** 📝
  - Edycja priorytetu (0-10)
  - Zależności między zadaniami
  - Audit notes (notatki z fazy audytu)
  - **Assigned Agent** - który agent zajmie się taskiem (ui-developer, architect, developer)

- **Live Logs** 📺
  - Streaming logu scheduler'a (`factory.log`)
  - Streaming logu aplikacji (`app.log`)
  - Live polling z autoscroll

- **Git History** 🔍
  - Ostatnie commity per aplikacja
  - Szybki podgląd zmian

### Gdzie?
**URL**: https://dashboard.marcinszewczyk.pl (konfigurowalny)
**Auth**: Login + password (zabezpieczony sessią)

---

## 🤖 Agent Role Assignment

System automatycznie przypisuje pracę odpowiedniemu agentowi na podstawie oceny trudności i typu zadania:

### ui-developer 🎨
- **Dla**: Zadania UI/frontend (komponenty, style, layout, formy)
- **Agenty**: Claude Sonnet (low effort) → Gemini Flash
- **Kiedy**: Słowa kluczowe: ui, component, button, layout, css, design

### architect 🏗️
- **Dla**: Złożone architektoniczne decyzje (bazy danych, API design, infrastruktura)
- **Agenty**: GPT-5.3-Codex → Claude Sonnet → Gemini Pro
- **Kiedy**: Priority ≥ 8 LUB opis > 800 znaków + słowa kluczowe: database, migration, architecture, deploy

### developer 💻 (default)
- **Dla**: Ogólne implementacyjne zadania
- **Agenty**: Claude Sonnet → GPT-Codex → Gemini Pro
- **Kiedy**: Wszystko inne

---

## 📦 Instalacja

### Wymagania Wstępne
- **VPS** z Linux (Ubuntu 20.04+, Debian 11+)
- **Docker** + Docker Compose v2
- **Node.js 18+** (dla schedulera)
- **Traefik** jako reverse proxy (na sieci `coolify`)
- **Domeny** z DNS wskazującym na Twój VPS

### Krok 1: Klonowanie Repozytorium

```bash
git clone https://github.com/yourusername/app-factory.git
cd app-factory
```

### Krok 2: Zainstaluj Zależności

```bash
# Scheduler dependencies
cd scripts/scheduler
npm install
npm run build
cd ../..

# Dashboard dependencies
cd apps/factory-dashboard
npm install
cd ../..
```

### Krok 3: Konfiguracja Środowiska

Utwórz `.env` w katalogu dashboard'u:

```bash
# apps/factory-dashboard/.env

# Database
DATABASE_URL="file:../../factory.db"

# Authentication
ADMIN_PASSWORD="twoje-haslo-admin"           # Zmień to!
DASHBOARD_SESSION_SECRET="$(openssl rand -hex 32)"  # Minimum 32 chars

# Server
PORT=3000
NODE_ENV=production
```

### Krok 4: Setup Bazy Danych

```bash
# Wygeneruj Prisma klienta
cd apps/factory-dashboard
npx prisma generate
cd ../..

# factory.db będzie stworzony automatycznie przy pierwszym uruchomieniu
```

### Krok 5: Utwórz docker-compose.yml dla Dashboard'u

```yaml
# apps/factory-dashboard/docker-compose.yml

version: '3.8'

services:
  factory-dashboard:
    image: factory-dashboard-app:latest
    container_name: app-factory-factory-dashboard
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: "file:../../factory.db"
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      DASHBOARD_SESSION_SECRET: ${DASHBOARD_SESSION_SECRET}
      NODE_ENV: production
    volumes:
      - ../../factory.db:/app/factory.db
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - coolify
    labels:
      traefik.enable: "true"
      traefik.http.routers.factory-dashboard.rule: "Host(`dashboard.twoja-domena.pl`)"
      traefik.http.routers.factory-dashboard.entrypoints: "https"
      traefik.http.routers.factory-dashboard.tls.certresolver: "letsencrypt"
      traefik.http.services.factory-dashboard.loadbalancer.server.port: "3000"

networks:
  coolify:
    external: true
```

### Krok 6: Deploy Dashboard'u

```bash
# Zbuduj obraz
docker build -t factory-dashboard-app apps/factory-dashboard

# Uruchom
docker compose -f apps/factory-dashboard/docker-compose.yml up -d
```

### Krok 7: Scheduler w Cron'ie

Dodaj do `crontab`:

```bash
# Co 5 minut uruchamiaj scheduler
*/5 * * * * /home/user/app-factory/scripts/scheduler.sh >> /home/user/app-factory/factory.log 2>&1
```

Lub używając systemd timer (lepiej):

```bash
# /etc/systemd/system/app-factory.service
[Unit]
Description=App Factory Scheduler
After=network.target

[Service]
Type=oneshot
User=appfactory
ExecStart=/home/appfactory/app-factory/scripts/scheduler.sh
StandardOutput=append:/home/appfactory/app-factory/factory.log
StandardError=append:/home/appfactory/app-factory/factory.log

[Install]
WantedBy=multi-user.target

# /etc/systemd/system/app-factory.timer
[Unit]
Description=Run App Factory Scheduler every 5 minutes
Requires=app-factory.service

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
Unit=app-factory.service

[Install]
WantedBy=timers.target
```

Włącz:
```bash
sudo systemctl enable app-factory.timer
sudo systemctl start app-factory.timer
```

### Krok 8: Stwórz Pierwszą Aplikację

```bash
# Skrypt bootstrap
./scripts/bootstrap.sh my-first-app first-app.your-domain.com

# Scheduler po pewnym czasie:
# - Przetworzy zadania
# - Wygeneruje kod
# - Uruchomi testy
# - Deployuje do Traefik'a
```

### Krok 9: Otwórz Dashboard

Odwiedź: `https://dashboard.your-domain.com`
- Login: (dowolny user)
- Hasło: wartość z `ADMIN_PASSWORD`

---

## 🗂️ Struktura Projektu

```
app-factory/
├── README.md                    # Ten plik
├── CLAUDE.md                    # Instrukcje dla AI agentów
├── factory.db                   # SQLite z zadaniami i projektami
├── factory.log                  # Logi scheduler'a
│
├── scripts/
│   ├── bootstrap.sh            # Tworzy nową aplikację
│   ├── scheduler.sh            # Cron entry point
│   ├── scheduler/
│   │   ├── src/                # TypeScript źródła
│   │   │   ├── scheduler.ts    # Główna pętla
│   │   │   ├── agent-runner.ts # Uruchamianie agentów
│   │   │   ├── triage.ts       # Klasyfikacja zadań
│   │   │   ├── db.ts           # SQLite operacje
│   │   │   ├── audit.ts        # Faza audytu
│   │   │   └── ...
│   │   ├── dist/               # Skompilowany JS
│   │   └── package.json
│   │
│   └── templates/default/      # Szablony dla nowych aplikacji
│       ├── Dockerfile
│       ├── docker-compose.yml
│       ├── next.config.js
│       └── ...
│
├── apps/
│   ├── factory-dashboard/      # React UI
│   │   ├── app/
│   │   │   ├── page.tsx        # Home page
│   │   │   ├── login/          # Auth
│   │   │   └── api/            # REST API
│   │   ├── prisma/             # Database schema
│   │   └── docker-compose.yml
│   │
│   └── my-first-app/           # Wygenerowana aplikacja
│       ├── Dockerfile
│       ├── docker-compose.yml
│       ├── package.json
│       ├── PRD.md              # Product requirements
│       ├── SPECS.md            # Technical specs
│       ├── verify.sh           # Health checks
│       ├── deploy.sh           # Deployment script
│       └── app/                # Next.js kod
│
└── lessons/
    ├── 1_20260101_000.md       # Lesson learned z task #1
    └── ...
```

---

## 🚀 Workflow: Od Idei do Produkcji

### 1. Przygotuj PRD
```markdown
# PRD: Social Media Analytics Dashboard

## Problem
Marketerzy potrzebują jednego miejsca do analizy statystyk ze wszystkich social media.

## Solution
Dashboard zintegrowany z Instagram, TikTok, YouTube APIs.

## MVP Features
- Real-time follower counts
- Engagement metrics (likes, comments, shares)
- Post scheduler
```

### 2. Uruchom Bootstrap
```bash
./scripts/bootstrap.sh social-dashboard social-dash.example.com
```

Scheduler automatycznie:
- Wygeneruje SPECS.md (architektura, database schema, endpoints)
- Rozłoży pracę na taski
- Uruchomi AI agenta do implementacji

### 3. Monitoruj w Dashboard'ie
- Otwórz Kanban board
- Zobacz postęp każdego zadania
- Edytuj priorytety jeśli potrzeba

### 4. AI Pracuje
- Developer agent: Implementuje backend
- UI-developer agent: Tworzy komponenty frontend
- Architect agent: Decyduje o schemacie bazy

### 5. Auditor Sprawdza
- Weryfikuje bezpieczeństwo (SQL injection, XSS, itd.)
- Sprawdza kod quality
- Czy są placeholder'y?

### 6. Health Checks
- Unit testy przechodzą
- Playwright E2E testy OK
- Aplikacja odpowiada na HTTPS

### 7. Deployment
- Docker image buduje się
- Traefik konfiguruje routing
- Aplikacja live na produkcji ✅

---

## 🔐 Security

- **Sessions**: Podpisane ciasteczka (JWT-like), nie localStorage
- **HTTPS**: Wymuszony, certyfikaty Let's Encrypt via Traefik
- **Database**: SQLite na dysku, zamontowany w kontenerze
- **Docker**: Każda aplikacja w osobnym kontenerze, sieć `coolify`
- **Agent Execution**: Headless (bez UI), kontekst przechowywany w failu (dla retry'ów)

---

## 📈 Monitoring

### Logi
- `factory.log` - Scheduler (zadania, error'y, tracing)
- `apps/<name>/logs/agents/` - Logi agentów
- `apps/<name>/app.log` - Logi aplikacji

### Dashboard
- Zadania w real-time
- Failure context (dla debugowania)
- Git diff podgląd

### Metryki
- CPU/RAM usage (scheduler bierze to pod uwagę - idle jeśli > 80%)
- Task success rate
- Agent model fallback stats

---

## 🛠️ Troubleshooting

### Scheduler nie uruchamia się
```bash
# Sprawdź cron/timer
systemctl status app-factory.timer
journalctl -u app-factory -f

# Ręczny run
/home/user/app-factory/scripts/scheduler.sh
```

### Dashboard nie dostępny
```bash
# Sprawdź container
docker ps | grep factory-dashboard

# Logi
docker logs app-factory-factory-dashboard

# Traefik config
docker logs traefik (jeśli Traefik w containerze)
```

### Aplikacja nie deployuje się
```bash
# Sprawdź task logs
cat factory.log | grep "Task <ID>"

# Sprawdź verify.sh (health checks)
cd apps/my-app && ./verify.sh

# Container status
docker logs app-<name>
```

---

## 🔄 Status Workflow

```
TRIAGE
  ↓ (scheduler ocenia difficulty + przypisuje agenta)
READY or PENDING_APPROVAL
  ↓ (czeka na wykonanie)
IN_PROGRESS
  ↓ (agent pracuje)
  ├→ success → AUDITING → DONE ✅
  └→ failure → FAILED (retry < 3) → READY (ponownie)
             → FAILED (retry = 3) ❌
```

---

## 📚 Dokumentacja

- [`CLAUDE.md`](CLAUDE.md) - Instrukcje dla AI agentów
- [`vision/VISION.md`](vision/VISION.md) - Architektoniczne założenia (SQLite-first, local-first)
- [`apps/factory-dashboard/CLAUDE.md`](apps/factory-dashboard/CLAUDE.md) - Dashboard mandates
- `apps/<name>/PRD.md` - Product requirements (per aplikacja)
- `apps/<name>/SPECS.md` - Technical specifications (per aplikacja)

---

## 🤝 Contributing

To rozwijaj system:

1. Fork repozytorium
2. Utwórz branch `feature/xyz`
3. Commitu z prefixem `feat:`, `fix:`, `refactor:`, itd.
4. Pull request ze wzorem

**Zasady**:
- Testy muszą przejść
- Kod musi być czysty (AI review)
- Documentation musi być updated

---

## 📄 Licencja

[Podaj swoją licencję - MIT, Apache, itd.]

---

## 💬 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: [twój email]

---

**Zbudowane z ❤️ dla twojej automatyzacji AI.**

App Factory przekształca ideę w produkcyjną aplikację, zamiast miesiące spędzić na kodowaniu.
