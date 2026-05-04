---
name: tempo-log
description: Use when the user wants to log time in Tempo, review their timesheet, backfill missing hours, or check what days are under-logged. Triggers on "log my time", "fill in tempo", "what did I log this week", "backfill my hours", "tempo", "timesheet", "my hours", "did I log X", "missing hours". Use even if the user doesn't say "tempo" explicitly — any request to log, review, or audit work hours against Jira/Statik should trigger this skill.
---

# tempo-log

Log time in Tempo Cloud for Jira at Statik. Designed for batch / catch-up logging — users often log days after the work.

This skill is layered so it can be shared across teams and users. See `README.md` for first-time setup — in short: install the plugin, then run `tempo install` to symlink the CLI onto `$PATH` and bootstrap `~/.config/tempo-log/preferences.md` from the template.

## Configuration layering

The skill reads four sources of configuration. **Priority (highest first): personal > team > org > skill defaults.**

| File | Layer | Owns |
|---|---|---|
| `preferences.md` | personal | identity, schedule, default Work Type, git-scan env vars, behaviour preferences, personal calendar exclusions |
| `<circle>-config.md` (e.g. `rhino-config.md`) | team | circle Jira/account, repo→project mappings, circle calendar mappings, recurring meetings, typical guild attendance. Pointed to from `preferences.md` `team_config` field. |
| `tkk-config.md` | org | Atlassian site/cloudId, mandatory fields, account category taxonomy, all-circles reference table, INTKNS guild issues, Statik-wide calendar mappings, location markers |
| `SKILL.md` (this file) | skill | workflow, tool reference, merge logic, skill-meta behaviour |

For tables (repo→project, calendar→issue, recurring meetings), **merge entries from all layers**, with lower-layer rows winning on key conflict. For scalars (granularity, timezone), use the first non-empty value in priority order.

## Step 0 — load configuration (first action of every workflow run)

Personal config lives in `~/.config/tempo-log/` (created by `tempo install`). Org and team defaults ship with the skill itself — read those from this skill's directory (the path the harness announces as "Base directory for this skill" on load; referred to below as `<skill-dir>`).

The team config file is named per circle (`rhino-config.md`, `panda-config.md`, …) and pointed to from `preferences.md`. Resolve in this order:

1. Read `~/.config/tempo-log/preferences.md` first.
   - If missing → stop and tell the user to run `tempo install` and then edit `~/.config/tempo-log/preferences.md`.
   - From its frontmatter, take the value of `team_config` (e.g. `rhino-config.md`).
2. Read these in parallel:
   - **Team config**: try `~/.config/tempo-log/<value-of-team_config>` first (personal override); fall back to `<skill-dir>/<value-of-team_config>` (shipped team default). If neither exists, warn and continue with org-only.
   - **Org config**: try `~/.config/tempo-log/tkk-config.md` first (rare personal override); fall back to `<skill-dir>/tkk-config.md` (shipped org default).

After reading, mentally apply override priority. From `preferences.md`, also note the three `git-scan` env vars (`GIT_SCAN_AUTHORS`, `GIT_SCAN_PARENTS`, `GIT_SCAN_SKIP`) — they need to be exported on every `tempo-git-scan` invocation.

Users can run `tempo memory` at any time to print the resolved layer chain (which path each config came from, whether a personal override is active). Useful for debugging "why isn't my override taking effect?".

## Why this skill bundles a CLI (not an MCP)

Three Tempo MCPs were evaluated. None worked for Statik's Atlassian Cloud:

- **Tranzact** requires Jira Data Center PATs — Cloud doesn't issue those.
- **Henry-Workshop**'s `tempo_get_worklogs` returns *all* worklogs (no user filter) and its Account lookup expects a Jira custom field that Statik doesn't use.
- **Ivelin-web** has the same user-filter gap.

Instead, this skill ships a small Bash CLI at `scripts/tempo`. It wraps Tempo REST v4, handles user-scoped reads, an OPEN-account discovery cache, duration parsing, and the `_WorkType_`/`_Account_` attributes Tempo Cloud requires.

## Environment

Required (export from `~/.zshenv` so Bash sees them, not just `~/.zshrc`):

- `TEMPO_API_TOKEN` — Tempo Cloud API token (manage-worklogs scope). Get/rotate at `statik.atlassian.net → Apps → Tempo → Settings → API Integration`.
- `TEMPO_ACCOUNT_ID` — your Atlassian accountId (also in `preferences.md`).

Optional (only for `tempo add --issue KEY` with a Jira key instead of numeric id):

- `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_BASE_URL` (default `https://statik.atlassian.net`).

Verify: `tempo help`.

## The `tempo` CLI

