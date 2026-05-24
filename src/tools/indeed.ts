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
      start: String(pageIndex * PAGE_SIZE),
    });
    if (location) params.set("l", location);

    await page.goto(`https://www.indeed.com/jobs?${params}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForSelector("div.job_seen_beacon, div[data-jk]", {
      timeout: 15000,
    }).catch(() => null);

    const batch = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll("div.job_seen_beacon, div[data-jk]")
      ).map((card) => {
        const anchor = card.querySelector("h2.jobTitle a, a[data-jk]") as HTMLAnchorElement;
        const href = anchor?.href ?? "";
        return {
          title: card.querySelector("h2.jobTitle span, h2.jobTitle")?.textContent?.trim() ?? "",
          company: card.querySelector(".companyName, [data-testid='company-name']")?.textContent?.trim() ?? "",
          location: card.querySelector(".companyLocation, [data-testid='text-location']")?.textContent?.trim() ?? "",
          url: href.startsWith("http") ? href : `https://www.indeed.com${href}`,
          posted: card.querySelector(".date, .result-footer-item time")?.textContent?.trim() ?? "",
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
