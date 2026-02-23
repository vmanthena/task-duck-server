# Task Duck

**AI-powered scope discipline tool that enforces a READ > PLAN > EXECUTE > CHECK workflow for development tasks.**

Task Duck is a self-hosted web app that catches scope drift before you start coding. Paste the original task, rewrite your understanding, and let AI verify the gap. Then fence your scope, track your execution, and ship with an accuracy score.

## Table of Contents

- [Workflow](#workflow)
- [Features](#features)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Sensitive Data Masking](#sensitive-data-masking)
- [API Reference](#api-reference)
- [Architecture](#architecture)
- [Deployment](#deployment)
- [Testing](#testing)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [License](#license)

## Workflow

Task Duck enforces a strict 4-step loop for every task:

### Step 1: Read and Rewrite

Paste the original ticket verbatim, then rewrite what you think is actually being asked. Fill in the deliverable, definition of done, and what is explicitly NOT in scope. Select an AI provider and hit **Verify** to compare your rewrite against the original.

The AI returns a structured verdict:

- **match** — your understanding aligns with the original
- **drift** — you added scope that was not asked for
- **missing** — you left out requirements from the original
- **major_mismatch** — significant misunderstanding detected

Each verdict includes confidence score, specific drift items, missing items, assumptions, definition of done assessment, spelling/grammar issues, story point evaluation, and suggestions. If drift is detected, you can either fix your rewrite or request an AI-powered **re-scope** with a justification for why the scope needs to change. The re-scope returns a corrected rewrite, corrected definition of done, a list of what changed and why, and suggested story points.

Story point validation uses the Scrum Fibonacci scale (1, 2, 3, 5, 8, 13). The AI flags estimates that are bloated relative to the described scope and recommends splitting stories at 8+ points.

### Step 2: Plan and Fence

Define 1 to 5 concrete scope items with time estimates in minutes. Total time is calculated and compared against your story point estimate (if provided), with color-coded fit indicators showing whether your plan matches the estimate.

Additional planning fields:

- **Approach** — files and services you will touch
- **Peer reviewer** — who reviews this work
- **Surprise check** — what would surprise your reviewer in the diff
- **Parking lot** — "while I'm in here" ideas that should NOT go in your PR

Print the plan as a formatted checklist for reference.

### Step 3: Execute

The work timer starts. A diff tracker displays your planned items with toggleable status (TODO, DONE, SKIP). If you do unplanned work, add it as an **extra** (penalizes your accuracy score by 10 points each). If scope legitimately needs to change mid-work, record a **scope amendment** with justification (amendments do not penalize your score).

Every 30 minutes the duck interrupts with a checkpoint modal asking which scope item you are currently working on and whether you are still inside the fence.

### Step 4: Pre-Push Check

Answer a series of verification questions before shipping:

- Definition of done is met
- Diff only contains task-related changes
- Only touched files listed in approach
- Reviewer would not ask "why did you change this?"
- No gold-plating beyond what was asked
- Every extra item is justified (if any exist)

All checks must pass before the Ship button enables.

### Completion

Accuracy score is calculated: `(done / planned) * 100 - (extras * 10)`, clamped to 0-100. The score is color-coded (green >= 80%, orange >= 50%, red < 50%) with a contextual duck message. Results are saved to history and the draft is cleared. Export as markdown or print the final report.

## Features

### AI-Powered Verification

- **Multi-provider support** — Anthropic Claude, OpenAI GPT-4o, Google Gemini, local Ollama, and a Mock provider for development
- **Structured JSON verdicts** — confidence scores, categorized drift items, actionable suggestions
- **AI-powered rescoping** — when drift is justified, the AI generates a corrected rewrite with updated definition of done and story points
- **Truncated JSON repair** — recovers partial LLM responses using progressive strategies (direct parse, fence stripping, structure closing)
- **Model overrides** — configure preferred models per provider via environment variables

### Sensitive Data Masking

- **10 automatic patterns** — email, IP, URL, API key, UUID, database connection string, file path, phone number, SSN, AWS ARN
- **Custom masking rules** — add project-specific terms via `CUSTOM_MASKS` environment variable
- **Round-trip fidelity** — data masked before sending to LLM, unmasked in the response
- **Masking report** — each verification shows how many items were masked and what categories

### Scope Discipline

- **5-item scope fence** — maximum 5 planned items forces decomposition of large tasks
- **Time-boxing with SP validation** — total minutes compared against Fibonacci story point estimates with color-coded fit indicators
- **30-minute checkpoint timer** — modal interrupts asking if you are still inside the fence
- **Parking lot field** — captures "while I'm in here" ideas without letting them into scope
- **Explicit NOT-in-scope field** — documents what is out of bounds before starting work
- **Creep alerts** — duck warnings when extras are added or scope limits are exceeded

### Execution Tracking

- **Diff tracker** — planned items with toggleable TODO/DONE/SKIP status
- **Extra work tracking** — unplanned items recorded separately with a -10 point accuracy penalty each
- **Scope amendments** — justified scope changes recorded without penalty
- **Work timer** — start, pause, resume with elapsed time displayed in the header
- **Accuracy scoring** — quantified discipline metric based on planned vs actual execution

### Draft and History

- **Autosave** — all form data saved to localStorage every 5 seconds with debounce
- **Draft recovery** — on page reload, the duck offers to restore your in-progress work
- **Task history** — up to 50 completed tasks stored locally with resume, clone, and delete actions
- **Trend dashboard** — average accuracy, average time, total extras, and a sparkline chart across the last 20 tasks (appears after 3+ completed tasks)

### Export

- **Markdown export** — task summary formatted for PR descriptions (Ctrl+M)
- **Print plan** — formatted checklist from Step 2 for journaling or desk reference
- **Print final report** — completion summary with diff items, extras, amendments, and accuracy score

### Security

- **Challenge-response authentication** — bcrypt-based with SHA-256 proof, not plain password transmission
- **JWT sessions** — HMAC-SHA256 signed tokens with configurable expiry
- **Rate limiting** — 3 failed login attempts trigger 20-minute IP lockout
- **Input sanitization** — XSS pattern stripping on all POST bodies, 10KB string limit, 50KB body limit
- **Security headers** — CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Permissions-Policy, Referrer-Policy
- **Same-origin CORS** — API routes reject cross-origin requests
- **Open auth mode** — when `PASSWORD_VERIFIER` is not set, login grants tokens without a password (development use)

### Duck Personality

- **10 contextual quotes** — scope discipline wisdom triggered by clicking the duck or pressing Escape
- **Quack sound effect** — plays on drift detection, checkpoint, extra work, and wrong passwords (toggleable)
- **Contextual messages** — the duck speaks throughout the workflow with step-specific guidance

## Quick Start

```bash
# Clone the repo
git clone https://github.com/vmanthena/task-duck-server.git
cd task-duck-server

# Install dependencies
npm install

# Generate your password credentials
npm run hash
# Follow the prompts — outputs BCRYPT_SALT and PASSWORD_VERIFIER

# Copy the env template and fill in your values
cp .env.example .env
# Edit .env: paste BCRYPT_SALT, PASSWORD_VERIFIER, add at least one API key

# Build and start
npm run build
npm start
# Access at http://localhost:8080
```

### Development Mode

```bash
npm run dev        # Starts server (tsx --watch) + client (esbuild --watch) concurrently
npm run dev:server # Server only with hot reload
npm run dev:client # Client only with watch mode
```

If no API keys are configured, a **Mock (Dev)** provider is automatically available that returns realistic verification and rescope responses.

### Docker

```bash
# Pull from GHCR and run
docker compose up -d

# Or build locally
docker compose -f docker-compose.build.yml up -d --build
```

The Dockerfile uses a multi-stage build with two image variants selectable via `--target`:

| Target | Tag | Size | Notes |
|---|---|---|---|
| `production` | `task-duck:latest` | ~104 MB | Uncompressed Bun — AV/enterprise-scanner compatible |
| `upx` | `task-duck:upx` | ~33 MB | UPX-compressed Bun — smaller, may trigger AV scanners |

```bash
# Standard image (AV-safe, recommended for enterprise)
docker build --target production -t task-duck:latest .

# UPX-compressed image (smaller, for personal use)
docker build --target upx -t task-duck:upx .
```

Building `--target production` skips the UPX compressor stage entirely — Docker only pulls stages reachable from the selected target.

**SlimToolkit** (optional): Further reduce the standard image to ~60–80 MB while staying AV-compatible:

```bash
slim build task-duck:latest \
  --target task-duck:slim \
  --http-probe-cmd /api/health \
  --expose 3000
```

An interactive build script offers a TUI menu for building variants and running Trivy scans:

```bash
bash docker-build.sh
```

All images run as non-root user with a health check on `/api/health`.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `BCRYPT_SALT` | Yes | — | Bcrypt salt (generated via `npm run hash`) |
| `PASSWORD_VERIFIER` | No | — | Password verifier hash (omit for open auth) |
| `BCRYPT_COST` | No | `15` | Bcrypt cost factor (15-16) |
| `JWT_SECRET` | No | auto-generated | Session signing secret (set for persistence across restarts) |
| `SESSION_HOURS` | No | `24` | Token expiry in hours |
| `ANTHROPIC_API_KEY` | At least one | — | Anthropic Claude API key |
| `OPENAI_API_KEY` | provider key | — | OpenAI API key |
| `GEMINI_API_KEY` | needed | — | Google Gemini API key |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Local Ollama instance URL |
| `OLLAMA_MODEL` | No | `qwen2.5:7b` | Ollama model name |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-20250514` | Override default Anthropic model |
| `GEMINI_MODEL` | No | `gemini-2.0-flash-lite` | Override default Gemini model |
| `CUSTOM_MASKS` | No | — | Custom masking rules (see below) |
| `PORT` | No | `8080` | Server port |
| `LOG_LEVEL` | No | `info` | Log level: debug, info, warn, error |

## Sensitive Data Masking

### Automatic Detection (always active)

10 patterns are detected and replaced with numbered placeholders before any text is sent to an LLM:

| Pattern | Example | Placeholder |
|---|---|---|
| Email | `user@example.com` | `[EMAIL_1]` |
| IP Address | `192.168.1.100` | `[IP_1]` |
| URL | `https://api.example.com/v2` | `[URL_1]` |
| API Key | `sk-ant-api03-abcdefghij` | `[APIKEY_1]` |
| UUID | `550e8400-e29b-41d4-a716-446655440000` | `[UUID_1]` |
| DB Connection | `postgres://user:pass@host:5432/db` | `[DBCONN_1]` |
| File Path | `/home/user/documents/file.txt` | `[PATH_1]` |
| Phone | `555-123-4567` | `[PHONE_1]` |
| SSN | `123-45-6789` | `[SSN_1]` |
| AWS ARN | `arn:aws:s3:::my-bucket` | `[ARN_1]` |

### Custom Rules

Add project-specific terms in `.env`:

```env
CUSTOM_MASKS=mycompany=COMPANY,prod-api.internal=SERVICE_A,custdb01=DATABASE_1
```

### How It Works

```
Your input:   "Update the endpoint at prod-api.internal/v2/customers"
Sent to LLM:  "Update the endpoint at [SERVICE_A]/v2/customers"
LLM response: "The rewrite mentions redesigning [SERVICE_A] which is drift"
You see:       "The rewrite mentions redesigning prod-api.internal which is drift"
```

The LLM never sees your actual service names, URLs, or credentials. Each verification response includes a masking report showing what was masked.

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | No | Health check (returns `{ status, version }`) |
| `GET` | `/api/auth/challenge` | No | Get nonce, timestamp, bcrypt salt and cost |
| `POST` | `/api/auth/login` | No | Submit proof, receive JWT token |
| `GET` | `/api/providers` | Yes | List available LLM providers |
| `POST` | `/api/verify` | Yes | Verify task understanding via AI |
| `POST` | `/api/rescope` | Yes | Re-evaluate scope with justification |

All `POST` bodies are sanitized (XSS patterns stripped, strings capped at 10KB, body capped at 50KB). Protected routes require `Authorization: Bearer <token>` header.

## Architecture

```
server/src/
  index.ts              Entry point: dotenv, create app, start server
  app.ts                Express app factory: middleware + routes
  config.ts             Environment variable loading, diagnostics
  types.ts              Shared TypeScript interfaces
  middleware/
    security.ts         CSP, HSTS, X-Frame-Options headers
    cors.ts             Same-origin enforcement for /api/*
    rateLimiter.ts      IP lockout (3 fails, 20 min)
    sanitizer.ts        XSS stripping, size limits
    auth.ts             JWT requireAuth middleware
  services/
    authService.ts      Nonce store, challenge-response, JWT
    dataMasker.ts       10 regex patterns + custom masks
    llmService.ts       Provider calls with retry, Mock provider
    jsonRepair.ts       Truncated JSON recovery (4 strategies)
  prompts/
    verify.ts           System + user prompt templates
    rescope.ts          Rescope prompt templates
  routes/
    health.ts           GET /api/health
    auth.ts             Challenge-response auth endpoints
    providers.ts        GET /api/providers
    verify.ts           POST /api/verify
    rescope.ts          POST /api/rescope

client/src/
  main.ts               Entry point, window bridge for onclick
  state.ts              Centralized state object
  auth.ts               Login flow, provider selection
  verify.ts             AI verification and rescope UI
  scope.ts              Scope items, time calculation
  steps.ts              Step navigation
  diff.ts               Diff tracker, extras, amendments
  timer.ts              Work timer (start, pause, stop)
  checkpoint.ts         30-minute checkpoint modal
  checks.ts             Pre-push verification questions
  ship.ts               Score calculation, completion screen
  history.ts            Task history CRUD, trend dashboard
  draft.ts              Autosave (5s debounce), restore
  export.ts             Markdown and print export
  duck.ts               Quotes, quack animation
  sound.ts              Audio playback toggle
  formData.ts           Form field gathering/setting
  utils.ts              DOM helpers, score formatting
  icons.ts              SVG icon definitions
  shortcuts.ts          Keyboard shortcut bindings

shared/
  constants.ts          Shared values (version, thresholds, limits, storage keys)
  logger.ts             Structured logger (JSON server, console client)
```

**Middleware chain order:** JSON parser > Security Headers > CORS > Input Sanitizer > Static Files > Routes > SPA Fallback

**Runtime dependencies:** `express`, `bcryptjs`, `dotenv` (3 packages total)

**Build toolchain:** TypeScript + esbuild for both server (Node 22 ESM) and client (browser ES2020)

## Deployment

### Docker Compose (GHCR)

```yaml
services:
  task-duck:
    image: ghcr.io/vmanthena/task-duck-server:latest
    container_name: task-duck
    restart: unless-stopped
    ports:
      - "3456:3000"
    env_file:
      - .env
```

### CI/CD

Every push to `main` builds a multi-arch Docker image (amd64 + arm64) and pushes to GitHub Container Registry.

| Trigger | Tags |
|---|---|
| Push to `main` | `latest`, `main`, `sha-<commit>` |
| Tag `v1.2.3` | `1.2.3`, `1.2`, `sha-<commit>` |
| Pull request | Build only (no push) |

### Docker Hardening

The Docker setup includes four layers of hardening, reusable as a reference for other projects:

**Dockerfile**

- **tini as PID 1** — forwards SIGTERM so `docker stop` completes in <2s instead of waiting 10s for SIGKILL
- **OCI metadata labels** — `org.opencontainers.image.*` labels populated via build-args (`BUILD_DATE`, `VCS_REF`, `VERSION`)
- **File permission lockdown** — `chmod 555` on `/app/dist` and `/usr/local/bin/bun` (read+execute, no write)
- **Package manager removal** — `apk-tools` purged after setup, preventing `apk add` inside running containers
- **Non-root user** — runs as `appuser` with no elevated privileges

**Compose**

- `read_only: true` — immutable root filesystem at runtime
- `tmpfs: /tmp:noexec,nosuid,size=64m` — writable temp dir without binary execution
- `cap_drop: [ALL]` — no Linux capabilities (port 3000 > 1024, none needed)
- `no-new-privileges: true` — prevents setuid/setgid escalation
- `pids_limit: 64` — fork bomb protection
- `logging: max-size 10m, max-file 3` — caps logs at 30MB total

**CI/CD**

- **Trivy vulnerability scan** — blocks pushes on HIGH/CRITICAL CVEs (`ignore-unfixed: true`)
- **SARIF upload** — scan results appear in GitHub Security tab
- **OCI build-args** — commit SHA, timestamp, and version baked into image labels

**Build Script**

- Interactive TUI menu (`bash docker-build.sh`) — build production, UPX, slim, or all variants
- Trivy scanning with fallback to `docker run aquasec/trivy` if CLI not installed
- OCI build-args auto-populated from git and package.json

### Reverse Proxy (Nginx Proxy Manager)

```
Proxy Host: task-duck.yourdomain.com
Forward:    http://task-duck:3000
SSL:        Force SSL, HTTP/2
```

## Testing

The test suite uses [Vitest](https://vitest.dev) with 227 tests across 23 test files covering unit, integration, and end-to-end layers.

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:ui       # Browser UI
npm run test:coverage # Coverage report (v8 provider)
npm run test:server   # Server project only
npm run test:client   # Client project only (happy-dom)
npm run test:e2e      # End-to-end flow tests
```

### Test Structure

```
tests/
  setup/              Server and client setup files
  fixtures/           Mock requests, LLM responses, env presets
  helpers/            Supertest app factory, fetch mocks
  unit/
    server/           Services, middleware, config, prompts
    shared/           Constants, logger
    client/           Utils, formData, score calculation
  integration/        Route tests via supertest (health, auth, providers, verify, rescope)
  e2e/                Full login > verify > rescope flow with Mock provider
```

### Other Commands

```bash
npm run typecheck     # TypeScript strict check (tsc --noEmit)
npm run build         # Build server + client to dist/
npm run hash          # Generate bcrypt credentials
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Escape` | Random duck quote |
| `Ctrl+P` | Print plan checklist |
| `Ctrl+M` | Export to Markdown |

## License

Personal use. Built for Nitin's workflow.
