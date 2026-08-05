# Finance — Kostenstellen (cost location) mapping

Reference for decoding the BuchhaltungsButler (BB) cost-location codes into TUM.ai
departments, sub-teams and categories. Derived from the LnF cost-center scheme
(owner image, 2026-08) **and verified against 2,535 live BB postings** pulled from
`POST /postings/get` (date range 2022-01-01 … today).

## API fields

BB returns two cost-center fields per posting:

| Image column                         | API field                       | Meaning                                   |
| ------------------------------------ | ------------------------------- | ----------------------------------------- |
| City · Main-department · Sub-Team    | `cost_location` (Kostenstelle 1)| department identity — see decode below    |
| Type of income & expenditure         | `cost_location_two` (Kostenst. 2)| category `0`–`9`                          |
| "Konto wo man drauf buchen darf"     | debit/credit account number     | Bereich via account suffix (`…10/40/50`)  |

**Bereich is *not* encoded in the cost location.** The tax realm
(`ideell` / `wirtschaftlich` / `gemischt`) comes from the ledger account suffix
(`400010`/`630010` → ideell, `…40` → wirtschaftlich, `…50` → gemischt), which the
image's bottom "Konto" block confirms and `inferAccountTaxArea` already implements.
A single cost location (e.g. Community) carries postings across several Bereiche, so
department mappings must leave `bereich = null` and let the account decide.

## `cost_location` layout: `[City][Main-department][Sub-Team]`

3-digit code, one digit per image column. München is city `0`, so
`normalizeCostLocation` strips its leading zero and München codes appear 2-digit
(`082` == `82`). Sub-team `0` = "for the team" (department-general).

### City (leading digit)

| digit | City     |
| ----- | -------- |
| 0     | München  |
| 1     | Berlin   |

### Main-department (middle digit)

| digit | Department  |
| ----- | ----------- |
| 0     | Board       |
| 1     | Community   |
| 2     | PnS         |
| 3     | DEV         |
| 4     | Marketing   |
| 5     | Venture     |
| 6     | Makeathon   |
| 7     | Taskforces  |
| 8     | LnF         |

### Observed codes (München, city 0) — confirmed against live postings

| `cost_location` | normalized | Department | Sub-team           | n   | evidence in data                         |
| --------------- | ---------- | ---------- | ------------------ | --- | ---------------------------------------- |
| `000`/`00`/`""` | `0`        | Board      | (team / unassigned)| 22  | opening balances, misc — see open items  |
| `011`           | `11`       | Community  | Onboarding         | 69  |                                          |
| `012`           | `12`       | Community  | Events             | 90  |                                          |
| `013`           | `13`       | Community  | Impact Projects    | 20  |                                          |
| `020`           | `20`       | PnS        | (team)             | 78  | NetApp, APPSfactory (sponsors)           |
| `030`           | `30`       | DEV        | (team)             | 132 |                                          |
| `040`           | `40`       | Marketing  | (team)             | 8   |                                          |
| `050`           | `50`       | Venture    | (team)             | 10  |                                          |
| `051`           | `51`       | Venture    | Med.ai             | 136 |                                          |
| `052`           | `52`       | Venture    | ACC                | 11  |                                          |
| `053`           | `53`       | Venture    | Quant Finance      | 1   |                                          |
| `060`           | `60`       | Makeathon  | (team)             | 1   |                                          |
| `061`           | `61`       | Makeathon  | Big Makeathon      | 98  | QuantCo, Reply (sponsors)                |
| `062`           | `62`       | Makeathon  | Small Makeathon    | 78  | Entrepreneur First, BMW                  |
| `070`           | `70`       | Taskforces | (team)             | 1   |                                          |
| `071`–`076`     | `71`–`76`  | Taskforces | sub 1–6 (see below)| 14  | member names only — labels unconfirmed   |
| `080`           | `80`       | LnF        | (team)             | 18  | UK Online Giving, PayPal, GLS            |
| `081`           | `81`       | LnF        | Legal counceling   | 57  | Notare, Campbell Hoermann                |
| `082`           | `82`       | LnF        | Memberfees         | 928 | member names, accts 180000/400010        |
| `083`           | `83`       | LnF        | Tax                | 44  | Finanzamt München                        |
| `084`           | `84`       | LnF        | Insurance          | 8   | ROLAND Rechtsschutz-Versicherung         |
| `085`           | `85`       | LnF        | Banking fees       | 45  | GLS Gemeinschaftsbank, ABSCHLUSS         |
| `086`           | `86`       | LnF        | Fines              | 5   | Finanzamt, TU München                    |

