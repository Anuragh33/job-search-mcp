import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { BrowserContext } from "playwright";

chromium.use(StealthPlugin());

export async function launchContext(): Promise<BrowserContext> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  }) as unknown as BrowserContext;

  // Patch close to also close the browser
  const origClose = context.close.bind(context);
  (context as any).close = async () => {
    await origClose();
    await browser.close();
  };

  return context;
}
