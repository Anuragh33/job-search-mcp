import { chromium, BrowserContext } from "playwright";
import os from "os";
import path from "path";

// Dedicated profile dir — Playwright owns this, not Chrome
export const PROFILE_DIR = path.join(os.homedir(), ".job-search-mcp-sessions");

export async function launchContext(): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  // Remove webdriver fingerprint from every page
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
  });

  return context;
}
