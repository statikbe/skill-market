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

## Gather fork

Workflow A's evidence-gathering stage runs in a forked Agent call rather than inline in the main conversation. The fork reads all configs, runs every gather query (calendar / git / Tempo / JQL) with internal parallelism, applies merged-table mapping, and writes a structured JSON file. Main agent reads from disk on demand for per-day rendering and edits the file in place when the user adjusts rows.

### Output file

`/tmp/tempo-gather-<from>-<to>.json` (predictable path so it can be re-found across the session).

### When to dispatch

Workflow A Step 3 dispatches the fork once per session, after the user has confirmed a date range. Adjustments do not re-dispatch. If the user changes the date range, the fork is re-dispatched and the file is overwritten.

### Fork prompt

Main agent assembles the prompt at dispatch time, substituting `<name>`, `<id>`, `<from>`, `<to>`, `<Nh>`, `<team_config>` from `preferences.md`. The literal prompt is:

```
You are gathering tempo-log evidence for a Statik backfill.
User: <name> (accountId <id>). Range: <from> to <to>. Daily target: <Nh>.

Read these in order, applying priority rule (personal > team > org):
  1. <skill-dir>/tkk-config.md
  2. <skill-dir>/<team_config>, then ~/.config/tempo-log/<team_config>
     overlay if present
  3. ~/.config/tempo-log/preferences.md

Then in one parallel tool turn, run:
  - tempo get <from> <to> --json
  - tempo-git-scan <from> <to>  (env: GIT_SCAN_AUTHORS, GIT_SCAN_PARENTS,
    GIT_SCAN_SKIP from preferences.md)
  - mcp__claude_ai_Google_Calendar__list_events for the range, primary
    calendar; exclude needsAction; exclude location markers + personal
    exclusions per the merged tables.

For each calendar event that doesn't resolve via the merged tables,
run in parallel:
  - mcp__atlassian__searchJiraIssuesUsingJql with
    assignee=currentUser() AND updated in [event_date-1d, event_date+1d],
    LIMIT 10
  - tempo memory check --category oneonone --pattern "<event title>"

Apply the merged-table mappings to produce candidate rows:
  - Calendar event title → issue: match against calendar_to_issue and
    recurring_meetings tables (exact string first, then case-insensitive
    substring for recurring patterns).
  - Repo basename in commits → project: use repo_to_project.
  - Commits without an explicit issue tag → infer from project context if
    exactly one open issue is active for that project in the range;
    otherwise route to ambiguous[].
  - Existing worklogs (from `tempo get`) → fold into existing_logged_h
    per day; do not duplicate as candidates.
  - Calendar items matching a 1:1 pattern with count >= promote_threshold
    and suppress_promotion != true → promotion_candidates[].
  - Anything else that doesn't resolve cleanly → ambiguous[].

Write the result as a single JSON object to
/tmp/tempo-gather-<from>-<to>.json matching the schema below. Validate
JSON before writing. Return ONLY a summary object:
  {"path": "...", "days_count": N, "total_candidates": M, "warnings_count": K}.

Do not present anything to the user. Do not submit anything.
```

### Output schema (the JSON file)

