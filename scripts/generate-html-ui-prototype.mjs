import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "SUR_HTML_UI_PROTOTYPE");

const pages = [
  ["/", "public", "SUR Aloeswood", "Understand the managed agarwood journey before creating an account."],
  ["/login", "public", "Customer Sign In", "Open your trees, contracts, care updates, wallet history, and support."],
  ["/register", "public", "Create Customer Account", "Start with a basic account, then complete verification only when required."],
  ["/set-password", "public", "Set Your Password", "Create a secure password for an invited or recovered account."],
  ["/session-expired", "public", "Session Expired", "Sign in again safely without losing the work you already submitted."],
  ["/unauthorized", "public", "Access Restricted", "This account does not have permission to open the requested workspace."],
  ["/launch", "public", "Getting Started", "A simple guide to the customer, admin, and caretaker workflows."],
  ["/legalities", "public", "Legal Library", "Read the controlling agreements, disclosures, certifications, and policies."],
  ["/plantation", "public", "How Tree Management Works", "Learn how allocation, planting, QR tagging, care, and updates work."],
  ["/harvest", "public", "Future Tree Sale", "Understand the external sale process, documents, and verified app records."],
  ["/certificates", "public", "Certificates and Documents", "Find customer-visible contract, certification, and DENR document guidance."],
  ["/tree", "public", "Verify a Tree ID", "Scan a QR tag or type an official SUR Tree ID without exposing private records."],
  ["/tree/[treeId]", "public", "Public Tree Record", "Show only the privacy-safe identity and approved public status of a tree."],
  ["/health", "system", "Platform Health", "A clear operational status page for essential app services."],

  ["/investor", "customer", "Customer Home", "Open the most important customer action without needing technical context."],
  ["/investor/dashboard", "customer", "Customer Dashboard", "See what needs attention, what is waiting, and what was recently approved."],
  ["/investor/marketplace", "customer", "Buy a Managed Tree", "Choose trees and one care plan, then submit one exact Maya payment."],
  ["/investor/my-trees", "customer", "My Agarwood", "Follow every official Tree ID, contract, care update, and sale status."],
  ["/investor/contracts/[contractId]", "customer", "Per-Tree Contract", "Read and sign the agreement that belongs to one official Tree ID."],
  ["/investor/care-services", "customer", "Care Coverage", "Review Skip, Monthly, or One-Time care coverage for each tree."],
  ["/investor/wallet", "customer", "Wallet Balance", "See verified balance and history while money moves through external channels."],
  ["/investor/timeline", "customer", "Tree Timeline", "Read approved milestones in a simple chronological history."],
  ["/investor/notifications", "customer", "Notifications", "See important contract, payment, care, support, and sale updates."],
  ["/investor/referrals", "customer", "Referrals", "View approved referral entries and their source history."],
  ["/investor/support", "customer", "Agarwood Support", "Ask one clear question and attach one file per message when needed."],
  ["/investor/profile", "customer", "Legal Profile", "Keep the account name aligned with KYC and per-tree contracts."],
  ["/investor/settings", "customer", "Customer Settings", "Control account preferences, security, and notification choices."],
  ["/investor/recovery", "customer", "Account Recovery", "Recover access through the approved external verification process."],

  ["/farmer", "caretaker", "Caretaker Home", "Open assigned Tree ID tasks with the fewest possible steps."],
  ["/farmer/dashboard", "caretaker", "Caretaker Dashboard", "See today’s assigned trees, due evidence, and admin instructions."],
  ["/farmer/dashboard/task", "caretaker", "Assigned Task", "Scan or choose a Tree ID, complete the task, and submit evidence."],
  ["/farmer/assigned-trees", "caretaker", "Assigned Tree IDs", "Work only on trees assigned by the admin."],
  ["/farmer/daily-care", "caretaker", "Daily Tree Care", "Submit one original-quality photo and a clear daily field note."],
  ["/farmer/photo-updates", "caretaker", "Photo Submissions", "Review submitted evidence and any requested correction."],
  ["/farmer/growth-logs", "caretaker", "Care History", "Review completed daily work by Tree ID and date."],
  ["/farmer/reports", "caretaker", "Caretaker Reports", "See submission completion and admin review results."],
  ["/farmer/profile", "caretaker", "Caretaker Profile", "Keep the work identity and contact details current."],
  ["/farmer/register", "caretaker", "Caretaker Registration", "Create a caretaker account that remains inactive until admin approval."],
  ["/farmer/gps", "retired", "GPS Page Retired", "GPS is not part of the approved SUR workflow and this route should redirect."],

  ["/admin", "admin", "Admin Home", "Open the single admin operations workspace."],
  ["/admin/login", "admin", "Admin Sign In", "Securely enter the protected SUR administration workspace."],
  ["/admin-login", "admin", "Admin Sign In", "Legacy entry point that should lead to the protected admin sign-in."],
  ["/admin/dashboard", "admin", "Admin Dashboard", "See every pending operational action without exposing unrelated data."],
  ["/admin/orders", "admin", "Maya Tree Orders", "Verify exact payments before creating Tree IDs and contracts."],
  ["/admin/purchases", "admin", "Purchase Review", "Review legacy and current purchase records in one controlled queue."],
  ["/admin/coplanters", "admin", "Customer Accounts", "Find customers, review account status, and open one profile."],
  ["/admin/coplanters/[profileId]", "admin", "Customer Record", "Review one customer’s identity, trees, documents, and support history."],
  ["/admin/tree-registry", "admin", "Tree Registry", "Manage official Tree IDs while keeping farm details private."],
  ["/admin/tree-tags", "admin", "Printable QR Tags", "Select, print, and verify physical QR tags for official trees."],
  ["/admin/care-operations", "admin", "Tree Care Operations", "Assign signed trees and review daily caretaker evidence."],
  ["/admin/tree-maintenance", "admin", "Tree Maintenance", "Review care status, replacement history, and approved incidents."],
  ["/admin/gardener", "admin", "Caretaker Accounts", "Approve and manage caretaker access and assignments."],
  ["/admin/operations", "admin", "Operations Center", "Coordinate tree, caretaker, document, and support work."],
  ["/admin/finance-distribution", "admin", "Sale Distribution", "Record an externally computed sale distribution with proof."],
  ["/admin/treasury", "admin", "Treasury", "Review verified balances, sources, receipts, and external transfers."],
  ["/admin/withdrawals", "admin", "Withdrawal Requests", "Review external withdrawal processing with the ₱50,000 request limit."],
  ["/admin/legal", "admin", "Contracts and Legal", "Manage fixed legal templates and per-tree customer documents."],
  ["/admin/support", "admin", "Support Inbox", "Resolve customer and caretaker tickets with one attachment per message."],
  ["/admin/notifications", "admin", "Admin Notifications", "See operational alerts that require acknowledgement or action."],
  ["/admin/activity", "admin", "Activity History", "Review important app events by person, record, and timestamp."],
  ["/admin/audit", "admin", "Audit Trail", "Inspect protected actions and their evidence without editing history."],
  ["/admin/reports", "admin", "Operational Reports", "Export clear summaries for business review and follow-up."],
  ["/admin/settings", "admin", "Platform Settings", "Control approved business values, content, and operational preferences."],
  ["/admin/guardian", "admin", "Guardian", "Analyze and execute strictly controlled SUR-only database work."],
  ["/admin/toh", "admin", "TOH Assistant", "Read app context, diagnose problems, and prepare bounded implementation guidance."],
];

