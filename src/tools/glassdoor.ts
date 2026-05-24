import { Page } from "playwright";
import type { Job } from "../types.js";

// Glassdoor blocks all automated access via Cloudflare.
// Dice.com is used instead — it's a major US tech-focused job board with no bot protection.
export async function scrapeGlassdoor(
  page: Page,
  role: string,
  _location = "United States",
  limit = 100,
  _hours = 24
): Promise<Job[]> {
  const jobs: Job[] = [];
  let pageNum = 1;

  while (jobs.length < limit) {
    const params = new URLSearchParams({
      q: role,
      location: "United States",
      datePosted: "ONE",
      page: String(pageNum),
    });

    await page.goto(`https://www.dice.com/jobs?${params}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(3000);

    const batch = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("[data-testid='job-card']"));
      return cards.map((card) => {
        const titleEl = card.querySelector("[data-testid='job-search-job-detail-link']") as HTMLAnchorElement;
        const paras = Array.from(card.querySelectorAll("p")).map((p) => p.textContent?.trim() ?? "");
        const company = paras.find((t) => t.length > 2 && !/•|Sponsored|Full-time|Part-time|Contract|Today|ago/.test(t)) ?? "";
        const location = paras.find((t) => /,\s+[A-Z]|Remote/.test(t)) ?? "";
        const posted = paras.find((t) => /Today|ago|hour|day|week/.test(t)) ?? "";

        return {
          title: titleEl?.textContent?.trim() ?? "",
          company,
          location,
          url: titleEl?.href ?? "",
          posted,
          source: "Dice",
        };
      }).filter((j) => j.title && j.url);
    });

    if (batch.length === 0) break;
    jobs.push(...batch);
    pageNum++;
    if (batch.length < 10) break;
  }

  return jobs.slice(0, limit);
}
