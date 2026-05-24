import { Page } from "playwright";
import type { Job } from "../types.js";

export async function scrapeGlassdoor(page: Page, role: string, location = "", limit = 25, hours = 24): Promise<Job[]> {
  const jobs: Job[] = [];
  let pageNum = 1;

  while (jobs.length < limit) {
    const params = new URLSearchParams({
      sc_keyword: role,
      fromAge: String(Math.max(1, Math.ceil(hours / 24))),
      sort: "date_desc",
      p: String(pageNum),
    });
    params.set("locKeyword", location || "United States");

    await page.goto(`https://www.glassdoor.com/Job/jobs.htm?${params}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(4000);

    // Dismiss any modal — cookie consent, sign-in prompt, etc.
    const dismissSelectors = [
      "button[data-test='modal-close-btn']",
      "#onetrust-accept-btn-handler",
      "button[alt='Close']",
      "[class*='modal'] button[class*='close']",
      "button[class*='CloseButton']",
    ];
    for (const sel of dismissSelectors) {
      await page.locator(sel).first().click({ timeout: 2000 }).catch(() => null);
    }

    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1500);

    const batch = await page.evaluate(() => {
      const selectors = [
        "li[data-test='jobListing']",
        "li[class*='JobsList']",
        "div[data-test='job-search-results'] li",
        "li[class*='react-job-listing']",
        "article[class*='jobCard']",
      ];

      let cards: Element[] = [];
      for (const sel of selectors) {
        cards = Array.from(document.querySelectorAll(sel));
        if (cards.length > 0) break;
      }

      return cards.map((card) => {
        const anchor = card.querySelector("a[data-test='job-title'], a[class*='jobLink'], a[href*='/job-listing/']") as HTMLAnchorElement;
        const href = anchor?.href ?? "";
        return {
          title: (card.querySelector("[data-test='job-title'], [class*='jobTitle'], [class*='JobTitle']") as HTMLElement)?.textContent?.trim() ?? "",
          company: (card.querySelector("[data-test='employer-name'], [class*='EmployerName'], [class*='employer-name']") as HTMLElement)?.textContent?.trim() ?? "",
          location: (card.querySelector("[data-test='emp-location'], [class*='location'], [class*='Location']") as HTMLElement)?.textContent?.trim() ?? "",
          url: href.startsWith("http") ? href : `https://www.glassdoor.com${href}`,
          posted: (card.querySelector("[data-test='listing-age'], [class*='listingAge'], time") as HTMLElement)?.textContent?.trim() ?? "",
          source: "Glassdoor",
        };
      }).filter((j) => j.title && j.url);
    });

    if (batch.length === 0) break;
    jobs.push(...batch);
    pageNum++;
  }

  return jobs.slice(0, limit);
}
