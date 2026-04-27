---
name: <short-circle-name>-config
description: Team/circle config for tempo-log skill — TEMPLATE; copy to <short-name>-config.md (e.g. rhino-config.md, panda-config.md) and fill in your circle's values
layer: team
team: <Your Circle>
circle_jira_project: <INTXXX>
circle_account_key: <INTXXXACC>
---

# Team config: <Your Circle>

> **Setup:** copy this file to `<short-circle-name>-config.md` (e.g. `rhino-config.md`, `panda-config.md`) in the same directory, and fill in your circle's values. Then point your `preferences.md` at it: set `team_config: <short-circle-name>-config.md` in the frontmatter.
>
> Once one circle member has created the file, share it with the rest of the circle (commit to a shared repo, paste in your circle's wiki, etc.).

Team-level defaults for the `tempo-log` skill. Lower priority than `preferences.md`, higher than `tkk-config.md`.

## Circle identity

- **Circle**: <Your Circle, e.g. Panda-Koala>
- **Circle Jira project**: <INTXXX, e.g. INTROK>
- **Circle account key**: <INTXXXACC, e.g. INTROKACC>

## Confluence reference (circle-specific)

- <Circle's internal logging guideline page> → `pageId: <id>` (space <KEY>)

> If your circle doesn't have one, omit this section. Org-wide refs live in `tkk-config.md`.

## Logging style

> Describe your circle's convention. Examples:
> - "Same-day logging required, no batch/catch-up."
> - "Batch / catch-up is fine, logs may lag 0–14 days."
> - "Weekly close-out on Friday."

## Repo parent dirs *(personal-override-allowed)*

Where your circle's devs typically keep code. Skill workflow exports this for `tempo-git-scan`:

```
GIT_SCAN_PARENTS="$HOME/PhpStormProjects $HOME/WebStormProjects $HOME/PyCharmProjects"
```

> Default above is the JetBrains layout. Adjust if your circle has a convention (e.g. `~/code/<client>/`).

## Repo → Jira project (circle's client portfolio)

| Repo dir (basename) | Jira project | Notes |
|---|---|---|
| `<repo-1>` | <PROJ1> | <client name> |
| `<repo-2>`, `<repo-2-alt>` | <PROJ2> | |
| `<repo-3>` | <PROJ3> | |

> List every client repo your circle works on. If a repo isn't listed, the skill defaults to "treat 6-letter prefix as project key, ask user to confirm."

## <Internal packages / tools, if any>

> Many circles maintain internal packages. If yours does:

| Repo dir | Issue |
|---|---|
| `<package-repo>` | <PROJ-N> |

**Cross-project override:** If your circle's internal work is ticketed under a different Jira project but bills to your circle account, document the override here:

> e.g. "Work on `<INTLAR>` issues bills to **<INTUNIACC>** because it's done during circle innovation time."

**Innovation rule:** When `<Innovation event title>` appears in calendar, default the issue to <pattern>. Ask if unclear.

## Calendar mappings (circle events)

| Title pattern | Issue | Notes |
|---|---|---|
| `DM <circle>`, `<circle> DM`, `Daily` | <CIRCLE-MEETING-ISSUE> | <e.g. "Always 0.25h, even if it overlaps existing work"> |
| `WM <circle>`, `<circle> (bi)weekly` | <CIRCLE-MEETING-ISSUE> | |
| `<circle> Team Lunch` | <CIRCLE-MEETING-ISSUE> | |
| `1:1`, `1on1` with <circle> colleague | <CIRCLE-MEETING-ISSUE> | Ask if person isn't <circle> |

### Client-project meetings

> Generic guidance — usually doesn't need editing per-circle:

- Title contains a Jira key (`<PROJ>-123 sync`) → use that key.
- Title contains a project name → use the matching project; ask which specific issue.
- Generic `checkin`, `status`, `sync` without a project hint → ask.

## Circle issues (<INTXXX>)

| Issue | Use for |
|---|---|
| <INTXXX-N> | Circle meetings, DMs, 1-on-1s |
| <INTXXX-M> | Circle admin (mail, Slack, planning, laptop issues) — NOT project work |
| <INTXXX-?> | Stage begeleiding |
| <INTXXX-?> | Facturatie |
| <INTXXX-?> | TeamLead |
| <INTXXX-?> | Opleiding (training) |
| <INTXXX-?> | S3 role: <name> |
| ... | |

## Typical guild attendance *(personal-override-allowed)*

> Which guilds your circle's devs typically attend. Personal opt-in/out → `preferences.md`.

| Title pattern | Issue |
|---|---|
| `Laravel gilde` | INTKNS-3 |
| `AI gilde` | INTKNS-5 |
| ... | |

## Recurring meetings *(personal-override-allowed)*

> Use as defaults when matching titles. Show in proposals so the user can adjust. Filter via `preferences.md` if some entries don't apply to every circle dev.

| Title pattern | Cadence | Time | Duration | Issue |
|---|---|---|---|---|
| <Circle> DM (Mon) | Weekly Mon | <HH:MM> | <Nm> | <CIRCLE-MEETING-ISSUE> |
| <Circle> DM | Tue–Fri | <HH:MM> | <Nm> | <CIRCLE-MEETING-ISSUE> |
| <Circle> (bi)weekly operational | Biweekly <day> | <HH:MM> | <Nh> | <CIRCLE-MEETING-ISSUE> |
| ... | | | | |