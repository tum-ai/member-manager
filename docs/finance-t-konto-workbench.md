# T-Konto Workbench — Functional Requirements & Implementation Plan

Follow-up to `docs/finance-analytics-roadmap.md` (FR-A … FR-J). This document continues the
FR letter scheme at **FR-K** and covers the next iteration of the Finance tool: turning the
T-Konto tab from a read-only report into the **single working surface** for invoices,
projects and planning — and retiring the tabs it makes redundant.

## Where we are today

| Piece | State | File |
| --- | --- | --- |
| T-Konto view | Read-only. Expense/income columns, actual vs plan, project folders, sub-team folders, roll-ups. No interaction beyond expand/collapse of a folder. | `client/src/features/finance/components/FinanceTAccountSection.tsx`, `FinanceTAccountGroup.tsx`, `financeTAccountUtils.ts` |
| T-Konto data | Built server-side per department, grouped by project → sub-team → ungrouped. | `server/src/lib/financeTAccount.ts` |
| Projects | Full CRUD incl. `parent_project_id` with DB-level cycle/depth guard. Lives in a separate "Projekte" tab. | `server/src/lib/financeProjects.ts`, `supabase/migrations/20260722090000_protect_finance_project_scope.sql` |
| Planposten | Full CRUD in a separate "Planung" tab. **Cannot be created inside a project** — `FinancePlanItemCreateSchema` has no `project_id`, and `createPlanItem` does not insert it. Only template assignment sets a project. | `shared/src/finance.ts:473`, `server/src/lib/financePlans.ts:72` |
| Invoice → project | `PUT /finance/posting-allocations/:externalId` (replace-all semantics). Reachable only from the "Abgleich" tab. | `server/src/routes/financeManagement.ts:477` |
| Invoice → Planposten | `POST /finance/plan-item-matches`, with direction + allocation + capacity validation. "Abgleich" tab only. | `server/src/routes/financeManagement.ts:711` |
| VAT | `embeddedVat()` server-side; T-account totals carry `vat_income` / `vat_expenses`; per-line `vat_amount` is computed for **both** directions but **rendered only for income** (`FinanceTAccountGroup.tsx:36`). Planposten have no VAT at all. | `server/src/lib/financeVat.ts` |

So: most of the *plumbing* exists, scattered across four tabs. This iteration is mostly a
**consolidation + interaction** project, plus three genuine data-model gaps (plan item
`project_id` on create, plan item enable/disable, plan item VAT rate).

---

## FR-K — Invoices are first-class, selectable objects in the T-view

- **FR-K1** Every *actual* line (a booked BB posting) in every column renders as a row with a
  **selection checkbox**. Selection is scoped to the whole department T-view, not to one node,
  so invoices from different sub-teams/projects can be collected into one new project.
- **FR-K2** Every line is **expandable** (disclosure, `aria-expanded`, keyboard operable) to a
  detail panel showing: booking date, receipt/invoice number, counterparty, gross amount,
  VAT rate + embedded VAT + net amount, ledger account (+ label), cost location (+ resolved
  sub-team), category (`cost_location_two`), current allocations
  (department / project / tax area / %), and any matched Planposten.
- **FR-K3** Detail requires **no extra round-trip**: the `/finance/t-account` response carries
  the detail payload on each actual line. The server already holds the postings in memory
  when it builds the response.
- **FR-K4** *Plan* lines expand too, to their Planposten detail: status, expected month, note,
  VAT rate, matched postings, and Plan / Ist / Delta.
- **FR-K5** When ≥ 1 invoice is selected, a **selection bar** appears (sticky on mobile) with
  the count, the gross sum, and actions: *Neues Projekt aus Auswahl*, *Zu Projekt hinzufügen*,
  *Auswahl aufheben*.
- **FR-K6** Selection and all write actions are offered only to users who may write the
  department (`finance.review`, or their own department). Read-only users still get FR-K2/K4
  expansion. Enforcement stays server-side (`assertCanWriteDepartment`).
- **FR-K7** Selection clears on department or period change, and after a successful bulk
  action. It survives a background refetch.

## FR-L — Projects and sub-projects are created and filled inside the T-view

- **FR-L1** *Neues Projekt aus Auswahl*: one dialog, prefilled with the selection count and
  sum. Fields: name, parent project (prefilled from the node the action was triggered on),
  sub-team, tax area, target amount, status. On submit the project is created **and** every
  selected invoice is allocated to it (100 %) in **one** server call.
