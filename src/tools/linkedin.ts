import { PlaywrightCrawler, Configuration } from "crawlee";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Job } from "../types.js";

export async function scrapeLinkedIn(
  role: string,
  location = "United States",
  limit = 100,
  hours = 24
): Promise<Job[]> {
  const jobs: Job[] = [];
  const storageDir = mkdtempSync(join(tmpdir(), "job-search-li-"));

  const config = new Configuration({ storageClientOptions: { localDataDirectory: storageDir } });
  const crawler = new PlaywrightCrawler({
    headless: true,
    maxRequestsPerCrawl: 1,
    requestHandlerTimeoutSecs: 60,
    launchContext: {
      launchOptions: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    },
    async requestHandler({ page }) {
      await page.waitForSelector(".job-search-card", { timeout: 15000 }).catch(() => null);
      await page.waitForTimeout(2000);

      const batch = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".job-search-card")).map((card) => ({
          title: card.querySelector("h3")?.textContent?.trim() ?? "",
          company: card.querySelector("h4")?.textContent?.trim() ?? "",
          location: card.querySelector(".job-search-card__location")?.textContent?.trim() ?? "",
          url: card.querySelector("a[href*='/jobs/view/']")?.getAttribute("href") ?? "",
          posted: card.querySelector("time")?.getAttribute("datetime") ?? "",
          source: "LinkedIn",
        })).filter((j) => j.title && j.url)
      );

      jobs.push(...batch);
    },
  }, config);

  const params = new URLSearchParams({
    keywords: role,
    f_TPR: `r${hours * 3600}`,
    sortBy: "DD",
    start: "0",
  });
  params.set("location", location);

  try {
    await crawler.run([{
      url: `https://www.linkedin.com/jobs/search/?${params}`,
      userData: {},
    }]);
  } finally {
    rmSync(storageDir, { recursive: true, force: true });
  }

  return jobs.slice(0, limit);
}
