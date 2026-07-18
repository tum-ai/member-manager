# Finance Analytics — Functional Requirements & Implementation Plan

Roadmap for evolving `/tools/finance/analytics` from an LnF-only expense overview into a
full budgeting, planning and analysis tool that maxes out the BuchhaltungsButler (BB) data,
gives **every department** control of its own budget, and gives **Legal & Finance (LnF)**
full control over all budgets and expenses.

Status of the codebase this builds on: branch `feat/finance-lnf-analytics` →
`feat/finance-buchhaltungsbutler`.

---

## 1. Baseline (already shipped)

- **Route:** `/tools/finance/analytics`, gated by `finance.review` (LnF + admins only).
- **Pipeline:** BB `/postings/get` → `getBuchhaltungsButlerTransactions` →
  `finance_department_mappings` (`cost_location → department + bereich + note`, LnF-editable) →
  `aggregateByDepartment` → rollups `by_department` / `by_month` / `by_bereich` / `totals`.
- **UI:** `FinanceAnalyticsSection` (overview + date range) and `DepartmentMappingEditorSection`
  (assign cost locations). Unassigned postings fall into `Nicht zugeordnet`.

### What we already receive from BB but do **not** use yet

Each posting carries 13 fields; only `date`, `cost_location`, `transaction_amount` drive analytics.
Unused, high-value signal:

| Field | Meaning | Opportunity |
| --- | --- | --- |
| `cost_location_two` | Second cost dimension (in the mock: expense _type_ — 1 catering, 2 travel, 3 venue, 4 consumables, 5 software, 6 hardware, 7 prizes, 8 admin/fees) | Category breakdown _within_ a department (treemap, category tab) |
| `debit_postingaccount_number` / `credit_postingaccount_number` | SKR ledger accounts (e.g. 6810/6840/6850 expenses, 8110/8450 income) | P&L-style account breakdown; robust income vs expense classification |
| `vat` | VAT rate/amount | Net vs gross toggle, VAT reclaim (wirtschaftlich), tax reporting |
| `credit_type` | `credit`/`debit` | Cross-check the income/expense sign |
| `transaction_purpose` / `postingtext` | Free-text description | Full-text transaction search & drill-down list |
| `currency` | Posting currency | Guard/label non-EUR postings |
| `external_id` | BB `id_by_customer` | Join to uploaded **receipts/documents** for audit drill-down |

> **Action:** confirm the full BB API v1 surface beyond `/postings/get`, `/receipts/upload`,
> `/comments/add`. Likely useful: chart-of-accounts / cost-location **master data** (to auto-label
> instead of manual mapping) and **receipt fetch** (to link a posting to its PDF). These are the
> "everything the API gives" endpoints we should pull in Phase 1/5 — treat as unconfirmed until
> verified against the live account.

---

## 2. Personas & access model

| Persona | Permission | Can |
| --- | --- | --- |
| **Department member** | new `finance.department` (own department only) | View / plan / analyze **their own** department's budget & spend |
| **Legal & Finance** | existing `finance.review` | Set budgets for **all** departments, full control of tool + all expenses, mapping editor |
| **Admin** | superuser | Everything, plus grant `finance.department` per department |

Rationale: the repo's RBAC is department-scoped ("a member's department IS their role",
`shared/src/permissions.ts`). We add one permission `finance.department` so admins can switch the
department portal on/off per department via the existing permission matrix, and resolve the caller's
scope from `members.department`. LnF's `finance.review` stays the full-control superset.

---

## 3. Functional requirements

IDs are stable references for the implementation plan (§4).

### FR-A — Max out BB dimensions (analytics depth)

- **FR-A1** Classify each posting as income vs expense by ledger account **and** amount sign, not
  sign alone (accounts 8xxx income, 6xxx/others expense); surface mismatches.
- **FR-A2** New rollup **by category** derived from `cost_location_two`, via an LnF-editable
  `cost_location_two → category` mapping (reuse the mapping-editor pattern). Category breakdown is
  shown within each department and org-wide.
- **FR-A3** New rollup **by account** (SKR) with human labels from an account-label table (or a
  seeded static SKR03/04 map). Group accounts into families (personnel, tools/software, events,
  fees, income).
- **FR-A4** **Net vs gross** toggle using `vat`; a VAT summary (reclaimable vs not, split by
  `bereich`).
