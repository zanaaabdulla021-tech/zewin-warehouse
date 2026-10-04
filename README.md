# ZEWIN — Warehouse & Accounting

Modern warehouse & accounting ERP. Next.js 14 (App Router) · TypeScript · Tailwind · Prisma · **Neon PostgreSQL** · EN / کوردی / العربية (RTL).

## Setup

```bash
npm install
cp .env.example .env        # paste both Neon connection strings (pooled + direct)
npx prisma db push          # create tables on Neon
npm run db:seed             # roles, permissions, demo users & data
npm run dev                 # http://localhost:3000
```

Sign in at `/login` with any demo account — password **zewin123**:
`zana@` (Super Admin) · `ahmed@` (Admin) · `shirin@` (Accounting) · `karwan@` (Warehouse Manager) · `dilan@` (Warehouse Employee) — all `@zewin.app`.
The sidebar and actions change with each role's permissions. Demo accounts are listed on the login page only outside production (or with `SHOW_DEMO_ACCOUNTS=1`).

## Phase 1 — done

| Area | What's in |
|---|---|
| Data model | Full schema for every module: users/roles/permissions, warehouses, products, categories, units, batches, stock levels, movements, suppliers, documents + items, verifications, audit log |
| Design system | Button, Input (prefix/suffix), Select, Textarea, searchable **Combobox**, Field, FormGrid (1→2→3 cols), collapsible FormSection, sticky FormActions, Modal (bottom sheet on mobile), ConfirmDialog (typed word / required reason), Toasts, Status badges, Skeletons, Empty states, three-dot menus, **DataTable** (search, filter chips, sort, pagination, CSV export, mobile cards) |
| Form behaviour | `useForm` (zod, translated messages, validate-on-blur, server errors, reset, dirty tracking), `useUnsavedChanges` (Stay / Leave dialog + browser guard), "Saving…" state, duplicate-submit protection, friendly errors only |
| Shell | Sidebar with role-filtered modules, mobile drawer, top bar, language switcher (RTL for Kurdish & Arabic) |
| RBAC + Audit | `ROLE_MATRIX` → seeded permissions → enforced in UI and in every server action; audit log on create / edit / archive / delete |
| Dashboard | Greeting, 6 KPI cards, quick actions, recent documents, pending verification, stock alerts (low stock + expiring batches), activity timeline |
| Warehouses | List · quick-add modal · details (overview / stock / employees / activity tabs) · full sectioned edit page · archive · safe delete |

## Phase 2 — done

| Area | What's in |
|---|---|
| Auth | NextAuth credentials (bcrypt), JWT sessions, middleware protects every page, split-screen login with language switch, logout |
| Products | List with live stock bars, low/out-of-stock badges, "Low stock" filter · Add page (Save / Save & add another, auto code) · Edit page with 4 sections, live margin and below-cost warning · Details: stock per warehouse & batch, nearest expiry, low-stock banner, activity |
| Categories & Units | One page, modal add/edit, parent categories, delete blocked while products use them |

## Phase 3 — done

| Area | What's in |
|---|---|
| Stock engine | `src/lib/stock.ts` — one transactional `postStockOperation` for stock in / out / transfer / adjustment; atomic decrements (never negative), batch auto-create, reference numbers `SI-` `SO-` `TR-` `ADJ-`, one movement row per warehouse/batch. Documents (Phase 4) reuse it |
| Operation form | Type cards · warehouse(s), date, note · editable items table: product search, FEFO batch pre-select, available / on-hand, counted vs. difference for adjustments, live totals · **Enter = next field, Tab, Esc = undo field**, Enter on the last cell adds a row · mobile card layout · confirm before posting · unsaved-changes guard |
| Overview | KPIs (units, value, products, expiring, expired), warehouse switcher, status chips (Low / Expiring / Expired), CSV export |
| Movements | Full history with reference, type, batch, from → to, signed quantities, author; opens filtered on the reference just posted |
| Batches & Expiry | Buckets: expired · ≤30 · 31–60 · 61–90 · >90 days, with value at risk |

> Schema change: `StockMovement` gained `reference`, `counterpartWarehouseId`, `createdById`, `createdByName` → run `npx prisma db push` again.

## Phase 4 — done

| Area | What's in |
|---|---|
| Document form | "Create Warehouse Document": type (Purchase / Transfer / Stock in / Stock out / Return / Other), auto number `DOC-000130`, date, warehouse, supplier or destination, reference no. · Items table: Product · Batch · (Expiry) · Qty · Unit Price · Discount · Total — price and tax prefilled from the product, FEFO batches for outgoing types, same keyboard flow as stock · live Subtotal / Discount / Tax / Grand Total (`src/lib/documents.ts`, shared by client and server) · **Save draft** or **Submit for verification** |
| Workflow | DRAFT → PENDING (locked) → VERIFIED / REJECTED; rejected documents show the reason and can be edited and resubmitted; only drafts/rejected can be deleted |
| List & details | Status chips, search, CSV, three-dot actions · details with parties, items, totals, rejection banner and a timeline (created → submitted → verified/rejected → stock posted) |
| Print / PDF | `/print/documents/[id]` — clean A4 layout: ZEWIN header, document meta grid, items, financial summary, Prepared / Checked / Approved signature blocks; `?auto=1` opens the print dialog |

> Stock moves when accounting **verifies** a document (Phase 5) — through the same stock engine.
> Schema change: `Document.submittedAt`, `Document.stockReference` → `npx prisma db push`.

## Phase 5 — done