const pageByRoute = new Map(pages.map((page) => [page[0], page]));
const fileFor = (route) => route === "/"
  ? "index.html"
  : route === "/admin-login"
    ? "legacy-admin-login.html"
    : `${route.slice(1).replaceAll("/", "-").replaceAll("[", "").replaceAll("]", "")}.html`;
const linkFor = (route) => pageByRoute.has(route) ? fileFor(route) : "index.html";

const navigation = {
  public: [["Home", "/"], ["Verify Tree", "/tree"], ["Legal", "/legalities"], ["Sign in", "/login"]],
  customer: [["Dashboard", "/investor/dashboard"], ["My Agarwood", "/investor/my-trees"], ["Buy", "/investor/marketplace"], ["Wallet", "/investor/wallet"], ["Support", "/investor/support"]],
  caretaker: [["Dashboard", "/farmer/dashboard"], ["Trees", "/farmer/assigned-trees"], ["Daily Care", "/farmer/daily-care"], ["Reports", "/farmer/reports"]],
  admin: [["Dashboard", "/admin/dashboard"], ["Orders", "/admin/orders"], ["Trees", "/admin/tree-registry"], ["Care", "/admin/care-operations"], ["Support", "/admin/support"]],
  system: [["Home", "/"], ["Health", "/health"], ["Sign in", "/login"]],
  retired: [["Admin", "/admin/dashboard"], ["Caretaker", "/farmer/dashboard"]],
};

