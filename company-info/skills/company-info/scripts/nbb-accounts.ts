#!/usr/bin/env npx tsx

/**
 * nbb-accounts.ts — Fetch Belgian company info from NBB/BNB Consult, KBO, and Belgisch Staatsblad
 *
 * Usage:
 *   bun run scripts/nbb-accounts.ts search <name> [--postal code]
 *   bun run scripts/nbb-accounts.ts company <enterprise-number>
 *   bun run scripts/nbb-accounts.ts kbo <enterprise-number>
 *   bun run scripts/nbb-accounts.ts filings <enterprise-number> [--limit N]
 *   bun run scripts/nbb-accounts.ts csv <enterprise-number> [--year YYYY]
 *   bun run scripts/nbb-accounts.ts pdf <enterprise-number> [--year YYYY] [--output path]
 *   bun run scripts/nbb-accounts.ts publications <enterprise-number> [--type TYPE]
 */

import { execSync } from "child_process";

const BASE = "https://consult.cbso.nbb.be";

// --- Helpers ---

function normalizeEnterprise(input: string): string {
  // Strip dots, spaces, "BE" prefix — keep 10-digit number
  const digits = input.replace(/[^0-9]/g, "");
  return digits.padStart(10, "0");
}

function usage(): never {
  console.log(`Usage: nbb-accounts.ts <command> [options]

Commands:
  search <name>        Search companies by name [--postal code]
  company <number>     Get company info from NBB (name, address, legal form)
  kbo <number>         Get KBO data (directors, NACE codes, capacities, history)
  filings <number>     List filed annual accounts [--limit N]
  csv <number>         Download accounting data as CSV [--year YYYY]
  pdf <number>         Download annual accounts as PDF [--year YYYY] [--output path]
  publications <number> List Belgisch Staatsblad publications [--type TYPE]

Publication types (--type):
  c01  oprichting          c02  einde/stopzetting    c03  benaming
  c04  maatschappelijke zetel  c05  andere adressen  c06  doel
  c07  kapitaal/aandelen   c08  ontslagen/benoemingen c09  algemene vergadering
  c10  boekjaar            c11  statuten             c12  wijziging rechtsvorm
  c13  herstructurering    c14  jaarrekeningen       c15  diversen
  c16  ambtshalve doorhaling

Enterprise number formats: 0454064819, 0454.064.819, BE0454064819

Examples:
  nbb-accounts.ts search "Statik"
  nbb-accounts.ts search "Bakkerij" --postal 3000
  nbb-accounts.ts company 0454.064.819
  nbb-accounts.ts filings BE0454064819 --limit 3
  nbb-accounts.ts csv 0454064819 --year 2023
  nbb-accounts.ts pdf 0454064819 --year 2023 --output ./jaarrekening.pdf
  nbb-accounts.ts publications 0809205672
  nbb-accounts.ts publications 0809205672 --type c13`);
  process.exit(0);
}

/**
 * Use python playwright to fetch data from the NBB Consult SPA.
 * The API endpoints are protected and require a browser session.
 */
