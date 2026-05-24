import { Page } from "playwright";
import type { Job } from "../types.js";

export async function scrapeZipRecruiter(page: Page, role: string, location = "", limit = 25, hours = 24): Promise<Job[]> {
  const jobs: Job[] = [];
  let pageNum = 1;

  while (jobs.length < limit) {
    const params = new URLSearchParams({
      search: role,
      days: String(Math.max(1, Math.ceil(hours / 24))),
      sort_by: "date",
      page: String(pageNum),
    });
    if (location) params.set("location", location);

    await page.goto(`https://www.ziprecruiter.com/jobs-search?${params}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(1500);

    const batch = await page.evaluate(() => {
      const selectors = [
        "article.job_result",
        "div[data-testid='job-card']",
        ".jobList-item",
        "div[class*='job_content']",
        "li[class*='job-listing']",
        "div[class*='JobCard']",
        "a[data-testid='job-title-link']",
      ];

      let cards: Element[] = [];
      for (const sel of selectors) {
        cards = Array.from(document.querySelectorAll(sel));
        if (cards.length > 0) break;
      }

      return cards.map((card) => {
        const anchor = card.querySelector("a[data-testid='job-title-link'], a.job_link, h2 a, a[href*='/jobs/']") as HTMLAnchorElement;
        return {
          title: (card.querySelector("[data-testid='job-title'], .job_title, h2") as HTMLElement)?.textContent?.trim() ?? "",
          company: (card.querySelector("[data-testid='company-name'], .hiring_company_text, .company_name") as HTMLElement)?.textContent?.trim() ?? "",
          location: (card.querySelector("[data-testid='location'], .location_text, .job_location") as HTMLElement)?.textContent?.trim() ?? "",
          url: anchor?.href ?? "",
          posted: (card.querySelector("time, .posted_time, [data-testid='posted-date']") as HTMLElement)?.textContent?.trim() ?? "",
          source: "ZipRecruiter",
        };
      }).filter((j) => j.title && j.url);
    });

    if (batch.length === 0) break;
    jobs.push(...batch);
    pageNum++;
  }

  return jobs.slice(0, limit);
}
