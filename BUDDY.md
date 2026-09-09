# Buddy read-only gateway (legacy name)

Buddy has been upgraded to **TOH**. See `TOH.md` for the current commands and safety model. The old `buddy:read` command remains available as a compatibility alias and has no write capability.

Buddy is a local command-line reader for the Direk Tony app database. It is not a website page and it does not use the Supabase dashboard.

## Safety boundaries

- Uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Never uses `SUPABASE_SERVICE_ROLE_KEY`.
- Authenticates as the dedicated Buddy user before each read.
- Supabase Row Level Security remains enforced.
- Only `SELECT` is implemented.
- Only explicitly allowlisted database resources beginning with `buddy_` are accepted.
- Reads at most 100 rows per command.
- Fields whose names look like passwords, tokens, secrets, or keys are redacted from output.

## Configuration

Add these values to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
BUDDY_EMAIL=YOUR_BUDDY_AUTH_EMAIL
BUDDY_PASSWORD=YOUR_BUDDY_AUTH_PASSWORD
BUDDY_READ_RESOURCES=buddy_app_overview
```

Create the read-only `buddy_app_overview` view and its `SELECT` policy/grant yourself in Supabase. Buddy does not create or modify database objects.

## Commands

Validate local configuration without contacting Supabase:

```bash
npm run buddy:read -- status
```

Read up to 25 rows from the allowlisted view:

```bash
npm run buddy:read -- read buddy_app_overview 25
```

To add another view, give it a `buddy_` prefix and append it to `BUDDY_READ_RESOURCES`.
