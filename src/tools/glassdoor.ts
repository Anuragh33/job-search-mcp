import { Page } from "playwright";
import type { Job } from "../types.js";

export async function scrapeGlassdoor(page: Page, role: string, location = "", limit = 25, hours = 24): Promise<Job[]> {
  const jobs: Job[] = [];
  let pageNum = 1;

  while (jobs.length < limit) {
    const params = new URLSearchParams({
      sc_keyword: role,
      fromAge: String(Math.max(1, Math.ceil(hours / 24))),
      sort: "date_desc",      // all jobs by date, not relevance
      p: String(pageNum),
    });
    if (location) params.set("locKeyword", location);

    await page.goto(`https://www.glassdoor.com/Job/jobs.htm?${params}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Dismiss cookie/sign-in modal if present
    await page.locator('[alt="Close"], button[data-test="modal-close-btn"], #onetrust-accept-btn-handler')
      .first()
      .click({ timeout: 5000 })
      .catch(() => null);

    await page.waitForSelector(
      "li[data-test='jobListing'], div[data-test='job-search-results'] li",
      { timeout: 15000 }
    ).catch(() => null);

    const batch = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll("li[data-test='jobListing'], div[data-test='job-search-results'] li")
      ).map((card) => {
        const anchor = card.querySelector("a[data-test='job-title'], a.jobLink") as HTMLAnchorElement;
        const href = anchor?.href ?? "";
        return {
          title: (card.querySelector("[data-test='job-title'], .job-title") as HTMLElement)?.textContent?.trim() ?? "",
          company: (card.querySelector("[data-test='employer-name'], .employer-name") as HTMLElement)?.textContent?.trim() ?? "",
          location: (card.querySelector("[data-test='emp-location'], .location") as HTMLElement)?.textContent?.trim() ?? "",
          url: href.startsWith("http") ? href : `https://www.glassdoor.com${href}`,
          posted: (card.querySelector("[data-test='listing-age'], .listing-age") as HTMLElement)?.textContent?.trim() ?? "",
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
