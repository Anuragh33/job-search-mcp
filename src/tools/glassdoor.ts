import { PlaywrightCrawler, Configuration } from "crawlee";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Job } from "../types.js";

export async function scrapeGlassdoor(
  role: string,
  location = "United States",
  limit = 100,
  hours = 24
): Promise<Job[]> {
  const jobs: Job[] = [];
  const storageDir = mkdtempSync(join(tmpdir(), "job-search-gd-"));
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
      for (const sel of [
        "button[data-test='modal-close-btn']",
        "#onetrust-accept-btn-handler",
        "button[class*='CloseButton']",
        "[aria-label='Close']",
      ]) {
        await page.locator(sel).first().click({ timeout: 2000 }).catch(() => null);
      }

      await page.waitForSelector(
        "li[data-jobid], li[data-test='jobListing'], li[class*='JobsList_jobListItem']",
        { timeout: 20000 }
      ).catch(() => null);
      await page.waitForTimeout(2000);

      const batch = await page.evaluate(() => {
        const selectors = [
          "li[data-jobid]",
          "li[data-test='jobListing']",
          "li[class*='JobsList_jobListItem']",
          "li[class*='react-job-listing']",
        ];
        let cards: Element[] = [];
        for (const sel of selectors) {
          cards = Array.from(document.querySelectorAll(sel));
          if (cards.length > 0) break;
        }

        return cards.map((card) => {
          const anchor = card.querySelector(
            "a[data-test='job-title'], a[class*='JobCard_trackingLink'], a[href*='/job-listing/'], a[href*='/partner/jobListing']"
          ) as HTMLAnchorElement;
          const href = anchor?.href ?? "";
          return {
            title: (card.querySelector(
              "[data-test='job-title'], [class*='JobCard_jobTitle'], [class*='jobTitle']"
            ) as HTMLElement)?.textContent?.trim() ?? anchor?.textContent?.trim() ?? "",
            company: (card.querySelector(
              "[data-test='employer-name'], [class*='EmployerProfile_compactEmployerName'], [class*='jobEmpolyerName']"
            ) as HTMLElement)?.textContent?.trim() ?? "",
            location: (card.querySelector(
              "[data-test='emp-location'], [class*='JobCard_location'], [class*='location']"
            ) as HTMLElement)?.textContent?.trim() ?? "",
            url: href.startsWith("http") ? href : href ? `https://www.glassdoor.com${href}` : "",
            posted: (card.querySelector("[data-test='listing-age'], time, [class*='JobCard_listingAge']") as HTMLElement)?.textContent?.trim() ?? "",
            source: "Glassdoor",
          };
        }).filter((j) => j.title && j.url);
      });

      jobs.push(...batch);
    },
  }, config);

  // Glassdoor search URL — use sc.keyword (dot, not underscore) and locT=N for nationwide
  const fromAge = Math.max(1, Math.ceil(hours / 24));
  const searchUrl = `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodeURIComponent(role)}&locT=N&locId=1&fromAge=${fromAge}&sort.sortType=D&sort.ascending=false`;

  try {
    await crawler.run([{
      url: searchUrl,
      userData: {},
    }]);
  } finally {
    rmSync(storageDir, { recursive: true, force: true });
  }

  return jobs.slice(0, limit);
}
