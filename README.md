# 🦆 Task Duck — AI-Powered Scope Discipline Tool

**BUILD · ARCHITECT · SHIP** — one task at a time.

Task Duck is a self-hosted web app that forces disciplined task execution through a structured READ → WRITE → CHECK workflow, with AI-powered verification to catch scope drift before you start working.

## Features

- **Side-by-side task comparison** — Paste the original, rewrite your understanding, AI catches the drift
- **Multi-provider AI verification** — Claude, GPT-4o, and Gemini support
- **Sensitive data masking** — Automatic + custom rules mask PII/secrets before sending to any LLM
- **Scope fencing with time-boxing** — 3-5 items max, with time estimates and duck warnings
- **30-minute checkpoint timer** — The duck interrupts you to check if you've drifted
- **Diff tracker** — Planned vs actual execution tracking with accuracy scores
- **Peer impact check** — "Who else will this touch?" before you ship
- **Markdown export** — Ready-to-paste PR descriptions with Ctrl+M
- **Printable checklists** — Clean table-based printout for journaling
- **Password-protected** — Scrypt-hashed auth with JWT sessions
- **Docker-ready** — Single container, env-file config

## Quick Start

```bash
# 1. Clone / copy the project
cd task-duck-server

# 2. Copy env template
cp .env.example .env

# 3. Start the server (first run — no auth for setup)
docker compose up -d

# 4. Generate your password hash
curl -X POST http://localhost:3456/api/hash-password \
  -H "Content-Type: application/json" \
  -d '{"password":"your-secure-password"}'

# 5. Copy the hash into .env
# PASSWORD_HASH=scrypt:salt:hash

# 6. Add your API keys to .env
# ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# GEMINI_API_KEY=AI...

# 7. Restart
docker compose down && docker compose up -d

# 8. Access at https://your-domain:3456
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PASSWORD_HASH` | Yes | Scrypt password hash (generate via `/api/hash-password`) |
| `JWT_SECRET` | Recommended | Session signing secret (auto-generated if empty) |
| `SESSION_HOURS` | No | Token expiry (default: 24) |
| `ANTHROPIC_API_KEY` | At least one | Claude API key |
| `OPENAI_API_KEY` | provider | OpenAI API key |
| `GEMINI_API_KEY` | needed | Gemini API key |
| `CUSTOM_MASKS` | No | Custom masking rules (see below) |
| `PORT` | No | Server port (default: 3000) |

## Sensitive Data Masking

### Automatic Detection (always active)
- Email addresses
- IP addresses
- URLs and file paths
- API keys and tokens
- UUIDs
- Database connection strings
- Phone numbers and SSNs
- AWS ARNs
- Kubernetes namespaces

### Custom Masking Rules

Add terms specific to your environment in `.env`:

```env
CUSTOM_MASKS=mycompany=COMPANY,prod-api.internal=SERVICE_A,custdb01=DATABASE_1,secretproject=PROJECT_X
```

The masker replaces these terms before sending to any LLM, and unmasks them in the response.

### How It Works

```
YOUR INPUT:  "Update the endpoint at prod-api.internal/v2/customers to add pagination"
SENT TO LLM: "Update the endpoint at [SERVICE_A]/v2/customers to add pagination"
LLM RESPONSE: "The rewrite mentions redesigning [SERVICE_A] which is scope drift"
YOU SEE:      "The rewrite mentions redesigning prod-api.internal which is scope drift"
```

The LLM never sees your actual service names, URLs, or credentials.

## Nginx Proxy Manager Config

If you're using NPM (which you already have in your homelab):

```
Proxy Host: task-duck.yourdomain.com
Forward: http://task-duck-container-ip:3000
SSL: Force SSL, HTTP/2
```

## CI/CD — GitHub Actions + GHCR

Every push to `main` automatically builds a multi-arch Docker image (`amd64` + `arm64`) and pushes it to GitHub Container Registry.

**Tagging strategy:**

| Trigger | Tags produced |
|---|---|
| Push to `main` | `latest`, `main`, `sha-abc1234` |
| Tag `v1.2.3` | `1.2.3`, `1.2`, `sha-abc1234` |
| Pull request | Build only (no push) |

**Deploy from GHCR on your homelab:**

```bash
# Pull latest and restart
docker compose pull && docker compose up -d
```

**Local build (dev):**

```bash
docker compose -f docker-compose.build.yml up -d --build
```

**Make image private or public:**

By default GHCR images are private. To make it accessible only to you across machines, no changes needed — just `docker login ghcr.io` on your homelab with a PAT. To make it public, go to the package settings on GitHub.

## Architecture

```
┌─────────────┐     HTTPS      ┌──────────────────┐
│   Browser    │ ◄────────────► │  Nginx Proxy Mgr │
│  (Task Duck) │                │  (SSL termination)│
└──────┬───────┘                └────────┬─────────┘
       │                                 │
       │            ┌────────────────────┘
       │            ▼
       │   ┌──────────────────┐
       │   │   Task Duck      │
       │   │   Node.js Server │
       │   │                  │
       │   │  ┌────────────┐  │      ┌─────────────┐
       │   │  │  Masking    │──────► │ Claude API  │
       │   │  │  Engine     │──────► │ OpenAI API  │
       │   │  └────────────┘  │  ──► │ Gemini API  │
       │   │                  │      └─────────────┘
       │   │  Auth (scrypt)   │
       │   │  JWT sessions    │
       │   └──────────────────┘
       │           Docker
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Enter` | Advance to next step |
| `Esc` | Random duck quote |
| `Ctrl+P` | Print checklist |
| `Ctrl+M` | Export to Markdown |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | No | Health check |
| POST | `/api/login` | No | Authenticate, returns JWT |
| GET | `/api/providers` | Yes | List configured LLM providers |
| POST | `/api/verify` | Yes | Verify task understanding via AI |
| POST | `/api/hash-password` | No | Generate password hash (setup only) |

## License

Personal use. Built for Nitin's workflow by Task Duck.
