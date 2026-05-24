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
      sortBy: "DD",
      start: String(pageIndex * PAGE_SIZE),
    });
    params.set("location", location || "United States");

    await page.goto(`https://www.linkedin.com/jobs/search/?${params}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForSelector(".job-search-card", { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(2000);

    const batch = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".job-search-card")).map((card) => ({
        title: card.querySelector("h3")?.textContent?.trim() ?? "",
        company: card.querySelector("h4")?.textContent?.trim() ?? "",
        location: card.querySelector(".job-search-card__location")?.textContent?.trim() ?? "",
        url: card.querySelector("a[href*='/jobs/view/']")?.getAttribute("href") ?? "",
        posted: card.querySelector("time")?.getAttribute("datetime") ?? "",
        source: "LinkedIn",
      })).filter((j) => j.title && j.url);
    });

    if (batch.length === 0) break;
    jobs.push(...batch);
    pageIndex++;
    if (batch.length < PAGE_SIZE) break;
  }

  return jobs.slice(0, limit);
}
