# Finance Tool — T-Konto & Department-Übersicht (Functional Requirements)

Quellen: LnF-Meeting-Transkript + Notizen des Owners (2026-08-04).
Anschluss an `docs/finance-analytics-roadmap.md` (FR-A … FR-F, Personas, Datenmodell).
Diese FRs führen die ID-Konvention mit **FR-G … FR-J** fort.

Sprache: Deutsch (Stakeholder-Sprache LnF); technische Entitäten in Englisch, wie im Code.

---

## 0. Ziel in einem Satz

Für jedes Department (und für Projekte wie Makeathon/Hackathon) soll es eine **T-Konto-Ansicht**
geben — **Ausgaben links, Einnahmen rechts, Saldo unten** — die die schon vorhandenen Ist-Buchungen
(BB) und die Plan-Posten (`direction` expense/income) zusammenführt, geplante Posten optisch abhebt
und Projekte auf-/zuklappbar mit ihrem Netto-Profit zeigt. Der Budget-Tab bleibt die
Gesamt-Übersicht über alle Departments.

## 1. Kontext: Was existiert bereits (nicht neu bauen)

Das Tool `/tools/finance/analytics` hat bereits die Tabs
**Übersicht · Budget · Planung · Projekte · Abgleich · Berichte · Kategorien · Konten · Zuordnung**.
Relevante vorhandene Bausteine für dieses Feedback:

| Wunsch aus Meeting/Notizen | Bereits vorhanden | Fundstelle |
| --- | --- | --- |
| Automatische Zuordnung Buchung → Department | Ja (auto + LnF-Override + Split-Allocations) | `FinancePostingAllocation*`, `finance_department_mappings` |
| Geplante Ausgaben **und** Einnahmen erfassen | Ja — Plan-Items mit `direction: expense \| income`, Status planned/committed/spent | `FinancePlanItem*`, `FinancePlanSection` |
| Projekte je Department (Makeathon etc.) inkl. Unterprojekte | Ja — Projekte mit `parent_project_id`, `target_amount`, Status | `FinanceProject*`, `FinanceProjectsSection` |
| Ausgaben einer Gruppe einem Projekt zuordnen | Ja — Allocation-Target `project_id` | `FinancePostingAllocationInputSchema` |
| Plan ↔ Ist abgleichen (was geplant, was real gebucht) | Ja | `FinanceReconciliation*`, Tab „Abgleich" |
| Budget vs. Ist pro Department + Gesamt | Ja | `FinanceBudgetVsActual*`, Tab „Budget" |
| USt-Aufschlüsselung | Teilweise — **nur Ausgaben** nach Satz | `FinanceVatRateSummary`, `FinanceVatSummarySection` |
| Netto/Brutto & USt je Buchung | `vat` = Prozentsatz (kein Betrag), Netto = brutto·Satz/(100+Satz) | `finance.ts` Kommentar Z. 242–254 |

**Konsequenz:** Der Kern des Feedbacks ist überwiegend eine **neue Darstellungsschicht (T-Konto)**
über bereits vorhandenen Daten, plus die Ausweitung der USt-Erklärung auf Einnahmen. Keine neue
Datenpipeline nötig.

## 2. Quell-Mapping (Aussage → Interpretation → Status)

