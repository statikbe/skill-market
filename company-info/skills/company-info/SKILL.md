---
name: company-info
description: >
  Fetch Belgian company information: KBO registration data (directors, NACE codes,
  capacities), annual accounts (jaarrekeningen) from the National Bank of Belgium
  (NBB/BNB), and official publications from the Belgisch Staatsblad. Use when
  looking up a company, analyzing a Belgian business, checking who the directors are,
  what activities are registered, downloading annual accounts as PDF or CSV data,
  or finding Staatsblad publications. Triggers on: "analyse van bedrijf",
  "company analysis", "wie is de zaakvoerder", "jaarrekening", "annual accounts",
  "balans van", "neerlegging NBB", "financiële gegevens", "download jaarrekening",
  "look up KBO number", "company financials", "NBB consult", "staatsblad",
  "publicaties", "fusie", "oprichting", "benoeming", "statutenwijziging",
  "what does this company do", "who runs this company", "KBO data".
---

# Belgian Company Info

Three data sources for Belgian companies, all without API keys:

1. **KBO Public Search** — registration data: directors, NACE activities, capacities, legal form
2. **NBB Consult** — annual accounts (jaarrekeningen) as CSV or PDF
3. **Belgisch Staatsblad** — official publications (oprichting, benoemingen, fusies, etc.)

## Prerequisites

