import { Page } from "playwright";
import type { Job } from "../types.js";

export async function scrapeZipRecruiter(page: Page, role: string, location = "", limit = 25, hours = 24): Promise<Job[]> {
  const jobs: Job[] = [];
  let pageNum = 1;

  while (jobs.length < limit) {
    const params = new URLSearchParams({
      search: role,
      days: String(Math.max(1, Math.ceil(hours / 24))),
      sort_by: "date",        // all jobs by date, not relevance
      page: String(pageNum),
    });
    if (location) params.set("location", location);

    await page.goto(`https://www.ziprecruiter.com/jobs-search?${params}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForSelector(
      "article.job_result, div[data-testid='job-card'], .jobList-item",
      { timeout: 15000 }
    ).catch(() => null);

    const batch = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll("article.job_result, div[data-testid='job-card'], .jobList-item")
      ).map((card) => {
        const anchor = card.querySelector("a.job_link, a[data-testid='job-title-link'], h2 a") as HTMLAnchorElement;
        return {
          title: (card.querySelector(".job_title, [data-testid='job-title'], h2 a") as HTMLElement)?.textContent?.trim() ?? "",
          company: (card.querySelector(".hiring_company_text, [data-testid='company-name'], .company_name") as HTMLElement)?.textContent?.trim() ?? "",
          location: (card.querySelector(".location_text, [data-testid='location'], .job_location") as HTMLElement)?.textContent?.trim() ?? "",
          url: anchor?.href ?? "",
          posted: (card.querySelector(".posted_time, time") as HTMLElement)?.textContent?.trim() ?? "",
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