| # | Aussage (Meeting / Notiz) | Interpretation als Anforderung | Status |
| --- | --- | --- | --- |
| 1 | „Overall Budget, pro Department, Profit ersichtlich (z. B. Media ~40k), rauf/runterstufbar" | Budget-Tab = Gesamt-Übersicht aller Departments mit Netto/Profit, drill-down in ein Department | **erweitern** (Budget-Tab existiert, Profit-Framing ergänzen) |
| 2 | „T-Table: links Ausgaben, rechts Einnahmen, automatisch zugeordnet" | Neue T-Konto-Ansicht pro Department über Ist-Buchungen | **neu (FR-G)** |
| 3 | „geplante Events reinpacken … das ist grau" | Plan-Posten in der T-Konto-Ansicht anzeigen, optisch abgesetzt (grau) | **neu (FR-G)** — Daten vorhanden |
| 4 | „Ist-Saldo und Plan-Saldo" | Zwei Salden: Ist (nur gebucht) und Plan (Ist + geplant) | **neu (FR-G)** |
| 5 | „Hackathon: Ordnersymbol, Profit 15.420 €, aufklappbar" | Projekte als aufklappbare Gruppe innerhalb der T-Konto-Ansicht, mit Netto-Profit in der Kopfzeile | **neu (FR-I)** — Projekte-Daten vorhanden |
| 6 | Notiz: „jedes Department anklickbar" | Department-Auswahl/Klick öffnet dessen T-Konto | **neu (FR-G)** |
| 7 | Notiz: „für Makeathon Projekt erstellen, Ausgaben einer Gruppe hinzufügen, dort auch planen" | Projekt anlegen + Ist/Plan dem Projekt zuordnen, direkt aus der Department-Ansicht | **erweitern (FR-I)** — Anlegen/Zuordnen existiert, Einstieg aus T-Konto neu |
| 8 | Notiz: „Zuordnung soll übernommen werden" | T-Konto nutzt exakt dieselbe Department/Projekt-Zuordnung wie die Analytics | **wiederverwenden (FR-G5)** |
| 9 | Notiz: „Einnahmen auch mit VAT-Erklärung" | USt-Erklärung auch für Einnahmen (Umsatzsteuer), nicht nur Ausgaben (Vorsteuer) | **erweitern (FR-J)** |
| 10 | Notiz: „Planung + Budget in Budget-Tab, dort Overview" | Gesamt-Übersicht (Budget + Planung aggregiert) im Budget-Tab; T-Konto ist die Detailtiefe | **erweitern (FR-H)** |

---

## 3. Functional Requirements

### FR-G — Department-T-Konto-Ansicht (Kern)

- **FR-G1** Zu einem gewählten **Department + Zeitraum** zeigt die Ansicht ein **T-Konto**:
  **linke Spalte „Ausgaben", rechte Spalte „Einnahmen"**. Beträge rechtsbündig, `tabular-nums`.
- **FR-G2** Jede Spalte listet **Ist-Posten** aus den BB-Buchungen des Departments (über die
  vorhandene Zuordnung/Allocations), gruppiert sinnvoll (Standard: nach Kategorie/`cost_location_two`
  bzw. Konto-Label; endgültige Gruppierung siehe Open Questions).
- **FR-G3** Zusätzlich werden **Plan-Posten** (`FinancePlanItem`, `direction` bestimmt die Spalte)
  desselben Scopes angezeigt und **visuell abgesetzt** (gedämpfte/graue Zeile, Badge „Geplant").
  Ist und Plan sind eindeutig unterscheidbar (Legende + `aria-label`, nicht nur Farbe → Dark-Mode/A11y).
- **FR-G4** Die Ansicht berechnet und zeigt **zwei Salden**:
  - **Ist-Saldo** = Σ Ist-Einnahmen − Σ Ist-Ausgaben.
  - **Plan-Saldo** = Σ (Ist + geplant) Einnahmen − Σ (Ist + geplant) Ausgaben.
  Vorzeichen/Farbe kennzeichnen Überschuss vs. Defizit; Betrag als „Profit" lesbar (positiver Saldo).
- **FR-G5** Die T-Konto-Ansicht **übernimmt die bestehende Zuordnung** unverändert: Auto-Mapping
  (Kostenstelle/Belegnummer → Department), LnF-Overrides und Split-Allocations. Es entsteht **keine
  zweite Zuordnungslogik**; die T-Konto-Summen müssen mit den Analytics/Budget-Summen desselben Scopes
  übereinstimmen (Konsistenz-Invariante, testbar).
- **FR-G6** **Department-Auswahl:** LnF/Admin kann jedes Department wählen/anklicken; ein
  `finance.department`-Mitglied sieht ausschließlich das eigene (Scope serverseitig erzwungen,
  wie FR-E2/E3).
- **FR-G7** Einstiegspunkt: Die T-Konto-Ansicht ist die **Detailtiefe der „Planung"** (Klick auf ein
  Department in der Übersicht öffnet dessen T-Konto). Genaue Tab-/Routing-Platzierung siehe FR-H4.
- **FR-G8** Leerer Zustand, Ladezustand (Skeleton) und Fehlerzustand sind definiert; responsiv
  (mobil: Spalten stapeln, Ausgaben vor Einnahmen), Dark-Mode-Parität — nicht optional.

### FR-H — Budget-/Profit-Gesamtübersicht (Budget-Tab)

- **FR-H1** Der **Budget-Tab bleibt die Gesamt-Übersicht** über **alle Departments** in einer Tabelle:
  je Department mindestens **Budget, Ist-Ausgaben, Ist-Einnahmen, Netto/„Profit", Rest, % genutzt**.
