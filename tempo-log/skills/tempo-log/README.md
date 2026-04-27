# tempo-log — getting started

A Claude Code skill for logging time in Tempo Cloud at Statik. Designed to handle batch / catch-up logging: ask Claude "log my time for last week" and it cross-references your calendar, git commits, and Jira activity to propose worklogs you can approve before submitting.

This README walks you from a fresh install to your first successful log.

## Prerequisites

- Atlassian Cloud + Tempo Cloud access at `statik.atlassian.net`.
- A unix-y shell (`bash` 4+), `curl`, `jq`, `git`. macOS ships with all of these (run `brew install jq` if it's missing).
- Claude Code with the TKK marketplace plugin installed.

## 1. Install the plugin

Add the TKK marketplace and install the plugin via Claude Code's plugin commands. Once installed, run:

```bash
tempo install
```

This:

- Symlinks `tempo` and `tempo-git-scan` into `~/.local/bin` (so they're on your `$PATH`).
- Creates `~/.config/tempo-log/` and copies `preferences.template.md` → `~/.config/tempo-log/preferences.md`.
- Warns you if `~/.local/bin` isn't on your `$PATH` and tells you how to add it.

If you'd rather install elsewhere: `tempo install --bin /custom/bin --config /custom/cfg` (or set `TEMPO_INSTALL_BIN_DIR` / `TEMPO_CONFIG_DIR` env vars).

## 2. Get your Tempo API token

1. Go to `https://statik.atlassian.net` → **Apps → Tempo → Settings → API Integration**.
2. Click **New Token**, give it a name (e.g. "claude-tempo-log"), scope: **manage-worklogs**.
3. Copy the token — you only see it once.

## 3. Find your Atlassian accountId

You also need a Jira API token (separate from Tempo's): go to <https://id.atlassian.com/manage-profile/security/api-tokens> → **Create API token**.

Then:

```bash
JIRA_EMAIL="your.name@statik.be"
JIRA_API_TOKEN="<token-from-step-above>"
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  "https://statik.atlassian.net/rest/api/3/myself" | jq -r .accountId
```

Copy the value (looks like a 24-char hex string, e.g. `5xxxxxxxxxxxxxxxxxxxxxxx`).

## 4. Set environment variables

Add to `~/.zshenv` (use `.zshenv`, not `.zshrc` — bash invocations from Claude Code don't always source `.zshrc`):

```bash
export TEMPO_API_TOKEN='<token-from-step-2>'
export TEMPO_ACCOUNT_ID='<accountId-from-step-3>'

# Optional — needed only if you call `tempo add --issue OKRADM-1234` (key form) instead of numeric IDs
export JIRA_EMAIL='your.name@statik.be'
export JIRA_API_TOKEN='<jira-api-token-from-step-3>'
```

Open a new terminal so the env vars are loaded.

## 5. Verify the CLI works

```bash
tempo help     # prints usage
tempo day      # today's worklogs and gap to 8h
```

If `tempo day` prints something like `2026-04-27 — logged 0h / 8h target (gap: 8h)`, the CLI is wired up. If you see "TEMPO_API_TOKEN not set", your shell didn't pick up the env vars — check `~/.zshenv` and reopen your terminal. If you see `command not found: tempo`, `~/.local/bin` isn't on your `$PATH`; the warning from `tempo install` shows the fix.

## 6. Configure your preferences

`tempo install` already created `~/.config/tempo-log/preferences.md` from the template. Open it and fill in at least:

- **`team_config:` field in the frontmatter**: set to your circle's file (e.g. `team_config: rhino-config.md` or `team_config: panda-config.md`).
- **Identity**: name, email, accountId.
- **Default Work Type**: ask your team lead which billing rate you're authorised at (e.g. `Development`, `MediorDevelopment`, `SeniorDevelopment`).
- **`GIT_SCAN_AUTHORS`**: name tokens that match your git commits — e.g. `"jane doe"`. Test by running `git log --author='jane' --since='1 week ago' --oneline` in a recent project.
- **`GIT_SCAN_PARENTS`**: where your work code lives. Default is the JetBrains layout (`~/PhpStormProjects ~/WebStormProjects ~/PyCharmProjects`); change if you keep code under, say, `~/code/`.
- **`GIT_SCAN_SKIP`**: any personal repos under those parent dirs that should never be logged to Tempo.
- **Personal calendar exclusions**: events on your calendar that aren't work (Yoga, school run, side project, …).

Don't worry about the optional sections — defaults are sensible.

## 7. (Optional) Configure a new team

Existing TKK circles ship their team config alongside this skill (e.g. `rhino-config.md`). If you're the first person from a new circle to set this up:

1. Copy the template into the shared marketplace repo as `<circle>-config.md` (e.g. `panda-config.md`) — that way every colleague in the circle picks it up automatically when they update the plugin. The template lives at `<skill-dir>/team-config.template.md`.
2. Open a PR on `statikbe/skill-market` adding the file.

If you want to override a team default for yourself only, drop a same-named file into `~/.config/tempo-log/<circle>-config.md` — the skill prefers the personal version over the shipped one.

## 8. Try it

In Claude Code: ask "log my time for yesterday". Claude will:

1. Read all three config files.
2. Pull yesterday's existing worklogs, calendar events, and git commits.
3. Propose a per-day table of worklogs to add.
4. Wait for your approval before submitting anything.

## How the layered config works

Every workflow run reads three layers in priority order:

```
preferences.md      (you)        ← highest priority, overrides everything below
<circle>-config.md  (your team)  ← e.g. rhino-config.md, panda-config.md
tkk-config.md       (TKK / Statik) ← lowest, baseline defaults
```

For tables (repo→project, calendar→issue, recurring meetings), entries are *merged* — your personal additions extend the team's, which extends the org's. For scalars (timezone, daily target, default Work Type), the highest layer wins.

For each layer, the skill reads `~/.config/tempo-log/<file>` first if it exists (your personal override), and otherwise falls back to the version shipped with the plugin. So you can override any line in `tkk-config.md` or your team config by dropping a same-named file in `~/.config/tempo-log/`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `command not found: tempo` | `~/.local/bin` not on `$PATH`. Re-run `tempo install` and follow the warning, or call `~/.local/bin/tempo` until you fix the shell config. |
| `tempo: TEMPO_API_TOKEN not set` | Env var didn't load. Check `~/.zshenv`, open a new terminal. |
| `HTTP 401` from `tempo` | Token expired or wrong scope. Generate a fresh token in Tempo settings. |
| `HTTP 400 Work attribute Account (_Account_) is required` | You forgot `--account`. Tempo Cloud doesn't auto-apply the issue's configured Account on POST. |
| `HTTP 400 Account ... is closed/archived` | The Account key has been deactivated. Run `tempo accounts <prefix>` to find an OPEN replacement. |
| Claude proposes 0 git activity | `GIT_SCAN_AUTHORS` doesn't match your commits. Run `git log --author='<your-pattern>' --oneline -5` in a recent repo to test. |
| `tempo-git-scan: GIT_SCAN_AUTHORS not set …` | The skill workflow forgot to export it (or you ran the command directly). Set it explicitly. |
| `tempo add --issue OKRADM-1234` fails with "JIRA_EMAIL/JIRA_API_TOKEN not set" | Issue-key resolution needs Jira credentials. Either set those env vars or pass the numeric issue id via `--issue 51348`. |
| Claude tries to log against the wrong project for a repo | Repo isn't in your team config's repo→project table. Add a row for it. |

## Updating the skill

When the org or team config changes:

- **Org-level changes** (e.g. new TKK-wide calendar event, retired Account) — someone updates `tkk-config.md` in the marketplace; pull the new plugin version.
- **Team-level changes** (new client, retired meeting) — your circle updates `<circle>-config.md` in the marketplace; pull.
- **Your changes** (new personal exclusion, role change) — edit `~/.config/tempo-log/preferences.md` directly. It's yours.

## Files

Skill bundle (read-only, lives where the marketplace installed it):

```
skills/tempo-log/
├── README.md                     ← this file
├── SKILL.md                      ← what Claude loads; workflow + tool reference
├── tkk-config.md                 ← org layer (shared, identical across teams)
├── rhino-config.md               ← Rhino circle's team config (and other circles' files alongside)
├── team-config.template.md       ← starting point for new circles
├── preferences.template.md       ← starting point for new users (copied by `tempo install`)
└── scripts/
    ├── tempo                     ← Tempo Cloud REST CLI (Bash)
    └── git-scan                  ← lists your commits across configured repos
```

Personal config (yours, never shipped):

```
~/.config/tempo-log/
├── preferences.md                ← created by `tempo install`; edit it
└── <circle>-config.md            ← optional personal override of a team config
```