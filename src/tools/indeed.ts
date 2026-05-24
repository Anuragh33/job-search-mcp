import { Page } from "playwright";
import type { Job } from "../types.js";

export async function scrapeIndeed(
  page: Page,
  role: string,
  location = "United States",
  limit = 100,
  hours = 24
): Promise<Job[]> {
  const jobs: Job[] = [];
  let start = 0;
  const pageSize = 15;

  while (jobs.length < limit) {
    const params = new URLSearchParams({
      q: role,
      l: location,
      sort: "date",
      fromage: String(Math.max(1, Math.ceil(hours / 24))),
      start: String(start),
    });

    await page.goto(`https://www.indeed.com/jobs?${params}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(3000);

    if ((await page.title()).includes("Security Check") || (await page.title()).includes("Just a moment")) break;

    const batch = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".job_seen_beacon, li.css-5lfssm"));
      return cards.map((card) => {
        const titleEl = card.querySelector("h2.jobTitle span, [data-testid='jobTitle'] span, h2 span[title]") as HTMLElement;
        const companyEl = card.querySelector("[data-testid='company-name'], .companyName") as HTMLElement;
        const locationEl = card.querySelector("[data-testid='text-location'], .companyLocation") as HTMLElement;
        const dateEl = card.querySelector("[data-testid='myJobsStateDate'], .date") as HTMLElement;
        const linkEl = card.querySelector("h2.jobTitle a, a[data-jk]") as HTMLAnchorElement;

        const href = linkEl?.getAttribute("href") ?? "";
        const url = href.startsWith("http") ? href : href ? `https://www.indeed.com${href}` : "";

        return {
          title: titleEl?.textContent?.trim() ?? "",
          company: companyEl?.textContent?.trim() ?? "",
          location: locationEl?.textContent?.trim() ?? "",
          posted: dateEl?.textContent?.trim() ?? "",
          url,
          source: "Indeed",
        };
      }).filter((j) => j.title && j.url);
    });

    if (batch.length === 0) break;
    jobs.push(...batch);
    start += pageSize;
    if (batch.length < pageSize) break;
  }

  return jobs.slice(0, limit);
}