| Area | What's in |
|---|---|
| Queue `/accounting` | KPIs (pending count & value, verified / rejected this month, average time to verify) · tabs Pending (oldest first, waiting time, one-click Review) · Verified · Rejected · Verification history |
| Verification screen `/accounting/[id]` | Big `DOC-000125` header + 🟡 Pending Verification · what verifying will do to stock · document information · items with a **live stock check** for outgoing documents (short lines highlighted) · Financial Summary · 6-point **Verification Checklist** (progress bar, Verify unlocks only when complete) · Accounting Notes · ✓ Verify / ✕ Reject (reason required) · previous reviews · Previous / Next in queue — after each decision the next pending document opens |
| Engine | `verifyDocument` claims the document (`PENDING → VERIFIED`) and posts stock through `postStockOperation` in **one transaction**, links movements to the document and stores `stockReference`; insufficient stock rolls everything back with a clear message · `rejectDocument` stores reason + checklist and returns it to the author · both audited |

## Phase 6 — done

| Area | What's in |
|---|---|
| Suppliers | List (documents, verified purchases) · add / edit page in 3 sections · details with purchased / returned totals and every transaction · archive · delete only without documents |
| Employees | List with roles, assigned warehouses, last activity · add / edit page (account, role, warehouses, password, active switch) · deactivate (signed out on next request) · safeguards: can't demote/deactivate yourself, can't remove the last active Super Admin, only Super Admins grant Super Admin |
| Roles & Permissions | Super Admin-only matrix — modules × View / Create / Edit / Delete / Verify / Approve / Export, row "All", any action implies View; Super Admin role locked |
| Reports | Hub + 7 reports (stock, warehouse, product, accounting, verification, supplier, movement) · date range + warehouse filters · KPIs · sortable table with totals · CSV export · clean print layout |
| Settings | Company profile (printed on documents) · documents & stock defaults (default type, default tax, expiry warning days — used by dashboard, stock and documents) · audit log viewer (filter by module, search, CSV) · system info |
| My account | `/account` for every role: name, phone, language, password change |

## Phase 7 — tested end-to-end

Ran the full app against a real PostgreSQL 16 database with a production build:

- **54 pages × 5 roles** — every page renders, 0 server errors, access matches the permission matrix
- **22 browser workflows (Playwright)** — login, warehouse/product create & edit with validation, unsaved-changes guard, stock in / out / transfer / adjustment through the keyboard grid, document → reject → fix → resubmit → verify (stock posted), role editor, RTL Kurdish, reports + CSV, A4 print, mobile layout — **22/22 passing**

Bugs found and fixed:
1. Signed-out users were sent to NextAuth's default page instead of `/login`
2. A warehouse employee could not fix and resubmit their own rejected document
3. Dashboard document numbers and dates wrapped onto two lines
4. Batch placeholder was cut off in the stock grid
5. Select fields had no ▼ arrow (now plain CSS, flips in RTL)
6. Zero discount showed as "-$0.00"
7. **Typing in any modal jumped focus back to the first field** (and caused a React update loop)
8. Hydration mismatch in the stock / document item tables (row keys)

## Phase 8 — Notifications · Barcode · Excel import · Multi-currency

| Feature | What's in |
|---|---|
| **Notifications** | Bell with unread badge in the top bar (polls every 45 s and on tab focus), mark one/all as read, click → opens the document · Events: document **submitted** → everyone who can verify; **verified / rejected** → the person who created it · Messages in each user's own language · **Email** (SMTP) and **WhatsApp** (Meta Cloud API, optional approved template) when configured — users switch channels in *My account*; Settings → System shows which channels are set up · Delivery never blocks or breaks the user's action |
| **Barcode scanning** | Scan bar above the stock and document item tables: USB/Bluetooth scanners (type + Enter) find products by **barcode or code**; scanning the same product again adds +1, a new one fills/adds a row with price and FEFO batch · **Camera** scanner for phones/laptops (BarcodeDetector, ZXing fallback for iOS/Firefox) with continuous scanning, beep and on-screen confirmation |
| **Excel import** | Stock → *Import from Excel*: download a template (with your warehouse/product codes on a second sheet) → upload → full **preview with per-row errors** (unknown codes, bad quantities/costs/dates, duplicates, missing batch) → optional *create missing products* → import posts one opening-balance stock-in per warehouse through the stock engine. Up to 5,000 rows; the server re-validates on import |
| **Multi-currency** | Settings → *Currencies*: base currency (from Company) + other currencies with exchange rates · Documents carry a currency and the rate at that time; prices convert when you switch currency; totals show the base-currency equivalent · Lists, details, print and verification show each document in its own currency; dashboards, reports and supplier totals use the base currency; verified stock cost is converted to base · All money formatting follows the company base currency |

> Schema changes (`Notification`, `Currency`, `User.notifyEmail/notifyWhatsApp`, `Document.currency/exchangeRate/grandTotalBase`) → `npx prisma db push`, then optionally `npm run db:seed`.
> New optional env vars for email/WhatsApp are documented in `.env.example`.

**Tested:** 22 regression + 13 new-feature browser tests pass on a production build against PostgreSQL; every page renders for all 5 roles. Fixed during testing: impossible dates such as `31/13/2027` were rolled over instead of rejected in the import.

## Ideas for later

- Automatic daily exchange rates from a rates API
- Low-stock and expiry digests by email
- Product import/update from Excel (not only opening balances)

## Structure

```
prisma/            schema.prisma · seed.ts
src/app/(app)/     pages per module (dashboard, warehouses, …)
src/components/ui  Zewin design system
src/components/layout  shell, sidebar, logo
src/hooks          use-form, use-unsaved-changes
src/i18n           en.ts · ckb.ts · ar.ts
src/lib            prisma, session, permissions, audit, utils
```