function runPlaywright(script: string): string {
  const py = `import json, sys
from playwright.sync_api import sync_playwright

${script}
`;
  const tmpFile = `/tmp/nbb_pw_${Date.now()}.py`;
  require("fs").writeFileSync(tmpFile, py);
  try {
    return execSync(`python3 "${tmpFile}"`, {
      encoding: "utf-8",
      timeout: 60000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: any) {
    const stderr = err.stderr?.toString() || "";
    if (stderr.includes("playwright") || stderr.includes("ModuleNotFoundError")) {
      console.error("Error: python playwright not installed. Run: pip3 install playwright");
    } else {
      console.error(`Error: ${stderr.slice(0, 500)}`);
    }
    process.exit(2);
  } finally {
    try { require("fs").unlinkSync(tmpFile); } catch {}
  }
}

// --- Search by name (works with direct fetch, no playwright needed) ---

async function search(name: string, postalCode: string) {
  const params = new URLSearchParams({
    companyName: name,
    language: "NL",
    postalCode: postalCode,
    phonetic: "false",
    exact: "false",
  });
  const url = `${BASE}/api/rs-consult/companies/search?${params}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Referer: `${BASE}/`,
      Origin: BASE,
    },
  });
  if (!res.ok) {
    console.error(`Search failed (HTTP ${res.status})`);
    process.exit(1);
  }
  const companies = await res.json() as any[];
  if (companies.length === 0) {
    console.error(`No companies found for "${name}"`);
    process.exit(1);
  }
  // Filter to active companies first, show all if none active
  const active = companies.filter((c: any) => c.legalSituationCode === "000");
  const display = active.length > 0 ? active : companies;

  console.log(`Found ${companies.length} result(s)${active.length < companies.length ? ` (${active.length} active)` : ""}\n`);
  console.log("KBO\t\tName\t\t\tCity\t\tLegal Form\t\tStatus");
  for (const c of display) {
    const status = c.legalSituationCode === "000" ? "Actief" : c.legalSituation;
    console.log(`${c.cbe}\t${c.name}\t${c.town}\t${c.legalForm}\t${status}`);
  }
}

// --- Company info (works with direct fetch, no playwright needed) ---

async function company(cbe: string) {
  const url = `${BASE}/api/rs-consult/companies/${cbe}/NL`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Referer: `${BASE}/`,
      Origin: BASE,
    },
  });
  if (!res.ok) {
    // Try FR
    const resFr = await fetch(`${BASE}/api/rs-consult/companies/${cbe}/FR`, {
      headers: { Accept: "application/json", Referer: `${BASE}/`, Origin: BASE },
    });
    if (!resFr.ok) {
      console.error(`Company not found: ${cbe} (HTTP ${res.status})`);
      process.exit(1);
    }
    console.log(JSON.stringify(await resFr.json(), null, 2));
    return;
  }
  console.log(JSON.stringify(await res.json(), null, 2));
}

// --- Filings list (needs playwright due to WAF) ---

function filings(cbe: string, limit: number) {
  const result = runPlaywright(`
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    deposits = []
    def handle_response(response):
        if "published-deposits" in response.url and response.status == 200:
            try:
                data = response.json()
                if isinstance(data, dict) and "content" in data:
                    deposits.extend(data["content"])
                elif isinstance(data, list):
                    deposits.extend(data)
            except: pass
    page.on("response", handle_response)
    page.goto("${BASE}/consult-enterprise/${cbe}", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(3000)
    browser.close()
    # Sort by year desc
    deposits.sort(key=lambda d: d.get("periodEndDateYear", 0), reverse=True)
    output = deposits[:${limit}]
    print(json.dumps(output, indent=2))
`);
  const data = JSON.parse(result);
  if (data.length === 0) {
    console.error(`No filings found for ${cbe}`);
    process.exit(1);
  }
  // Print summary table
  console.log(`Found ${data.length} filing(s) for ${data[0].enterpriseName || cbe}\n`);
  console.log("Year\tModel\tReference\tDeposit Date\tID");
  for (const d of data) {
    const year = d.periodEndDateYear;
    const model = d.modelName || d.modelId;
    const ref = d.reference;
    const date = d.depositDate?.split("T")[0] || "?";
    console.log(`${year}\t${model}\t${ref}\t${date}\t${d.id}`);
  }
}

// --- CSV download (accounting data) ---

function downloadCsv(cbe: string, year?: number) {
  const result = runPlaywright(`
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    deposits = []
    def handle_response(response):
        if "published-deposits" in response.url and response.status == 200:
            try:
                data = response.json()
                if isinstance(data, dict) and "content" in data:
                    deposits.extend(data["content"])
                elif isinstance(data, list):
                    deposits.extend(data)
            except: pass
    page.on("response", handle_response)
    page.goto("${BASE}/consult-enterprise/${cbe}", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(3000)

    deposits.sort(key=lambda d: d.get("periodEndDateYear", 0), reverse=True)
    target_year = ${year || 0}
    if target_year:
        matches = [d for d in deposits if d.get("periodEndDateYear") == target_year]
        deposit = matches[0] if matches else None
    else:
        deposit = deposits[0] if deposits else None

    if not deposit:
        print(json.dumps({"error": "No filing found"}))
        browser.close()
        sys.exit(0)

    deposit_id = deposit["id"]
    csv_url = f"${BASE}/api/external/broker/public/deposits/consult/csv/{deposit_id}"
    response = page.request.get(csv_url)
    result = {
        "year": deposit.get("periodEndDateYear"),
        "reference": deposit.get("reference"),
        "model": deposit.get("modelName"),
        "enterprise": deposit.get("enterpriseName"),
        "status": response.status,
    }
    if response.status == 200:
        result["csv"] = response.text()
    else:
        result["error"] = f"HTTP {response.status}"
    browser.close()
    print(json.dumps(result, indent=2))
`);
  const data = JSON.parse(result);
  if (data.error) {
    console.error(`Error: ${data.error}`);
    process.exit(1);
  }
  console.log(data.csv);
}

// --- PDF download ---

function downloadPdf(cbe: string, year: number | undefined, outputPath: string) {
  const result = runPlaywright(`
import base64
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    deposits = []
    def handle_response(response):
        if "published-deposits" in response.url and response.status == 200:
            try:
                data = response.json()
                if isinstance(data, dict) and "content" in data:
                    deposits.extend(data["content"])
                elif isinstance(data, list):
                    deposits.extend(data)
            except: pass
    page.on("response", handle_response)
    page.goto("${BASE}/consult-enterprise/${cbe}", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(3000)

    deposits.sort(key=lambda d: d.get("periodEndDateYear", 0), reverse=True)
    target_year = ${year || 0}
    if target_year:
        matches = [d for d in deposits if d.get("periodEndDateYear") == target_year]
        deposit = matches[0] if matches else None
    else:
        deposit = deposits[0] if deposits else None

    if not deposit:
        print(json.dumps({"error": "No filing found"}))
        browser.close()
        sys.exit(0)

    deposit_id = deposit["id"]
    pdf_url = f"${BASE}/api/external/broker/public/deposits/pdf/{deposit_id}"
    response = page.request.get(pdf_url)
    result = {
        "year": deposit.get("periodEndDateYear"),
        "reference": deposit.get("reference"),
        "enterprise": deposit.get("enterpriseName"),
        "status": response.status,
    }
    if response.status == 200:
        result["pdf_base64"] = base64.b64encode(response.body()).decode()
    else:
        result["error"] = f"HTTP {response.status}"
    browser.close()
    print(json.dumps(result))
`);
  const data = JSON.parse(result);
  if (data.error) {
    console.error(`Error: ${data.error}`);
    process.exit(1);
  }
  if (data.pdf_base64) {
    const buf = Buffer.from(data.pdf_base64, "base64");
    const path = outputPath || `jaarrekening_${cbe}_${data.year}.pdf`;
    require("fs").writeFileSync(path, buf);
    console.log(`Downloaded: ${path} (${buf.length} bytes)`);
    console.log(`Enterprise: ${data.enterprise}`);
    console.log(`Year: ${data.year}`);
    console.log(`Reference: ${data.reference}`);
  }
}

// --- KBO Public Search ---

async function kbo(cbe: string) {
  const cbeFormatted = `${cbe.slice(0, 4)}.${cbe.slice(4, 7)}.${cbe.slice(7)}`;
  const url = `https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html?nummer=${cbe}&actionLu=Zoeken`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "text/html",
    },
  });
  if (!res.ok) {
    console.error(`KBO fetch failed (HTTP ${res.status})`);
    process.exit(1);
  }
  const html = await res.text();

  if (html.includes("Foute of ontbrekende parameter") || html.includes("Geen resultaten gevonden")) {
    console.error(`No KBO data found for ${cbe}`);
    process.exit(1);
  }

  // Helper to extract text between patterns
  function extractAfter(text: string, marker: string, endMarker?: string): string {
    const idx = text.indexOf(marker);
    if (idx === -1) return "";
    const start = idx + marker.length;
    const end = endMarker ? text.indexOf(endMarker, start) : start + 500;
    return text
      .substring(start, end === -1 ? start + 500 : end)
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Strip HTML for easier parsing
  const clean = html
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, "\n");

  // Helper: extract cell content from a row
  function cellText(h: string): string {
    return h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  }

  // --- Parse structured data ---
  const result: any = {
    enterpriseNumber: cbeFormatted,
  };

  // Status
  const statusMatch = html.match(/class="pageactief">([^<]+)/);
  result.status = statusMatch?.[1]?.trim() || "";

  // Legal situation + since
  const legalSitMatch = html.match(/Rechtstoestand:[\s\S]*?class="pageactief">([^<]+)[\s\S]*?class="upd">([^<]+)/);
  result.legalSituation = legalSitMatch?.[1]?.trim() || "";
  result.legalSituationSince = legalSitMatch?.[2]?.trim() || "";

  // Start date
  const startMatch = html.match(/Begindatum:<\/td>\s*<td[^>]*>([^<]+)/);
  result.startDate = startMatch?.[1]?.trim() || "";

  // Name + since
  const nameMatch = html.match(/Naam:<\/td>\s*<td[^>]*>([^<]+)/);
  result.name = nameMatch?.[1]?.trim() || "";
  const nameSinceMatch = html.match(/Naam:<\/td>[\s\S]*?class="upd">([^<]+)/);
  result.nameSince = nameSinceMatch?.[1]?.trim() || "";

  // Address
  const addrMatch = html.match(/Adres van de zetel:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/);
  if (addrMatch) {
    const addrLines = addrMatch[1]
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean);
    // Separate address from "Sinds" line
    const sinceIdx = addrLines.findIndex((l: string) => l.toLowerCase().startsWith("sinds"));
    if (sinceIdx !== -1) {
      result.addressSince = addrLines[sinceIdx];
      result.address = addrLines.slice(0, sinceIdx).join(", ");
    } else {
      result.address = addrLines.join(", ");
    }
  }

  // Entity type
  const typeMatch = html.match(/Type entiteit:\s*<\/td>\s*<td[^>]*>([^<]+)/);
  result.entityType = typeMatch?.[1]?.trim() || "";

  // Legal form — extract just the form name, strip footnotes and since date
  const formMatch = html.match(/Rechtsvorm:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/);
  if (formMatch) {
    const formText = formMatch[1]
      .replace(/<sup>[^<]*<\/sup>/g, "")
      .replace(/<span[^>]*>.*?<\/span>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    result.legalForm = formText;
  }

  // Number of establishments
  const veMatch = html.match(/Aantal vestigingseenheden[^<]*<\/td>\s*<td[^>]*>\s*<strong>(\d+)<\/strong>/);
  result.establishments = veMatch ? parseInt(veMatch[1]) : null;

  // Financial info
  const agmMatch = html.match(/Jaarvergadering<\/td>\s*<td[^>]*>\s*([^<]+)/);
  result.annualMeeting = agmMatch?.[1]?.trim() || "";
  const fyMatch = html.match(/Einddatum boekjaar<\/td>\s*<td[^>]*>\s*([^<]+)/);
  result.fiscalYearEnd = fyMatch?.[1]?.trim() || "";

  // --- Directors/Functions ---
  // Pattern: <td>Role<sup>...</sup></td><td> Lastname ,&nbsp; Firstname&nbsp;</td><td><span>Sinds date</span></td>
  const functions: any[] = [];
  const funcSection = html.match(/<h2>Functies<\/h2>([\s\S]*?)(?=<h2>)/);
  if (funcSection) {
    // Match each function row: role td + person td + since td
    const funcRowRegex = /<td[^>]*>((?:Zaakvoerder|Bestuurder|Gedelegeerd bestuurder|Dagelijks bestuur|Commissaris|Vereffenaar)[^<]*(?:<sup>[^<]*<\/sup>)?)\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
    let funcMatch;
    while ((funcMatch = funcRowRegex.exec(funcSection[1])) !== null) {
      const role = funcMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").replace(/\(\d+\)/, "").trim();
      // Person cell: " Van Giel ,&nbsp;  Wannes&nbsp;"
      const personRaw = funcMatch[2].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
      const commaMatch = personRaw.match(/(.+?)\s*,\s*(.+)/);
      const name = commaMatch ? `${commaMatch[2].trim()} ${commaMatch[1].trim()}` : personRaw;
      // Since date
      const sinceMatch = funcMatch[3].match(/Sinds\s+(\d+\s+\w+\s+\d{4})/);
      const since = sinceMatch?.[1] || "";
      functions.push({ role, name, since });
    }
  }
  result.functions = functions;

  // --- Capacities (hoedanigheden) ---
  const capacities: any[] = [];
  const capSection = html.match(/<h2>Hoedanigheden<\/h2>[\s\S]*?(?=<h2>|<\/table>)/);
  if (capSection) {
    const capRegex = /(Werkgever RSZ|Onderworpen aan btw|Inschrijvingsplichtige onderneming|Ambachtelijke onderneming)[\s\S]*?Sinds\s+(\d+\s+\w+\s+\d{4})/gi;
    let capMatch;
    while ((capMatch = capRegex.exec(capSection[0])) !== null) {
      capacities.push({
        type: capMatch[1].trim(),
        since: capMatch[2],
      });
    }
  }
  result.capacities = capacities;

  // --- NACE activity codes (only current version 2025) ---
  const activities: any[] = [];
  const textOnly = html.replace(/<[^>]+>/g, "\n").replace(/&nbsp;/g, " ");
  const naceRegex = /(Btw|RSZ)\s*\n?\s*(2025|2008|2003)\s*\n?\s*([\d.]+)\s*-\s*([^\n]+)/gi;
  let naceMatch;
  while ((naceMatch = naceRegex.exec(textOnly)) !== null) {
    activities.push({
      register: naceMatch[1].trim(),
      version: naceMatch[2],
      code: naceMatch[3].trim(),
      description: naceMatch[4].trim(),
    });
  }
  // Only keep the latest version per register to avoid noise
  const latestActivities = activities.filter(a => a.version === "2025");
  result.activities = latestActivities.length > 0 ? latestActivities : activities;

  // --- Output ---
  console.log(JSON.stringify(result, null, 2));
}

// --- Publications from Belgisch Staatsblad ---

const STAATSBLAD_BASE = "https://www.ejustice.just.fgov.be";

async function publications(cbe: string, type: string) {
  // Fetch all publications from the article page via Bijlage Rechtspersonen
  const cbeShort = cbe.replace(/^0/, "").replace(/\./g, "");
  const articleRes = await fetch(
    `${STAATSBLAD_BASE}/cgi_tsv/article.pl?language=nl&btw_search=${cbeShort}&page=1&la_search=n&caller=list&=0&view_numac=&btw=${cbeShort}`
  );
  if (!articleRes.ok) {
    console.error(`Fetch failed (HTTP ${articleRes.status})`);
    process.exit(1);
  }
  const html = await articleRes.text();

  // Parse the company name from the article page
  const nameMatch = html.match(/<font color=blue>([^<]+)<\/font>\s*&nbsp;&nbsp;(\w+)/);
  const companyName = nameMatch ? `${nameMatch[1]} ${nameMatch[2]}` : cbe;

  // Parse publications: each entry is between <br><hr> separators
  // Format: "DESCRIPTION \n DATE / NUMBER   BEELD link"
  const contentMatch = html.match(/<p><font color=blue>[\s\S]*?<\/p>/);
  if (!contentMatch) {
    console.error("No publications found");
    process.exit(1);
  }
  const content = contentMatch[0];

  // Split on <hr> to get individual entries
  const entries = content.split(/<br><hr>/).slice(1); // skip the header

  interface Publication {
    description: string;
    date: string;
    number: string;
    pdfUrl: string | null;
  }

  const pubs: Publication[] = [];
  for (const entry of entries) {
    const clean = entry
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) continue;

    // Extract date/number pattern: YYYY-MM-DD / NNNNNNN
    const dateMatch = clean.match(/(\d{4}-\d{2}-\d{2})\s*\/\s*(\d+)/);
    // Extract PDF link
    const pdfMatch = entry.match(/href="(\/tsv_pdf\/[^"]+)"/);
    // Description is everything before the date
    const desc = dateMatch
      ? clean.substring(0, clean.indexOf(dateMatch[0])).trim()
      : clean;

    if (dateMatch) {
      pubs.push({
        description: desc.replace(/BEELD\s*$/, "").trim(),
        date: dateMatch[1],
        number: dateMatch[2],
        pdfUrl: pdfMatch ? `${STAATSBLAD_BASE}${pdfMatch[1]}` : null,
      });
    }
  }

  if (pubs.length === 0) {
    console.error(`No publications found for ${cbe}`);
    process.exit(1);
  }

  // Sort newest first
  pubs.sort((a, b) => b.date.localeCompare(a.date));

  // Client-side type filtering
  const typeLabels: Record<string, string> = {
    c01: "OPRICHTING", c02: "EINDE", c03: "BENAMING", c04: "MAATSCHAPPELIJKE ZETEL",
    c05: "ADRES", c06: "DOEL", c07: "KAPITAAL", c08: "ONTSLAGEN",
    c09: "ALGEMENE VERGADERING", c10: "BOEKJAAR", c11: "STATUTEN",
    c12: "WIJZIGING RECHTSVORM", c13: "HERSTRUCTURERING", c14: "JAARREKENING",
    c15: "DIVERSEN", c16: "AMBTSHALVE DOORHALING",
  };
  if (type && typeLabels[type]) {
    const keyword = typeLabels[type];
    const filtered = pubs.filter(p => p.description.toUpperCase().includes(keyword));
    if (filtered.length === 0) {
      console.error(`No publications matching type ${type} (${keyword})`);
      process.exit(1);
    }
    pubs.length = 0;
    pubs.push(...filtered);
  }

  console.log(`${pubs.length} publication(s) for ${companyName}\n`);
  console.log("Date\t\tNumber\t\tDescription\t\t\t\t\t\tPDF");
  for (const p of pubs) {
    const pdf = p.pdfUrl ? "✓" : "";
    console.log(`${p.date}\t${p.number}\t${p.description}\t${pdf}`);
  }
}

// --- CLI Router ---

const args = process.argv.slice(2);
const [command, ...rest] = args;

if (!command || command === "--help" || command === "help") usage();

// Search takes a name, not a KBO number
if (command === "search") {
  const name = rest[0];
  if (!name) {
    console.error("Error: company name required");
    process.exit(1);
  }
  const postalIdx = rest.indexOf("--postal");
  const postalCode = postalIdx !== -1 ? rest[postalIdx + 1] : "";
  await search(name, postalCode);
  process.exit(0);
}

const cbeRaw = rest[0];
if (!cbeRaw) {
  console.error("Error: enterprise number required");
  process.exit(1);
}
const cbe = normalizeEnterprise(cbeRaw);

const limitIdx = rest.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(rest[limitIdx + 1]) : 10;

const yearIdx = rest.indexOf("--year");
const year = yearIdx !== -1 ? parseInt(rest[yearIdx + 1]) : undefined;

const outputIdx = rest.indexOf("--output");
const output = outputIdx !== -1 ? rest[outputIdx + 1] : "";

const typeIdx = rest.indexOf("--type");
const pubType = typeIdx !== -1 ? rest[typeIdx + 1] : "";

switch (command) {
  case "company":
    await company(cbe);
    break;
  case "kbo":
    await kbo(cbe);
    break;
  case "filings":
    filings(cbe, limit);
    break;
  case "csv":
    downloadCsv(cbe, year);
    break;
  case "pdf":
    downloadPdf(cbe, year, output);
    break;
  case "publications":
    await publications(cbe, pubType);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    usage();
}