- **FR-H2** Aus der Übersicht ist ein Department **drill-down**-fähig: Auswahl öffnet dessen
  T-Konto-Ansicht (FR-G). „Rauf/runterstufen" = zwischen Gesamt und Department-Detail wechseln.
- **FR-H3** Die Übersicht aggregiert **Budget und Planung** gemeinsam (geplantes Netto neben
  Ist-Netto), sodass Plan-Saldo je Department schon in der Gesamtsicht sichtbar ist.
- **FR-H4** *(Entscheidung, siehe Open Questions)* Ob T-Konto als Detail unter „Planung", unter
  „Budget" oder als eigener Tab „T-Konto" lebt, ist final zu klären; Default-Empfehlung: Klick in der
  Budget-Übersicht → Department-T-Konto (ein Navigationsfluss, keine Duplikate).

### FR-I — Projekte im T-Konto (Makeathon/Hackathon)

- **FR-I1** Innerhalb der T-Konto-Ansicht werden **Projekte** (`FinanceProject`) als **auf-/zuklappbare
  Gruppe** dargestellt (Ordner-Metapher/Icon), analog „Hackathon" im Mockup.
- **FR-I2** Die Projekt-Kopfzeile zeigt den **aggregierten Netto-Profit** des Projekts
  (Σ Einnahmen − Σ Ausgaben, Ist und Plan getrennt ausweisbar); aufgeklappt erscheinen die
  Einzelposten in der jeweiligen T-Konto-Spalte.
- **FR-I3** Aus der Department-Ansicht kann ein **Projekt angelegt** werden (Reuse
  `FinanceProjectCreateForm`); es erscheint danach als Gruppe im T-Konto.
- **FR-I4** Ist-Buchungen lassen sich einem Projekt **zuordnen** (Reuse Allocation-Target
  `project_id`) und **geplante Posten** direkt im Projekt-Kontext anlegen (Plan-Item mit `project_id`).
  → „für Makeathon ein Projekt, Ausgaben einer Gruppe hinzufügen, dort auch planen".
- **FR-I5** Posten ohne Projektzuordnung liegen direkt unter dem Department (nicht in einer Gruppe);
  Unterprojekte (`parent_project_id`) werden verschachtelt dargestellt.

### FR-J — Umsatzsteuer-Erklärung auf Einnahmen

- **FR-J1** Die USt-Aufschlüsselung wird **auf Einnahmen** ausgeweitet (bislang nur Ausgaben):
  je Steuersatz **Brutto-Einnahme, enthaltene USt, Netto**, plus Anzahl.
- **FR-J2** In der T-Konto-Ansicht ist die **enthaltene USt je Einnahme(-gruppe)/Projekt** erklärend
  sichtbar (Tooltip/Zeile), sodass ersichtlich ist, welcher Teil eines Einnahme-Betrags USt ist
  (Berechnung: `vat` ist Prozentsatz → USt = brutto·Satz/(100+Satz)).
- **FR-J3** USt-Behandlung folgt weiterhin dem `bereich` (ideell/wirtschaftlich/gemischt); die
  Erklärung benennt, ob es sich um abzuführende USt (wirtschaftlich) handelt. Detaillierte
  Vorsteuer-/Erstattungslogik bleibt außerhalb dieses Scopes (siehe Roadmap FR-A4).

---

## 4. Wiederverwendung (explizit, um Doppelarbeit zu vermeiden)

- **Zuordnung/Allocations:** `FinancePostingAllocation*` + `finance_department_mappings` — T-Konto
  liest, definiert nicht neu.
- **Plan-Posten:** `FinancePlanItem` mit `direction` steuert Spalte (Ausgabe/Einnahme) und `status`
  die Grau-Darstellung (planned/committed vs. spent).
- **Projekte:** `FinanceProject*` inkl. `parent_project_id`, `target_amount`.
- **Salden/Aggregation:** dieselben Server-Aggregate wie Budget/Analytics (Konsistenz-Invariante FR-G5).
- **USt:** `FinanceVatRateSummary`-Muster, für Einnahmen gespiegelt.

## 5. Nicht-funktional (geerbt)

- Feature-scoped: dünne `*Page` → `hooks/use*` → präsentationale `*Section` (< 400 Zeilen, hart 700).
- Shared Zod-Schemas sind der einzige Contract; `pnpm build:shared` nach jeder `shared/`-Änderung.
- Coverage-Schwellen nur nach oben; jede neue Funktion mit Vitest-Tests **und** Storybook play/a11y,
  plus Playwright-E2E für den Primärfluss.