const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function roleName(role) {
  return ({ public: "Public", customer: "Customer", caretaker: "Caretaker", admin: "Admin", system: "System", retired: "Retired" })[role];
}

function icon(route) {
  if (/wallet|treasury|withdraw|finance/.test(route)) return "₱";
  if (/tree|plant|care|growth|harvest/.test(route)) return "♧";
  if (/legal|contract|certificate/.test(route)) return "§";
  if (/support|notification/.test(route)) return "◇";
  if (/guardian|toh|health|audit/.test(route)) return "◎";
  if (/login|register|profile|recovery|password/.test(route)) return "○";
  return "SUR";
}

function emptyState(title, text, action = "Refresh") {
  return `<section class="panel empty"><span class="empty-icon">✓</span><h2>${esc(title)}</h2><p>${esc(text)}</p><button class="btn secondary" type="button">${esc(action)}</button></section>`;
}

function formField(label, placeholder, type = "text") {
  return `<label class="field"><span>${esc(label)}</span><input type="${type}" placeholder="${esc(placeholder)}" /></label>`;
}

function renderBody(route, role) {
  if (role === "retired") return `<section class="panel warning"><span class="kicker">Removed by blueprint</span><h2>No GPS collection</h2><p>The approved workflow uses Tree ID tasks. Internet is required only when submitting original-quality evidence.</p><a class="btn primary" href="${linkFor("/farmer/daily-care")}">Open Daily Care</a></section>`;

  if (/login$/.test(route) || route === "/admin-login") return `<section class="panel form-panel"><h2>Welcome back</h2><p>Use the account assigned to this workspace.</p>${formField("Email address", "name@example.com", "email")}${formField("Password", "Enter your password", "password")}<button class="btn primary full" type="button">Sign in securely</button><a class="text-link" href="${linkFor("/investor/recovery")}">Forgot your password?</a></section>`;

  if (/register/.test(route)) return `<section class="panel form-panel"><div class="step-row"><span class="step active">1</span><span class="step">2</span><span class="step">3</span></div><h2>Basic information</h2><p>You can browse while verification is pending.</p>${formField("Legal name", "As shown on your valid ID")}${formField("Email address", "name@example.com", "email")}${formField("Mobile number", "09XX XXX XXXX", "tel")}<button class="btn primary full" type="button">Continue</button></section>`;

  if (/set-password/.test(route)) return `<section class="panel form-panel"><h2>Create a secure password</h2>${formField("New password", "At least 8 characters", "password")}${formField("Confirm password", "Type it again", "password")}<button class="btn primary full" type="button">Save password</button></section>`;

  if (/marketplace/.test(route)) return `<div class="grid two"><section class="panel"><span class="kicker">Tree package</span><h2>Managed Agarwood Tree</h2><p class="price">₱25,000 <small>per tree</small></p><ul class="check-list"><li>One official Tree ID</li><li>Physical QR tag</li><li>Per-tree contract</li><li>Farm-managed allocation and planting</li></ul><button class="btn primary full">Add a tree</button></section><section class="panel"><span class="kicker">Choose one</span><h2>Care plan</h2><div class="choice"><b>Skip</b><span>₱0 now</span></div><div class="choice"><b>Monthly</b><span>₱200/month</span></div><div class="choice"><b>One-time</b><span>₱5,000</span></div></section></div><section class="sticky-checkout"><span><small>Exact total</small><b>Calculated at checkout</b></span><button class="btn gold">Continue</button></section>`;

  if (/contracts/.test(route)) return `<article class="panel contract"><span class="kicker">Per-tree agreement</span><h2>Read before signing</h2><div class="document-meta"><span>Tree ID<br><b>Shown after approval</b></span><span>Legal name<br><b>Must match KYC</b></span></div><ol><li>One agreement belongs to one Tree ID.</li><li>Growth, sale date, buyer, price, and profit are not guaranteed.</li><li>Farm and caretaker information remains private.</li><li>External sale and distribution require approved documents and receipts.</li></ol><label class="check"><input type="checkbox" /> I reviewed and understand this agreement.</label>${formField("Type your legal name", "Exact approved legal name")}<button class="btn primary full">Sign and activate this tree</button></article>`;

  if (/tree-tags/.test(route)) return `<section class="action-bar"><button class="btn primary">Print selected tags</button><button class="btn secondary">Select all</button></section><div class="grid three">${[1,2,3].map(() => `<article class="panel qr-card"><label class="check"><input type="checkbox" /> Include</label><div class="qr-placeholder">QR</div><h2>Official Tree ID</h2><p>Ready after payment approval and contract signing.</p></article>`).join("")}</div>`;

  if (route === "/tree" || route === "/tree/[treeId]") return `<section class="panel verify-card"><span class="record-icon">QR</span><h2>${route === "/tree" ? "Enter an official Tree ID" : "Privacy-safe verification"}</h2>${route === "/tree" ? formField("Tree ID", "SUR-YYYY-XXXXXXXXXX") : `<div class="status-line"><span>Tree identity</span><b>Verified record only</b></div><div class="status-line"><span>Private data</span><b>Not displayed</b></div>`}<button class="btn primary full">${route === "/tree" ? "Verify Tree ID" : "Return to search"}</button></section>`;

  if (/support/.test(route)) return `<div class="grid two"><section class="panel"><span class="kicker">One active conversation</span><h2>Agarwood Support Team</h2><div class="message support">How can we help with your account or Tree ID?</div><div class="message user">Write a clear question here.</div><label class="upload">＋ Attach one photo or file<input type="file" hidden /></label><textarea class="composer" placeholder="Write a message"></textarea><button class="btn primary full">Send message</button></section>${emptyState("Ticket history", "Closed tickets remain available for reference.", "View history")}</div>`;

  if (/guardian|toh/.test(route)) return `<div class="grid two"><section class="panel console"><span class="kicker">Protected admin tool</span><h2>${route.includes("guardian") ? "SUR-only SQL gateway" : "Application AI workspace"}</h2><textarea class="codebox" placeholder="Describe the check or paste approved SQL here"></textarea><div class="action-row"><button class="btn primary">Analyze</button><button class="btn secondary">Clear</button></div></section><section class="panel"><h2>Safety gates</h2><ul class="check-list"><li>Active admin session required</li><li>SUR project boundary enforced</li><li>Blocked capabilities rejected</li><li>Every approved action audited</li></ul></section></div>`;

  if (/profile|settings/.test(route)) return `<div class="grid two"><section class="panel form-panel"><h2>${route.includes("profile") ? "Identity details" : "Preferences"}</h2>${formField("Legal name", "Approved account name")}${formField("Email address", "name@example.com", "email")}${formField("Mobile number", "09XX XXX XXXX", "tel")}<button class="btn primary full">Save changes</button></section><section class="panel notice"><h2>Important</h2><p>Changing the legal name before KYC is allowed. A legal-name change after submission removes the previous verification and requires resubmission.</p></section></div>`;

  if (/legal|certificate/.test(route)) return `<div class="grid two"><section class="panel"><span class="kicker">Document library</span><h2>Customer documents</h2><div class="list-row"><span>Business and customer agreement</span><button class="chip">Open</button></div><div class="list-row"><span>Per-tree contract</span><button class="chip">Open</button></div><div class="list-row"><span>Certification and DENR copies</span><button class="chip">Open</button></div></section>${emptyState("No signature waiting", "Documents that need action will appear here.", "Refresh")}</div>`;

  if (/wallet|treasury|withdraw|finance-distribution|referrals/.test(route)) return `<section class="balance-card"><span>Verified balance</span><h2>Available after secure sign-in</h2><p>Every entry shows its approved source in History.</p><button class="btn gold">View history</button></section><div class="grid two"><section class="panel"><h2>Recent history</h2><div class="list-row"><span>No verified entry yet</span><span class="muted">—</span></div></section><section class="panel notice"><h2>External processing</h2><p>The app records status and proof. Maya, bank transfers, sale computation, and withdrawal processing happen through approved external channels.</p></section></div>`;

  if (/orders|purchases/.test(route)) return `<div class="grid admin-split"><section class="panel"><div class="section-head"><div><span class="kicker">Review queue</span><h2>Pending submissions</h2></div><button class="chip">Refresh</button></div>${emptyState("Queue is clear", "New exact-payment submissions will appear here.", "Refresh")}</section><section class="panel"><span class="kicker">Selected record</span><h2>Choose a submission</h2><p>Protected receipt, sender name, exact amount, reference, items, and decision controls appear here.</p><div class="action-row"><button class="btn primary" disabled>Approve</button><button class="btn danger" disabled>Reject</button></div></section></div>`;

  if (/care-operations|maintenance|assigned-trees|daily-care|photo-updates|growth-logs/.test(route)) return `<div class="grid admin-split"><section class="panel"><div class="section-head"><div><span class="kicker">Tree ID tasks</span><h2>Assigned trees</h2></div><button class="chip">Refresh</button></div>${emptyState("No tree selected", "Only assigned official Tree IDs appear here.", "Refresh")}</section><section class="panel form-panel"><span class="kicker">Evidence workflow</span><h2>${role === "caretaker" ? "Submit daily care" : "Review daily evidence"}</h2>${formField("Observation date", "Select date", "date")}<label class="field"><span>Clear field note</span><textarea placeholder="Describe the tree condition and work completed"></textarea></label><label class="upload">＋ Original-quality photo<input type="file" hidden /></label><button class="btn primary full">${role === "caretaker" ? "Submit for admin review" : "Review selected evidence"}</button></section></div>`;

  if (/notifications/.test(route)) return emptyState("You’re all caught up", "New payment, contract, care, support, and sale updates will appear here.", "Refresh");

  if (/activity|audit|reports|timeline/.test(route)) return `<section class="panel"><div class="section-head"><div><span class="kicker">Filterable history</span><h2>Latest records</h2></div><button class="chip">Export</button></div><div class="filters"><button class="chip active">All</button><button class="chip">Needs action</button><button class="chip">Completed</button></div>${emptyState("No matching record", "Activity will appear after an approved app action.", "Clear filters")}</section>`;

  if (/dashboard/.test(route) || ["/investor", "/farmer", "/admin"].includes(route)) return `<section class="metric-grid"><div class="metric"><span>Needs action</span><b>None</b></div><div class="metric"><span>Waiting</span><b>Up to date</b></div><div class="metric"><span>Support</span><b>Available</b></div></section><div class="grid two"><section class="panel"><span class="kicker">Next best action</span><h2>No urgent action</h2><p>When a payment, contract, Tree ID, care task, or support reply needs attention, it appears here first.</p><button class="btn primary">Refresh status</button></section><section class="panel"><h2>Quick actions</h2>${(navigation[role] || navigation.public).slice(1).map(([label, target]) => `<a class="list-row link-row" href="${linkFor(target)}"><span>${esc(label)}</span><b>→</b></a>`).join("")}</section></div>`;

  if (/health/.test(route)) return `<section class="panel"><h2>Essential services</h2>${["Web application", "Authentication", "Database gateway", "File storage"].map((label) => `<div class="status-line"><span>${label}</span><b class="status-good">Configured check</b></div>`).join("")}<p class="fine-print">This prototype does not connect to live services.</p></section>`;

  return `<div class="grid two"><section class="panel"><span class="kicker">Primary workspace</span><h2>Clear action area</h2><p>This page uses the same phone-first language, navigation, states, permissions, and accessible controls as the rest of SUR.</p><button class="btn primary">Continue</button></section>${emptyState("Nothing requires action", "Records appear only when the signed-in role has permission to see them.", "Refresh")}</div>`;
}