```json
{
  "session": {
    "from": "YYYY-MM-DD",
    "to": "YYYY-MM-DD",
    "user_account_id": "...",
    "created_at": "ISO-8601"
  },
  "days": [
    {
      "date": "YYYY-MM-DD",
      "weekday": "Mon",
      "existing_logged_h": 3.5,
      "gap_h": 4.5,
      "locked_in": false,
      "candidates": [
        {"row": 1, "time": "08:00", "issue": "OKRADM-3121",
         "hours": 1.0, "desc": "...", "source": "calendar+git",
         "account_hint": "OKRADMACC"}
      ],
      "promotion_candidates": [
        {"pattern": "Karbon demo", "proposed_issue": "OKRADM-3200",
         "count": 3, "row_position_hint": 4}
      ],
      "ambiguous": [
        {"time": "11:00", "title": "Sleutelen aan AI & coffee",
         "jql_candidates": [{"key": "OKRADM-3145", "summary": "..."}]}
      ]
    }
  ],
  "mapping_context": {
    "calendar_to_issue": {"Rhino DM": "INTUNI-27"},
    "repo_to_project":  {"okradm": "OKRADM"},
    "recurring_meetings": [
      {"pattern": "Rhino DM", "duration": "15m", "issue": "INTUNI-27"}
    ],
    "personal_exclusions": ["Office", "Bureau", "Home"],
    "guild_issues": {"INTKNS": ["INTKNS-23", "INTKNS-42"]},
    "account_categories": {"OPEN": "...", "CLOSED": "..."}
  },
  "warnings": []
}
```

### Boundary

- Fork's JSON file is the only thing crossing back into main context.
- Configs are read by the fork only; main agent reads `preferences.md` for user-facing prefs.
- Fork is one-shot per session.
- Learning-loop **writes** (`tempo memory record`, `--forget`, `--suppress`) stay in main agent so they fire at user-confirmation time.

### Token budget guardrails

Warn at JSON file size > 200KB. Refuse at > 500KB and ask user to narrow the range.

## Step 0 — load configuration (first action of every workflow run)