- **FR-A5** **Transaction explorer**: server-paginated, filterable (department, category, account,
  bereich, date, free-text over `postingtext`/`transaction_purpose`, amount range) list with export.
- **FR-A6** **Receipt drill-down** (best-effort): from a transaction, link to its BB receipt/document
  via `external_id` when available.

### FR-B — Budgets (LnF sets, everyone reads their own)

- **FR-B1** LnF can set a budget per **department** per **fiscal period**, optionally scoped to a
  **category** and/or **bereich**. Amounts are planned/ceiling values in EUR.
- **FR-B2** Fiscal period is explicit and configurable (default: calendar year; support
  semester WS/SS granularity since TUM.ai plans per semester).
- **FR-B3** Budget history is auditable (who set what, when).
- **FR-B4** Department members can **view** their own budget but not change it.

### FR-C — Planning (departments, bottom-up)

- **FR-C1** A department member can create **plan line items** (label, category, planned amount,
  expected month, note, status: planned/committed/spent) for their department & period.
- **FR-C2** The tool shows **planned vs budget** (are we over-committing the ceiling?) with a soft
  warning when the sum of plan items exceeds the budget.
- **FR-C3** LnF can view/edit plan items for **any** department.

### FR-D — Analysis (actual vs budget)

- **FR-D1** For a department + period: **budget, actual (from BB), remaining, % used**, and a
  month-by-month **burn-down**.
- **FR-D2** **Projection**: simple run-rate forecast of period-end spend vs budget.
- **FR-D3** Org-wide LnF view: all departments in one table with variance, sortable, with the
  unmapped bucket surfaced for cleanup.
- **FR-D4** Reconcile plan → actual: match plan items to real postings (by category/period), show
  unplanned spend.

### FR-E — Access control & scoping

- **FR-E1** New permission `finance.department`; department portal visible only to members whose
  department has it (or to LnF/admin).
- **FR-E2** All department-scoped endpoints resolve the caller's department server-side; requests for
  another department return 403 (LnF/admin exempt).
- **FR-E3** Postings are filtered to the department's owned cost locations (reverse map from
  `finance_department_mappings`); a department never sees another department's transactions.
- **FR-E4** RLS on every new table mirrors `is_finance_reviewer()` plus a new
  `is_finance_department_member(department)` predicate.

### FR-F — Reporting / export

