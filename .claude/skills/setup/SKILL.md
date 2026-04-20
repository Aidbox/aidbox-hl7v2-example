---
name: setup
description: Verify the developer's machine has everything required to run this project (Bun, Docker, bash on Windows, free ports, .env). Use when the user asks to "set up", "check prerequisites", "what do I need installed", or is onboarding to the project.
---

# Project Setup Check

Verify the developer's machine can run this project. **Detect and report; never auto-install.** Install steps require admin/sudo and vary per OS — the developer runs them.

## Step 1: Detect the platform

Run `uname -s` to classify:
- `Linux` → linux
- `Darwin` → macOS
- `MINGW*` / `MSYS*` / `CYGWIN*` → Windows (in Git Bash)
- If `uname` itself fails → native Windows without bash (biggest blocker — see Step 3).

Remember this — some checks branch on platform.

## Step 2: Run the required-tools check

Run each of these and capture exit code + version line. Do them in parallel (single message, multiple Bash calls) — they're independent.

| Tool | Command | Required version |
|---|---|---|
| Bun | `bun --version` | 1.2+ |
| Docker CLI | `docker --version` | any recent |
| Docker Compose v2 | `docker compose version` | v2+ (note the space, not `docker-compose`) |
| Docker daemon | `docker info --format '{{.ServerVersion}}'` | must succeed — means Docker Desktop / daemon is running |
| Git | `git --version` | any |

On Windows (Git Bash), also check:

| Tool | Command | Why |
|---|---|---|
| bash on PATH | `command -v bash` | `package.json` scripts (`dev`, `stop`, `typecheck`, `regenerate-hl7v2`) invoke `.sh` files. Without bash on PATH, `bun run dev` etc. fail. |
| tail | `command -v tail` | `bun run logs` uses `tail -f`. |

## Step 3: Check required ports are free

The project binds these host ports. If something else already listens, startup silently fails or Aidbox complains about port conflicts.

| Port | Used by |
|---|---|
| 3000 | Web UI (`bun run dev`) |
| 8080 | Aidbox |
| 2575 | MLLP server |
| 5440 | Postgres (host side) |
| 8888 | Test Aidbox (only if running integration tests) |

How to check — pick the command for the detected platform:

- **Linux:** `ss -ltn 'sport = :3000' 'sport = :8080' 'sport = :2575' 'sport = :5440' 'sport = :8888'` (empty output = all free) — fallback `lsof -iTCP -sTCP:LISTEN -P -n | grep -E ':(3000|8080|2575|5440|8888)\b'`
- **macOS:** `lsof -iTCP -sTCP:LISTEN -P -n | grep -E ':(3000|8080|2575|5440|8888)\b'` (empty = free)
- **Windows (Git Bash):** `netstat -ano | grep -E "LISTENING\s+.*:(3000|8080|2575|5440|8888)\b"` — or `powershell -Command "Get-NetTCPConnection -State Listen -LocalPort 3000,8080,2575,5440,8888 -ErrorAction SilentlyContinue"`

Port 8888 is only relevant if the developer plans to run `bun test:integration`. Note it separately.

## Step 4: Check `.env` structure against `.env.example`

`.env` is gitignored; `.env.example` is the checked-in template. Fresh clones must `cp .env.example .env` and fill in real values. Bun auto-loads `.env` if present.

Run this block. It parses keys only — **never print values**, they may be secrets.

```bash
if [ ! -f .env.example ]; then
  echo ".env.example missing — cannot validate structure"
elif [ ! -f .env ]; then
  echo ".env missing — run: cp .env.example .env"
else
  extract_keys() {
    awk -F= '
      /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
      { key = $1
        sub(/^[[:space:]]*export[[:space:]]+/, "", key)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
        print key }
    ' "$1" | sort -u
  }

  missing=$(comm -23 <(extract_keys .env.example) <(extract_keys .env))
  extra=$(comm -13 <(extract_keys .env.example) <(extract_keys .env))
  empty=$(awk -F= '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    { key = $1
      sub(/^[[:space:]]*export[[:space:]]+/, "", key)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
      val = $0; sub(/^[^=]*=/, "", val)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", val)
      gsub(/^"|"$/, "", val)
      if (val == "") print key }
  ' .env)

  [ -n "$missing" ] && echo "MISSING keys (in .env.example, absent from .env):" && echo "$missing"
  [ -n "$empty" ]   && echo "EMPTY keys (present but no value):" && echo "$empty"
  [ -n "$extra" ]   && echo "EXTRA keys (in .env, not in .env.example — probably fine):" && echo "$extra"
  [ -z "$missing$empty$extra" ] && echo "OK — .env matches .env.example"
fi
```

