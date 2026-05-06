import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const venuesPath = path.resolve(__dirname, "../src/data/venues.json");
const summaryPath = path.resolve(__dirname, "../venue-deals-summary.md");

const venues = JSON.parse(await fs.readFile(venuesPath, "utf8"));

const notes = [
  "Hours are blank where the workbook did not provide a time window.",
  "Legends Bar uses the Ballers Clubhouse deal listing because the workbook explicitly references it.",
  "GFC and Eastea use the David's Master Pot deal listing because the workbook explicitly references it.",
  "Mr Kim's is marked active in the workbook, but the workbook does not include a deal or hours entry for it.",
];

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

const lines = [
  "# AUES Pub Crawl Venue Deals Summary",
  "",
  "Event: AUES Pub Crawl: Scooby Brew: Mystery Intoxicated  ",
  "Date: 8 May 2026",
  "",
  "This summary reflects the venues highlighted green in the workbook. Deals, hours, addresses, and capacities have been pulled from the spreadsheet, with blank hours left blank when the workbook did not provide them.",
  "",
  "| Venue | Address | Capacity | Deals | Hours |",
  "|---|---|---:|---|---|",
  ...venues.map((venue) => {
    const deals = escapeCell(venue.deals.join("; "));
    return `| ${escapeCell(venue.name)} | ${escapeCell(venue.address)} | ${escapeCell(venue.capacity)} | ${deals} | ${escapeCell(venue.hours)} |`;
  }),
  "",
  "## Notes",
  "",
  ...notes.map((note) => `- ${note}`),
  "",
];

await fs.writeFile(summaryPath, lines.join("\n"), "utf8");
console.log(`Updated ${path.relative(process.cwd(), summaryPath)} from ${path.relative(process.cwd(), venuesPath)}`);
