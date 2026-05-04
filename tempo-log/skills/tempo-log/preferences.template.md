---
name: preferences
description: Personal config for tempo-log skill — TEMPLATE; copy to preferences.md and fill in
layer: personal
team_config: <your-circle>-config.md   # e.g. rhino-config.md, panda-config.md
promote_threshold: 3                   # learned mappings get a promotion prompt at this count
---

# Personal preferences

> **Setup:** copy this file to `preferences.md` (same directory) and fill in the values below. The skill workflow always reads `preferences.md`, never this template.

Highest-priority layer — overrides values from your team config (`<circle>-config.md`) and `tkk-config.md`.

## Identity

- **Name**: <Your full name>
- **Email**: <you@statik.be>
- **Jira accountId**: `<your-account-id>`

> **How to find your accountId:**
> ```bash
> curl -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
>   "https://statik.atlassian.net/rest/api/3/myself" | jq .accountId
> ```

## Schedule

- **Working days**: Monday–Friday  *(adjust if you do 4/5)*
- **Weekly target**: 40h (8h/day)  *(adjust to your contract)*
- **Start time pattern**: <e.g. 08:00–09:00, modal 08:30>

## Default Work Type

`<your-rate>` — applied to every new worklog unless explicitly overridden.

> Common values: `Development`, `MediorDevelopment`, `SeniorDevelopment`, `Analysis`, `Testing`, `Management`. Confirm with your team lead which rate you're authorised to log at.

## git-scan env vars

Skill workflow exports these before calling `tempo-git-scan`:

```
GIT_SCAN_AUTHORS="<git-author-pattern> <alt-pattern>"   # e.g. "jane doe"
GIT_SCAN_PARENTS="$HOME/PhpStormProjects $HOME/WebStormProjects $HOME/PyCharmProjects"
GIT_SCAN_SKIP="<repo-basename> <other-repo>"            # personal repos to never log
```

`GIT_SCAN_AUTHORS` is matched against `git log --author=...` (substring; case-insensitive in `git log`'s default config). Add multiple patterns space-separated to catch e.g. both first and last name.

If you don't have personal repos under your project parent dirs, leave `GIT_SCAN_SKIP` empty.

## Personal calendar exclusions

In addition to org-level location markers (Office, Home, Thuis, Bureau, Keukenteam) and team-level rules, also skip:

- `<personal-event-1>`  *(e.g. Yoga, Social Club, school run)*
- `<personal-event-2>`

## 1:1 mappings (specific colleagues)

| Title pattern | Issue | Notes |
|---|---|---|
| `<You & Colleague>` | INTUNI-27 *(or your circle's meeting issue)* | Colleague is a <circle> dev |

## Behaviour preferences

Pick the ones that match how you want the skill to act. Defaults shown:

- **Ask before submitting.** Per-day confirmation required. Never POST without explicit approval. *(default: ON; turn off if you want autonomous logging — not recommended)*
- **One day at a time, oldest first.** Don't dump week-wide proposals.
- **Don't frame work around sprints** — useful if your planning is fluid.
- **Description style**: <e.g. short, concrete; English for technical work, Dutch for Dutch-language meetings; no issue key in description text>

### Description examples I've used and like

- `"<example 1>"`
- `"<example 2>"`

## Recently used Account keys (informational)

Optional. Sanity-check list of accounts you commonly log against — not authoritative. Skill resolves accounts via `tempo last-account` / `tempo accounts` at runtime.

## Learned mappings

The skill keeps an append-only log of user-confirmed ambiguity resolutions at `~/.config/tempo-log/learned-mappings.jsonl`. Each time you resolve a recurring ambiguity (a 1:1 with someone whose meeting isn't in the table, a calendar event that isn't mapped, …), the row's `count` increments. Once `count` reaches `promote_threshold` (set in the frontmatter above; default 3), the skill proposes promoting the mapping permanently into `preferences.md` so future sessions don't re-ask.

Inspect or edit at any time:

- `tempo memory --learned` — sorted summary
- `tempo memory --forget "<title pattern>"` — remove an entry
- `tempo memory --suppress "<title pattern>"` — keep the count but never propose promotion

The JSONL is per-machine (same scope as Claude Code's auto-memory); deleting it resets all "never promote" choices.

## Team-default overrides

> Use this section ONLY if you need to override your team's defaults (in `<circle>-config.md`). Common cases:
>
> - Different repo parent dirs (e.g. you keep code under `~/code/`)
> - You don't attend a guild your team typically attends
> - You don't have a recurring meeting your team has by default

```
# Examples — uncomment and edit if needed:
# repo_parent_dirs_override: "$HOME/code"
# guilds_skip: ["UX Gilde"]
# recurring_meetings_skip: ["KULSKI checkin"]
```