Configuration is split between main agent (the conversation you're in) and the gather fork (the subagent dispatched by Workflow A Step 3).

### Step 0a — main agent reads `preferences.md` only

Read `~/.config/tempo-log/preferences.md`.
- If missing → stop and tell the user to run `tempo install` and then edit `~/.config/tempo-log/preferences.md`.
- From its frontmatter, take the value of `team_config` (e.g. `rhino-config.md`) — needed when assembling the fork prompt in Step 3.
- Note user-facing prefs: granularity, daily target, default Work Type, behaviour preferences, `promote_threshold`.

Main agent does **not** read team config or `tkk-config.md`. Those are read by the fork. If main agent needs mapping context mid-loop (e.g., user adds a row for an unmapped event), it pulls from the fork's `mapping_context` payload in the on-disk JSON.

### Step 0b — fork reads configs

The gather fork (Workflow A Step 3) reads `tkk-config.md`, the team config (with personal overlay), and `preferences.md` itself. It applies the priority rule (personal > team > org) and produces the merged tables internally. See `## Gather fork` for the full prompt.

The fork inspects the three `git-scan` env vars (`GIT_SCAN_AUTHORS`, `GIT_SCAN_PARENTS`, `GIT_SCAN_SKIP`) from `preferences.md` and exports them when invoking `tempo-git-scan`.

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
tempo memory --learned                 print learned-mappings JSONL (sorted by count desc)
tempo memory --forget <pattern>        remove all rows with this exact title_pattern
tempo memory --suppress <pattern>      mark rows with this title_pattern as never-promote
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

3. **Dispatch the gather fork.** Single Agent() call, no `subagent_type` (so it's a fork — inherits prompt cache). The prompt is the literal block in `## Gather fork → Fork prompt`, with `<name>`, `<id>`, `<from>`, `<to>`, `<Nh>`, `<team_config>` substituted from `preferences.md`.
   - The fork reads all configs (Step 0b), runs the gather queries with internal parallelism, applies merged-table mapping, runs JQL ambiguity searches and `tempo memory check` for unmapped events, and writes the structured JSON file to `/tmp/tempo-gather-<from>-<to>.json`.
   - The fork returns only `{path, days_count, total_candidates, warnings_count}`. Do not expect the full JSON in the fork's response.
   - If the fork errors or returns malformed JSON twice in a row, fall through to `### Fallback: inline gather` below.
   - On non-empty `warnings[]` (read from the file), surface them to the user before proceeding.

4. **(Folded into the fork.)** Per-day computation — existing hours, gap, candidate rows, promotion candidates, ambiguous items — happens inside the fork. Main agent reads from the on-disk JSON in Step 5 and does not recompute.

5. **Render one day at a time from the on-disk JSON, oldest first.** Read only `days[i]` for the day you're presenting (not the whole file). Format unchanged from before:

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

   Source of the rendered values: `days[i].candidates`, `days[i].promotion_candidates`, `days[i].ambiguous`. Compute `Already logged` from `days[i].existing_logged_h` and `Gap` from `days[i].gap_h`.

6. **Per-day approval loop.** The user can:
   - Approve (`ok`, `looks good`, `yes`).
   - Adjust by row number ("change #3 to OKRADM-3108", "drop #4", "merge #1 and #5", "bump #3 to 2h").
   - Suggest issues for ambiguous items.
   - Respond to promotion candidates: `yes`, `not yet`, or `never for this pattern`.

   **Adjustments edit the JSON file in place.** Use the `Edit` tool on `/tmp/tempo-gather-<from>-<to>.json` to change one row at a time — modify the relevant `days[i].candidates[j]` object (or remove it for "drop", or insert a new one for additions). After every Edit, re-Read the file and verify it parses as JSON (e.g., `python3 -c "import json,sys; json.load(open(sys.argv[1]))" /tmp/tempo-gather-<from>-<to>.json`). On parse failure, abort the edit and re-Edit from a fresh Read.

   **Confirm with a one-line ack.** "OK, #3 → OKRADM-3108." Do **not** re-render the day's table after each adjustment. Re-render only when the user explicitly asks ("show me the day again").

   **After the user resolves any item that came from a learning-loop category** (1:1 meetings, freeform calendar titles), record the resolution so the count climbs:
   ```bash
   tempo memory record --category oneonone --pattern "<title>" --resolved-to <ISSUE-KEY>
   ```
   This includes promotion-candidate responses — record on every confirmation, not only at threshold. Then handle the promotion response, if any:
   - **`yes`** — edit `preferences.md` to add a row to the 1:1 mappings table (or the appropriate section); then `tempo memory --forget "<pattern>"` to remove the JSONL row. Future sessions match from `preferences.md` directly.
   - **`not yet`** — nothing extra; the count increments via the `record` call above and the prompt re-fires next session at threshold.
   - **`never for this pattern`** — `tempo memory --suppress "<pattern>"`. Skill still uses the resolution for the current session but never re-prompts.

   **Lock the day in.** When the user signals the day is done, show a clean final summary read fresh from disk:

   ```
   Locking in Mon 2026-04-15: 4 entries, 4.50h. OK?
   ```

   On confirm: `Edit` the file to set `days[i].locked_in = true`. Verify the edit parses. Advance to the next day.

   Only proceed to the next day once the user has confirmed lock-in.

7. **After all days are locked in**, submit via `tempo batch`:
   - Read `/tmp/tempo-gather-<from>-<to>.json` once. From `days[]` where `locked_in == true`, build a JSONL file at `/tmp/worklogs-<from>-<to>.jsonl`. Each line: `{"issue": "<KEY>", "date": "...", "time": "...", "duration": "<Nh>", "account": "...", "desc": "..."}`. Use `issueKey` as the alias so `JIRA_API_TOKEN` isn't needed. Account comes from each candidate's `account_hint`; if missing, fall through to `tempo last-account <prefix>` / `tempo accounts <prefix>` (ask if ambiguous).
   - Run `tempo batch /tmp/worklogs-<from>-<to>.jsonl`. Summary on stderr reports `N ok, M failed`.
   - For any `ok: false` entries in the NDJSON output, inspect the `error`/`body` field. On "Account closed or archived", ask for a replacement and retry **only the failed rows** (filter the NDJSON for `ok: false`, build a retry JSONL, re-run). Never re-run the whole input file — `tempo batch` is not idempotent.
   - Verify totals with `tempo summary <from> <to>` (or `tempo get <from> <to>`).

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