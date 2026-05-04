---
name: rhino-config
description: Team/circle config for tempo-log skill — Rhino circle
layer: team
team: Rhino
circle_jira_project: INTUNI
circle_account_key: INTUNIACC
---

# Team config: Rhino

Rhino-circle defaults for the `tempo-log` skill. Lower priority than `preferences.md`,
higher than `tkk-config.md`.

> Loaded by SKILL.md when `preferences.md` has `team_config: rhino-config.md`.

## Circle identity

- **Circle**: Rhino
- **Circle Jira project**: INTUNI
- **Circle account key**: INTUNIACC

## Confluence reference (Rhino-specific)

- Logging uren intern en opvolging (Rhino) → `pageId: 1662255105` (space RHIN)

## Logging style

Rhino convention: batch / catch-up logging is fine. Logs typically lag 0–14 days behind the work. Descriptive comments expected (no placeholders).

## Repo parent dirs *(personal-override-allowed)*

Rhino default — JetBrains layout used by most Rhino devs. Skill workflow exports this for `tempo-git-scan`:

```
GIT_SCAN_PARENTS="$HOME/PhpStormProjects $HOME/WebStormProjects $HOME/PyCharmProjects"
```

Override in `preferences.md` if your repos live elsewhere.

## Repo → Jira project (Rhino client portfolio)

| Repo dir (basename) | Jira project | Notes |
|---|---|---|
| `okradm-laravel`, `okradm` | OKRADM | Dominant project |
| `pubmus`, `pubmus-backup`, `pubmusvoyagertest` | PUBMUS | Museumpassmusees |
| `voight`, `laravel-filament-voight`, `voight-osv-scanner-lambda` | VOIGHT | Dependency audit |
| `knxcou` | KNXCOU | KNX country profiles |
| `knxbus` | KNXBUS | KNX infra / ETL |
| `kulski` | KULSKI | AI assistant platform |
| `vlwpla` | VLWPLA | |
| `mktpla` | MKTPLA | Madyna |
| `diginc` | DIGINC | |
| `ovbtel` | OVBTEL | |
| `laravel-surveyhero` | External / case-by-case | |
| `all-ride-mcp` | ALL-RIDE (confirm) | |

If a repo isn't listed, treat the 6-letter prefix as an initial guess for the Jira project key, and **ask the user to confirm** before using it.

## INTLAR — Rhino Laravel packages

Internal Laravel packages tracked in INTLAR:

| Repo dir | Issue |
|---|---|
| `laravel-filament-flexible-content-blocks` | INTLAR-199 / INTLAR-175 |
| `laravel-filament-flexible-content-block-pages` | INTLAR-199 / INTLAR-223 |
| `laravel-filament-flexible-blocks-asset-manager` | INTLAR-210 |
| `laravel-filament-solaris` | INTLAR (confirm ticket) — AI actions for Filament |
| `laravel-puppeteer-pdf-converter`, `pdf-lambda` | INTLAR — internal tooling |
| `laravel-security-txt` | INTLAR — internal package |

