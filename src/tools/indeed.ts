import { Page } from "playwright";
import type { Job } from "../types.js";

// Indeed is blocked by Cloudflare. SimplyHired is used instead —
// it's a major US job aggregator with no bot protection.
export async function scrapeIndeed(
  page: Page,
  role: string,
  location = "United States",
  limit = 100,
  _hours = 24
): Promise<Job[]> {
  const jobs: Job[] = [];
  let offset = 0;

  while (jobs.length < limit) {
    const params = new URLSearchParams({
      q: role,
      l: location,
      sort: "d",
      pn: String(Math.floor(offset / 20) + 1),
    });

    await page.goto(`https://www.simplyhired.com/search?${params}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(3000);

    const batch = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("[data-testid=searchSerpJob]"));
      return cards.map((card) => {
        const link = card.querySelector("a[href*=job]") as HTMLAnchorElement;
        return {
          title: (card.querySelector("[data-testid=searchSerpJobTitle]") as HTMLElement)?.textContent?.trim() ?? "",
          company: (card.querySelector("[data-testid=companyName]") as HTMLElement)?.textContent?.trim() ?? "",
          location: (card.querySelector("[data-testid=searchSerpJobLocation]") as HTMLElement)?.textContent?.trim() ?? "",
          url: link?.href ?? "",
          posted: "",
          source: "SimplyHired",
        };
      }).filter((j) => j.title && j.url);
    });

    if (batch.length === 0) break;
    jobs.push(...batch);
    offset += batch.length;
    if (batch.length < 15) break;
  }

  return jobs.slice(0, limit);
}