- **FR-L2** Invoices can be added to an **existing** project one at a time (per-row action in
  the expanded detail) or in bulk (selection bar). Both use the same endpoint.
- **FR-L3** Every node offers project creation in place: a department node and a sub-team node
  offer *Neues Projekt*; a project or sub-project node offers *Neues Teilprojekt*, which
  presets `parent_project_id`. The existing DB cycle/depth guard remains the authority.
- **FR-L4** A project created inside a sub-team folder is **stored with that sub-team** and
  renders nested inside it. This needs a new `finance_projects.sub_team` column — today
  sub-teams exist only as a cost-location mapping attribute, so a project cannot hang under one.
- **FR-L5** Assignment must not silently destroy data. `PUT /finance/posting-allocations/:id`
  has *replace-all* semantics, so a posting that is already **split** across several targets is
  **refused** by the bulk/one-click assign with a pointer to the split editor. Only postings
  with 0 or 1 allocation take the fast path.
- **FR-L6** A bulk assign is **atomic per posting**: a partial failure leaves the successful
  ones applied and reports exactly which postings failed and why.
- **FR-L7** An invoice already matched to a Planposten in another project cannot be moved
  until the match is detached; the error says so in words, not as a constraint violation.
- **FR-L8** A posting can only be assigned to a project whose period contains the posting's
  booking date. Cross-period assignment is rejected with a readable message.

## FR-M — Planposten are planned, tracked and corrected in the T-view

- **FR-M1** A Planposten can be created on **any** node — department, sub-team, project,
  sub-project — with `project_id` (and sub-team) preset from that node.
  *Gap to close:* `project_id` must be accepted on plan-item create **and** update.
- **FR-M2** A Planposten is editable in place: label, category, direction, planned amount,
  expected month, VAT rate, note, and the project it belongs to.
- **FR-M3** **Enable / disable.** A new `is_active` flag. A disabled Planposten stays visible
  (muted, under a "Deaktiviert" disclosure) but is excluded from Plan-Saldo, forecast and all
  plan totals. Toggling is one click, optimistic, and undoable from the toast.
- **FR-M4** **Activate when the expenditure arrives.** Matching an invoice to a Planposten
  moves its status automatically: `planned` → `committed` on a partial match, → `spent` once
  the matched total reaches the planned amount. A manual status override remains possible and
  is not overwritten by a later match.
- **FR-M5** **Assign new expenses.** From an expanded invoice: pick a Planposten of the same
  direction in scope. From an expanded Planposten: pick from the unmatched invoices in scope.
  Partial amounts are supported; the amount field defaults to the open remainder.
- **FR-M6** **Correct the actual amount.** An expanded Planposten shows Plan / Ist / Delta with
  a *Plan auf Ist korrigieren* action that sets `planned_amount` to the matched total. The
  existing `update_finance_plan_item` guard ("below its matched total") makes this safe.
- **FR-M7** Detaching a match restores the open remainder and reverts the status when nothing
  remains matched.
- **FR-M8** A disabled Planposten accepts no new matches (server-enforced).

## FR-N — VAT is tracked by direction

- **FR-N1** Every actual line exposes `vat_rate`, `vat_amount` and its net amount **in both
  directions**. Today the amount tooltip returns early for anything that is not income
  (`FinanceTAccountGroup.tsx:36`), so expense VAT is invisible.
- **FR-N2** Expense VAT is labelled **Vorsteuer**, income VAT **Umsatzsteuer**. Never a
  generic "USt" that hides which side of the ledger it is on.
- **FR-N3** VAT subtotals per column per node: Vorsteuer under the expense column, USt under
  the income column. At department level, add the **Zahllast** (USt − Vorsteuer) alongside the
  existing `vat_income` / `vat_expenses`.
- **FR-N4** A **Netto / Brutto toggle** switches every amount in the T-view; saldi recompute
  accordingly and the active mode is stated in the header, never merely implied.
- **FR-N5** Planposten carry an optional `vat_rate`, so planned VAT feeds the plan-side
  subtotals and the forecast Zahllast is meaningful. A missing rate renders as "—", not "0 €".
- **FR-N6** All VAT arithmetic stays in `financeVat.ts` / the client's `computeVatAmount`. No
  new inline formulas.

