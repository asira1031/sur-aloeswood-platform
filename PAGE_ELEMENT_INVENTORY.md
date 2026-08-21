# Page and Element Inventory

**Version:** `0.1-DRAFT`  
**Basis:** Existing local Next.js routes  
**Important:** Presence in source means `EXISTING IMPLEMENTATION`, not owner-approved requirement.

## Shared behavior contract

Unless a row overrides it, every page requires: visible loading indicator; actionable empty state; plain-language error with retry when safe; keyboard-accessible controls; mobile single-column layout; tablet adaptive grid; desktop constrained readable width; no horizontal overflow; session-expiry recovery; and no false success. Exact visual approval is pending.

Shared actionable elements:

| Element ID | Element | Visibility and action | Required feedback/failure |
|---|---|---|---|
| GLB-NAV-001 | Primary navigation | Routes user to authorized modules | Current location visible; inaccessible route blocked |
| GLB-AUTH-001 | Login/session gate | Protected roles only | Loading while verifying; redirect on missing/expired session |
| GLB-LOGOUT-001 | Logout | Authenticated roles | Clear session, redirect to login; report failure |
| GLB-RETRY-001 | Retry | Failed data loads | Disabled while retrying; retain safe user context |
| GLB-FEEDBACK-001 | Status/error region | All users | Accessible success/error text; never false success |

## Public and shared pages

| Page ID | Page / route | Role; purpose | Entry / exits | Required data | Meaningful element IDs |
|---|---|---|---|---|---|
| PUB-HOME-001 | Home `/` | Public; explain offering | Direct/nav → register/login/public info | Approved marketing content UNKNOWN | HOME-REG-001, HOME-LOGIN-001, HOME-NAV-001 |
| PUB-LOGIN-001 | Login `/login` | All roles; authenticate and route | Protected redirect/direct → role dashboard/reset/register | Supabase auth, profile role/status | LOGIN-EMAIL-001, LOGIN-PASS-001, LOGIN-SUBMIT-001, LOGIN-FORGOT-001, LOGIN-REG-001 |
| PUB-ADMINLOGIN-001 | Legacy admin login `/admin-login` | Admin; alternate login | Direct → admin dashboard | Auth/profile | ADML-EMAIL-001, ADML-PASS-001, ADML-SUBMIT-001; necessity UNKNOWN |
| PUB-REGISTER-001 | Co-planter register `/register` | Public; create pending account | Home/login → login/status | Registration requirements | REG-FORM-001, REG-SUBMIT-001, REG-LOGIN-001 |
| PUB-FARMREG-001 | Farmer register `/farmer/register` | Public; create farmer application | Direct → login/status | Identity/contact/resume requirements | FREG-FORM-001, FREG-RESUME-001, FREG-SUBMIT-001 |
| PUB-SETPASS-001 | Set password `/set-password` | Invited/recovery user | Auth link → login | Recovery session | PASS-NEW-001, PASS-CONFIRM-001, PASS-SUBMIT-001 |
| PUB-UNAUTH-001 | Unauthorized `/unauthorized` | Any blocked role | Access guard → safe dashboard/login | Reason-safe message | UNAUTH-BACK-001, UNAUTH-LOGIN-001 |
| PUB-SESSION-001 | Session expired `/session-expired` | Authenticated user | Session guard → login | None | SESSION-LOGIN-001 |
| PUB-HEALTH-001 | Health `/health` | Public/operator; current UI health display | Direct → home | Health semantics UNKNOWN | HEALTH-REFRESH-001 |
| PUB-LAUNCH-001 | Launch `/launch` | Operator/admin; launch checklist | Direct → modules | Checklist source | LAUNCH-CHECK-001; production purpose UNKNOWN |
| PUB-TEST-001 | Test `/test` | Developer/test | Direct | UNKNOWN | TEST-ACTION-001; production inclusion UNKNOWN |
| PUB-TREE-001 | Tree registry `/tree` | Public/co-planter; portfolio view | Nav → tree details/public pages | Tree registry under RLS | TREE-FILTER-001, TREE-SELECT-001 |
| PUB-CERT-001 | Certificates `/certificates` | Co-planter/public status UNKNOWN | Nav → tree | Profile/tree/growth | CERT-SELECT-001, CERT-PRINT-001 |
| PUB-HARVEST-001 | Harvest `/harvest` | Co-planter; estimates/readiness | Nav → tree | Profile/tree/growth/rules | HARV-TREE-001, HARV-PROJ-001 |
| PUB-PLANT-001 | Plantation `/plantation` | Public/co-planter; farms | Nav → legalities/tree | Farms/licenses | PLANT-FARM-001, PLANT-DOC-001 |
| PUB-LEGAL-001 | Legalities `/legalities` | Public/co-planter; legal information | Nav → plantation | Approved legal content/docs | LEGAL-DOC-001 |