function pageHtml(page) {
  const [route, role, title, description] = page;
  const nav = navigation[role] || navigation.public;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="light" />
  <title>${esc(title)} · SUR UI Prototype</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="role-${role}">
  <div class="prototype-banner">UI PROTOTYPE · NO LIVE DATA</div>
  <div class="app-shell">
    <aside class="side-nav">
      <a class="brand" href="index.html"><span class="brand-mark">S</span><span><b>SUR Aloeswood</b><small>${roleName(role)} workspace</small></span></a>
      <nav>${nav.map(([label, target]) => `<a class="${target === route ? "active" : ""}" href="${linkFor(target)}">${esc(label)}</a>`).join("")}</nav>
      <a class="side-help" href="${linkFor(role === "admin" ? "/admin/support" : role === "customer" ? "/investor/support" : "/login")}"><b>Need help?</b><span>Agarwood Support Team</span></a>
    </aside>
    <main class="page">
      <header class="page-header">
        <div class="topline"><a class="mobile-brand" href="index.html"><span class="brand-mark">S</span><b>SUR</b></a><span class="role-chip">${roleName(role)}</span></div>
        <div class="heading-row"><div><p class="route">${esc(route)}</p><h1>${esc(title)}</h1><p class="lead">${esc(description)}</p></div><span class="page-icon">${icon(route)}</span></div>
      </header>
      <div class="content">${renderBody(route, role)}</div>
      <footer class="page-footer"><span>SUR Aloeswood mobile-first UI reference</span><a href="all-pages.html">All screens</a></footer>
    </main>
  </div>
  <nav class="bottom-nav">${nav.slice(0, 4).map(([label, target], index) => `<a class="${target === route ? "active" : ""}" href="${linkFor(target)}"><span>${["⌂","♧","＋","◇"][index]}</span><small>${esc(label)}</small></a>`).join("")}</nav>
  <script src="app.js"></script>
</body>
</html>`;
}

function allPagesHtml() {
  const groups = ["public", "customer", "caretaker", "admin", "system", "retired"];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>All SUR Screens</title><link rel="stylesheet" href="styles.css"></head><body><div class="prototype-banner">UI PROTOTYPE · ${pages.length} SCREENS</div><main class="catalog"><a class="brand" href="index.html"><span class="brand-mark">S</span><span><b>SUR Aloeswood</b><small>HTML screen catalog</small></span></a><header class="catalog-head"><p class="route">Design review index</p><h1>Every user-facing page</h1><p class="lead">Open any standalone mobile-first HTML screen. These files contain no live customer or database data.</p></header>${groups.map((role) => `<section class="catalog-group"><h2>${roleName(role)}</h2><div class="catalog-grid">${pages.filter((page) => page[1] === role).map(([route,,title,description]) => `<a class="catalog-card" href="${fileFor(route)}"><span class="page-icon">${icon(route)}</span><b>${esc(title)}</b><small>${esc(route)}</small><p>${esc(description)}</p></a>`).join("")}</div></section>`).join("")}</main></body></html>`;
}