Interpret the output:

- **`.env` or `.env.example` missing** → see severity in Step 5.
- **MISSING keys** → blocker. The developer needs to add them (copy the line from `.env.example` and fill in a value).
- **EMPTY keys** → blocker. Placeholder not replaced with a real value.
- **EXTRA keys** → informational. Not a failure; may mean `.env.example` should be updated to document them.

Never copy values from one file to the other yourself, and never print the actual values in the report.

## Step 5: Present a clear report

Produce a single table. Use ✓ / ✗ / ! markers (they render in monospace). Do not add emojis.

```
| Check             | Status | Detail                                  |
|-------------------|--------|-----------------------------------------|
| Platform          | ✓      | macOS / arm64                            |
| Bun               | ✓      | 1.2.14                                   |
| Docker CLI        | ✓      | 27.4.0                                   |
| Docker Compose v2 | ✓      | v2.30.3                                  |
| Docker daemon     | ✗      | not running — start Docker Desktop       |
| Git               | ✓      | 2.47.0                                   |
| Port 3000         | ✓      | free                                     |
| Port 8080         | !      | in use by PID 4821 (another container?)  |
| Port 2575         | ✓      | free                                     |
| Port 5440         | ✓      | free                                     |
| .env              | ✗      | AIDBOX_LICENSE empty (not filled in)     |
```

Below the table, for each ✗ or ! show an actionable next step. Group by severity:

- **Blockers** (project cannot start): missing Bun, Docker CLI, Docker daemon not running, missing bash on Windows, port 8080 or 5440 taken, `.env` missing, `.env` missing keys that exist in `.env.example`, `.env` keys with empty values
- **Workflow breaks**: missing `tail` on Windows, port 3000 taken (web UI won't start), port 2575 taken (MLLP won't start)
- **Optional**: port 8888 taken (only affects integration tests), extra keys in `.env` not in `.env.example`

## Step 6: Give install instructions only for what's missing

Do not dump a generic install wall. For each missing/broken item, give the one canonical command or link for the detected platform.

- **Bun:**
  - Linux/macOS: `curl -fsSL https://bun.sh/install | bash`
  - Windows: `powershell -c "irm bun.sh/install.ps1 | iex"`
- **Docker:**
  - Linux: Docker Engine — https://docs.docker.com/engine/install/
  - macOS/Windows: Docker Desktop — https://www.docker.com/products/docker-desktop/
- **Docker daemon not running:** macOS/Windows → open Docker Desktop; Linux → `sudo systemctl start docker`
- **bash missing on Windows:** install Git for Windows (https://git-scm.com/download/win) and make sure its `bin/` directory is on PATH so `bun run dev` can exec `.sh` scripts
- **Port conflict:** identify the occupier with the platform-specific command above and ask the developer whether to stop it or change the project's port mapping in `docker-compose.yaml`

## Step 7: Offer next steps once clean

When all blockers are clear, tell the developer the exact commands to start the project (from `README.md`):

```sh
bun install
docker compose up -d
bun run migrate
bun run dev
```

And mention: on first Aidbox boot, open http://localhost:8080 and log in with aidbox.app to activate the license.

## Rules

- **Never run `bun install`, `docker compose up`, or migrations as part of this skill.** This skill only *verifies*. Starting the stack is an explicit next step the developer runs.
- **Never edit `.env` or create one from guessed values.**
- **Never suggest `--no-verify`, disabling SSL, or other "just skip the check" workarounds.**
- If a check fails in a way you don't recognize (e.g., `docker info` returns an unusual error), report the raw output and stop — don't speculate.
- If the platform is native Windows without bash (uname fails), stop after Step 1 and tell the developer: `package.json` scripts assume bash. Install Git for Windows first, then re-run this skill from Git Bash.