## Admin pages

All pages require `GLB-AUTH-001`; current layout accepts ADMIN, SUPER_ADMIN, and STAFF, while protected API rules differ. Exact role visibility is `CONFLICTING`.

| Page ID | Page / route | Purpose | Required data | Entry / exits | Meaningful element IDs |
|---|---|---|---|---|---|
| ADM-ROOT-001 | `/admin` | Redirect to dashboard | Session | Direct → dashboard | None |
| ADM-LOGIN-001 | `/admin/login` | Admin login variant | Auth/profile | Direct → dashboard | ALOGIN-EMAIL-001, ALOGIN-PASS-001, ALOGIN-SUBMIT-001; necessity UNKNOWN |
| ADM-DASH-001 | `/admin/dashboard` | Operational overview/queues | Profiles, purchases, trees, cash-in, tickets | Login/modules | ADASH-REFRESH-001, ADASH-MODULE-001, ADASH-QUEUE-001 |
| ADM-TOH-001 | `/admin/toh` | Read-only app diagnosis | Session; bounded prompt context | Dashboard → dashboard | TOH-PROMPT-001, TOH-SUGGEST-001, TOH-SUBMIT-001 |
| ADM-COP-001 | `/admin/coplanters` | Account/KYC queue | Profiles/KYC | Dashboard → detail | COP-FILTER-001, COP-OPEN-001, COP-APPROVE-001, COP-REJECT-001 |
| ADM-COPDET-001 | `/admin/coplanters/[profileId]` | Profile/KYC detail | Selected profile and records | Queue → queue/modules | COPD-APPROVE-001, COPD-REJECT-001, COPD-STATUS-001 |
| ADM-PUR-001 | `/admin/purchases` | Purchase approval queue | Purchases/profiles/trees | Dashboard → registry | PUR-FILTER-001, PUR-APPROVE-001, PUR-REJECT-001 |
| ADM-TREEREG-001 | `/admin/tree-registry` | Tree/AG registry | Trees, profiles, farms, assignments | Dashboard → maintenance | TREG-OWNER-001, TREG-TREE-001, TREG-EDIT-001, TREG-PROOF-001 |
| ADM-TREEMNT-001 | `/admin/tree-maintenance` | Orders and assignments | Orders, trees, farmers, proofs | Dashboard → farmer/task | TMNT-ASSIGN-001, TMNT-STATUS-001, TMNT-PROOF-001 |
| ADM-TREAS-001 | `/admin/treasury` | Cash-in approvals/wallet crediting | Requests, wallets, ledger, profiles | Dashboard → audit | TREAS-APPROVE-001, TREAS-REJECT-001, TREAS-FILTER-001 |
| ADM-WITH-001 | `/admin/withdrawals` | Withdrawal review | Requests, wallets, ledger | Dashboard → audit | WITH-APPROVE-001, WITH-REJECT-001, WITH-FILTER-001 |
| ADM-FIN-001 | `/admin/finance-distribution` | Allocation/payout settlement | Purchases, allocations, finance rules | Dashboard → reports/audit | FIN-DATE-001, FIN-ALLOC-001, FIN-SETTLE-001 |
| ADM-GARD-001 | `/admin/gardener` | Farmer/gardener management | Profiles/gardeners | Dashboard → assignments | GARD-ADD-001, GARD-EDIT-001, GARD-STATUS-001 |
| ADM-SUP-001 | `/admin/support` | Support queue/replies | Tickets/chats/messages/profiles | Dashboard → ticket | ASUP-FILTER-001, ASUP-OPEN-001, ASUP-REPLY-001, ASUP-CLOSE-001 |
| ADM-NOTIF-001 | `/admin/notifications` | System notification management | Notifications/profiles | Dashboard → related module | ANOT-FILTER-001, ANOT-READ-001, ANOT-CREATE-001 |
| ADM-ACT-001 | `/admin/activity` | Operational activity feed | Activity/evidence records | Dashboard → affected module | ACT-FILTER-001, ACT-OPEN-001 |
| ADM-AUDIT-001 | `/admin/audit` | Financial/operational audit | Ledgers, allocations, workflows | Dashboard → records | AUD-FILTER-001, AUD-EXPORT-001 |
| ADM-LEGAL-001 | `/admin/legal` | Compliance documents | Farms/legal docs/storage | Dashboard → public legal | ALEGAL-UPLOAD-001, ALEGAL-EDIT-001, ALEGAL-PUBLISH-001 |
| ADM-REPORT-001 | `/admin/reports` | Analytics/summaries | Aggregate business data | Dashboard → modules | REPORT-FILTER-001, REPORT-EXPORT-001 |
| ADM-SET-001 | `/admin/settings` | Platform configuration | Settings/preferences | Dashboard → dashboard | SET-FORM-001, SET-SAVE-001 |

