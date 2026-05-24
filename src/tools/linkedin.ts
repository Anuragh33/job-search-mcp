import { Page } from "playwright";
import type { Job } from "../types.js";

const PAGE_SIZE = 25;

export async function scrapeLinkedIn(page: Page, role: string, location = "", limit = 25, hours = 24): Promise<Job[]> {
  const jobs: Job[] = [];
  let pageIndex = 0;

  while (jobs.length < limit) {
    const params = new URLSearchParams({
      keywords: role,
      f_TPR: `r${hours * 3600}`,
      sortBy: "DD",           // DD = date descending — all jobs, not just top matches
      start: String(pageIndex * PAGE_SIZE),
    });
    if (location) params.set("location", location);

    await page.goto(`https://www.linkedin.com/jobs/search/?${params}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    if (page.url().includes("/login") || page.url().includes("/authwall")) break;

    await page.waitForSelector(
      ".jobs-search__results-list li, .scaffold-layout__list-item",
      { timeout: 15000 }
    ).catch(() => null);

    const batch = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(".jobs-search__results-list li, .scaffold-layout__list-item")
      ).map((card) => ({
        title: card.querySelector(".base-search-card__title, .job-card-list__title")?.textContent?.trim() ?? "",
        company: card.querySelector(".base-search-card__subtitle, .job-card-container__company-name")?.textContent?.trim() ?? "",
        location: card.querySelector(".job-search-card__location, .job-card-container__metadata-item")?.textContent?.trim() ?? "",
        url: (card.querySelector("a[href*='/jobs/view/']") as HTMLAnchorElement)?.href ?? "",
        posted: card.querySelector("time")?.getAttribute("datetime") ?? "",
        source: "LinkedIn",
      })).filter((j) => j.title && j.url);
    });

    if (batch.length === 0) break;
    jobs.push(...batch);
    pageIndex++;
  }

  return jobs.slice(0, limit);
}
