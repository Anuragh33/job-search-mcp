import { chromium } from "playwright";
import os from "os";
import path from "path";

function getChromePath(): string {
  const home = os.homedir();
  switch (os.platform()) {
    case "darwin": return path.join(home, "Library/Application Support/Google/Chrome");
    case "win32": return path.join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/User Data");
    default: return path.join(home, ".config/google-chrome");
  }
}

export async function checkSetup(): Promise<{ ready: boolean; report: string }> {
  const lines: string[] = [];
  let allGood = true;

  lines.push("# Job Search MCP — Setup Checklist\n");

  // 1. Check Node version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1));
  if (nodeMajor >= 20) {
    lines.push(`✅ Node.js ${nodeVersion} — OK`);
  } else {
    lines.push(`❌ Node.js ${nodeVersion} — needs v20 or higher (https://nodejs.org)`);
    allGood = false;
  }

  // 2. Check Chrome profile exists
  const chromePath = getChromePath();
  const { existsSync } = await import("fs");
  if (existsSync(chromePath)) {
    lines.push(`✅ Chrome profile found at: ${chromePath}`);
  } else {
    lines.push(`❌ Chrome not found at: ${chromePath}`);
    lines.push(`   → Install Google Chrome: https://www.google.com/chrome`);
    allGood = false;
  }

  // 3. Check Playwright can launch
  let playwrightOk = false;
  try {
    const ctx = await chromium.launchPersistentContext("", {
      headless: true,
      args: ["--no-sandbox"],
    });
    await ctx.close();
    playwrightOk = true;
    lines.push("✅ Playwright + Chromium — OK");
  } catch {
    lines.push("❌ Playwright Chromium not installed");
    lines.push("   → Run: npx playwright install chromium");
    allGood = false;
  }

  // 4. Login checklist (manual — we can't verify without navigating)
  lines.push("\n## Chrome Login Checklist");
  lines.push("Make sure you are logged in to each of these in Google Chrome:");
  lines.push("  🔲 LinkedIn     → https://www.linkedin.com/login");
  lines.push("  🔲 Indeed       → https://secure.indeed.com/auth");
  lines.push("  🔲 ZipRecruiter → https://www.ziprecruiter.com/login");
  lines.push("  🔲 Glassdoor    → https://www.glassdoor.com/profile/login_input.htm");

  lines.push("\n## Important");
  lines.push("⚠️  Close Google Chrome BEFORE running a job search.");
  lines.push("   The tool borrows your Chrome session — Chrome must not be open.");

  if (allGood && playwrightOk) {
    lines.push("\n✅ Everything looks good! You're ready to search for jobs.");
    lines.push('Try: "Look at my resume and find matching jobs posted in the last 24 hours"');
  } else {
    lines.push("\n⚠️  Fix the issues above, then run check_setup again.");
  }

  return { ready: allGood, report: lines.join("\n") };
}