## Co-Planter / Investor pages

| Page ID | Page / route | Purpose | Required data | Entry / exits | Meaningful element IDs |
|---|---|---|---|---|---|
| INV-ROOT-001 | `/investor` | Redirect to dashboard | Session | Direct → dashboard | None |
| INV-DASH-001 | `/investor/dashboard` | Portfolio summary/action hub | Profile, wallet, trees, notices | Login → modules | IDASH-REFRESH-001, IDASH-MODULE-001 |
| INV-MARKET-001 | `/investor/marketplace` | Buy package | Profile, wallet, package rules | Dashboard → purchase result | BUY-QTY-001, BUY-CONFIRM-001, BUY-SUBMIT-001 |
| INV-TREES-001 | `/investor/my-trees` | View owned trees | Profile/tree registry/logs | Dashboard → timeline/care | ITREE-FILTER-001, ITREE-OPEN-001 |
| INV-TIME-001 | `/investor/timeline` | Growth/activity timeline | Trees/growth logs | Tree/dashboard → tree | TIME-TREE-001, TIME-REFRESH-001 |
| INV-WALLET-001 | `/investor/wallet` | Balance, ledger, cash-in, withdrawal | Wallet, transactions, requests | Dashboard → request status | WAL-CASHIN-001, WAL-WITHDRAW-001, WAL-PROOF-001, WAL-REFRESH-001 |
| INV-CARE-001 | `/investor/care-services` | Purchase/pay tree care | Ownership, wallet, orders | Tree/dashboard → order | CARE-TREE-001, CARE-ORDER-001, CARE-PAY-001 |
| INV-REC-001 | `/investor/recovery` | Request termination/recovery | Profile, eligible packages/trees, wallet | Dashboard → status | REC-SELECT-001, REC-ACK-001, REC-SUBMIT-001 |
| INV-REF-001 | `/investor/referrals` | Referral details/bonuses | Profile/referral/ledger | Dashboard → wallet | REF-COPY-001, REF-LIST-001 |
| INV-SUP-001 | `/investor/support` | Open/track support | Tickets/chats/messages | Dashboard → thread | ISUP-NEW-001, ISUP-OPEN-001, ISUP-REPLY-001 |
| INV-SET-001 | `/investor/settings` | Preferences/account settings | Profile/preferences | Dashboard → dashboard | ISET-FORM-001, ISET-SAVE-001 |
| INV-PROF-001 | `/investor/profile` | View/edit allowed profile fields | Profile | Dashboard → settings | IPROF-EDIT-001, IPROF-SAVE-001 |
| INV-NOTIF-001 | `/investor/notifications` | View messages | Owner notifications | Dashboard → related module | INOT-OPEN-001, INOT-READ-001 |