## FR-O — Section consolidation

The T-view absorbs three tabs. Decision per current tab:

| Tab today | Decision | Rationale |
| --- | --- | --- |
| **Übersicht** | **Keep**, absorbs Kategorien + Konten + USt-Summary as panels | Three tabs that are each a single breakdown table are three clicks too many. |
| **Budget** | **Keep** | Distinct concern (LnF sets ceilings); already drills down into T-Konto. |
| **Planung** | **Remove** | Planposten now live in the T-view next to the actuals they plan (FR-M). `FinancePlanSection.tsx` retires. |
| **T-Konto** | **Becomes the workbench** | This document. |
| **Projekte** | **Remove** for project CRUD; **move** plan templates to Einstellungen | Project creation belongs where the money is (FR-L). Templates are an admin/setup concern. |
| **Abgleich** | **Split** | Allocation + matching move into the T-view (FR-K/L/M). Cross-department reallocation requests and budget-transfer approvals become their own **Anträge** tab — they are an approval inbox, not a reconciliation surface. |
| **Berichte** | **Keep** | Board reporting, unchanged. |
| **Kategorien** | **Merge** into Übersicht | Read-only breakdown. |
| **Konten** | **Merge** into Übersicht | Read-only breakdown. |
| **Zuordnung** | **Keep**, rename **Einstellungen**, absorbs plan templates | LnF-only setup. |

- **FR-O1** Final tab set: **Übersicht · Budget · T-Konto · Anträge · Berichte · Einstellungen**
  (6, down from 10).
