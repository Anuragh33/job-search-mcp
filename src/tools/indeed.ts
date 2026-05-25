import { PlaywrightCrawler, Configuration } from "crawlee";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Job } from "../types.js";

export async function scrapeIndeed(
  role: string,
  location = "United States",
  limit = 100,
  hours = 24
): Promise<Job[]> {
  const jobs: Job[] = [];
  const storageDir = mkdtempSync(join(tmpdir(), "job-search-in-"));
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
      await page.waitForTimeout(3000);

      if ((await page.title()).includes("Security Check")) return;

      const batch = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll(".job_seen_beacon, li.css-5lfssm"));
        return cards.map((card) => {
          const titleEl = card.querySelector("h2.jobTitle span, [data-testid='jobTitle'] span") as HTMLElement;
          const companyEl = card.querySelector("[data-testid='company-name'], .companyName") as HTMLElement;
          const locationEl = card.querySelector("[data-testid='text-location'], .companyLocation") as HTMLElement;
          const dateEl = card.querySelector("[data-testid='myJobsStateDate'], .date") as HTMLElement;
          const linkEl = card.querySelector("h2.jobTitle a, a[data-jk]") as HTMLAnchorElement;
          const href = linkEl?.getAttribute("href") ?? "";
          return {
            title: titleEl?.textContent?.trim() ?? "",
            company: companyEl?.textContent?.trim() ?? "",
            location: locationEl?.textContent?.trim() ?? "",
            posted: dateEl?.textContent?.trim() ?? "",
            url: href.startsWith("http") ? href : href ? `https://www.indeed.com${href}` : "",
            source: "Indeed",
          };
        }).filter((j) => j.title && j.url);
      });

      jobs.push(...batch);
    },
  }, config);

  const params = new URLSearchParams({
    q: role,
    l: location,
    sort: "date",
    fromage: String(Math.max(1, Math.ceil(hours / 24))),
    start: "0",
  });

  try {
    await crawler.run([{
      url: `https://www.indeed.com/jobs?${params}`,
      userData: {},
    }]);
  } finally {
    rmSync(storageDir, { recursive: true, force: true });
  }

  return jobs.slice(0, limit);
}
