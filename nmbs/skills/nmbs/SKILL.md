---
name: nmbs
description: >
  Look up Belgian train schedules, connections, and live departures via NMBS/SNCB
  (iRail API). Use when searching train routes between Belgian stations, checking
  departure times, finding transfer details, or looking up station names. Triggers
  on: "trein van X naar Y", "wanneer vertrekt de trein", "train from X to X",
  "NMBS", "SNCB", "treintijden", "spoorwegen", "welke trein", "volgende trein",
  "departures", "overstappen", "treinverbinding", "is er een rechtstreekse trein".
---

# NMBS Train Schedules

Look up Belgian train connections and live departures via the iRail API.
No API key needed.

## Key Commands

```bash
# Find connections between two stations
npx tsx ${CLAUDE_PLUGIN_ROOT}/skills/nmbs/scripts/nmbs.ts route <from> <to> [--time HH:MM] [--date DD/MM/YY] [--results N]

# Live departure board for a station
npx tsx ${CLAUDE_PLUGIN_ROOT}/skills/nmbs/scripts/nmbs.ts departures <station> [--limit N]

# Search station names
npx tsx ${CLAUDE_PLUGIN_ROOT}/skills/nmbs/scripts/nmbs.ts stations [<query>]
```

## Workflow

1. If the user asks for a connection: use `route` with from/to station names
2. If the user asks about departures from a station: use `departures`
3. If unsure about exact station name: use `stations <query>` first to find it
4. Use `--time` and `--date` when the user asks about a specific time
5. Default results show the next connections from now

## Station Names

Use the official station names (Dutch). Common ones:
- Brussel-Centraal, Brussel-Zuid, Brussel-Noord
- Gent-Sint-Pieters, Antwerpen-Centraal, Leuven
- Brugge, Oostende, Mechelen, Hasselt, Luik-Guillemins

When unsure, search first: `nmbs.ts stations "brussel"`

## Output

The script shows departure/arrival times, duration, number of transfers,
platform numbers, delays, and cancellations. Transfer details show the
intermediate station with arrival/departure times and platform.

## Constraints

- Only covers Belgian railways (NMBS/SNCB)
- Some international connections may show if they pass through Belgium
- Real-time delay info depends on iRail data availability