- `node` runtime (with `npx` available)
- `python3` with `playwright` package installed (`pip3 install playwright`)
- Chromium browser (Playwright's bundled Chromium or system install)

## Workflow: Company Analysis

When asked to analyze a company, gather data from all three sources:

1. **Find the company** — `search` by name if no KBO number is known
2. **KBO data** — `kbo` for directors, activities, capacities, legal status
3. **NBB company info** — `company` for address and legal form confirmation
4. **Financial data** — `filings` to list years, then `csv` for the latest 2 years
5. **Publications** — `publications` for corporate history (name changes, mergers, etc.)

**Always start with `search` when the user gives a company name instead of a KBO number.**

## Commands

```bash
# Search companies by name (no KBO number needed)
npx tsx ${CLAUDE_PLUGIN_ROOT}/skills/company-info/scripts/nbb-accounts.ts search <name> [--postal code]

# KBO registration data (directors, NACE codes, capacities, fiscal year)
npx tsx ${CLAUDE_PLUGIN_ROOT}/skills/company-info/scripts/nbb-accounts.ts kbo <enterprise-number>

# Company info from NBB (name, address, legal form)
npx tsx ${CLAUDE_PLUGIN_ROOT}/skills/company-info/scripts/nbb-accounts.ts company <enterprise-number>

# List filed annual accounts
npx tsx ${CLAUDE_PLUGIN_ROOT}/skills/company-info/scripts/nbb-accounts.ts filings <enterprise-number> [--limit N]

# Download accounting data as CSV (structured, with rubric codes)
npx tsx ${CLAUDE_PLUGIN_ROOT}/skills/company-info/scripts/nbb-accounts.ts csv <enterprise-number> [--year YYYY]

# Download full annual accounts as PDF
npx tsx ${CLAUDE_PLUGIN_ROOT}/skills/company-info/scripts/nbb-accounts.ts pdf <enterprise-number> [--year YYYY] [--output path]

# List Belgisch Staatsblad publications (Bijlage Rechtspersonen)
npx tsx ${CLAUDE_PLUGIN_ROOT}/skills/company-info/scripts/nbb-accounts.ts publications <enterprise-number> [--type TYPE]
```

Enterprise number formats accepted: `0454064819`, `0454.064.819`, `BE0454064819`.

## KBO Data

The `kbo` command returns JSON with:

| Field | Description |
|-------|-------------|
| `name` | Official company name |
| `status` | Actief / Niet-actief |
| `legalForm` | Legal form (BV, NV, VZW, etc.) |
| `startDate` | Registration date |
| `address` | Registered office |
| `functions` | Directors/managers with role, name, and since date |
| `capacities` | RSZ employer, BTW-plichtig, etc. with since dates |
| `activities` | NACE codes (BTW + RSZ) with descriptions |
| `annualMeeting` | Month of annual general meeting |
| `fiscalYearEnd` | End date of fiscal year |
| `establishments` | Number of establishment units |

Note: some directors may appear as KBO numbers (management companies) rather than names.

## Publication types (--type filter)

| Code | Description |
|------|-------------|
| `c01` | Oprichting (nieuwe rechtspersoon, opening bijkantoor) |
| `c02` | Einde (stopzetting, nietigheid, gerechtelijke reorganisatie) |
| `c03` | Benaming |
| `c04` | Maatschappelijke zetel |
| `c05` | Andere adressen |
| `c06` | Doel |
| `c07` | Kapitaal / aandelen |
| `c08` | Ontslagen / benoemingen |
| `c09` | Algemene vergadering |
| `c10` | Boekjaar |
| `c11` | Statuten (vertaling, coördinatie, wijzigingen) |
| `c12` | Wijziging rechtsvorm |
| `c13` | Herstructurering (fusie, splitsing, overdracht vermogen) |
| `c14` | Jaarrekeningen |
| `c15` | Diversen |
| `c16` | Ambtshalve doorhaling KBO nr. |

Publications with a PDF link (✓) can be downloaded directly from the URL shown.

## Interpreting CSV Output

The CSV has two sections:

1. **Header rows** (quoted key-value pairs): reference, entity info, period, model
2. **Data rows** (rubric code + value): e.g. `"620","1968000.01"`

### Important notes on CSV data

- Rubric codes follow the Belgian MAR schema — see [references/rubric-codes.md](references/rubric-codes.md)
- **Personnel codes** (`1001`–`1213`) use different units depending on the model:
  - FTE count (`1001`): can be decimal (e.g., `14.8` = 14.8 FTE)
  - Head count (`1011`–`1013`): actual number of employees
  - Hours (`1002`): total hours in thousands
  - Costs (`1003`): total cost in the period's currency
- **Financial values** are in EUR unless the header says otherwise
- Not all rubric codes appear in every filing — the model type (volledig/verkort)
  determines which codes are present

### Key codes for quick analysis

| Code | What it tells you |
|------|-------------------|
| `70` | Revenue (omzet) — not always present in verkort model |
| `9900` | Total operating income (bedrijfsopbrengsten) |
| `9901` | Operating profit/loss (bedrijfsresultaat) |
| `9903` | Net profit/loss (winst/verlies boekjaar) |
| `20/58` | Total assets (balanstotaal) |
| `10/15` | Equity (eigen vermogen) |
| `1001` | Average FTE |
| `620` | Wages & social security (bezoldigingen) |

For the full rubric code reference, load [references/rubric-codes.md](references/rubric-codes.md).

## Troubleshooting

- **Timeout**: the NBB Consult site can be slow — the script allows 60s
- **No filings found**: verify the enterprise number via `company` first
- **403 on deposits**: the `filings`/`csv`/`pdf` commands use Playwright because
  the NBB protects these endpoints behind a WAF that requires a browser session.
  The `search`, `company`, `kbo`, and `publications` commands work via direct HTTP.
- **Playwright not found**: run `pip3 install playwright`
- **Multiple search results**: narrow down with `--postal` or verify with `company`

## Constraints

- Only works for Belgian companies registered in KBO / filing with NBB
- Historical filings go back to ~1999 (PDF) or ~2020 (CSV/XBRL for newer formats)
- Staatsblad publications go back to 1/1/1983 for companies, 1/7/2003 for associations
- The `csv` command returns raw rubric codes — interpret using the reference table
- Verkort (abbreviated) model filings have fewer rubric codes than volledig (full) model
- Revenue (`70`) is often not disclosed in verkort model — use `9900` (total operating
  income) instead
