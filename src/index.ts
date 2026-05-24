#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { launchContext } from "./browser.js";
import { scrapeLinkedIn } from "./tools/linkedin.js";
import { scrapeIndeed } from "./tools/indeed.js";
import { scrapeZipRecruiter } from "./tools/ziprecruiter.js";
import { scrapeGlassdoor } from "./tools/glassdoor.js";
import type { Job } from "./types.js";

const TOOLS = [
  {
    name: "search_jobs",
    description:
      "Search for job listings across LinkedIn, Indeed, ZipRecruiter, and Glassdoor in parallel. " +
      "Use this after extracting the target role from a resume. " +
      "Uses the user's local Chrome session so results are authenticated where possible.",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", description: "Job title to search, e.g. 'Full Stack Developer'" },
        location: { type: "string", description: "Optional location, e.g. 'New York' or 'Remote'" },
        limit: { type: "number", description: "Max results per board (default 20)" },
        hours: { type: "number", description: "Only return jobs posted within this many hours (default 24)" },
      },
      required: ["role"],
    },
  },
  {
    name: "search_linkedin",
    description: "Search LinkedIn jobs using the user's local Chrome session.",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", description: "Job title to search" },
        location: { type: "string", description: "Optional location filter" },
        limit: { type: "number" },
        hours: { type: "number", description: "Only return jobs posted within this many hours (default 24)" },
      },
      required: ["role"],
    },
  },
  {
    name: "search_indeed",
    description: "Search Indeed jobs using the user's local Chrome session.",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", description: "Job title to search" },
        location: { type: "string", description: "Optional location filter" },
        limit: { type: "number" },
        hours: { type: "number", description: "Only return jobs posted within this many hours (default 24)" },
      },
      required: ["role"],
    },
  },
  {
    name: "search_ziprecruiter",
    description: "Search ZipRecruiter jobs using the user's local Chrome session.",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", description: "Job title to search" },
        location: { type: "string", description: "Optional location filter" },
        limit: { type: "number" },
        hours: { type: "number", description: "Only return jobs posted within this many hours (default 24)" },
      },
      required: ["role"],
    },
  },
  {
    name: "search_glassdoor",
    description: "Search Glassdoor jobs using the user's local Chrome session.",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", description: "Job title to search" },
        location: { type: "string", description: "Optional location filter" },
        limit: { type: "number" },
        hours: { type: "number", description: "Only return jobs posted within this many hours (default 24)" },
      },
      required: ["role"],
    },
  },
];

const server = new Server(
  { name: "job-search-mcp", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const role = args?.role as string;
  const location = (args?.location as string) ?? "";
  const limit = (args?.limit as number) ?? 100;
  const hours = (args?.hours as number) ?? 24;

  try {
    if (name === "search_jobs") {
      const context = await launchContext();
      try {
        const [p1, p2, p3, p4] = await Promise.all([
          context.newPage(),
          context.newPage(),
          context.newPage(),
          context.newPage(),
        ]);

        const [linkedin, indeed, ziprecruiter, glassdoor] = await Promise.allSettled([
          scrapeLinkedIn(p1, role, location, limit, hours),
          scrapeIndeed(p2, role, location, limit, hours),
          scrapeZipRecruiter(p3, role, location, limit, hours),
          scrapeGlassdoor(p4, role, location, limit, hours),
        ]);

        const allJobs: Job[] = [
          ...(linkedin.status === "fulfilled" ? linkedin.value : []),
          ...(indeed.status === "fulfilled" ? indeed.value : []),
          ...(ziprecruiter.status === "fulfilled" ? ziprecruiter.value : []),
          ...(glassdoor.status === "fulfilled" ? glassdoor.value : []),
        ];

        const sources = {
          linkedin: linkedin.status === "fulfilled" ? linkedin.value.length : `error: ${(linkedin as PromiseRejectedResult).reason}`,
          indeed: indeed.status === "fulfilled" ? indeed.value.length : `error: ${(indeed as PromiseRejectedResult).reason}`,
          ziprecruiter: ziprecruiter.status === "fulfilled" ? ziprecruiter.value.length : `error: ${(ziprecruiter as PromiseRejectedResult).reason}`,
          glassdoor: glassdoor.status === "fulfilled" ? glassdoor.value.length : `error: ${(glassdoor as PromiseRejectedResult).reason}`,
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ total: allJobs.length, sources, jobs: allJobs }, null, 2),
          }],
        };
      } finally {
        await context.close();
      }
    }

    // Single-board tools
    const scrapers: Record<string, (role: string, location: string, limit: number, hours: number) => Promise<Job[]>> = {
      search_linkedin: singleBoard(scrapeLinkedIn),
      search_indeed: singleBoard(scrapeIndeed),
      search_ziprecruiter: singleBoard(scrapeZipRecruiter),
      search_glassdoor: singleBoard(scrapeGlassdoor),
    };

    if (!scrapers[name]) throw new Error(`Unknown tool: ${name}`);

    const jobs = await scrapers[name](role, location, limit, hours);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ total: jobs.length, jobs }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      isError: true,
    };
  }
});

function singleBoard(
  fn: (page: import("playwright").Page, role: string, location: string, limit: number, hours: number) => Promise<Job[]>
) {
  return async (role: string, location: string, limit: number, hours: number): Promise<Job[]> => {
    const context = await launchContext();
    try {
      const page = await context.newPage();
      return await fn(page, role, location, limit, hours);
    } finally {
      await context.close();
    }
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Job Search MCP server running (LinkedIn, Indeed, ZipRecruiter, Glassdoor)");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
