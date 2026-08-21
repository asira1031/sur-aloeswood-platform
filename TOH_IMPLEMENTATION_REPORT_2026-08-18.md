# TOH Implementation Report

**Application:** Direk Tony / SUR Aloeswood Platform  
**Repository:** `asira1031/sur-aloeswood-platform`  
**Report date:** 2026-08-18  
**Local application:** `http://localhost:3002`  
**TOH page:** `http://localhost:3002/admin/toh`  
**Implementation commit:** `024b840819e09870a12d3b7dcd4716ab8a2bfdbc`

## Executive summary

TOH is now implemented as an application-specific, admin-only AI assistant for the Direk Tony application. It is designed for technical explanation and read-only diagnosis. It cannot edit Supabase records, approve transactions, change roles, deploy the application, or perform autonomous repairs.

The feature passed its local security tests, lint validation, production build, dependency audit, route checks, and unauthenticated access check. The interface is available locally, but OpenAI-powered answers require the owner to configure a server-only `OPENAI_API_KEY`.

The changes are committed locally but have not been pushed to GitHub or deployed to Vercel.

## Work completed

### 1. Admin TOH interface

- Added `/admin/toh`.
- Added TOH to the Admin Modules list.
- Added suggested diagnostic questions.
- Added a 4,000-character question limit.
- Added evidence classification and evidence-boundary display.
- Added warnings against submitting passwords, API keys, customer records, wallet details, and KYC documents.

### 2. Secure TOH API

- Added `POST /api/toh/chat`.
- Requires a valid Supabase bearer session.
- Allows only active `ADMIN` and `SUPER_ADMIN` profiles.
- Rejects unauthenticated requests with HTTP `401`.
- Applies a limit of 20 requests per hour per client identifier.
- Uses the server-only OpenAI API key; the key is never sent to the browser.
- Uses the OpenAI Responses API with response storage disabled through `store: false`.
- Exposes no database, filesystem, deployment, or mutation tools to the model.

### 3. Safe fallback mode

When `OPENAI_API_KEY` is not configured, TOH remains usable in deterministic evidence mode. It provides bounded guidance for:

- Application status and health questions
- Authentication and role-routing problems
- Tree-record questions
- Financial and wallet protected domains
- GitHub, Vercel, commit, and deployment comparisons

This fallback does not call OpenAI and does not change application data.

### 4. Application-specific knowledge boundary

TOH is instructed to use information only from the Direk Tony / `sur-aloeswood-platform` application. It must not mix this client's data or assumptions with:

- SUR Final Apps
- rejected sur app
- agarwood-platform
- Any other client application

TOH separates owner-defined, runtime-observed, test-derived, database-derived, code-derived, documentation-derived, historical, and AI-inferred information.

## Safety and authority

TOH remains at Authority Level 0/1: Observe and Diagnose.

The following actions are not available to TOH:

- Supabase insert, update, upsert, or delete
- Supabase RPC execution
- Service-role access
- Wallet or financial modification
- Tree ownership modification
- Role, permission, authentication, or RLS modification
- KYC or legal approval
- Git push
- Vercel deployment
- Autonomous repair

Protected domains must remain subject to human approval and separate verification.

## Verification results

| Check | Result |
|---|---|
| TOH and security tests | 20 passed, 0 failed |
| TypeScript / production build | Passed |
| Generated application routes | 68 |
| `/admin/toh` build route | Passed |
| `/api/toh/chat` build route | Passed |
| ESLint | 0 errors, 161 existing warnings |
| npm dependency audit | 0 vulnerabilities |
| Unauthenticated TOH API request | Correctly rejected with HTTP 401 |
| Unauthenticated `/admin/toh` access | Correctly redirected to login |
| Browser console during access test | 0 errors/warnings |

The 161 lint warnings are existing application technical debt and were not introduced as TOH build errors.

## Database boundary

No Supabase website changes or database mutations were performed for this implementation.

The previously authorized Buddy/TOH gateway remains read-only and limited to allowlisted `buddy_*` resources. The last bounded result for `buddy_app_overview` reported 18 rows. This result does not prove the completeness, ownership accuracy, or overall health of the entire production database.

## Environment configuration required

For local OpenAI mode, the owner must add the following to `.env.local`:

```env
OPENAI_API_KEY=your_server_only_openai_key
TOH_OPENAI_MODEL=gpt-5.6-luna
```

Rules:

- Never commit `.env.local`.
- Never paste the actual API key into chat, notes, screenshots, or source code.
- For production, configure the same values as server environment variables in Vercel.
- Restart the local development server after adding or changing environment values.

## Git and deployment status

- Local branch: `master`
- TOH implementation commit: `024b840819e09870a12d3b7dcd4716ab8a2bfdbc`
- Local branch status at completion: 2 commits ahead of `origin/master`
- Last recorded production commit: `597f1c42d3a05c3b82b23ddd84309f2259fc368f`
- Recorded production URL: `https://sur-aloeswood-platform.vercel.app`
- TOH implementation pushed to GitHub: No
- TOH implementation deployed to Vercel: No

The local implementation must not be described as live in production until the GitHub commit and Vercel deployment commit are verified.

## Remaining owner actions

1. Create or retrieve an OpenAI API key directly from the authorized OpenAI account.
2. Add the key to local `.env.local` without sharing it in chat.
3. Restart the application and test TOH using an active Admin or Super Admin account.
4. Define and monitor an OpenAI usage budget.
5. Complete the remaining owner decisions in `TOH_OWNER_BLUEPRINT.md`.
6. Review the two local commits before approving a GitHub push.
7. Approve a Vercel deployment only after local authenticated testing succeeds.

## Current conclusion

**Status: IMPLEMENTED LOCALLY — OPENAI CONFIGURATION AND AUTHENTICATED TEST REQUIRED**

The TOH interface, API, safeguards, fallback mode, documentation, and tests are complete locally. No production write authority has been granted. The remaining operational steps are server-key configuration, authenticated admin testing, owner review, GitHub push approval, and Vercel deployment approval.
