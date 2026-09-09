# TOH — application intelligence

TOH is the local, application-specific operating intelligence for this repository. Version 1 is intentionally read-only. It can inspect local source identity, regenerate a local system map, verify the local build, and read explicitly allowlisted Supabase views through the existing RLS-protected reader account.

TOH does not import truth from another application. Its current baseline is documented in `TOH_CURRENT_SYSTEM_DISCOVERY.md`.

## Commands

Use `npm.cmd` in PowerShell because this computer blocks the `npm.ps1` wrapper.

```powershell
npm.cmd run toh -- status
npm.cmd run toh -- map
npm.cmd run toh -- refresh
npm.cmd run toh -- workflows
npm.cmd run toh -- trace seedling-purchase
npm.cmd run toh -- invariants
npm.cmd run toh -- incidents
npm.cmd run toh -- gate financial high false false false unknown
npm.cmd run toh -- audit
npm.cmd run toh -- reconcile
npm.cmd run toh -- health
npm.cmd run toh -- snapshot before-change
npm.cmd run toh -- compare before-change after-change
npm.cmd run toh -- impact app/investor/wallet/page.tsx
npm.cmd run toh -- decay
npm.cmd run toh -- incident:add wallet CONFIRMED "symptom" "root cause"
npm.cmd run toh -- proof
npm.cmd run toh -- read buddy_app_overview 25
npm.cmd run toh -- check buddy_app_overview
npm.cmd run toh -- verify
npm.cmd run toh:test
```

The old command remains compatible:

```powershell
npm.cmd run buddy:read -- read buddy_app_overview 25
```

## In-app TOH

Active admins can open `/admin/toh`. The page sends the current Supabase session token to the server-only `/api/toh/chat` route. TOH has no database, deployment, or mutation tools; it receives only the admin's question and the bounded application context documented in source.

Add these values to `.env.local` for local use and to the Vercel project's server environment for deployment. Never commit or paste the key into chat:

```env
OPENAI_API_KEY=your_server_only_key
TOH_OPENAI_MODEL=gpt-5.6-luna
```

Without `OPENAI_API_KEY`, the same page safely returns deterministic evidence guidance. With the key, it uses the OpenAI Responses API with `store: false`, no tools, a 4,000-character question limit, and an admin-only rate limit.

## Authority and safety

- Authority Level 0: Observe.
- Live write actions are frozen.
- Database access uses the public anon key plus an authenticated reader, so RLS remains active.
- Only explicitly allowlisted resources beginning with `buddy_` are readable.
- Each read is limited to 100 rows.
- Secret-like fields are redacted.
- There are no insert, update, upsert, delete, RPC, storage-write, auth-admin, schema, Git push, or deployment commands.
- Money, ownership, identity, authentication, roles, permissions, RLS, legal/KYC, and production schema are protected domains.

## Optional TOH environment names

Existing Buddy environment names remain supported. They can later be renamed without breaking the gateway:

```env
TOH_READER_EMAIL=reader@example.com
TOH_READER_PASSWORD=use-a-strong-rotated-password
TOH_READ_RESOURCES=buddy_app_overview,buddy_tree_health
```

If these are absent, TOH falls back to `BUDDY_EMAIL`, `BUDDY_PASSWORD`, and `BUDDY_READ_RESOURCES`. Never commit `.env.local`.

## What each command proves

- `status` checks local configuration only. It does not connect to Supabase.
- `map` derives routes, APIs, RPC references, roles, SQL files, Git identity, and evidence gaps from local source.
- `refresh` regenerates `toh/generated/system-model.json` from source plus the control plane, workflows, invariants, and incident memory. It writes only this local model.
- `workflows` lists critical workflow definitions; `trace` compares expected steps with currently proven evidence and stops at the first unproven runtime step.
- `invariants` lists machine-checkable target truths without claiming that missing live checks passed.
- `incidents` displays structured local incident memory and prevention rules.
- `gate` applies deterministic authority, protected-domain, reversibility, idempotency, test, and root-cause rules. With Level 0 and the write kill switch, mutation cannot pass.
- `audit` states which TOH capabilities are implemented, local-only, frozen, blocked by owner truth, or not implemented.
- `reconcile` compares workflow evidence and code-referenced RPCs against local source/SQL, reporting missing definitions without querying production.
- `health` summarizes local evidence, blueprint readiness, kill-switch state, worktree state, and proof limitations.
- `snapshot` and `compare` capture local source hashes before/after a change without copying `.env.local` or touching live systems.
- `impact` performs conservative static change-impact and protected-domain classification for a repository file.
- `decay` invalidates confidence after commit, dirty-worktree, or evidence-age changes.
- `incident:add` appends a bounded structured incident to local memory; it never writes to production.
- `proof` evaluates the full source/build/test/database/role/browser/invariant/regression/deployment contract and refuses broad completion when evidence is missing.

The owner must complete `TOH_OWNER_BLUEPRINT.md` before TOH can treat product, business, security, data, or change intent as authoritative. Operational procedures and proof language are in `TOH_OPERATIONS.md`.
- `read` performs one bounded live read from an allowlisted view. It does not prove the whole database is healthy.
- `check` performs bounded read-only uniqueness and essential-field invariants on the allowlisted tree view and stores local evidence. It does not infer owner rules or prove the rest of the database.
- `verify` runs lint and a production build. It does not prove live database, role, browser, or deployment behavior.

TOH must report these proof limits and must not say an application workflow is complete from source presence alone.
