---
name: aidbox-request
description: Authenticate ad-hoc curl requests to the local Aidbox using the root Client secret from docker-compose.yaml. Use for debugging and one-off queries from the shell (not from app code — `src/aidbox.ts` already wraps auth).
---

# Aidbox Request

**Read the secret fresh from `docker-compose.yaml` every time. Never hardcode.** Rotating the value then would break anything that cached it.

## Auth

- URL: `http://localhost:8080`
- Client ID: `root` (Aidbox default)
- Client Secret: `BOX_ROOT_CLIENT_SECRET` in `docker-compose.yaml` (not `BOX_ADMIN_PASSWORD` — that's the web-console password for the `admin` user, not API auth)

## Request

```sh
SECRET=$(awk -F': ' '/^[[:space:]]*BOX_ROOT_CLIENT_SECRET:/ {print $2}' docker-compose.yaml)
[ -z "$SECRET" ] && echo "BOX_ROOT_CLIENT_SECRET missing from docker-compose.yaml" && exit 1

# Search / read / create / update / delete — use the HTTP verb you need.
curl -sf -u "root:$SECRET" 'http://localhost:8080/fhir/Patient?_count=5' | jq
curl -sf -u "root:$SECRET" 'http://localhost:8080/fhir/Patient/<id>' | jq
curl -sf -u "root:$SECRET" -H 'Content-Type: application/fhir+json' \
  -X PUT -d @patient.json 'http://localhost:8080/fhir/Patient/<id>'
```

Useful curl flags: `-s` silent, `-f` fail on 4xx/5xx. Pipe through `jq` (or `python -m json.tool`) for readable output.

## Useful FHIR search params

`_count=N` · `_sort=-_lastUpdated` (newest first) · `_elements=id,status,...` (partial projection) · `_include` / `_revinclude` · `status=a,b` (multi-value)

## Troubleshooting

- **401** — secret mismatch. Re-check `docker-compose.yaml`; if rotated, `docker compose restart aidbox`.
- **403 as root** — endpoint isn't FHIR (e.g., `/rpc` with its own auth) or resource type isn't defined.
- **404 on `/fhir/<CustomType>`** — resource not registered; check `init-bundle.json` StructureDefinition.
- **Connection refused** — Aidbox not up. Check with `docker compose ps` or `curl -sf http://localhost:8080/health` (no auth needed).
- **Sanity-check creds** — `curl -sf -u "root:$SECRET" http://localhost:8080/auth/userinfo`.

## Note

If `docker-compose.yaml` ever switches to a `${VAR}` reference resolved from `.env`, change the extraction to read `.env` instead.