After `tempo install`, the CLI lives on `$PATH` as `tempo` (and `git-scan` as `tempo-git-scan`). Allowlist `Bash(tempo:*)` and `Bash(tempo-git-scan:*)` once and Claude Code won't re-prompt per command.

```
tempo get [from] [to] [--json]         my worklogs, default last 7 days
tempo day [date] [--json]              one day, default today; shows 8h gap
tempo summary <from> <to>              per-day totals + top accounts
tempo accounts <PROJECT_PREFIX>        OPEN accounts whose key starts with prefix
tempo last-account <PROJECT_PREFIX>    my most recently used Account on this prefix
tempo add --issue <KEY|ID> --date YYYY-MM-DD --duration 1h30m --account KEY --desc "..."
         [--time HH:MM] [--worktype <type>] [--billable 1h]
tempo batch [--dry-run] <file.jsonl|->  submit many worklogs from JSONL
         One JSON object per line: {issue, date, duration, account, desc,
         [time], [worktype], [billable]}. Aliases: issueKey/issueId, description.
         Prints NDJSON results in input order + summary on stderr. Parallel.
tempo update <worklog-id> [--date ...] [--time ...] [--duration ...] [--account ...] [--desc ...] [--worktype ...]
tempo delete <worklog-id>
tempo accounts-refresh                 force rebuild of OPEN-account cache (normally 12h TTL)
tempo memory                           print the resolved config layer chain (personal/team/org/skill)
```

Duration formats: `1h30m`, `2h`, `45m`, `0.5h`, `1.25h`. The CLI rounds to Tempo's 15-min granularity implicitly via `timeSpentSeconds`.

`--worktype` defaults to `SeniorDevelopment` in the script. For shareability, **always pass `--worktype` explicitly** using the value from `preferences.md` so the script default never matters.

`_Account_` is required on every write — Tempo's API rejects POSTs without it (HTTP 400). Always pass `--account`.

### Discovering the right `_Account_` for an issue

Two-pronged approach (run both, pick the best default):

```bash
# Step 1: most-recent usage on this project — usually the right answer
tempo last-account OKRADM

# Step 2: all OPEN accounts whose key starts with the prefix — shown if step 1 is empty/ambiguous
tempo accounts OKRADM
```

Decision rule:

- If `last-account` returns a key → use it (billing mode rarely changes mid-project).
- Else if `accounts` returns exactly one OPEN match → use it silently.
- Else → show the candidates with their category/name and ask the user which.

Category meanings, deprecation cues, and `_InvoicePeriod_` rules → `tkk-config.md`.

### Writes: what to pass

For `tempo add`:

- `--issue <numeric-id>` — resolve from Jira key via `mcp__atlassian__getJiraIssue` (the `.id` field).
- `--date YYYY-MM-DD`
- `--duration 1h30m` (CLI converts to seconds).
- `--account <KEY>` (discovered per above).
- `--desc "<short concrete summary>"`.
- `--time HH:MM` (optional but preferred — sequential times make the day readable).
- `--worktype <value-from-preferences.md>`.

On error "Account closed or archived", pick an alternative from `tempo accounts <prefix>` and ask the user.

### Backfill pattern

**Prefer `tempo batch` for multi-entry submissions.** One Bash invocation (one permission prompt, not N), parallel internally, NDJSON results in input order plus an `ok/failed` summary on stderr.

Workflow:

1. Build a JSONL file (`/tmp/worklogs-<date>.jsonl` is fine) with one JSON object per line — numeric `issue` IDs are preferred so `JIRA_EMAIL`/`JIRA_API_TOKEN` aren't needed. Blank lines and `#` comments are ignored.
2. Sanity check: `tempo batch --dry-run <file>` validates every row (required fields, duration parsing, issue resolution) without POSTing.
3. Submit: `tempo batch <file>`.
4. Verify: `tempo day <date>`.

JSONL schema per line:

```json
{"issue": 51348, "date": "2026-04-22", "time": "09:30", "duration": "15m", "account": "INTUNIACC", "desc": "Rhino DM"}
```

Optional keys: `time` (omit to leave Tempo unscheduled), `worktype` (default in script: `SeniorDevelopment`; pass explicit value from `preferences.md`), `billable` (default = duration). Aliases accepted: `issueKey`/`issueId` for `issue`, `description` for `desc`.

Fallback for one stray entry: `tempo add --issue ... --date ... --duration ... --account ... --desc "..." [--time HH:MM]`.

> **`tempo batch` is not idempotent.** Re-running the same input file submits duplicate worklogs — Tempo has no client-side dedupe key. On partial failure, retry **only the failed rows** (filter the NDJSON output for `ok: false`), never the whole input file. If you double-submit, you'll have to delete the extras with `tempo delete <worklog-id>` manually.

## `tempo-git-scan` — list the user's commits

Lists commits across configured project dirs in a date window. Reads three env vars from `preferences.md`:

