# Guardian Developer Studio

Guardian has two deliberately separate surfaces for the SUR Aloeswood Platform.

## Developer Studio

- Available only in `NODE_ENV=development` on `localhost`, `127.0.0.1`, or `::1`.
- Requires a real active SUR `ADMIN` or `SUPER_ADMIN` session.
- Creates structured feature plans and queues local JSON briefs under `.guardian/requests/`.
- Runs only named verification workflows whose executable and arguments are fixed in source.
- Does not accept shell commands, filesystem paths, Git operations, deployment operations, or arbitrary code from the browser.
- Source changes and E2E browser work remain Codex-reviewed local actions with normal approval and verification.

## SQL Bridge

- Hard-bound to Supabase project `dvidrbhfzzhgwyempgtu`.
- Uses the signed-in admin token and database RLS; no service-role key is exposed.
- Supports one bounded `SELECT`, `INSERT`, `UPDATE`, or `DELETE` statement.
- Writes require `EXECUTE SUR WRITE` and all database executions are audited.
- Auth, Storage, system schemas, DDL, grants, comments, multiple statements, and system capabilities remain blocked.

## End-to-end workflow

1. Owner and Codex brainstorm the feature.
2. Save the accepted brief with **Queue for Codex**.
3. Codex inspects the repository and database contracts, implements the source/migration, and shows the diff.
4. Run security, focused behavior, lint, build, and browser E2E checks.
5. Deploy only after explicit owner approval, then verify the deployed commit and workflow.
