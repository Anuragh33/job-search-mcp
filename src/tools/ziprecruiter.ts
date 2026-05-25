import { PlaywrightCrawler, Configuration } from "crawlee";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Job } from "../types.js";

export async function scrapeZipRecruiter(
  role: string,
  location = "United States",
  limit = 100,
  hours = 24
): Promise<Job[]> {
  const jobs: Job[] = [];
  const storageDir = mkdtempSync(join(tmpdir(), "job-search-zr-"));
  const config = new Configuration({ storageClientOptions: { localDataDirectory: storageDir } });

  const crawler = new PlaywrightCrawler({
    headless: true,
    maxRequestsPerCrawl: 1,
    requestHandlerTimeoutSecs: 60,
    async requestHandler({ page }) {
      await page.waitForSelector(".job_result_two_pane_v2, [data-testid='job-card']", { timeout: 15000 }).catch(() => null);
      await page.waitForTimeout(2000);

      const batch = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll(".job_result_two_pane_v2"));
        return cards.map((card) => {
          const article = card.querySelector("article") ?? card;
          const links = Array.from(article.querySelectorAll("a")) as HTMLAnchorElement[];
          const companyLink = links.find((a) => a.href.includes("/co/"));
          const locationLink = links.find((a) => a.href.includes("jobs-search?location"));
          const dateEl = article.querySelector("time, [class*='posted'], [data-testid='job-posted']") as HTMLElement;
          const uuid = companyLink?.href.match(/uuid=([^&]+)/)?.[1] ?? "";
          const title = (article.querySelector("h2") as HTMLElement)?.textContent?.trim() ?? "";
          const company = companyLink?.textContent?.trim() ?? "";
          const loc = locationLink?.textContent?.trim() ?? "";
          const slug = (s: string) => s.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
          const url = uuid && company && title
            ? `https://www.ziprecruiter.com/jobs/${slug(company)}/${slug(title)}?jid=${uuid}`
            : "";
          return {
            title,
            company,
            location: loc,
            posted: dateEl?.textContent?.trim() ?? "",
            url,
            source: "ZipRecruiter",
          };
        }).filter((j) => j.title && j.url);
      });

      jobs.push(...batch);
    },
  }, config);

  const params = new URLSearchParams({
    search: role,
    location,
    days: String(Math.max(1, Math.ceil(hours / 24))),
    page: "1",
  });

  try {
    await crawler.run([{
      url: `https://www.ziprecruiter.com/jobs-search?${params}`,
      userData: {},
    }]);
  } finally {
    rmSync(storageDir, { recursive: true, force: true });
  }

  return jobs.slice(0, limit);
}
