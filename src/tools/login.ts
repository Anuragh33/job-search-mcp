import { chromium } from "playwright";
import { PROFILE_DIR } from "../browser.js";

const BOARDS = [
  { name: "LinkedIn",     loginUrl: "https://www.linkedin.com/login",                     checkUrl: "linkedin.com/feed" },
  { name: "Indeed",       loginUrl: "https://secure.indeed.com/auth",                     checkUrl: "indeed.com" },
  { name: "ZipRecruiter", loginUrl: "https://www.ziprecruiter.com/login",                 checkUrl: "ziprecruiter.com" },
  { name: "Glassdoor",    loginUrl: "https://www.glassdoor.com/profile/login_input.htm",  checkUrl: "glassdoor.com/member" },
];

export async function loginSetup(): Promise<string> {
  const lines: string[] = [
    "Opening browser for login setup.",
    "A browser window will open. Log into each site when prompted, then close the tab.",
    "",
  ];

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  for (const board of BOARDS) {
    const page = await context.newPage();
    await page.goto(board.loginUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    lines.push(`➡️  ${board.name}: Please log in now in the browser window.`);

    // Wait up to 3 minutes for user to log in
    try {
      await page.waitForURL((url) => url.href.includes(board.checkUrl), { timeout: 180000 });
      lines.push(`✅ ${board.name}: Login detected.`);
    } catch {
      lines.push(`⚠️  ${board.name}: Login not confirmed (timed out). You can re-run login_setup anytime.`);
    }

    await page.close();
  }

  await context.close();

  lines.push("");
  lines.push("Login setup complete. Sessions are saved — you won't need to log in again unless cookies expire.");
  lines.push("Run diagnose_logins to verify, then search_jobs to start searching.");

  return lines.join("\n");
}
