#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { launchContext } from "./browser.js";
import { scrapeLinkedIn } from "./tools/linkedin.js";
import { scrapeIndeed } from "./tools/indeed.js";
import { scrapeZipRecruiter } from "./tools/ziprecruiter.js";
import { scrapeGlassdoor } from "./tools/glassdoor.js";
import { checkSetup } from "./tools/setup.js";
import { diagnoseLogins } from "./tools/diagnose.js";
import type { Job } from "./types.js";

function toTable(jobs: Job[]): string {
  if (jobs.length === 0) return "No jobs found.";

  const rows = jobs.map((j, i) => [
    String(i + 1),
    j.title,
    j.company,
    j.location || "—",
    j.posted || "—",
    j.source,
    j.url,
  ]);

  const headers = ["#", "Title", "Company", "Location", "Posted", "Source", "URL"];
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length))
  );

  const line = (cols: string[]) =>
    "| " + cols.map((c, i) => c.padEnd(widths[i])).join(" | ") + " |";
  const divider = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";

  return [line(headers), divider, ...rows.map(line)].join("\n");
}

const SETUP_INSTRUCTIONS = `
Before using this tool, make sure you have completed the following steps:

**1. Install dependencies**
\`\`\`bash
npm install
npm run build
npx playwright install chromium
\`\`\`

**2. Log in to each job board in Google Chrome**
Open Chrome and sign in to:
- LinkedIn → https://www.linkedin.com/login
- Indeed → https://secure.indeed.com/auth
- ZipRecruiter → https://www.ziprecruiter.com/login
- Glassdoor → https://www.glassdoor.com/profile/login_input.htm

**3. Close Chrome before searching**
The tool borrows your Chrome login sessions. Chrome must be fully closed (not just minimized) when you run a search, otherwise it falls back to a logged-out session and returns fewer results.

**4. You're ready!**
Attach your resume PDF to Claude and say:
> "Look at my resume, figure out what role I'm best suited for, and search for matching jobs posted in the last 24 hours"

Run \`check_setup\` at any time to verify your environment is correctly configured.
`.trim();

const TOOLS = [
  {
    name: "diagnose_logins",
    description:
      "Opens each job board in a real browser window and checks whether you are logged in. " +
      "Run this if Indeed, ZipRecruiter, or Glassdoor are returning zero results.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "check_setup",
    description:
      "Run this first. Verifies that Node.js, Chrome, and Playwright are correctly installed, " +
      "and shows a checklist of job board logins required before searching.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "search_jobs",
    description:
      "Search for job listings across LinkedIn, Indeed, ZipRecruiter, and Glassdoor in parallel. " +
      "Use this after extracting the target role from a resume. " +
      "Requires Chrome to be closed and the user to be logged into each job board in Chrome.",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", description: "Job title to search, e.g. 'Full Stack Developer'" },
        location: { type: "string", description: "Optional location, e.g. 'New York' or 'Remote'" },
        limit: { type: "number", description: "Max results per board (default 100)" },
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
  { capabilities: { tools: {}, prompts: {} } }
);

// Prompts — shows as a slash command in Claude desktop
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "setup",
      description: "Show setup instructions for the Job Search MCP tool",
    },
    {
      name: "search-from-resume",
      description: "Search for jobs based on your resume — attach your PDF first",
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === "setup") {
    return {
      description: "Job Search MCP — Setup Instructions",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please show me the setup instructions for the Job Search MCP tool and then run check_setup to verify my environment.\n\n${SETUP_INSTRUCTIONS}`,
          },
        },
      ],
    };
  }

  if (request.params.name === "search-from-resume") {
    return {
      description: "Search jobs from resume",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "I have attached my resume PDF. Please read it, identify the role I am best suited for, and then use search_jobs to find matching positions posted in the last 24 hours. Present the results in a clear, readable list grouped by job board.",
          },
        },
      ],
    };
  }

  throw new Error(`Unknown prompt: ${request.params.name}`);
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const role = args?.role as string;
  const location = (args?.location as string) ?? "";
  const limit = (args?.limit as number) ?? 100;
  const hours = (args?.hours as number) ?? 24;

  try {
    if (name === "diagnose_logins") {
      const report = await diagnoseLogins();
      return { content: [{ type: "text", text: report }] };
    }

    if (name === "check_setup") {
      const { report } = await checkSetup();
      return { content: [{ type: "text", text: report }] };
    }

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

        if (allJobs.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No jobs found. This usually means Chrome is open (close it and try again) or you are not logged in to the job boards.\n\nRun check_setup to diagnose.\n\n${SETUP_INSTRUCTIONS}`,
            }],
          };
        }

        const summary = Object.entries(sources)
          .map(([board, count]) => `${board}: ${count}`)
          .join(" | ");

        return {
          content: [{
            type: "text",
            text: `**Total: ${allJobs.length} jobs** (${summary})\n\n${toTable(allJobs)}`,
          }],
        };
      } finally {
        await context.close();
      }
    }

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
        text: `**Total: ${jobs.length} jobs**\n\n${toTable(jobs)}`,
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