- **FR-O2** Landing tab: **T-Konto** for department-scoped members (their working surface),
  **Übersicht** for `finance.review` (LnF's org-wide view).
- **FR-O3** The budget → T-Konto drill-down (`openDepartmentTAccount`) keeps working, carrying
  department and period.
- **FR-O4** **No endpoint is deleted.** Every route behind a retired tab is reused by the
  T-view or the Anträge tab. This is a UI consolidation, not an API break.

## Non-functional

- **NFR-1** `client/src/features/**/*.tsx` hard-fails > 700 lines, warns > 400. The T-view grows
  a lot — it ships as a `components/tAccount/` folder of small files, not a fat section.
- **NFR-2** Responsive: the two columns already stack below `sm`. The selection bar becomes a
  sticky bottom bar on mobile; detail panels are full-width.
- **NFR-3** Dark-mode parity, keyboard operability and ARIA on every new disclosure, checkbox
  and dialog. Amount sign is always explicit — colour is never the only signal.
- **NFR-4** Every hook and util gets a Vitest test; every interactive component gets a
  Storybook play + a11y story; the primary flow gets a Playwright spec. Coverage thresholds
  ratchet up only.
- **NFR-5** German UI copy, matching the existing T-view.

---

## Data model changes

Three migrations, all additive. **No merged migration is edited.**

### M1 — `finance_projects.sub_team`

```sql
alter table "public"."finance_projects" add column if not exists "sub_team" text;
```

Plus an index on `(department, sub_team)`. The project create/update RPC in
`20260722090000_protect_finance_project_scope.sql` takes its columns as parameters, so its
signature changes → **create the new overload and drop the old one in the same migration**
(Postgres will otherwise keep two ambiguous overloads).

**Rule of precedence** (must be documented in `docs/finance-cost-location-mapping.md`):
the cost-location mapping's `sub_team` decides where an *unallocated posting* lands;
`finance_projects.sub_team` decides where a *project folder* hangs. They are independent.

### M2 — `finance_plan_items` gains lifecycle + VAT

```sql
alter table "public"."finance_plan_items"
    add column if not exists "is_active" boolean not null default true,
    add column if not exists "vat_rate"  numeric(5,2);
```

`project_id` already exists on the table — only the write path ignores it. Extend
`update_finance_plan_item` with `p_is_active`, `p_vat_rate`, `p_project_id` (same
create-new-overload-then-drop-old dance), keeping the existing
"below its matched total" / "direction cannot change" guards.

### M3 — matching respects the disabled flag

Extend the match-creation guard so a match against an inactive plan item is rejected (FR-M8),
and add the automatic status transition of FR-M4 where matches are written.

### Seed parity

`supabase/seed.sql` and the E2E fixtures must gain: a sub-team-owned project, a disabled
Planposten, a Planposten with a VAT rate, and a partially matched Planposten — otherwise
none of the new states are reachable in E2E.

---

## API changes

| Endpoint | Change |
| --- | --- |
| `GET /finance/t-account` | Response gains per-line detail (FR-K2/K3), per-node VAT subtotals (FR-N3), `sub_team` on project groups, and `is_active` / `vat_rate` on plan lines. |
| `POST /finance/plan-items` | Accepts `project_id`, `vat_rate`, `is_active`. |
| `PUT /finance/plan-items/:id` | Accepts `project_id`, `vat_rate`, `is_active`. |
| `POST /finance/projects/from-postings` | **New.** Atomic: create the project, then allocate N postings to it. Backs FR-L1 without an N+1 client loop. |
| `POST /finance/posting-allocations/bulk` | **New.** Assign many postings to one project; per-posting result list (FR-L6), refuses already-split postings (FR-L5). |
| `POST /finance/plan-item-matches` | Rejects inactive plan items (FR-M8); applies the FR-M4 status transition. |
| everything else | Unchanged and reused. |

`shared/src/finance.ts` is edited **first**, then `pnpm build:shared`, then both consumers —
in the same change.

---

## Client architecture

```
client/src/features/finance/
  FinanceAnalyticsPage.tsx                    # tabs trimmed to 6 (FR-O1)
  hooks/
    useFinanceTAccount.ts                     # data + period/department (exists)
    useFinanceTAccountSelection.ts            # selection set, derived sums (FR-K)
    useFinanceTAccountActions.ts              # project/plan/match/allocate mutations
  components/tAccount/
    FinanceTAccountSection.tsx                # shell (moves here)
    FinanceTAccountGroup.tsx                  # node folder (moves here)
    FinanceTAccountLineRow.tsx                # checkbox + disclosure (FR-K1/K2)
    FinancePostingDetailPanel.tsx             # FR-K2
    FinancePlanItemDetailPanel.tsx            # FR-K4, FR-M6
    FinanceTAccountSelectionBar.tsx           # FR-K5
    FinanceProjectDialog.tsx                  # FR-L1/L3
    FinanceAssignToProjectDialog.tsx          # FR-L2
    FinancePlanItemDialog.tsx                 # FR-M1/M2
    FinanceMatchPlanItemDialog.tsx            # FR-M5
  components/approvals/
    FinanceApprovalsSection.tsx               # extracted from FinanceReconciliationSection
```

Page → hook → sections stays intact: the page pulls one `tAccount` object, the sections stay
prop-driven and presentational.

---

## Implementation plan

Each phase is independently shippable and ends green on `pnpm gate`.

### Phase 0 — Contract + migrations (no UI) — **done**
Shared schemas for the new fields and the two new endpoints; migrations M1–M3; seed +
E2E fixture parity; `pnpm build:shared`; `pnpm supabase:reset` verified.

Landed:

- `shared/src/finance.ts` — `sub_team` on projects; `is_active`/`vat_rate` on plan items
  (`project_id` now accepted on create **and** update); T-account lines carry `vat_rate`,
  `net_amount` and an inline `posting_detail`/`plan_detail`; groups carry `sub_team`,
  `is_sub_team` and per-column `vorsteuer`/`umsatzsteuer`; totals carry `vat_payload`;
  plus the `from-postings` and bulk-allocation contracts with their per-posting result list.
- `supabase/migrations/20260808120000_finance_project_sub_team.sql`,
  `20260808120100_finance_plan_item_lifecycle.sql` — both apply on a clean
  `pnpm supabase:reset`; each RPC has exactly one arity (old overloads dropped).
- Server write paths: `financeProjects`, `financePlans` (the create path silently dropped
  `project_id` — fixed), `financeAllocations` (match delete now goes through the RPC so the
  status walks back), `financeTAccount` (line detail, per-column VAT, sub-team grouping,
  disabled items excluded from plan totals).
- `client/src/features/finance/financeTAccountFixtures.ts` — shared builders, so the next
  contract change does not mean rewriting a dozen spec files by hand.
- `supabase/seed.sql` — a sub-team-owned project, an active VAT-rated Planposten, a
  partially matched one (`committed`), and a disabled one, with the allocation that makes
  the match a legally reachable state.

Verified directly against the local database: `planned → committed → spent` on match and
back down on detach; a manual override to `spent` survives a later partial match; a
disabled Planposten refuses matches; a Planposten cannot move to another department's
project, or to any project once postings are matched to it.

### Phase 1 — Line detail and VAT by direction (FR-K1–K4, FR-N1–N3) — **done**
Server enriches the T-account lines. Client splits the T-view into `components/tAccount/`,
adds the disclosure rows and the two detail panels, fixes the income-only VAT rendering,
adds per-column Vorsteuer/USt subtotals and the department Zahllast.
*Tests:* `financeTAccountUtils` unit tests for the new subtotals; play + a11y stories for the
disclosure rows; server tests for the enriched payload.

Landed:

- `client/src/features/finance/components/tAccount/` — `FinanceTAccountSection` and
  `FinanceTAccountGroup` moved here (NFR-1), joined by `FinanceTAccountLineRow`,
  `FinancePostingDetailPanel`, `FinancePlanItemDetailPanel` and the shared
  `FinanceTAccountDetailList` primitives. Every real line is now a Radix disclosure
  (`aria-expanded`, Enter/Space operable); a rolled-up child-project folder line has no
  detail of its own and stays static.
- `financeTAccountUtils` — display lines carry `vatRate`, `netAmount`, `status`, `isActive`
  and their inline detail, plus allocation/match views with the project, Planposten and
  posting **names resolved** from the same response (no uuids in the panel, no extra
  request). Column summaries gained `vatIst` / `vatPlan`, and a disabled Planposten is now
  excluded from the client plan subtotals too — it used to inflate them while the server
  saldo already ignored it.
- VAT rendering fixed: the old tooltip returned early for anything that was not income, so
  Vorsteuer was invisible. It is now stated in words on every line ("inkl. 19,00 €
  Vorsteuer"), readable on touch and by a screen reader, and the totals card names
  Umsatzsteuer / Vorsteuer separately and adds the **Zahllast** (FR-N3).
- The selection checkbox of FR-K1 is deliberately **not** here: a checkbox without the
  selection state and bar of FR-K5–K7 would be dead UI. The row is structured so Phase 2
  adds it without touching the disclosure.
- Tests: `financeTAccountUtils.test.ts` (VAT subtotals both directions, disabled item
  excluded, resolved names), four play + a11y stories in `FinanceTAccountLineRow.stories.tsx`,
  an extended section story, and six server tests over the enriched payload.

### Phase 2 — Selection, projects, sub-projects (FR-K5–K7, FR-L) — **done**
Selection hook + selection bar; `POST /finance/projects/from-postings` and the bulk-allocation
endpoint with the split-posting refusal and per-posting results; project/sub-project dialogs on
every node; `finance_projects.sub_team` wired through the grouping.
*Tests:* selection hook unit tests; server tests for atomicity, split refusal, period mismatch
(FR-L8), cross-department authZ; a Playwright spec for *select two invoices → new project →
they appear under it*.

Landed:

- `server/src/lib/financeBulkAllocation.ts` — the per-posting decision is a **pure** function
  (`planBulkAllocation`): no Supabase, no BB, so every refusal path is unit-tested. AuthZ is
  checked first, then split (FR-L5), period (FR-L8), matched-elsewhere (FR-L7). `assignPostingsToProject`
  in the route does the IO and writes only what the planner cleared.
- `POST /finance/projects/from-postings` and `POST /finance/posting-allocations/bulk`. Both are
  open to **department-scoped members** via `assertCanWriteDepartment` + a per-posting
  `canWriteDepartment` predicate — the pre-existing replace endpoint stays reviewer-only. A write
  that the database still refuses (the plan-item-match guard) is caught per posting, so the
  successful ones stay applied (FR-L6).
- Client: `useFinanceTAccountSelection` (department-wide selection, cleared on department/period
  change but **not** on a refetch), `useFinanceTAccountActions`, the selection bar (sticky on
  mobile), the project/sub-project dialog on every node and the assign dialog from the bar or a
  single expanded row. `TAccountInteraction` bundles the write surface into one prop so it can
  travel to a line row without five props at every level; omitted, the view is read-only (FR-K6).
- `buildTAccountTree` now nests a project inside the sub-team folder that owns it (FR-L4), keyed
  by a stable `proj:`/`sub:` node key.
- **Bug found and fixed:** `PATCH /finance/projects/:id` rebuilt its update payload without
  `sub_team`, so *any* edit silently cleared a project's sub-team — the Phase 0 column would have
  been wiped by the first rename.
- Tests: 11 planner cases server-side; 6 selection-hook cases; tree-nesting and skip-summary util
  cases; `Workbench` + `ReadOnly` play/a11y stories; a Playwright spec that selects two invoices
  across folders, creates a project from them, and asserts the one funding another project's
  Planposten is **refused by name** rather than moved.

Notes on the E2E: the mock BB postings and the seeded cost-location mappings only overlap on
cost location 111 (Community / Onboarding), so the spec is written against those seeded
fixtures rather than depending on an earlier spec's mapping side effect. It also expands every
folder before selecting, because the suite does not reset the database between local runs and a
previous run leaves the moved invoice inside the project it created — the flow has to work from
either starting state.

**Second bug, found by that spec:** the Phase 0 seed pinned its allocation and its match to
`BB-1010`, but the mock generator's ids shift with every posting added before them — `BB-1010`
is *"Mitgliedsbeiträge"* (+420, cost location 182), not the intended *"Onboarding SS Catering"*
(−840, cost location 111), which is `BB-1077`. The seed was therefore allocating an unrelated
income posting to the Community project and matching it to an **expense** Planposten: a state
the API validates against and would never create. Fixed in `supabase/seed.sql`, with a comment
warning that the id has to be re-checked whenever mock postings are added ahead of it.

### Phase 3 — Planposten in the T-view (FR-M) — **done**
`project_id` on plan-item create/update; enable/disable with plan totals excluding inactive
items; create/edit dialogs on every node; match + detach from both directions; the
*Plan auf Ist korrigieren* action; the FR-M4 status transitions.
*Tests:* server tests for the status transitions, the inactive-item match refusal and the
correct-to-actual guard; hook tests for totals excluding disabled items; a Playwright spec for
*plan → invoice arrives → match → status becomes spent → correct the amount*.

Landed — almost entirely client work, because Phase 0 had already built the server side
(automatic status transitions with manual override, the inactive-item match refusal, the
status walk-back on detach, and the "below its matched total" guard):

- **Partial updates are now possible, and safe.** `FinancePlanItemUpdateSchema` makes every
  field optional (with an "at least one field" refinement), and `updatePlanItem` reads the
  stored row first so an omitted field keeps its value while an explicit `null` still clears
  it. Without this the T-view could not send a one-field update at all.
- **Bug found and fixed:** the RPC assigns most columns unconditionally, so the *existing*
  plan tab — which never sends `project_id` or `vat_rate` — was **clearing a Planposten's
  project and VAT rate on every edit**. Phase 0's `project_id` would have been erased by the
  first rename from that form.
- `useFinanceTAccountPlanActions` — create/edit, park/revive, correct-to-actual, match,
  detach. Parking is optimistic (the cache is patched so the row mutes and leaves the plan
  subtotals immediately) and undoable from the toast, which meant giving `ToastContext` an
  optional action button.
- `FinancePlanItemDialog` (create on any node with its project preset, edit in place) and
  `FinanceMatchPlanItemDialog` (one dialog, both directions: the expanded side is fixed, the
  other is picked from the candidates of the same direction **and the same scope**, amount
  defaulting to the open remainder).
- **What "in scope" turned out to mean (FR-M5).** The E2E caught the first version offering
  candidates the database then refused: a match may only draw on the part of a posting
  allocated to the Planposten's own *(department, project)*, so a department-level Planposten
  cannot absorb an invoice that belongs to a project. The candidate lists now carry their
  project and are paired like with like. Folders also became named `role="group"` regions,
  which a screen reader can move between — and which let the E2E act inside one folder.
- The plan detail panel is where a Planposten is worked on: edit, match, correct, park, and
  detach per match. Parked items collapse into a "Deaktiviert (n)" disclosure per column.
- `FinanceTAccountWorkbench` was extracted from the section, which was about to blow the
  400-line warn threshold; the section keeps the department/period chrome and the totals card.
- Tests: 4 server cases pinning the partial-update semantics, `collectMatchCandidates` /
  `openPostingAmount` util cases, `PlannedItemWritable` / `ParkedPlanItem` / `PlanFromNode`
  play + a11y stories, and a Playwright spec for *plan 5.000 → match an invoice → status
  becomes Zugesagt → correct the plan to the 600 that arrived*.

- **Third find:** a fully matched Planposten carries no open remainder, so the server emits no
  line for it — and the invoice funding it then showed a nameless "Planposten". The response
  now carries `plan_item_labels` (every Planposten of the department by id) so a reference can
  always be named, whether or not the item has a line.

Deliberately **not** included: deleting a Planposten from the T-view. FR-M covers parking, not
deletion, and the plan tab still owns delete until Phase 5 retires it — that phase has to grow
a delete affordance here or the capability disappears with the tab.

**Open for Phase 5:** a fully matched Planposten is invisible in the T-view (no line, only a
name on the invoice that funds it), so it cannot be edited, parked or detached from there. That
is survivable while the Planung tab exists; when that tab goes, these items need a home — most
likely an "Erledigt" disclosure per column, mirroring "Deaktiviert".

### Phase 4 — Netto/Brutto and planned VAT (FR-N4–N6) — **done**
The toggle plus planned VAT feeding the plan-side subtotals and the forecast Zahllast.
*Tests:* util tests for net/gross recomputation across both directions; a story per mode.

Landed. Most of FR-N5 was already in place from Phase 1 (plan lines carry `vat_rate`,
`vat_amount` and `net_amount`, and feed a "(geplant)" row in each column's VAT subtotal), so
this phase is the toggle and the forecast:

- **`buildTAccountTree(groups, { planItemLabels, amountMode })`.** The mode is applied once,
  where a line is turned into a display line: `amount` becomes the net or the gross figure and
  everything downstream — column subtotals, node saldi, the forecast, the rolled-up folder
  lines — is derived from it. That is what makes one toggle switch *every* number consistently
  rather than a dozen call sites each remembering to convert (FR-N4).
- **No new arithmetic (FR-N6).** Both figures come from the server per line (`amount` and
  `net_amount`), and the department header reads the server's new `actual_net` / `plan_net`
  saldi. Nothing on the client subtracts VAT from anything.
- **Forecast Zahllast (FR-N5).** Totals gained `vat_income_plan` / `vat_expenses_plan` and
  `vat_payload_forecast` — what the department will owe once the still-open Planposten have
  arrived. It is only surfaced when it actually differs from today's Zahllast, so a department
  that plans without VAT rates sees no noise.
- Per-row wording follows the mode: "inkl. 19,00 € Vorsteuer" in Brutto becomes "zzgl." in
  Netto, because in Netto the VAT is not inside the number being shown.
- The active mode is stated in the header ("· Beträge netto"), never left to be inferred from
  the figures.
- Tests: 4 util cases (both directions, both modes, roll-ups, and both figures staying on the
  line), 2 server cases (net saldi, and a forecast where a planned 19 % expense cancels the
  booked USt), a `NettoBrutto` play + a11y story, and a toggle assertion in the T-Konto E2E.

### Phase 5 — Consolidation (FR-O) — **done**
Trim the tab set; move Kategorien/Konten/USt into Übersicht; extract the Anträge tab from
`FinanceReconciliationSection`; move plan templates into Einstellungen; delete
`FinancePlanSection` and the project-CRUD half of `FinanceProjectsSection`; set the
role-dependent landing tab.
*Tests:* update `e2e/finance-analytics.spec.ts` for the new navigation; delete the tests of
deleted components, keep coverage at or above the current floor.

Landed:

- **Six tabs, down from ten** (FR-O1): Übersicht · Budget · T-Konto · Anträge · Berichte ·
  Einstellungen. Kategorien, Konten and the VAT summary became panels of Übersicht; Planung,
  Projekte and Abgleich are gone.
- **Landing tab by role** (FR-O2): LnF lands on Übersicht, a department-scoped member on the
  T-Konto — and the org-wide analytics query is no longer fetched for them at all.
- `FinanceApprovalsSection` — the approval inbox extracted from `FinanceReconciliationSection`
  (reallocation queue + budget transfers), and `FinancePlanTemplateAssignForm`, since applying
  a template used to hang off a row of the project table that no longer exists.
- Deleted: `FinancePlanSection`, `FinanceProjectsSection`, `FinanceReconciliationSection`,
  `FinanceProjectCreateForm`, `FinanceReconciliationPostingRow`, `FinancePlanMatchForm`,
  `useFinancePlanItems` and their tests/stories, plus the now-dead allocation/matching
  mutations and the reconciliation query in `useFinanceManagement`. **No endpoint was removed**
  (FR-O4) — every one of them is still called, from the T-view's own hooks.
- **Capabilities that lived only in a deleted tab moved into the T-view rather than
  disappearing** — this was the bulk of the work, and each one is a promise the earlier phases
  made:
  - *Deleting a Planposten* (the Phase 3 gap): offered in the plan detail panel while nothing
    is matched to it, behind a confirm, with parking still the reversible option.
  - *The split editor*: FR-L5 refuses a split posting and points at "the split editor", which
    only existed on the Abgleich tab. It is now a dialog on the invoice's own row —
    reviewer-only, exactly like the endpoint behind it. That message pointed at nothing for
    the length of this phase's WIP; it points at a real control again.
  - *Requesting a cross-department reallocation*: from the invoice row, reviewed in Anträge.
- Tests updated: the management hook's prop bags and its test, the page hook's tabs/landing
  test, and the E2E navigation (Einstellungen/Anträge, template setup and both approval flows;
  the parts now covered by the T-view specs were dropped rather than re-pointed).

Then closed:

- **The regression is fixed.** The server no longer drops a fully matched Planposten: every
  Planposten of the department is emitted, whatever state it is in. One with nothing open
  contributes its zero to the plan column — so the no-double-count property that the skip was
  protecting is unchanged — and the client groups those under an **"Erledigt (n)"** disclosure
  per column, mirroring "Deaktiviert". A settled item is still editable and detachable, and is
  no longer offered as a match candidate, having no capacity left.
- Stories for `FinanceApprovalsSection` (open inbox, empty, department member) and
  `FinancePlanTemplateAssignForm` (assigning, and the no-projects state that points at the
  T-Konto). The approvals header gained a named landmark so its open count can be read apart
  from the per-request status badges.

### Follow-up — projects are removable where they are created

Reported while driving the running app: FR-L lets a project be created from the T-view, but
nothing could take one back out, so a mistyped or abandoned project was permanent.

- `DELETE /finance/projects/:projectId` — `requireFinanceViewer`, 404 for an unknown id, then
  `assertCanWriteDepartment` against the project's own department, 204 on success.
- Deleting **detaches rather than destroys**: every foreign key at `finance_projects` is
  `ON DELETE SET NULL` (allocations, plan items, reimbursement links, `parent_project_id`), so
  the project's invoices fall back to their department bucket, its Planposten lose the project
  and its sub-projects become top-level. Only template assignments cascade away. Verified
  against real Postgres, since the in-memory route harness does not model FKs.
- A red **"Projekt löschen"** sits on the project folder, gated by the same `canWrite` as the
  other node actions, behind a confirm that counts the consequences ("1 Buchung fällt zurück ans
  Department — gelöscht wird nichts davon.") instead of a generic prompt.

---

## Decisions (settled 2026-08-09)

The four open questions have been answered; this is what the implementation follows.

1. **Sub-team ownership of projects — set by hand.** A project's `sub_team` is chosen in the
   create dialog, prefilled from the folder the action was started in, and never derived from
   its postings' cost locations. Precedence stands as proposed: the cost-location mapping
   decides where an *unallocated posting* lands, `finance_projects.sub_team` decides where a
   *project folder* hangs.
   *Why not derived:* a project whose invoices come from several cost locations has no defined
   home, and a folder that relocates itself when the next invoice arrives cannot be trusted.
   *Known cost:* nothing reconciles the two, so a project can sit under one sub-team while its
   spending is booked to another's cost locations. That divergence is deliberate and visible
   rather than silent.
2. **Status transitions — automatic, with manual override (FR-M4).** A match moves a Planposten
   `planned → committed → spent`; a status set by hand is never overwritten by a later match.
   Already implemented and verified against the local database in Phase 0.
3. **Project creation — department members.** Whoever may write their own department may create
   projects in it, one click from the T-view. No permission change. Consequence accepted: the
   number of projects will grow.
4. **Split postings — refuse and point at the split editor (FR-L5).** The fast path takes
   postings with 0 or 1 allocation; already-split ones are skipped, named, and pointed at the
   existing `FinanceAllocationEditor`. Moving that editor into the expanded row stays open as a
   later, strictly additive step (~1 phase) if splits turn out to be common.
