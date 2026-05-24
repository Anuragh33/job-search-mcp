import { Page } from "playwright";
import type { Job } from "../types.js";

const PAGE_SIZE = 15;

export async function scrapeIndeed(page: Page, role: string, location = "", limit = 25, hours = 24): Promise<Job[]> {
  const jobs: Job[] = [];
  let pageIndex = 0;

  while (jobs.length < limit) {
    const params = new URLSearchParams({
      q: role,
      fromage: String(Math.max(1, Math.ceil(hours / 24))),
      sort: "date",
      start: String(pageIndex * PAGE_SIZE),
    });
    if (location) params.set("l", location);

    await page.goto(`https://www.indeed.com/jobs?${params}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(3000);

    await page.locator("button#onetrust-accept-btn-handler, button[id*='accept']")
      .first().click({ timeout: 2000 }).catch(() => null);

    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1000);

    const batch = await page.evaluate(() => {
      // Try multiple selector patterns — Indeed redesigns frequently
      const selectors = [
        "div.job_seen_beacon",
        "div[data-jk]",
        "li.css-5lfssm",
        "div.resultContent",
        "td.resultContent",
      ];

      let cards: Element[] = [];
      for (const sel of selectors) {
        cards = Array.from(document.querySelectorAll(sel));
        if (cards.length > 0) break;
      }

      return cards.map((card) => {
        const anchor = card.querySelector("a[data-jk], h2 a, a[id^='job_']") as HTMLAnchorElement;
        const href = anchor?.href ?? "";
        return {
          title: card.querySelector("h2 span[title], h2 a span, .jobTitle span")?.textContent?.trim() ?? "",
          company: card.querySelector("[data-testid='company-name'], .companyName, span.css-92r8pb")?.textContent?.trim() ?? "",
          location: card.querySelector("[data-testid='text-location'], .companyLocation, div.css-1restlb")?.textContent?.trim() ?? "",
          url: href.startsWith("http") ? href : `https://www.indeed.com${href}`,
          posted: card.querySelector(".date, [data-testid='myJobsStateDate']")?.textContent?.trim() ?? "",
          source: "Indeed",
        };
      }).filter((j) => j.title && j.url);
    });

    if (batch.length === 0) break;
    jobs.push(...batch);
    pageIndex++;
  }

  return jobs.slice(0, limit);
}
