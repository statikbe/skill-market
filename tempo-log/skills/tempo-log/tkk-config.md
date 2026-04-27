---
name: tkk-config
description: TKK (The Kind Kids / Statik) org-wide rules for tempo-log skill — applies to every TKK dev regardless of circle
layer: org
---

# TKK / Statik organisation config

Org-wide defaults for the `tempo-log` skill. Apply to every TKK dev.
Lower priority than your team config (`<circle>-config.md`) and `preferences.md` (see SKILL.md → Configuration layering).

## Atlassian / Tempo

- **Site**: `statik.atlassian.net`
- **cloudId**: `3b96b5e8-c5c1-447a-9683-e0775f042900`
- **JIRA_BASE_URL** default: `https://statik.atlassian.net`
- **Timezone**: `Europe/Brussels` (calendar reads, date math)
- **Time granularity**: 15 minutes (0.25h) — *overridable in `preferences.md`*

## Mandatory worklog fields

Every worklog needs:

| Field | Rule |
|---|---|
| **Issue** | Always. Project issue for client work, circle issue for internal. |
| **Date** | The date the work was done. |
| **Duration** | Effective time, 15-min increments. |
| **Description** | Not technically required, but should always be written. Be concrete: `"WP→CRM payment hook: reproduce + fix validation"` rather than `"Activity: Jira"`. |
| **Account** | Always required in the POST — Tempo's API does **not** auto-apply the issue's configured Account (POST without `_Account_` returns HTTP 400 "Work attribute Account (_Account_) is required"). Never guess. Discover via the `tempo last-account <prefix>` / `tempo accounts <prefix>` recipe. If no prior worklog exists for the project, ask the user. If the account was closed/archived, ask for a replacement. |
| **Work Type** | Required — determines billing rate. Set per user in `preferences.md`. Other valid values exist in Statik's Tempo config but aren't enumerated in `/work-attributes` (empty `staticListValues`); infer from existing worklogs as needed. |

`_InvoicePeriod_` is set by facturatieverantwoordelijken during invoicing — the skill never sets it.

## Where to log what

- **Client project work** → the specific project issue.
- **Internal work** → your circle's Jira project (e.g. Rhino = INTUNI, Maanlanders = INTMAA).
- **Leave / sickness** → INT-1 / INT-2.

## Account category taxonomy

When `tempo accounts <prefix>` returns multiple candidates, use the category to disambiguate:

- `In Regie` — hourly billing
- `Volgens Offerte` — fixed-price offer (e.g. `PUBMUSOPI` = "OPT Website Q1 26")
- `Internal Time` — circle work (`INTUNIACC`, `INTKNSACC`, etc.)
- `Supportcontract` — ongoing support
- `Garantie` (`*GAR`) — warranty only; avoid for regular work
- `Voortraject` (`*VTJ`) — pre-project phase
- `(niet meer gebruiken)` — deprecated; avoid

## Circles → account keys

Reference table — useful even outside your own circle:

| Circle | Project | Account key |
|---|---|---|
| Rhino | INTUNI | INTUNIACC |
| Gilden / Knowledge Sharing | INTKNS | INTKNSACC |
| Projects | INTPRJ | INTPRJACC |
| Panda-Koala | INTROK | INTROKACC |
| Maanlanders | INTMAA | INTMAAACC |
| Fairy | INTFAI | INTFAIACC |
| Sales & account management | INTSAL | INTSALACC |
| Support | INTSPT | INTSPTACC |
| Operations | INTOPE | INTOPEACC |
| Care & culture | INTCNC | INTCNCACC |
| Mission & strategy | INTMNS | INTMNSACC |
| Communication | INTCOM | INTCOMACC |
| Investeringen | INTINV | INTINVACC |
| General | INTGEN | INTGENACC |

Client project Account keys vary per client. When in doubt, inspect a recent worklog on the same project to copy the key — see SKILL.md → "Discovering the right `_Account_` for an issue".

## Guild issues (INTKNS)

Cross-circle — any Statik dev can attend:

| Issue | Guild |
|---|---|
| INTKNS-1 | UX Gilde |
| INTKNS-2 | FE Gilde |
| INTKNS-3 | Laravel Gilde |
| INTKNS-4 | Craft Gilde |
| INTKNS-5 | AI Gilde |
| INTKNS-6 | GDPR Gilde |
| INTKNS-8 | S3 |
| INTKNS-9 | Accessibility (A11Y) |
| INTKNS-10 | Knowledge circle |
| INTKNS-11 | Learning (conferences, meetups, self-study) |
| INTKNS-12 | Coaching |

Which guilds your circle typically attends → see your team config (`<circle>-config.md`). Personal opt-in/out → `preferences.md`.

## Statik-wide calendar mappings

| Title pattern | Issue |
|---|---|
| `Demo Donderdag`, `Round-up`, `Statik Meetings`, `Statik I Level27` | INT-3 |
| `Verlof`, `vakantie`, `OOO` (multi-day OK) | INT-1 |
| `Ziekte` | INT-2 |
| `Luisterend oor`, `Gesprek met collega` | INT-14 |

## Calendar markers to skip (org-wide)

These appear on Statik calendars but are not loggable work:

- `Office`, `Bureau` — workplace markers
- `Home`, `Thuis` — remote markers
- `Keukenteam` — kitchen-duty roster

Personal additions (`Yoga`, `Social Club`, etc.) → `preferences.md`.

## Description norm

Be concrete. Bad: `"time-tracking"`, `"Activity: Jira"`. Good: a short specific summary of the work. Mix Dutch/English depending on context (technical work tends to be English; Dutch meetings stay Dutch). Don't include the issue key in the description text — the worklog already has it.

## Confluence references (org-wide)

Re-fetch with `mcp__atlassian__getConfluencePage` (cloudId `3b96b5e8-c5c1-447a-9683-e0775f042900`, `contentFormat: "markdown"`):

- Algemene tijdsregistratie → `pageId: 540868613` (space INTHAN)
- Uurtarieven → `pageId: 2044461057` (space INTHAN)

Circle-specific Confluence pages → see your team config (`<circle>-config.md`).