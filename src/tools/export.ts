import { writeFileSync, mkdirSync } from "fs";
import os from "os";
import path from "path";
import type { Job } from "../types.js";

export function exportToCSV(jobs: Job[], role: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const safeRole = role.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filename = `jobs_${safeRole}_${date}.csv`;
  const filePath = path.join(os.homedir(), "Desktop", filename);

  const escape = (val: string) => `"${(val ?? "").replace(/"/g, '""')}"`;

  const headers = ["#", "Title", "Company", "Location", "Posted", "Source", "URL"];
  const rows = jobs.map((j, i) => [
    String(i + 1),
    escape(j.title),
    escape(j.company),
    escape(j.location ?? ""),
    escape(j.posted ?? ""),
    escape(j.source),
    escape(j.url),
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n");

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, csv, "utf-8");

  return filePath;
}