- Scope serverseitig erzwungen (`finance.review` = alle, `finance.department` = eigenes; sonst 403).
- Responsive + Dark-Mode sind Produktanforderung, keine Politur.
- Keine Klartext-Sensitivfelder loggen/zurückgeben/seeden.

## 6. Offene Entscheidungen (mit LnF/Owner klären)

1. **Platzierung:** T-Konto als Detail unter „Planung", unter „Budget" oder eigener Tab? (FR-H4)
2. **Gruppierung der Ist-Posten** im T-Konto: nach Kategorie (`cost_location_two`), nach Konto (SKR)
   oder nach Projekt zuerst? Default-Vorschlag: Projekt → sonst Kategorie.
3. **Plan-Saldo-Definition:** Zählt `committed` schon wie Ist, oder nur `spent`? Welche Status
   fließen in welchen Saldo? (Vorschlag: Ist = `spent`/gebuchte BB-Posten; Plan = alle offenen Posten.)
4. **Profit vs. Budget-Rest:** Zeigt die Kopfzahl den **Netto-Profit** (Einnahmen − Ausgaben) oder
   **Budget-Rest**? Im Mockup ist „Profit" gemeint — bestätigen.
5. **Brutto/Netto-Anzeige:** T-Konto-Beträge brutto (wie BB gebucht) mit USt-Ausweis, oder umschaltbar
   netto? (Vorschlag: brutto mit USt-Erklärung; Netto-Toggle optional später.)
6. **Einnahmen-Buchungen:** Erfasst BB für alle Departments überhaupt Einnahmen, oder laufen sie
   zentral (z. B. Sponsoring über PnS)? Falls zentral, wie werden sie einem Department/Projekt
   zugeordnet? (Betrifft, ob die rechte Spalte je Department gefüllt ist.)
7. **„Profit 40k bei Media"** — Referenzzahl aus echten BB-Daten verifizieren (Mapping der ~27 realen
   Kostenstellen ist laut Projektstand teils noch offen).

---

> **Umsetzungsstand (2026-08-04):** T0–T4 sowie der E2E-Spec (T5) sind implementiert auf Branch
> `fix/finance-remove-department-fallback-lnf`. Neu: shared `FinanceTAccount*`-Contracts,
> `server/src/lib/financeTAccount.ts` + `GET /finance/t-account` (+ `incomeVatTotal`), Client-Hook
> `useFinanceTAccount` + `FinanceTAccountSection`/`FinanceTAccountGroup`, T-Konto-Tab, Budget-Drilldown.
> FR-H1 (Profit-/Einnahmen-**Spalte** in der Budget-Gesamttabelle) bleibt offen, weil die
> `budget-vs-actual`-Response bewusst nur Ausgaben führt — der Drilldown (FR-H2) ist umgesetzt.
>
> **Nachtrag (2026-08-05) — Mockup-Angleichung:** Die T-Konto-Darstellung wurde an das LnF-Mockup
> herangeführt. Neu: (1) **Zielsaldo + Abweichung zum Ziel** je Projekt (`target_amount` jetzt Teil des
> `FinanceTAccountGroup`-Contracts, serverseitig aus `FinanceProject.target_amount` befüllt); (2)
> **Ist-/Plan-Spaltensummen** je Spalte (Ist = gebucht, Plan = nur geplant); (3) **Unterprojekt-
> Verschachtelung + Roll-up** (FR-I5): `client/.../financeTAccountUtils.ts#buildTAccountTree` baut den
> Baum, rollt den Netto-Saldo jedes Kindprojekts als Ordnerzeile ins Elternprojekt und listet Kinder
> aufklappbar darunter. Der Roll-up ist **rein visuell** — die Department-Gesamtsumme kommt weiter aus
> `totals` des Servers, sodass die FR-G5-Invariante (kein Doppelzählen) erhalten bleibt. Projekt-Fußzeile
> zeigt `Saldo Ist` + `Forecast` (bzw. `Abweichung zum Ziel` bei gesetztem Ziel); Legende „Grau = geplant".

## 7. Implementierungsplan (phasenweise)

