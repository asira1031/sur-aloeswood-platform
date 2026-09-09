# UI and UX Contract

**Version:** `0.1-DRAFT`  
**Status:** `DESIGN DECISION REQUIRED`

## Existing visual observations

- Forest green, emerald, amber/gold, white, and slate palette — **EXISTING IMPLEMENTATION**.
- Rounded cards, large hero panels, gradients, and responsive utility classes — **EXISTING IMPLEMENTATION**.
- Typography uses application/system styling; official font family is **UNKNOWN**.
- Existing layouts vary by page and are not proof of owner approval.

## Decisions required

| Contract area | Required owner decision |
|---|---|
| Color tokens | Exact primary, secondary, success, warning, error, neutral, background, and contrast values |
| Typography | Approved families, scale, weights, line heights, and fallback fonts |
| Spacing | Base unit and page/card/form spacing scale |
| Radius/shadow | Card, modal, input, button, badge rules |
| Layout | Approved navbar/sidebar structure by role and desktop width |
| Density | Table and form density, especially admin operations |
| Icons | Icon library/style and accessible labeling |
| Responsive | Supported phone/tablet/desktop widths and behavior |
| Accessibility | Target standard, keyboard flow, focus visibility, screen-reader and contrast requirements |
| Language | English, Filipino/Taglish, or multilingual behavior |

## Proposed interaction contract

For every actionable element:

```text
USER ACTION
→ CLIENT VALIDATION
→ CONTROL DISABLED + VISIBLE LOADING
→ ONE AUTHORITATIVE REQUEST
→ SERVER AUTHORIZATION AND VALIDATION
→ ATOMIC RESULT
→ ACCESSIBLE SUCCESS OR ACTIONABLE ERROR
→ REFRESHED CANONICAL STATE
```

### Required states

- Loading: skeleton/spinner plus descriptive text; destructive/financial controls disabled.
- Empty: explain why it is empty and present the next permitted action.
- Validation failure: field-specific message without erasing valid entries.
- Network/timeout: no success message; safe retry only when idempotent.
- Unauthorized: explain access boundary without exposing protected data.
- Success: identify the completed state and next destination; never imply external settlement without evidence.
- Stale state: refresh canonical server state before protected confirmation.
- Duplicate click: ignore/disable subsequent submission and reuse the same idempotency identity.

## Role-first UX goals

| Role | Must understand first | Primary action | Failure recovery |
|---|---|---|---|
| Public | What the service is and whether it fits them | Register or log in | Clear requirements/support path |
| Co-Planter | Current account/portfolio status and next valid action | View trees or initiate approved transaction | Retain request context; show status and support |
| Farmer | Assigned work due now | Open task and submit evidence | Draft preservation/retry without duplicates |
| Admin | Queues requiring attention and risk | Review one verified item | No partial approval; audit-safe retry/escalation |
| TOH user | Evidence level and action boundary | Ask diagnosis question | Deterministic fallback/no mutation |

## Responsive contract

- Mobile: single-column reading order, minimum touch targets, no hidden required action, tables become labeled cards or controlled horizontal regions.
- Tablet: two-column where information hierarchy remains clear; forms retain labels and validation proximity.
- Desktop: constrained content width, stable navigation, multi-column only when scanability improves.
- Exact breakpoints and reference screens: **DESIGN DECISION REQUIRED**.

## Error contract

All critical pages must explicitly handle invalid input, unauthorized access, missing record, duplicate submission, expired session, network loss, timeout, backend/database/provider failure, and stale/multi-tab state. Messages must not reveal stack traces, SQL, tokens, existence of another user's record, or sensitive internal identifiers.

## Approval gate

The owner/UI checker must approve representative screens for public, Co-Planter, Farmer, Admin, financial confirmation, empty/error states, and phone/tablet/desktop before the visual contract can be locked.
