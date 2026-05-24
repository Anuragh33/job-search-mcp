import type { Job } from "../types.js";

export async function scrapeIndeed(
  _page: unknown,
  role: string,
  location = "United States",
  limit = 100,
  hours = 24
): Promise<Job[]> {
  const jobs: Job[] = [];
  let start = 0;
  const pageSize = 25;

  while (jobs.length < limit) {
    const params = new URLSearchParams({
      q: role,
      l: location,
      sort: "date",
      fromage: String(Math.max(1, Math.ceil(hours / 24))),
      start: String(start),
    });

    const res = await fetch(`https://www.indeed.com/rss?${params}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RSS reader)" },
    });

    if (!res.ok) break;
    const xml = await res.text();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const title = extractCDATA(item, "title");
      const url   = extract(item, "link") || extractCDATA(item, "guid");
      const desc  = extractCDATA(item, "description");
      const date  = extract(item, "pubDate");

      // Indeed title format: "Job Title - Company Name"
      const dashIdx = title.lastIndexOf(" - ");
      const jobTitle = dashIdx > 0 ? title.slice(0, dashIdx).trim() : title;
      const company  = dashIdx > 0 ? title.slice(dashIdx + 3).trim() : "";

      // Location is buried in description HTML — pull it out
      const locMatch = desc.match(/location.*?<b>(.*?)<\/b>/i) ||
                       desc.match(/<span[^>]*>([^<]+,\s*[A-Z]{2}[^<]*)<\/span>/);
      const location_ = locMatch?.[1]?.trim() ?? "";

      if (jobTitle && url) {
        jobs.push({ title: jobTitle, company, location: location_, url, posted: date, source: "Indeed" });
      }
    }

    if (items.length < pageSize) break;
    start += pageSize;
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
