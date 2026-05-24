import { chromium, BrowserContext } from "playwright";
import os from "os";
import path from "path";

function getChromePath(): string {
  const home = os.homedir();
  switch (os.platform()) {
    case "darwin":
      return path.join(home, "Library/Application Support/Google/Chrome");
    case "win32":
      return path.join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/User Data");
    default:
      return path.join(home, ".config/google-chrome");
  }
}

export async function launchContext(): Promise<BrowserContext> {
  const args = [
    "--no-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
  ];

  try {
    return await chromium.launchPersistentContext(getChromePath(), {
      headless: true,
      args,
      ignoreDefaultArgs: ["--enable-automation"],
    });
  } catch {
    // Chrome profile is locked (Chrome is open) — use fresh session
    return await chromium.launchPersistentContext("", { headless: true, args });
  }
}
