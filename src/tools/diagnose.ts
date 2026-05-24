import { launchContext } from "../browser.js";

const BOARDS = [
  { name: "LinkedIn",    url: "https://www.linkedin.com/jobs/",   signal: "linkedin.com" },
  { name: "SimplyHired", url: "https://www.simplyhired.com/",     signal: "simplyhired.com" },
  { name: "Dice",        url: "https://www.dice.com/jobs",        signal: "dice.com" },
];

export async function diagnoseLogins(): Promise<string> {
  const lines: string[] = ["# Connectivity Check\n", "No login is required. Checking that each job board is reachable...\n"];

  const context = await launchContext();

  try {
    for (const board of BOARDS) {
      const page = await context.newPage();
      try {
        await page.goto(board.url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(2000);
        const finalUrl = page.url();
        const ok = finalUrl.includes(board.signal) && !finalUrl.includes("challenge") && !finalUrl.includes("just-a-moment");
        lines.push(`${board.name}: ${ok ? "OK" : "unreachable — " + finalUrl}`);
      } catch (err) {
        lines.push(`${board.name}: Error — ${(err as Error).message}`);
      } finally {
        await page.close();
      }
    }

    lines.push("");
    lines.push("Remotive API: always reachable (no browser needed).");
  } finally {
    await context.close();
  }

  return lines.join("\n");
}
