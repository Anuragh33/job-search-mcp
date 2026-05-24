import { launchContext, PROFILE_DIR } from "../browser.js";
import { existsSync } from "fs";

const BOARDS = [
  { name: "LinkedIn",     url: "https://www.linkedin.com/feed/",         loggedInSignal: "feed" },
  { name: "Indeed",       url: "https://www.indeed.com/",                loggedInSignal: "indeed.com" },
  { name: "ZipRecruiter", url: "https://www.ziprecruiter.com/",          loggedInSignal: "ziprecruiter.com" },
  { name: "Glassdoor",    url: "https://www.glassdoor.com/member/home/", loggedInSignal: "member/home" },
];

export async function diagnoseLogins(): Promise<string> {
  const lines: string[] = ["# Login Diagnostics\n"];

  if (!existsSync(PROFILE_DIR)) {
    lines.push("⚠️  No saved sessions found. Run login_setup first.");
    return lines.join("\n");
  }

  const context = await launchContext();

  try {
    for (const board of BOARDS) {
      const page = await context.newPage();
      try {
        await page.goto(board.url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(2000);

        const finalUrl = page.url();
        const title = await page.title();
        const isLoggedIn =
          finalUrl.includes(board.loggedInSignal) &&
          !finalUrl.includes("login") &&
          !finalUrl.includes("signin") &&
          !finalUrl.includes("authwall");

        lines.push(`## ${board.name}`);
        lines.push(`- Status: ${isLoggedIn ? "✅ Logged in" : "❌ NOT logged in"}`);
        lines.push(`- Final URL: ${finalUrl}`);
        lines.push(`- Page title: ${title}`);
        lines.push("");
      } catch (err) {
        lines.push(`## ${board.name}`);
        lines.push(`- Status: ❌ Error — ${(err as Error).message}`);
        lines.push("");
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
  }

  lines.push("If any board shows NOT logged in:");
  lines.push("1. Open Google Chrome");
  lines.push("2. Log into that site");
  lines.push("3. Fully quit Chrome (Cmd+Q on Mac, not just close the window)");
  lines.push("4. Run diagnose_logins again");

  return lines.join("\n");
}
