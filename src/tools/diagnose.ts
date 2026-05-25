import { PlaywrightCrawler } from "crawlee";

const BOARDS = [
  { name: "LinkedIn",     url: "https://www.linkedin.com/jobs/" },
  { name: "Indeed",       url: "https://www.indeed.com/" },
  { name: "ZipRecruiter", url: "https://www.ziprecruiter.com/" },
  { name: "Glassdoor",    url: "https://www.glassdoor.com/" },
];

export async function diagnoseLogins(): Promise<string> {
  const lines: string[] = ["# Connectivity Check\n", "No login required. Checking each job board is reachable...\n"];
  const results: Record<string, string> = {};

  const crawler = new PlaywrightCrawler({
    headless: true,
    maxRequestsPerCrawl: BOARDS.length,
    requestHandlerTimeoutSecs: 30,
    async requestHandler({ page, request }) {
      await page.waitForTimeout(3000);
      const title = await page.title();
      const url = page.url();
      const blocked = title.toLowerCase().includes("just a moment") || title.toLowerCase().includes("security check") || url.includes("challenge");
      results[request.userData.name as string] = blocked ? `BLOCKED (${title})` : `OK — ${title.slice(0, 60)}`;
    },
    failedRequestHandler({ request }) {
      results[request.userData.name as string] = `ERROR — request failed`;
    },
  });

  await crawler.run(BOARDS.map((b) => ({ url: b.url, userData: { name: b.name } })));

  for (const board of BOARDS) {
    lines.push(`${board.name}: ${results[board.name] ?? "no response"}`);
  }

  return lines.join("\n");
}
