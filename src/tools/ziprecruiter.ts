import type { Job } from "../types.js";

export async function scrapeZipRecruiter(
  _page: unknown,
  role: string,
  location = "United States",
  limit = 100,
  hours = 24
): Promise<Job[]> {
  const jobs: Job[] = [];
  let page = 1;

  while (jobs.length < limit) {
    const params = new URLSearchParams({
      search: role,
      location,
      days: String(Math.max(1, Math.ceil(hours / 24))),
      page: String(page),
    });

    const res = await fetch(`https://www.ziprecruiter.com/jobs.rss?${params}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RSS reader)" },
    });

    if (!res.ok) break;
    const xml = await res.text();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const title   = extractCDATA(item, "title");
      const url     = extract(item, "link") || extractCDATA(item, "guid");
      const company = extractCDATA(item, "source") || extract(item, "source");
      const date    = extract(item, "pubDate");
      const loc     = extractCDATA(item, "location") || extract(item, "location");

      if (title && url) {
        jobs.push({ title, company, location: loc, url, posted: date, source: "ZipRecruiter" });
      }
    }

    if (items.length < 10) break;
    page++;
  }

  return jobs.slice(0, limit);
}

function extractCDATA(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`));
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

function extract(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*/?>([\\s\\S]*?)<\\/${tag}>`));
  return (m?.[1] ?? "").trim();
}
