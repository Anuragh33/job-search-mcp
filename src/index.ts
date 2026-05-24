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
import { loginSetup } from "./tools/login.js";
import { exportToCSV } from "./tools/export.js";
import type { Job } from "./types.js";

function toJSON(jobs: Job[], sources?: Record<string, number | string>): string {
  return JSON.stringify({ total: jobs.length, ...(sources && { sources }), jobs }, null, 2);
}

const SETUP_INSTRUCTIONS = `
Before using this tool, make sure you have completed the following steps:

**1. Install dependencies**
\`\`\`bash
npm install
npm run build
npx playwright install chromium
\`\`\`

**2. You're ready — no login required**
This tool searches LinkedIn, SimplyHired, Dice, and Remotive. None of these require an account.

Attach your resume PDF to Claude and say:
> "Look at my resume, figure out what role I'm best suited for, and search for matching jobs posted in the last 24 hours"

Run \`check_setup\` at any time to verify your environment is correctly configured.
`.trim();

const TOOLS = [
  {
    name: "search_and_export",
    description:
      "Search for jobs across all boards and save the results as a CSV file on the Desktop. " +
      "The file is named jobs_<role>_<today's date>.csv and opens directly in Excel. " +
      "Use this when the user wants job results saved to a file.",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", description: "Job title extracted from the resume" },
        location: { type: "string", description: "Location filter (default: United States)" },
        hours: { type: "number", description: "Only jobs posted within this many hours (default 24)" },
      },
      required: ["role"],
    },
  },
  {
    name: "login_setup",
    description:
      "Run this ONCE on first use. Opens a browser window and guides you through logging into " +
      "LinkedIn, Indeed, ZipRecruiter, and Glassdoor. Sessions are saved permanently — " +
      "you only need to run this again if cookies expire.",
    inputSchema: { type: "object", properties: {} },
  },
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
        location: { type: "string", description: "Location filter (default: 'United States'). Override with a city/state e.g. 'New York' or 'Remote'" },
        limit: { type: "number", description: "Max results per board (default 100). Total across all 4 boards = up to 400." },
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
        location: { type: "string", description: "Location filter (default: United States)" },
        limit: { type: "number", description: "Max results, default unlimited" },
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
        location: { type: "string", description: "Location filter (default: United States)" },
        limit: { type: "number", description: "Max results, default unlimited" },
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
        location: { type: "string", description: "Location filter (default: United States)" },
        limit: { type: "number", description: "Max results, default unlimited" },
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
        location: { type: "string", description: "Location filter (default: United States)" },
        limit: { type: "number", description: "Max results, default unlimited" },
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
  const location = (args?.location as string) ?? "United States";
  const limit = (args?.limit as number) ?? 100;
  const hours = (args?.hours as number) ?? 24;

  try {
    if (name === "search_and_export") {
      const context = await launchContext();
      try {
        const [p1, p2, p3] = await Promise.all([
          context.newPage(), context.newPage(), context.newPage(),
        ]);
        const [linkedin, indeed, ziprecruiter, glassdoor] = await Promise.allSettled([
          scrapeLinkedIn(p1, role, location, limit, hours),
          scrapeIndeed(p2, role, location, limit, hours),
          scrapeZipRecruiter(null, role, location, limit, hours),
          scrapeGlassdoor(p3, role, location, limit, hours),
        ]);
        const allJobs: Job[] = [
          ...(linkedin.status === "fulfilled" ? linkedin.value : []),
          ...(indeed.status === "fulfilled" ? indeed.value : []),
          ...(ziprecruiter.status === "fulfilled" ? ziprecruiter.value : []),
          ...(glassdoor.status === "fulfilled" ? glassdoor.value : []),
        ];
        const filePath = exportToCSV(allJobs, role);
        const sources = {
          linkedin: linkedin.status === "fulfilled" ? linkedin.value.length : 0,
          indeed: indeed.status === "fulfilled" ? indeed.value.length : 0,
          ziprecruiter: ziprecruiter.status === "fulfilled" ? ziprecruiter.value.length : 0,
          glassdoor: glassdoor.status === "fulfilled" ? glassdoor.value.length : 0,
        };
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total: allJobs.length,
              sources,
              file: filePath,
              message: `Saved ${allJobs.length} jobs to ${filePath}`,
            }, null, 2),
          }],
        };
      } finally {
        await context.close();
      }
    }

    if (name === "login_setup") {
      const report = await loginSetup();
      return { content: [{ type: "text", text: report }] };
    }

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
        const [p1, p2, p3] = await Promise.all([
          context.newPage(), context.newPage(), context.newPage(),
        ]);

        const [linkedin, indeed, ziprecruiter, glassdoor] = await Promise.allSettled([
          scrapeLinkedIn(p1, role, location, limit, hours),
          scrapeIndeed(p2, role, location, limit, hours),
          scrapeZipRecruiter(null, role, location, limit, hours),
          scrapeGlassdoor(p3, role, location, limit, hours),
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
              text: `No jobs found. Run check_setup to verify your environment, then try again.\n\n${SETUP_INSTRUCTIONS}`,
            }],
          };
        }

        return {
          content: [{
            type: "text",
            text: toJSON(allJobs, sources),
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
        text: toJSON(jobs),
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