const styles = `
:root{--ink:#10231a;--muted:#68766e;--line:#dce6df;--paper:#f4f7f3;--card:#fff;--forest:#063c28;--forest-2:#0b5d3c;--mint:#baf3ce;--gold:#f4c84e;--danger:#a83535;--shadow:0 18px 48px rgba(15,58,39,.09)}
*{box-sizing:border-box}html{overflow-x:clip;-webkit-text-size-adjust:100%;text-size-adjust:100%}body{margin:0;min-width:320px;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow-x:clip}button,a,input,select,textarea{font:inherit;touch-action:manipulation}button,a{min-height:48px}a{color:inherit;text-decoration:none}input,textarea,select{width:100%;border:1px solid #cad8cf;border-radius:16px;background:#fff;padding:14px 15px;font-size:16px;color:var(--ink);outline:none}textarea{min-height:120px;resize:vertical}input:focus,textarea:focus,select:focus{border-color:#16885a;box-shadow:0 0 0 4px rgba(22,136,90,.12)}button{cursor:pointer}.prototype-banner{position:sticky;top:0;z-index:90;background:#ffefaf;color:#604800;padding:7px max(12px,env(safe-area-inset-left));font-size:10px;font-weight:900;letter-spacing:.16em;text-align:center}.app-shell{min-height:100vh}.side-nav{display:none}.page{min-width:0;padding-bottom:88px}.page-header{background:linear-gradient(145deg,#052d1f 0%,#0a5136 62%,#0e6142 100%);color:#fff;padding:18px max(16px,env(safe-area-inset-right)) 28px max(16px,env(safe-area-inset-left))}.topline,.heading-row,.section-head,.action-row,.action-bar,.status-line,.list-row,.choice,.document-meta{display:flex;align-items:center;justify-content:space-between;gap:12px}.mobile-brand,.brand{display:flex;align-items:center;gap:10px}.brand-mark{display:grid;width:38px;height:38px;place-items:center;border-radius:13px;background:var(--mint);color:#063d28;font-weight:950}.role-chip,.chip{display:inline-flex;align-items:center;justify-content:center;min-height:34px;border-radius:999px;border:1px solid rgba(255,255,255,.22);padding:6px 12px;font-size:11px;font-weight:850}.heading-row{align-items:flex-end;margin-top:34px}.heading-row>div{min-width:0}.route,.kicker{margin:0;color:#6dd99b;font-size:10px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}.page-header h1,.catalog h1{margin:8px 0 0;font-size:clamp(2rem,10vw,3.75rem);line-height:1.02;letter-spacing:-.045em}.lead{max-width:730px;margin:12px 0 0;color:rgba(255,255,255,.7);font-size:14px;line-height:1.65}.page-icon{display:grid;flex:0 0 auto;width:48px;height:48px;place-items:center;border-radius:16px;background:rgba(186,243,206,.13);color:#baf3ce;font-size:13px;font-weight:950}.content{display:grid;gap:16px;max-width:1180px;margin:auto;padding:16px 12px 24px}.panel,.metric,.balance-card,.sticky-checkout{min-width:0;border:1px solid var(--line);border-radius:24px;background:var(--card);padding:18px;box-shadow:var(--shadow)}.panel h2,.balance-card h2{margin:7px 0 8px;font-size:21px;line-height:1.18}.panel p{color:var(--muted);font-size:14px;line-height:1.65}.grid{display:grid;gap:16px}.metric-grid{display:grid;grid-template-columns:1fr;gap:10px}.metric{padding:16px}.metric span,.balance-card>span{display:block;color:var(--muted);font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.metric b{display:block;margin-top:8px;font-size:20px}.btn{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:16px;padding:12px 18px;font-weight:900}.btn.primary{background:var(--forest-2);color:#fff}.btn.secondary{border:1px solid var(--line);background:#fff;color:var(--ink)}.btn.gold{background:var(--gold);color:#4b3900}.btn.danger{border:1px solid #efc2c2;background:#fff5f5;color:var(--danger)}.btn:disabled{cursor:not-allowed;opacity:.45}.full{width:100%}.form-panel{display:grid;gap:14px}.field{display:grid;gap:7px;color:#4e5f55;font-size:12px;font-weight:850}.text-link{display:inline-flex;align-items:center;justify-content:center;color:#0b6a43;font-size:13px;font-weight:850}.step-row{display:flex;gap:7px}.step{display:grid;width:28px;height:28px;place-items:center;border-radius:50%;background:#e8eeea;color:#728078;font-size:11px;font-weight:900}.step.active{background:var(--forest);color:#fff}.price{color:#087249!important;font-size:30px!important;font-weight:950}.price small{color:var(--muted);font-size:12px}.check-list{display:grid;gap:10px;padding:0;list-style:none}.check-list li{position:relative;padding-left:25px;color:#4f6258;font-size:14px}.check-list li:before{position:absolute;left:0;content:"✓";color:#0c8b57;font-weight:950}.choice,.status-line,.list-row{min-height:50px;border-top:1px solid #edf1ee;padding:10px 0;font-size:13px}.choice:first-of-type,.status-line:first-of-type,.list-row:first-of-type{border-top:0}.choice span,.muted{color:var(--muted)}.sticky-checkout{position:sticky;bottom:76px;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:12px;border-color:#ead07a;background:#fff8db}.sticky-checkout span{display:grid}.sticky-checkout small{color:#806b2c}.document-meta{align-items:stretch;margin:16px 0}.document-meta span{flex:1;border-radius:14px;background:#f1f6f2;padding:12px;color:var(--muted);font-size:11px}.document-meta b{color:var(--ink)}.contract ol{display:grid;gap:12px;padding-left:22px;color:#4e6056;font-size:14px;line-height:1.6}.check{display:flex;align-items:flex-start;gap:10px;border:1px solid var(--line);border-radius:16px;padding:14px;font-size:13px;font-weight:800}.check input{flex:0 0 auto;width:23px;height:23px;margin:0;accent-color:var(--forest-2)}.qr-card{text-align:center}.qr-card .check{border:0;padding:0}.qr-placeholder{display:grid;aspect-ratio:1;max-width:220px;margin:18px auto 0;place-items:center;border:14px solid #11392a;background:repeating-linear-gradient(45deg,#fff 0 8px,#11392a 8px 16px);color:#fff;font-weight:950}.verify-card{max-width:620px;margin:auto;text-align:center}.record-icon,.empty-icon{display:grid;width:58px;height:58px;margin:0 auto;place-items:center;border-radius:20px;background:#e4f7eb;color:#087249;font-size:13px;font-weight:950}.verify-card .field{text-align:left}.empty{text-align:center}.empty h2{margin-top:14px}.empty .btn{margin-top:5px}.warning{border-color:#efd68a;background:#fffaf0}.notice{background:#f0f7f3}.message{max-width:88%;margin-top:10px;border-radius:17px;padding:12px 14px;font-size:13px;line-height:1.5}.message.support{background:#edf4ef}.message.user{margin-left:auto;background:#0b5d3c;color:#fff}.upload{display:flex;min-height:54px;align-items:center;justify-content:center;border:1px dashed #7da48d;border-radius:16px;background:#f6fbf8;color:#0a7148;font-size:13px;font-weight:900}.composer{margin-top:12px}.codebox{min-height:220px;background:#10221a;color:#cbf5d8;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.action-row,.action-bar{justify-content:flex-start;flex-wrap:wrap;margin-top:16px}.balance-card{border:0;background:linear-gradient(135deg,#072e20,#0c6744);color:#fff}.balance-card>span,.balance-card p{color:rgba(255,255,255,.65)}.balance-card h2{font-size:27px}.section-head{align-items:flex-start}.section-head .chip,.filters .chip{border-color:var(--line);background:#fff;color:var(--ink)}.filters{display:flex;gap:8px;overflow:auto;padding:14px 0}.filters .active{background:#e6f6ec;color:#087249}.link-row{min-height:54px}.fine-print{border-top:1px solid var(--line);padding-top:15px}.status-good{color:#07804f}.page-footer{display:flex;justify-content:space-between;gap:15px;max-width:1180px;margin:auto;padding:0 18px 30px;color:#748178;font-size:11px}.page-footer a{min-height:auto;color:#0b6843;font-weight:850}.bottom-nav{position:fixed;right:0;bottom:0;left:0;z-index:70;display:grid;grid-template-columns:repeat(4,1fr);padding:7px max(8px,env(safe-area-inset-right)) max(7px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));border-top:1px solid #dce6df;background:rgba(255,255,255,.96);backdrop-filter:blur(16px)}.bottom-nav a{display:grid;min-width:0;place-items:center;border-radius:14px;color:#728077;font-size:17px}.bottom-nav a small{max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:9px;font-weight:850;white-space:nowrap}.bottom-nav a.active{background:#e9f7ee;color:#075e3b}.catalog{max-width:1200px;margin:auto;padding:26px 14px 60px}.catalog>.brand{width:max-content}.brand small{display:block;color:#718078}.catalog-head{margin:38px 0;padding:28px;border-radius:28px;background:linear-gradient(140deg,#052d1f,#0a6040);color:#fff}.catalog-group{margin-top:34px}.catalog-group>h2{text-transform:capitalize}.catalog-grid{display:grid;gap:12px}.catalog-card{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;min-height:150px;border:1px solid var(--line);border-radius:22px;background:#fff;padding:17px;box-shadow:var(--shadow)}.catalog-card .page-icon{grid-row:1/4}.catalog-card small{color:#0b754a;font-weight:850}.catalog-card p{grid-column:2;color:var(--muted);font-size:12px;line-height:1.5}
@media(min-width:640px){.content{padding:24px}.metric-grid{grid-template-columns:repeat(3,1fr)}.grid.two,.admin-split{grid-template-columns:repeat(2,minmax(0,1fr))}.grid.three,.catalog-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.page-header{padding:28px 32px 42px}.panel{padding:24px}}
@media(min-width:980px){.prototype-banner{position:fixed;right:0;left:0}.app-shell{display:grid;grid-template-columns:260px minmax(0,1fr);padding-top:28px}.side-nav{position:fixed;top:28px;bottom:0;left:0;display:flex;width:260px;flex-direction:column;border-right:1px solid #d8e4dc;background:#fff;padding:28px 18px}.side-nav nav{display:grid;gap:5px;margin-top:34px}.side-nav nav a{display:flex;min-height:46px;align-items:center;border-radius:14px;padding:10px 13px;color:#5d6c64;font-size:13px;font-weight:800}.side-nav nav a.active{background:#e6f6ec;color:#075f3b}.side-help{display:grid;margin-top:auto;border-radius:17px;background:#eff7f2;padding:14px}.side-help span{color:#6b7971;font-size:11px}.page{grid-column:2;padding-bottom:0}.topline{justify-content:flex-end}.mobile-brand{display:none}.page-header{padding:54px 52px 50px}.content{padding:30px}.bottom-nav{display:none}.grid.three,.catalog-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.admin-split{grid-template-columns:.78fr 1.22fr}.catalog{padding-top:70px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
`;

const appJs = `document.querySelectorAll('button:not([disabled])').forEach((button)=>{button.addEventListener('click',()=>{if(!button.closest('a')){const original=button.textContent;button.textContent='Prototype action';setTimeout(()=>button.textContent=original,900)}})});`;

mkdirSync(output, { recursive: true });
writeFileSync(join(output, "styles.css"), styles.trimStart(), "utf8");
writeFileSync(join(output, "app.js"), appJs, "utf8");
writeFileSync(join(output, "all-pages.html"), allPagesHtml(), "utf8");
for (const page of pages) writeFileSync(join(output, fileFor(page[0])), pageHtml(page), "utf8");
writeFileSync(join(output, "README.txt"), `SUR Aloeswood HTML UI Prototype\n\nOpen all-pages.html to review all ${pages.length} standalone screens.\nThese files are design-only and contain no live data, credentials, or database connection.\nGenerated from the approved mobile-first blueprint.\n`, "utf8");

console.log(JSON.stringify({ output, pages: pages.length, entry: join(output, "all-pages.html") }, null, 2));