- **FR-F1** CSV/XLSX export of the transaction explorer and the budget-vs-actual table (respecting
  the caller's scope).
- **FR-F2** Per-department, per-period PDF/print summary for board reporting.

### Non-functional

- Coverage thresholds only ratchet up (client vite config, server c8). New code ships tested.
- Feature-scoped architecture: thin `*Page` → `hooks/use*` → presentational `*Section` (< 400 lines).
- Shared Zod schemas are the single contract; `pnpm build:shared` after every `shared/` change.
- Migrations are immutable once merged — every schema change is a new timestamped file with RLS.
- No plaintext sensitive fields ever logged/returned/seeded.

---

## 4. Implementation plan (phased)

Each phase is independently shippable and gated behind the previous one's data. Every phase ends with
`pnpm gate` green + a Playwright E2E for its primary flow.

### Phase 1 — Depth: category / account / VAT / transaction explorer (LnF-only)

Delivers FR-A. No new personas yet, so it's low-risk and immediately useful.

- **shared/** extend `finance.ts`: `FinanceCategoryMapping*`, `by_category`/`by_account` rollup
  schemas, `netTotals`/`grossTotals`, a `FinanceTransactionsQuery`/`Response` (paginated + filters).
- **migration** `finance_category_mappings` (`cost_location_two → category`, RLS like mappings);
  `finance_account_labels` _or_ a seeded static SKR map in `server/src/lib/financeAccounts.ts`.
- **server/** grow `financeDepartments.ts` (or split into `financeAnalytics.ts`):
  `aggregateByCategory`, `aggregateByAccount`, net/gross via `vat`, income/expense via account +
  sign; add `GET /finance/transactions` (server-side filter + paginate) and category-mapping
  routes mirroring the department-mapping ones.
- **client/** add tabs to `FinanceAnalyticsSection` (Category, Accounts, Transactions) + net/gross
  toggle; new `hooks/useFinanceTransactions.ts`; charts follow the `dataviz` skill (theme-aware).
  Watch the 400-line soft / 700 hard limit — split into per-tab sections.
- **tests** unit for every new aggregation + hook; Storybook play/a11y for new sections; extend
  `e2e/finance-analytics.spec.ts`.

### Phase 2 — Budgets (LnF sets)

Delivers FR-B + the LnF side of FR-D.

- **migration** `finance_budgets` (`department`, `period_type`, `period_key`, `bereich?`,
  `category?`, `amount_planned`, `currency`, `note`, `set_by`, timestamps; unique on the scope key;
  RLS `is_finance_reviewer()` for write, department-readable in Phase 3).
- **shared/** budget schemas + `budget-vs-actual` response (budget, actual, remaining, pct, burn-down).
- **server/** `financeBudgets.ts` (load/upsert + compute variance by joining budgets to
  `aggregateByDepartment`); routes `GET/PUT /finance/budgets` (`finance.review`).
- **client/** Budget tab: LnF table to set budgets per department/period/(category); variance +
  burn-down charts; `hooks/useFinanceBudgets.ts`.
- **tests** variance math edge cases (no budget, over budget, mid-period run-rate), stories, E2E.

### Phase 3 — Department scoping & portal

Delivers FR-E + department-facing FR-D.

- **shared/** add `finance.department` to `PERMISSIONS` + `PERMISSION_DETAILS`; `pnpm build:shared`.
- **migration** `is_finance_department_member(dept)` SQL predicate; extend RLS on
  `finance_budgets` (+ Phase 1 tables) so a department reads its own rows; optional seed granting
  `finance.department` in `department_permissions`.
- **server/** `requireFinanceAccess` middleware resolving caller scope (own department vs all);
  every analytics/budget/transaction endpoint takes an optional `department` param — `finance.review`
  → any; `finance.department` → forced to own, else 403. Reverse map department → cost locations to
  filter postings (FR-E3).
- **client/** department portal — either a scoped `/tools/finance/department` page or the same page
  auto-scoped by role; nav entry visible per permission (`MainLayout`).
- **tests** authZ matrix (member sees only own dept; cross-dept 403; LnF sees all), E2E for both
  personas.

### Phase 4 — Planning (departments)

Delivers FR-C + FR-D4.

- **migration** `finance_plan_items` (department, period, category, label, planned_amount,
  expected_month, status, note, created_by; RLS: department members CRUD own, LnF all).
- **shared/** plan-item schemas + planned-vs-budget-vs-actual reconciliation response.
- **server/** `financePlans.ts` CRUD + reconciliation (match plan items to postings by
  category/period); routes scoped by `requireFinanceAccess`.
- **client/** Planning tab: editable plan line items, planned-vs-budget guardrail (FR-C2),
  plan-vs-actual reconciliation view; `hooks/useFinancePlan.ts`.
- **tests** CRUD + reconciliation + guardrail, stories, E2E.

### Phase 5 — Receipts, exports, reporting

Delivers FR-A6 + FR-F.

- Confirm & wire BB receipt/document fetch (`external_id` → receipt); drill-down link/preview.
- CSV/XLSX export of transaction explorer + budget-vs-actual (scope-aware).
- Per-department/period print/PDF summary.
- **tests** export shape + scope enforcement, E2E smoke.

---

## 5. Data model summary (new tables)

| Table | Key | Written by | Read by |
| --- | --- | --- | --- |
| `finance_category_mappings` | `cost_location_two` | LnF | LnF (+ dept scope) |
| `finance_account_labels` (opt.) | account number | LnF | all scoped |
| `finance_budgets` | (department, period, category?) | LnF | LnF + own dept |
| `finance_plan_items` | id | dept members (own) + LnF | LnF + own dept |

All: `enable row level security`, predicates built on `is_finance_reviewer()` and (Phase 3+)
`is_finance_department_member(department)`; `service_role` full; `authenticated` scoped.

---

## 6. Open decisions (confirm with LnF before Phase 2)

1. **Fiscal period** — calendar year, or semester (WS/SS) granularity, or both?
2. **Budget granularity** — department-level ceiling only, or per category / per bereich?
3. **Who edits budgets** — LnF only (departments plan within), confirmed? Any co-editing?
4. **SKR variant** — SKR03 or SKR04 (drives the account-label map)?
5. **VAT reclaim** — is input-VAT recovery in scope (relevant only for wirtschaftlich)?
6. **Which departments** get the self-service portal at launch, and do any cost locations (e.g. board
   / management `100`) stay LnF-only regardless of mapping?
7. **BB master data** — is the account / cost-location naming API available on our plan to auto-label?
