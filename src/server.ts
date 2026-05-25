#!/usr/bin/env node
import { log } from "crawlee";
log.setLevel(log.LEVELS.OFF);

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { scrapeLinkedIn } from "./tools/linkedin.js";
import { scrapeIndeed } from "./tools/indeed.js";
import { scrapeZipRecruiter } from "./tools/ziprecruiter.js";
import { scrapeGlassdoor } from "./tools/glassdoor.js";
import type { Job } from "./types.js";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

app.get("/search", async (c) => {
  const role     = c.req.query("role") ?? "";
  const location = c.req.query("location") ?? "United States";
  const limit    = parseInt(c.req.query("limit") ?? "100", 10);
  const hours    = parseInt(c.req.query("hours") ?? "168", 10); // default 7 days

  if (!role) return c.json({ error: "role is required" }, 400);

  const [linkedin, indeed, ziprecruiter, glassdoor] = await Promise.allSettled([
    scrapeLinkedIn(role, location, limit, hours),
    scrapeIndeed(role, location, limit, hours),
    scrapeZipRecruiter(role, location, limit, hours),
    scrapeGlassdoor(role, location, limit, hours),
  ]);

  const jobs: Job[] = [
    ...(linkedin.status      === "fulfilled" ? linkedin.value      : []),
    ...(indeed.status        === "fulfilled" ? indeed.value        : []),
    ...(ziprecruiter.status  === "fulfilled" ? ziprecruiter.value  : []),
    ...(glassdoor.status     === "fulfilled" ? glassdoor.value     : []),
  ];

  const sources = {
    linkedin:     linkedin.status     === "fulfilled" ? linkedin.value.length     : 0,
    indeed:       indeed.status       === "fulfilled" ? indeed.value.length       : 0,
    ziprecruiter: ziprecruiter.status === "fulfilled" ? ziprecruiter.value.length : 0,
    glassdoor:    glassdoor.status    === "fulfilled" ? glassdoor.value.length    : 0,
  };

  return c.json({ total: jobs.length, sources, jobs });
});

const PORT = parseInt(process.env.PORT ?? "3001", 10);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.error(`Job Search HTTP server running on port ${PORT}`);
});