Jede Phase ist eigenständig lauffähig, endet mit `pnpm gate` grün + Playwright-E2E für den
Primärfluss. Der Plan baut auf vorhandenen Server-Aggregaten auf — **kein zweiter Zuordnungspfad**
(FR-G5). Referenzierte Bausteine existieren bereits:

- Server-Aggregation: `server/src/lib/financeDepartments.ts`
  (`buildEffectiveDepartmentTransactions`, `buildEffectivePostingSplits`, `aggregateByDepartment`),
  `financePlans.ts` (`computePlanTotals`), `financeVat.ts`
  (`embeddedVat`, `expenseVatTotal`, `aggregateByVatRate`), `financeProjects.ts`, `financeScope.ts`.
- Routen: `server/src/routes/finance.ts`, `server/src/routes/financeManagement.ts` (in `app.ts`
  registriert). Scope-Guard: `financeScope.ts`.
- Client: `FinanceAnalyticsPage.tsx` (Tabs), `hooks/useFinanceAnalyticsPage.ts`, `useFinanceManagement.ts`.
- Migrationen: bestehende `finance_*`; neue nur als **neue timestamped Datei** (nie mergte editieren).

### Phase T0 — Contract: T-Konto-Aggregat (shared)  ▸ FR-G4, FR-I2