### Observed codes (Berlin, city 1)

| `cost_location` | Department | Sub-team   | n |
| --------------- | ---------- | ---------- | - |
| `111`           | Community  | Onboarding | 4 |

### Sub-team catalog (from image)

Departments not listed have only the team code (`0`).

| Department  | sub-team digits                                                                     |
| ----------- | ----------------------------------------------------------------------------------- |
| Community 1 | 1 Onboarding · 2 Events · 3 Impact Projects                                          |
| DEV 3       | 1 AI E-Lab · 2 Events · 3 AI Talentschmiede                                          |
| Venture 5   | 1 Med.ai · 2 ACC · 3 Quant Finance · 4 Robotics · (5 Global Affairs · 6 women@tumai?)|
| Makeathon 6 | 1 Big Makeathon · 2 Small Makeathon                                                  |
| Taskforces 7| 1–6 unconfirmed (may include Global Affairs / women@tumai — see open items)          |
| LnF 8       | 1 Legal counceling · 2 Memberfees · 3 Tax · 4 Insurance · 5 Banking fees · 6 Fines   |

## `cost_location_two` → category

The API returns exactly `""` + `"0"`…`"9"`, matching the image's Type column.

| `cost_location_two` | Category               | n    |
| ------------------- | ---------------------- | ---- |
| `""`                | (unset) → Ohne Kategorie | 669 |
| `0`                 | Donations & Sponsorings| 152  |
| `1`                 | Catering & Food        | 263  |
| `2`                 | Transport & Lodging    | 32   |
| `3`                 | Rent                   | 15   |
| `4`                 | Consumables            | 86   |
| `5`                 | Software               | 144  |
| `6`                 | Hardware               | 12   |
| `7`                 | Pricemoney & Presents  | 63   |
| `8`                 | Services, Gebühren     | 1083 |
| `9`                 | Others                 | 16   |

## Legacy 4-digit scheme (pre-2024)

~700 postings from 2022–2023 use 4-digit codes that do **not** fit `[City][Main][Sub]`
and use old SKR03 expense accounts (`68xxxx`). Assign these manually by inspection;
best-effort department guess is the second digit (`0X00` → department `X`), but it is
unverified:

`0100`, `0200`–`0205`, `0300`, `0400`, `0500`, `0501`, `0600`, `0701`, `0800`,
`0900` (no department 9 exists — needs review), `1104`.

## Open items

- **Taskforces vs Venture 5/6** — the image floats "5 Global Affairs / 6 women@tumai"
  next to the Venture box, but the live data shows Taskforces `071`–`076` populated
  while Venture `054`–`056` are empty. Confirm whether Global Affairs / women@tumai are
  Venture sub-teams 5/6 or Taskforces sub-teams.
- **Empty / `0` / `00` / `000`** all normalize to `0`. Decide whether these mean
  "Board, general" or "unassigned" — they include opening balances and stray postings.
- **Legacy 4-digit codes** need a manual pass (above).

## Seeding guidance

- `cost_location_two` → `finance_category_mappings` (keyed on `cost_location_two`):
  the 0–9 table above is ready to insert as-is.
- `cost_location` → `finance_department_mappings` (keyed on normalized `cost_location`):
  set `department` to the main-department name, put the sub-team in the dedicated
  **`sub_team`** column, and leave `bereich = null` (account suffix decides the Bereich).

## Sub-team → T-Konto grouping (2026-08-05)

The 2nd meaningful Kostenstelle digit (sub-team, e.g. `61` = Big / `62` = Small Makeathon)
is now a first-class, assignable field:

- Migration `20260805120000_finance_mapping_sub_team.sql` adds `finance_department_mappings.sub_team`.
- The **Zuordnung** editor has a per-row *Sub-Team* input next to Department
  (`FinanceDepartmentMappingUpsertSchema.sub_team`).
- The **T-Konto** groups a department's **un-allocated** postings by their cost location's
  `sub_team` (each becomes a folder labelled with the sub-team name); an explicit project
  allocation still wins. Postings whose cost location has no `sub_team` fall into
  "Direkt zugeordnet". Grouping is display-only — the department net is unchanged (FR-G5).