```bash
GIT_SCAN_AUTHORS="<user-name-tokens>" \
GIT_SCAN_PARENTS="<space-separated-parent-dirs>" \
GIT_SCAN_SKIP="<space-separated-repo-basenames>" \
tempo-git-scan 2026-04-23
# range form:
GIT_SCAN_AUTHORS="..." GIT_SCAN_PARENTS="..." GIT_SCAN_SKIP="..." \
tempo-git-scan 2026-04-20 2026-04-24
```

Output: `=== <repo> ===` header, then `<iso-datetime> <sha> <subject>` lines, blank line between repos. Always exits 0 so it's safe in parallel batches.

If `GIT_SCAN_AUTHORS` is empty, the script falls back to `git config --global user.name` and warns on stderr — but the workflow should always export the value from `preferences.md` so this fallback never fires in practice.

## Atlassian MCP — Jira metadata only (NOT for reading worklogs)

- `mcp__atlassian__searchJiraIssuesUsingJql` — find issues by project / assignee / updated date.
- `mcp__atlassian__getJiraIssue` — resolve issue key → numeric ID for Tempo posts; also for summary/description context.
- `mcp__atlassian__getConfluencePage` — re-fetch Statik or circle guidelines if rules need refreshing (page IDs in `tkk-config.md` and your team config file).

Known limitations:

- `worklog.author.accountId` on Jira shows the Tempo-app service account — Jira can't filter worklogs by user. Always use the Tempo API for worklog reads.
- JQL `worklogDate` returns 0 results on this instance — don't use it.

## Google Calendar MCP

