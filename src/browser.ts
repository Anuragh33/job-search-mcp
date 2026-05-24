import { chromium, BrowserContext } from "playwright";
import os from "os";
import path from "path";
import { existsSync } from "fs";

function getUserDataDir(): string {
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

function getChromeExecutable(): string | undefined {
  const candidates: string[] = [];

  if (os.platform() === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else if (os.platform() === "win32") {
    candidates.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    );
  }

  return candidates.find(existsSync);
}

export async function launchContext(): Promise<BrowserContext> {
  const userDataDir = getUserDataDir();
  const executablePath = getChromeExecutable();

  const args = [
    "--no-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    "--disable-features=IsolateOrigins,site-per-process",
  ];

  const baseOptions = {
    headless: false,          // visible window — bypasses bot detection on Indeed/Glassdoor/ZipRecruiter
    args,
    ignoreDefaultArgs: ["--enable-automation"],
    ...(executablePath && { executablePath }), // use real Chrome if found
  };

  try {
    return await chromium.launchPersistentContext(userDataDir, baseOptions);
  } catch {
    // Profile locked (Chrome is open) — launch without profile, no saved sessions
    return await chromium.launchPersistentContext("", {
      ...baseOptions,
      headless: false,
    });
  }
}