## Farmer / caretaker pages

| Page ID | Page / route | Purpose | Required data | Entry / exits | Meaningful element IDs |
|---|---|---|---|---|---|
| FAR-ROOT-001 | `/farmer` | Redirect to dashboard | Session | Direct → dashboard | None |
| FAR-DASH-001 | `/farmer/dashboard` | Assignment overview | Gardener profile, assignments, trees/logs | Login → task/pages | FDASH-REFRESH-001, FDASH-TASK-001 |
| FAR-TASK-001 | `/farmer/dashboard/task` | Work queue and task updates | Assignments/orders/trees | Dashboard → proof/report | FTASK-OPEN-001, FTASK-STATUS-001, FTASK-PROOF-001 |
| FAR-TREES-001 | `/farmer/assigned-trees` | Inspect assigned trees | Assignment RPC/table, trees, owners, logs | Dashboard → updates | FATREE-OPEN-001, FATREE-FILTER-001 |
| FAR-PHOTO-001 | `/farmer/photo-updates` | Submit photo evidence | Assignment/tree/storage | Task → reports | PHOTO-TREE-001, PHOTO-FILE-001, PHOTO-SUBMIT-001 |
| FAR-GROW-001 | `/farmer/growth-logs` | Submit health/measurements/notes | Assignment/tree/logs | Task → reports | GROW-TREE-001, GROW-FORM-001, GROW-SUBMIT-001 |
| FAR-GPS-001 | `/farmer/gps` | Update location reference | Assignment/tree/geolocation | Task → reports | GPS-TREE-001, GPS-CAPTURE-001, GPS-SUBMIT-001 |
| FAR-REPORT-001 | `/farmer/reports` | Review submitted work | Assignments, trees, logs | Dashboard → task | FREP-FILTER-001, FREP-OPEN-001 |
| FAR-PROF-001 | `/farmer/profile` | Farmer profile | Profile/gardener | Dashboard → dashboard | FPROF-EDIT-001, FPROF-SAVE-001 |

## API route inventory

| Contract ID | Route | Observed authority/purpose | Blueprint status |
|---|---|---|---|
| API-REG-COP-001 | `POST /api/register/coplanter` | Public registration with server credential | Required behavior not owner approved |
| API-REG-FAR-001 | `POST /api/farmer/register` | Farmer registration/resume/profile | Required behavior not owner approved |
| API-BUY-001 | `POST /api/investor/buy-seedling` | Authenticated purchase RPC | RPC/live transaction unverified |
| API-ADM-PUR-001 | `POST /api/admin/purchases/approve` | Admin purchase/tree/allocation mutation | Protected; transaction/idempotency contract incomplete |
| API-ADM-FAR-001 | `/api/admin/farmers` | Admin farmer profile management | Protected; exact permission unknown |
| API-HEY-001 | `POST /api/heygen/generate` | Active admin video generation | Provider/product need owner confirmation |
| API-HEYTEST-001 | `/api/heygen/test` | Provider test | Production inclusion UNKNOWN |
| API-TOH-001 | `POST /api/toh/chat` | Active admin/Super Admin read-only reasoning | Owner-approved boundary; no tools |

## Page completeness gate

Routes are inventoried, but required data fields, approved copy, exact empty/loading/error states, role permissions, and responsive layouts remain partly `UNKNOWN`. No page is considered blueprint-locked until its owner-approved purpose and controls are confirmed.
