# @argus/cloud — Vigilis Governance Cloud

Org/key store, ingest API, and audit dashboard for agent heal/refusal receipts.
Auth is [Auth.js v5](https://authjs.dev) (self-hosted, MIT) with GitHub OAuth;
no paid auth vendor. Storage is Node's built-in `node:sqlite`.

## Run locally

```bash
pnpm install
cp apps/cloud/.env.example apps/cloud/.env.local   # then set AUTH_SECRET
pnpm --filter @argus/cloud dev                      # http://localhost:3300
```

`AUTH_SECRET` is required (`openssl rand -base64 32`).

### Without GitHub (zero setup)

With `VIGILIS_CLOUD_DEV=1` (or simply no GitHub creds set), the sign-in page
shows a **Dev login** button that signs you in as `dev@vigilis.local` with no
password. On first sign-in the app bootstraps a user, a personal org, an admin
membership, and a default API key. Dev login is hard-disabled whenever real
GitHub creds are present, so it cannot be used in a configured deployment.

### With GitHub OAuth (free)

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. **Homepage URL:** `http://localhost:3300`
3. **Authorization callback URL:** `http://localhost:3300/api/auth/callback/github`
4. Register, copy the **Client ID**, generate a **Client secret**.
5. Put them in `.env.local` as `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.

Restart dev; the sign-in page now offers **Sign in with GitHub**.

## API keys

Each org manages keys at `/keys`. A key's full value is shown **once** at
creation; only its sha256 hash + a masked preview are stored. The agent
authenticates ingest calls with `Authorization: Bearer <key>`:

```bash
VIGILIS_CLOUD_URL=http://localhost:3300 VIGILIS_CLOUD_KEY=<your org key>
```

The legacy seeded dev key `vigilis_dev_key` (org "Acme Dev") remains valid for
backward compatibility.

## Scripts

```bash
pnpm --filter @argus/cloud build   # next build
pnpm --filter @argus/cloud test    # vitest
pnpm --filter @argus/cloud dev     # next dev -p 3300
```