**Cross-project override:** Work on INTLAR issues bills to **INTUNIACC** (Rhino's circle account), not Gilden/Projects — innovation time accrues to the circle that funds it.

**Innovation rule:** When `Innovatietijd Rhino` appears in calendar, default the issue to an INTLAR-<N> from that day's git commits. If the commits during the block look like **client work** (a project key from the Rhino client portfolio rather than INTLAR — e.g. OKRADM, PUBMUS, VLWPLA), the dev may have used the block for billable client work instead of innovation; ask the user whether to bill the client or INTLAR before logging. Ask if otherwise unclear.

## Account hygiene — Rhino-portfolio known traps

For the general failure modes of `tempo last-account` (account expiry, phase change, billing-mode switch, prefix collision), see `tkk-config.md` → "Account hygiene". Known traps in the Rhino portfolio:

- **VLWPLA**: `tempo last-account VLWPLA` returns `VLWPLAGAR` (warranty), which **expired on 2026-03-26**. Current VLWPLA work bills to **VLWPLANEW** (V2, *Volgens Offerte*). Don't trust the cached default — confirm with `tempo accounts VLWPLA` or ask the user.

## Calendar mappings (Rhino events)

| Title pattern | Issue | Notes |
|---|---|---|
| `DM Rhino`, `Rhino DM`, `Daily` | INTUNI-27 | **Always 0.25h, even if it overlaps existing work** — Tempo accepts overlap, and the small overcount is preferred to "splitting" a work block |
| `WM Rhino`, `Rhino (bi)weekly`, `Work Moment Rhino` | INTUNI-27 | |
| `Rhino Team Lunch` | INTUNI-27 | |
| `1:1`, `1on1` with Rhino colleague | INTUNI-27 | Ask if person isn't Rhino |
| `Innovatietijd Rhino` | INTLAR-<from git> | See "Innovation rule" above |

### Client-project meetings

- Title contains a Jira key (`OKRADM-3108 sync`, `KNXCOU-2 wireframes`) → use that key.
- Title contains a project name (`OKRA`, `PUBMUS`, `KNXCOU`, `VOIGHT`, `VLWPLA`, `MKTPLA`, `DIGINC`, `KULSKI`) → use the matching project; ask which specific issue.
- Generic `checkin`, `status`, `sync` without a project hint → ask.

## Rhino issues (INTUNI)

| Issue | Use for |
|---|---|
| INTUNI-27 | Rhino meetings, DMs, 1-on-1s, biweekly operational, team lunch |
| INTUNI-5 | Rhino admin: mail, HelpScout, Slack catch-up, own planning, laptop issues |
| INTUNI-12 | Stage begeleiding |
| INTUNI-28 | Facturatie Rhino |
| INTUNI-30 | TeamLead Rhino |
| INTUNI-32 | Combell problems |
| INTUNI-74 | Opleiding (training) |
| INTUNI-76 | S3 role: Klantenopleidingsverantwoordelijke |
| INTUNI-77 | S3 role: DevOps-verantwoordelijke |
| INTUNI-78 | S3 role: Rekruteringsverantwoordelijke |
| INTUNI-79 | S3 role: Testprotocolverantwoordelijke |
| INTUNI-80 | S3 role: Facturatieverantwoordelijke |
| INTUNI-81 | S3 role: Planningsverantwoordelijke |
| INTUNI-82 | S3 role: Sfeerbeheerder |

INTUNI-5 is for **Rhino admin** (mail/Slack/HelpScout, laptop issues, own planning) — NOT for project work (that goes on the project ticket).

## Typical guild attendance *(personal-override-allowed)*

Rhino devs typically attend Laravel, AI, and FE more than UX/Craft. Confirm via your own calendar; opt in/out in `preferences.md`.

| Title pattern | Issue |
|---|---|
| `UX Gilde` | INTKNS-1 |
| `FE gilde`, `Frontend gilde` | INTKNS-2 |
| `Laravel gilde`, `INTKNS-3 Laravel gilde` | INTKNS-3 |
| `AI gilde`, `INTKNS-5: AI gilde`, `AI manifest`, `Hackathon brainstorm`, `Lunch AI-speeltijd`, `Kick-off AI manifest` | INTKNS-5 |
| Other AI events (`AI werf bespreken`, `AI plugin`, `Karbon demo`, `Sleutelen aan AI & coffee`) | **ask** |
| `Learning`, conferences (`Laracon EU`), meetups, self-study | INTKNS-11 |

## Recurring meetings *(personal-override-allowed)*

Use as defaults when matching titles. Still show them in proposals so the user can adjust. Some entries don't apply to every Rhino dev (e.g. KULSKI checkin only if you work on KULSKI) — filter via `preferences.md`.

| Title pattern | Cadence | Time | Duration | Issue |
|---|---|---|---|---|
| Rhino DM (Mon variant) | Weekly Mon | 09:30 | 30m | INTUNI-27 |
| Rhino DM | Tue–Fri | 09:30 | 15m | INTUNI-27 |
| Rhino (bi)weekly operational | Biweekly Thu | 09:45 | 60m | INTUNI-27 |
| Innovatietijd Rhino | Biweekly Thu | 13:00 | 4h | INTLAR-<from git> |
| Rhino Team Lunch | Monthly Thu | 11:45 | ~105m | INTUNI-27 |
| Demo Donderdag | Weekly Thu | 12:00 | 30m | INT-3 |
| Laravel gilde status | Monthly Mon | 10:00 | 60m | INTKNS-3 |
| AI gilde | Monthly Thu | 11:00 | ~75m | INTKNS-5 |
| OKRA DM | Short runs Tue/Wed/Fri | 10:00 or 13:30 | 25m | OKRADM (ask which issue) |
| OKRADM maandelijks overleg | Monthly Wed | 11:00 | 50m | OKRADM (ask which issue) |
| PUBMUS maandelijkse afstemming | Monthly Wed | 11:00 | 60m | PUBMUS (ask which issue) |
| KULSKI checkin | Weekly | 16:00 | 15m | KULSKI (ask which issue) |