- **shared/** `finance.ts` erweitern:
  - `FinanceTAccountQuerySchema` = `FinancePlanQuery` (period_type/key, optional `department`) +
    optional `project_id`.
  - `FinanceTAccountLineSchema`: `{ kind: "actual" | "plan", direction: "expense" | "income",
    label, category|null, project_id|null, amount, vat_amount|null, status?, posting_external_id?|plan_item_id? }`.
  - `FinanceTAccountProjectGroupSchema`: `{ project, expense_lines[], income_lines[],
    actual_net, plan_net }` (Netto-Profit je Projekt, Ist/Plan getrennt — FR-I2).
  - `FinanceTAccountResponseSchema`: `{ period_*, department, ungrouped: { expense_lines[],
    income_lines[] }, projects: FinanceTAccountProjectGroup[], totals: { actual_income,
    actual_expenses, actual_saldo, plan_income, plan_expenses, plan_saldo, vat_income, vat_expenses },
    source, generated_at }`.
- `pnpm build:shared`. Beide Konsumenten in derselben Änderung.
- **tests** Schema-Roundtrip in `shared/test/`.

### Phase T1 — Server: T-Konto-Aggregation + Einnahmen-USt  ▸ FR-G2/3/4/5, FR-I2, FR-J1

- **server/** neue `financeTAccount.ts`:
  - Ist-Zeilen aus `buildEffectiveDepartmentTransactions` (nutzt vorhandene Zuordnung + Allocations →
    FR-G5), Split in Ausgaben/Einnahmen über die vorhandene Income/Expense-Klassifikation (Konto/Sign).
  - Plan-Zeilen aus den Plan-Items des Scopes (`direction` → Spalte, `status` → für Grau/Plan-Saldo).
  - Gruppierung nach `project_id` (Projekte via `financeProjects.ts`), Rest in `ungrouped`.
  - Salden je FR-G4; USt je Zeile via `embeddedVat`.
  - **Invariante:** `actual_saldo` == Netto desselben Scopes aus `aggregateByDepartment`
    (Regressionstest, FR-G5).
- **financeVat.ts**: `incomeVatTotal` + `aggregateByVatRate` für Einnahmen spiegeln (FR-J1).
- **routes/financeManagement.ts**: `GET /finance/t-account` (Scope-Guard `financeScope.ts`:
  `finance.review` → beliebiges Department; `finance.department` → eigenes erzwungen, sonst 403 — FR-G6).
- **tests** `node --test`: Aufteilung Ausgaben/Einnahmen, Ist-/Plan-Saldo, Projekt-Netto,
  Scope-403, Konsistenz-Invariante, USt-Einnahmen.

### Phase T2 — Client: T-Konto-Ansicht  ▸ FR-G1/3/4/7/8, FR-J2

- **client/** `hooks/useFinanceTAccount.ts` (Query auf `/finance/t-account`, Query-Key + Invalidation).
- **components/** `FinanceTAccountSection.tsx` (präsentational, < 400 Zeilen — sonst in
  `FinanceTAccountColumn`/`FinanceTAccountRow`/`FinanceTAccountTotals` splitten):
  - Zwei-Spalten-Layout Ausgaben/Einnahmen; mobil gestapelt (FR-G8).
  - Plan-Zeilen gedämpft + Badge „Geplant"; Legende; nicht nur farbcodiert (A11y/Dark-Mode, FR-G3).
  - Fußzeile: Ist-Saldo + Plan-Saldo, Vorzeichen/Farbe (FR-G4).
  - USt-Erklärung je Einnahme-Zeile/Gruppe als Tooltip/Subzeile (FR-J2).
  - Skeleton/Empty/Error-Zustände.
- **Einstieg (FR-G7/H4):** vorerst als Detail im „Planung"-Tab bei gewähltem Department; endgültige
  Platzierung nach Open-Question 1. `useFinanceAnalyticsPage.ts` um Department-Auswahl/aktives Department erweitern.
- **tests** Vitest für Hook (Salden-Ableitung, Formatierung) + Storybook play/a11y für die Section
  (Ist+Plan, leeres Department, Dark-Mode).

### Phase T3 — Projekte im T-Konto  ▸ FR-I1/3/4/5

- **client/** in `FinanceTAccountSection` Projekte als auf-/zuklappbare Gruppe (Ordner-Icon,
  Kopfzeile mit Netto-Profit, verschachtelte Unterprojekte via `parent_project_id`).
- Aktionen aus der Ansicht heraus (Reuse bestehender Formulare/Mutations aus `useFinanceManagement.ts`):
  Projekt anlegen (`FinanceProjectCreateForm`), Ist-Buchung → `project_id` allozieren
  (`FinanceAllocationEditor`), Plan-Item mit `project_id` anlegen (`FinancePlanSection`-Muster).
- **tests** Auf-/Zuklappen, Projekt-Netto, Anlege-/Zuordnungsfluss (play-Story + E2E).

### Phase T4 — Budget-Gesamtübersicht + Drill-down  ▸ FR-H1/2/3

- **client/** `FinanceBudgetSection` um Einnahmen-/Netto-Spalte („Profit") und geplantes Netto
  ergänzen (Daten aus `FinanceBudgetVsActual` + Plan-Totals; ggf. Response um `actual_income`/
  `planned_net` je Department erweitern → dann shared + server in derselben Änderung).
- Zeilen-Klick → Department-T-Konto (FR-H2, ein Navigationsfluss).
- **tests** Übersicht rendert Profit/Plan-Netto; Drill-down navigiert; E2E über Gesamtsicht → T-Konto.

### Phase T5 — E2E, Doku, Rollout

- `e2e/finance-*.spec.ts` erweitern: LnF öffnet Department-T-Konto, sieht Ist/Plan-Saldo, klappt
  Projekt auf, sieht USt-Erklärung; `finance.department`-Mitglied sieht nur eigenes (403 fremd).
- `docs/finance-analytics-roadmap.md` Status-Absatz um die T-Konto-Ansicht ergänzen.
- Seed/Fixtures: mind. ein Department mit Ist-Einnahmen + Projekt für sichtbare Demo-Daten.

## 8. Contract-/Datenmodell-Deltas (Zusammenfassung)

| Ebene | Neu / Änderung | Bestehendes wiederverwendet |
| --- | --- | --- |
| shared | `FinanceTAccount{Query,Line,ProjectGroup,Response}` (Phase T0); ggf. `actual_income`/`planned_net` in Budget-Response (T4) | `FinancePlanQuery`, `FinanceProject`, `FinancePlanItem`, `FinanceVatRateSummary` |
| server | `financeTAccount.ts`, `incomeVatTotal`; Route `GET /finance/t-account` | `buildEffectiveDepartmentTransactions`, `aggregateByDepartment`, `computePlanTotals`, `financeScope`, `financeProjects` |
| DB | **keine neue Tabelle nötig** (reine Aggregation über vorhandene) | `finance_department_mappings`, Allocations, `finance_plan_items`, Projekte |
| client | `useFinanceTAccount`, `FinanceTAccountSection` (+ Split-Komponenten) | `FinanceBudgetSection`, `FinanceProjectCreateForm`, `FinanceAllocationEditor`, `FinancePlanSection` |

**Wichtig:** Keine neue DB-Zuordnungslogik — das T-Konto ist eine Sicht auf bereits zugeordnete Daten
(FR-G5). Neue Tabellen nur, falls Open-Question 6 (zentrale Einnahmen) eine explizite
Einnahmen-→-Department/Projekt-Zuordnung erzwingt; dann als neue timestamped Migration mit RLS.
</content>
</invoke>
