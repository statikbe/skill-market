#!/usr/bin/env bun

/**
 * nmbs.ts — Look up Belgian train connections and live departures via iRail API
 *
 * Usage:
 *   bun run scripts/nmbs.ts route <from> <to> [--time HH:MM] [--date DD/MM/YY] [--results N]
 *   bun run scripts/nmbs.ts departures <station> [--limit N]
 *   bun run scripts/nmbs.ts stations [<query>]
 */

const BASE = "https://api.irail.be";
const HEADERS = { Accept: "application/json", "User-Agent": "pi-nmbs-skill/1.0" };

async function apiGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "nl");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) {
    const text = await res.text();
    console.error(`API error ${res.status}: ${text.slice(0, 300)}`);
    process.exit(2);
  }
  return res.json();
}

function formatTime(ts: string): string {
  const d = new Date(parseInt(ts) * 1000);
  return d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}u${m.toString().padStart(2, "0")}` : `${m} min`;
}

function formatDelay(delay: string | undefined): string {
  if (!delay || delay === "0") return "";
  const mins = parseInt(delay) / 60;
  return ` (+${mins} min vertraging)`;
}

function cancelledTag(cancelled: string | undefined): string {
  return cancelled === "1" ? " ❌ AFGESCHAFT" : "";
}

// --- Commands ---

async function route(args: string[]) {
  const flags: Record<string, string> = {};
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--time" && args[i + 1]) { flags.time = args[++i]; continue; }
    if (args[i] === "--date" && args[i + 1]) { flags.date = args[++i]; continue; }
    if (args[i] === "--results" && args[i + 1]) { flags.results = args[++i]; continue; }
    positionals.push(args[i]);
  }

  const from = positionals[0];
  const to = positionals[1];
  if (!from || !to) {
    console.error("Usage: nmbs.ts route <from> <to> [--time HH:MM] [--date DD/MM/YY] [--results N]");
    process.exit(1);
  }

  const params: Record<string, string> = { from, to };
  if (flags.time) params.time = flags.time;
  if (flags.date) params.date = flags.date;
  if (flags.results) params.results = flags.results;

  const data = await apiGet("/connections/", params);
  const connections = data.connection;

  if (!connections || connections.length === 0) {
    console.log(`Geen verbindingen gevonden van ${from} naar ${to}.`);
    return;
  }

  console.log(`\n🚂 ${from} → ${to}\n`);

  for (const conn of connections) {
    const dep = formatTime(conn.departure.time);
    const arr = formatTime(conn.arrival.time);
    const dur = formatDuration(parseInt(conn.duration));
    const depDelay = formatDelay(conn.departure.delay);
    const arrDelay = formatDelay(conn.arrival.delay);
    const cancelled = cancelledTag(conn.departure.canceled);
    const transfers = parseInt(conn.vias?.number ?? "0");
    const platform = conn.departure.platform ? `  spoor ${conn.departure.platform}` : "";

    console.log(`  ${dep}${depDelay} → ${arr}${arrDelay}  (${dur}, ${transfers === 0 ? "rechtstreeks" : `${transfers} overstap${transfers > 1 ? "pen" : ""}`})${platform}${cancelled}`);

    // Show transfer details
    if (conn.vias && conn.vias.via) {
      const vias = Array.isArray(conn.vias.via) ? conn.vias.via : [conn.vias.via];
      for (const via of vias) {
        const viaArr = formatTime(via.arrival.time);
        const viaDep = formatTime(via.departure.time);
        const viaDelay = formatDelay(via.arrival.delay);
        console.log(`    ↳ overstap ${via.stationinfo.standardname}: aankomst ${viaArr}${viaDelay}, vertrek ${viaDep} (spoor ${via.departure.platform || "?"})`);
      }
    }
  }
  console.log();
}

async function departures(args: string[]) {
  const flags: Record<string, string> = {};
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) { flags.limit = args[++i]; continue; }
    positionals.push(args[i]);
  }

  const station = positionals[0];
  if (!station) {
    console.error("Usage: nmbs.ts departures <station> [--limit N]");
    process.exit(1);
  }

  const data = await apiGet("/liveboard/", { station });
  const deps = data.departures?.departure;

  if (!deps || deps.length === 0) {
    console.log(`Geen vertrektijden gevonden voor ${station}.`);
    return;
  }

  const limit = parseInt(flags.limit || "10");
  const shown = deps.slice(0, limit);

  console.log(`\n🚉 Vertrekken vanuit ${data.stationinfo.standardname}\n`);
  console.log("  Tijd       Spoor  Bestemming");
  console.log("  " + "─".repeat(50));

  for (const dep of shown) {
    const time = formatTime(dep.time);
    const delay = formatDelay(dep.delay);
    const timeCol = `${time}${delay}`.padEnd(25);
    const platform = (dep.platform || "?").padEnd(5);
    const dest = dep.stationinfo.standardname;
    const cancelled = cancelledTag(dep.canceled);
    console.log(`  ${timeCol} ${platform}  ${dest}${cancelled}`);
  }
  console.log();
}

async function stations(args: string[]) {
  const query = args[0];
  const data = await apiGet("/stations/");
  let stations = data.station;

  if (query) {
    const q = query.toLowerCase();
    stations = stations.filter((s: any) => s.standardname.toLowerCase().includes(q));
  }

  if (stations.length === 0) {
    console.log(`Geen stations gevonden${query ? ` voor "${query}"` : ""}.`);
    return;
  }

  const shown = stations.slice(0, 20);
  for (const s of shown) {
    console.log(s.standardname);
  }
  if (stations.length > 20) {
    console.log(`\n... en ${stations.length - 20} meer. Verfijn je zoekopdracht.`);
  }
}

// --- Router ---

const [command, ...rawArgs] = process.argv.slice(2);

switch (command) {
  case "route":       await route(rawArgs); break;
  case "departures":  await departures(rawArgs); break;
  case "stations":    await stations(rawArgs); break;
  case "help":
  case "--help":
  case undefined:
    console.log(`Usage: nmbs.ts <command> [args]

Commands:
  route <from> <to>       Zoek verbindingen (--time HH:MM, --date DD/MM/YY, --results N)
  departures <station>    Live vertrektijden (--limit N)
  stations [<query>]      Zoek stations op naam

Examples:
  nmbs.ts route "Leuven" "Brussel-Zuid"
  nmbs.ts route "Gent-Sint-Pieters" "Antwerpen-Centraal" --time 08:30
  nmbs.ts departures "Brussel-Centraal" --limit 5
  nmbs.ts stations "Brussel"`);
    break;
  default:
    console.error(`Onbekend commando: ${command}`);
    process.exit(1);
}
