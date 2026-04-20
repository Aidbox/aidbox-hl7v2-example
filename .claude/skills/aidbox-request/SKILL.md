---
name: aidbox-request
description: Send HTTP requests to the local Aidbox using the root Client resource credentials from docker-compose.yaml. Use whenever you need to query, create, update, or delete Aidbox resources (FHIR or custom) via curl from the shell — including from other skills like check-errors.
---

# Aidbox Request

Canonical way to authenticate HTTP requests to Aidbox from the shell. **Read the secret from `docker-compose.yaml` at call time — never hardcode it.** If someone rotates the value in docker-compose, hardcoded skills break silently; this skill stays correct.

Do not use this skill for requests from application code — `src/aidbox.ts` already wraps auth (`aidboxFetch`, `getResources`, `putResource`). This skill is for ad-hoc curl from the shell: debugging, `/check-errors`, one-off queries.

## Credentials

Aidbox ships with a built-in `root` Client resource. Its secret is set at container startup via the `BOX_ROOT_CLIENT_SECRET` env var in `docker-compose.yaml`.

- **URL:** `http://localhost:8080` (from `aidbox.ports` in `docker-compose.yaml`)
- **Client ID:** `root` (Aidbox default — no `BOX_ROOT_CLIENT_ID` override in this project)
- **Client Secret:** value of `BOX_ROOT_CLIENT_SECRET` in `docker-compose.yaml`

**Do not confuse with `BOX_ADMIN_PASSWORD`** — that's for logging into the Aidbox web console as the `admin` user, not for API auth.

## Step 1: Extract the secret

Every invocation, read it fresh from `docker-compose.yaml`:

```sh
SECRET=$(awk -F': ' '/^[[:space:]]*BOX_ROOT_CLIENT_SECRET:/ {print $2}' docker-compose.yaml)
```

If `$SECRET` is empty after this, stop and tell the developer: `BOX_ROOT_CLIENT_SECRET` is not set in `docker-compose.yaml`. Do not fall back to a guessed value.

## Step 2: Send the request

Auth: HTTP Basic with `root:$SECRET`. Use `curl -u "root:$SECRET"` — curl does the base64 for you.

```sh
# Search
curl -sf -u "root:$SECRET" 'http://localhost:8080/fhir/Patient?_count=5' | python -m json.tool

# Read by ID
curl -sf -u "root:$SECRET" 'http://localhost:8080/fhir/Patient/<id>' | python -m json.tool

# Create (server-assigned ID)
curl -sf -u "root:$SECRET" \
  -H 'Content-Type: application/fhir+json' \
  -X POST -d @patient.json \
  'http://localhost:8080/fhir/Patient'

# Upsert (client-assigned ID)
curl -sf -u "root:$SECRET" \
  -H 'Content-Type: application/fhir+json' \
  -X PUT -d @patient.json \
  'http://localhost:8080/fhir/Patient/<id>'

# Delete
curl -sf -u "root:$SECRET" -X DELETE 'http://localhost:8080/fhir/Patient/<id>'
```

Flags worth setting by default:

- `-s` silent (no progress bar)
- `-f` fail on 4xx/5xx so errors surface as non-zero exit codes
- Pipe JSON through `python -m json.tool` (or `jq` if you prefer) for readable output

## Step 3: Common FHIR search params

Combine these on search URLs:

- `_count=N` — page size
- `_sort=-_lastUpdated` — newest first (minus sign = descending)
- `_elements=id,status,...` — partial projection (keeps responses small)
- `_include=<Resource>:<ref>` / `_revinclude=<Resource>:<ref>` — graph expansion
- `status=value1,value2` — multi-value filter

## Troubleshooting

- **401 Unauthorized** → secret mismatch. Re-check `docker-compose.yaml` line; confirm Aidbox actually started with that value (`docker compose logs aidbox | grep -i secret`). If you rotated the secret, restart the container: `docker compose restart aidbox`.
- **403 Forbidden** → `root` has full access; a 403 as `root` usually means the endpoint isn't FHIR (e.g., a `/rpc` method with its own auth rules) or the resource type isn't defined.
- **404 on `/fhir/<CustomType>`** → the custom resource isn't registered. Check `init-bundle.json` has the matching `StructureDefinition`.
- **Connection refused** → Aidbox isn't up. Run `/setup` or `docker compose ps`.
- **Health check (no auth required):** `curl -sf http://localhost:8080/health` returns plain text. Useful for sanity-checking the container before debugging auth.

## Rules

- Always re-read the secret from `docker-compose.yaml`. Do not cache it across skill invocations or copy it into memory/notes.
- Never commit the secret to new files. The one in `docker-compose.yaml` is a demo credential for this example project, not a production secret.
- Use `/auth/userinfo` (`curl -sf -u "root:$SECRET" http://localhost:8080/auth/userinfo`) to sanity-check that credentials are valid without touching FHIR data.
- If `docker-compose.yaml` ever switches the secret to a `${VAR}` reference resolved from `.env`, update the extraction step — read from `.env` instead, and verify the `.env` value is present before proceeding.
