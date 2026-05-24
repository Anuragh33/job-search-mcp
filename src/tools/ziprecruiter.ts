import type { Job } from "../types.js";

// ZipRecruiter blocks all automated access via Cloudflare.
// Remotive provides a free public API for remote jobs with no auth required.
export async function scrapeZipRecruiter(
  _page: unknown,
  role: string,
  _location = "United States",
  limit = 100,
  _hours = 24
): Promise<Job[]> {
  const res = await fetch(
    `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(role)}&limit=${limit}`,
    { headers: { "Accept": "application/json" } }
  );

  if (!res.ok) return [];

  const data = await res.json() as { jobs?: Array<{
    title: string;
    company_name: string;
    candidate_required_location: string;
    url: string;
    publication_date: string;
  }> };

  return (data.jobs ?? []).slice(0, limit).map((j) => ({
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location || "Remote",
    url: j.url,
    posted: j.publication_date,
    source: "Remotive (Remote)",
  }));
}