- `mcp__claude_ai_Google_Calendar__list_events` — primary calendar.
- Exclude `needsAction` invites (the user didn't accept).
- Exclude location markers (org-level: `Office`, `Bureau`, `Home`, `Thuis`, `Keukenteam`) and personal noise (per `preferences.md`).

## Workflow

### A. "Log my time" / "backfill" / "what do I need to log?"

1. **Step 0 first** — load all config files (see top of file).

2. **Ask the user for the date range** if they didn't specify. Defaults: "yesterday", "this week (Mon–today)", "last week", "last 2 weeks". Confirm on ranges > 1 week.

3. **Gather evidence in parallel** for each day in range:
   - Tempo: `tempo get <from> <to>` for existing worklogs (or `tempo day <date>` per day).
   - Calendar: events via `list_events`.
   - Git: commit scan via `tempo-git-scan` with env vars exported from `preferences.md`.
   - Optional: `searchJiraIssuesUsingJql` with `assignee = currentUser() AND updated >= "YYYY-MM-DD" AND updated <= "YYYY-MM-DD" ORDER BY updated ASC`.
   - Warm the account cache with any `tempo accounts <prefix>` or `tempo last-account <prefix>` call — subsequent lookups are free for 12h.

4. **Compute per day**:
   - Existing logged hours.
   - Gap to daily target (from `preferences.md`).
   - Candidate entries from calendar + commits + Jira activity, mapped via the merged tables in your team config + `tkk-config.md` + `preferences.md`.
   - **Pre-prompt check (learning loop).** For each calendar item that doesn't resolve cleanly via the merged tables — typically 1:1 meetings (`Aurel & Jan`), generic recurring titles, or freeform event names — query the learned-mappings JSONL:
     ```bash
     tempo memory check --category oneonone --pattern "<title>"
     ```
     The output is a JSON array. If any row has `count >= promote_threshold` (default 3, frontmatter of `preferences.md`) and `suppress_promotion != true`, mark the item as a **promotion candidate** with the highest-count `resolved_to` as the proposed issue. Otherwise, mark as ambiguous as before.

5. **Present one day at a time** as a table, oldest first:

   ```
   === Tuesday 2026-04-15 ===
   Already logged: 3.50h  |  Gap: 4.50h

   Proposed entries (**always prefix with a `#` column — row number resets per day** — so the user can reference entries as "row 3" / "drop #2" without retyping start times):
   | # | Start | Issue      | Hours | Description                                           | Source      |
   |---|-------|------------|-------|-------------------------------------------------------|-------------|
   | 1 | 08:00 | OKRADM-3121| 1.00  | Debug 500 error in WP→CRM payment notification        | calendar+git|
   | 2 | 09:30 | INTUNI-27  | 0.25  | Rhino DM                                              | calendar    |

   Promotion candidates (seen ≥ promote_threshold times — see learning loop):
   - "Karbon demo" at 14:00 → OKRADM-3200 (confirmed 3× before).
     Add to `preferences.md` 1:1 mappings? (yes / not yet / never for this pattern)

   Ambiguous:
   - "Sleutelen aan AI & coffee" at 11:00 — no issue key. Which issue should this log against?
   ```

6. **Wait for user feedback**. The user can:
   - Approve (`ok`, `looks good`, `yes`).
   - Adjust by row number ("change #3 to OKRADM-3108", "drop #4", "merge #1 and #5", "bump #3 to 2h").
   - Suggest issues for ambiguous items.
   - Respond to promotion candidates: `yes`, `not yet`, or `never for this pattern`.

   Only proceed to the next day once they confirm the current day.

   **After the user resolves any item that came from a learning-loop category** (1:1 meetings, freeform calendar titles), record the resolution so the count climbs:
   ```bash
   tempo memory record --category oneonone --pattern "<title>" --resolved-to <ISSUE-KEY>
   ```
   This includes promotion-candidate responses — record on every confirmation, not only at threshold. Then handle the promotion response, if any:
   - **`yes`** — edit `preferences.md` to add a row to the 1:1 mappings table (or the appropriate section); then `tempo memory --forget "<pattern>"` to remove the JSONL row. Future sessions match from `preferences.md` directly.
   - **`not yet`** — nothing extra; the count increments via the `record` call above and the prompt re-fires next session at threshold.
   - **`never for this pattern`** — `tempo memory --suppress "<pattern>"`. Skill still uses the resolution for the current session but never re-prompts.

7. **After all days are confirmed**, submit via `tempo batch`:
   - Resolve each issue key → numeric ID via `getJiraIssue` (the `id` field).
   - Resolve each issue's `_Account_` via `tempo last-account <prefix>` / `tempo accounts <prefix>` (ask if ambiguous).
   - Write a JSONL file to `/tmp/worklogs-<date>.jsonl`.
   - Run `tempo batch /tmp/worklogs-<date>.jsonl`. Summary on stderr reports `N ok, M failed`.
   - For any `ok: false` entries in the NDJSON output, inspect the `error`/`body` field. On "Account closed or archived", ask for a replacement and retry just those lines.

8. **Report back**: total hours logged, by project, and any failures. On attribute errors, show the exact entry and ask whether to retry with adjusted attributes or fall back to `mcp__atlassian__addWorklogToJiraIssue` (no Work Type, correct in Tempo UI later).

### B. "Review my timesheet" / "what did I log this week?"

1. `tempo summary <from> <to>` for the big picture; `tempo get <from> <to>` for the raw list.
2. Cross-reference with calendar for known off-days (`Verlof` / `Ziekte` / conferences).
3. Flag days under the daily target (from `preferences.md`) and days with no logs.
4. Offer to backfill gaps (fall through to workflow A for those dates).

### C. "Help me log today"

1. Ask: "Is your day done?" If not, defer.
2. Run workflow A for today only.
3. After submit, remind about tomorrow's stand-up entry if this is Mon–Thu.

## Mapping — when in doubt, ask

The merged tables across the three config files cover the common cases. When something doesn't match:

- Calendar title doesn't appear in any table → ask the user.
- Repo isn't in your team config's repo→project list → treat the 6-letter prefix as a guess and ask to confirm.
- Two candidate issues for the same event → present both with context and let the user pick.

**Remember answers within and across sessions.** Within a session: if the user maps `Karbon demo → OKRADM-3200` once, don't ask again that conversation. Across sessions: every confirmed resolution gets recorded in `~/.config/tempo-log/learned-mappings.jsonl` via `tempo memory record`. Once a pattern has been confirmed `promote_threshold` times (default 3, set in `preferences.md` frontmatter), workflow A Step 5 surfaces a promotion candidate instead of re-asking.

## Critical behaviours (skill-meta)

- **Ask before submitting.** Per-day confirmation. Never POST without explicit approval. (Personal preference in `preferences.md`.)
- **One day at a time, oldest first.** (Personal preference.)
- **Don't guess mappings.** If the repo or calendar title isn't in any merged table, ask.
- **Remember answers within the session** so the user doesn't get asked twice. Across sessions, `tempo memory record` accumulates confirmations in `learned-mappings.jsonl`; at `promote_threshold` confirmations, surface a promotion candidate — never silently persist.
- **Always confirm promotions.** When a learning-loop candidate is at threshold, present it as `pattern → issue (confirmed N× before)` with three responses: `yes` (edit `preferences.md` + `tempo memory --forget`), `not yet` (use the resolution, count keeps climbing), `never for this pattern` (`tempo memory --suppress`). Never edit `preferences.md` without explicit user approval.
- **If a write fails with attribute errors**, inspect an existing worklog on the same project via `tempo get --json` to copy its `attributes`, then retry. Final fallback: `mcp__atlassian__addWorklogToJiraIssue` (inherits Account; Work Type defaults — fix in Tempo UI later).
- **Never invent an Account or Work Type value.** If unsure, check an existing worklog on the same project or hit `/work-attributes` to list valid values, then confirm with the user.