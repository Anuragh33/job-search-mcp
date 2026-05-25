---
title: Job Search MCP
emoji: 🔍
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# job-search-mcp

MCP server that scrapes job listings from LinkedIn, Indeed, ZipRecruiter, and Glassdoor using your local Chrome session. Attach your resume PDF to Claude, and it will extract your target role and search across all boards in parallel.

## How it works

- Uses your existing Chrome login sessions — no API keys needed
- Paginates each board to return up to 100 results per source (400 total)
- Filters to jobs posted within the last 24 hours by default

## Requirements

- Node.js 20+
- Google Chrome installed and logged into the job boards you want to search
- Claude desktop app

## Setup

**1. Clone and build**

```bash
git clone https://github.com/YOUR_USERNAME/job-search-mcp.git
cd job-search-mcp
npm install
npm run build
npx playwright install chromium
```

**2. Add to Claude desktop config**

Open `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) and add:

```json
{
  "mcpServers": {
    "job-search": {
      "command": "node",
      "args": ["/absolute/path/to/job-search-mcp/dist/index.js"]
    }
  }
}
```

On Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**3. Restart Claude desktop app**

## Usage

In Claude desktop, attach your resume PDF and say:

> "Look at my resume, figure out what role I'm best suited for, and search for matching jobs posted in the last 24 hours"

## Tools

| Tool | Description |
|------|-------------|
| `search_jobs` | Search all 4 boards in parallel |
| `search_linkedin` | LinkedIn only |
| `search_indeed` | Indeed only |
| `search_ziprecruiter` | ZipRecruiter only |
| `search_glassdoor` | Glassdoor only |

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `role` | required | Job title to search, e.g. `"Full Stack Developer"` |
| `location` | none | Location filter, e.g. `"New York"` or `"Remote"` |
| `limit` | 100 | Max results per board |
| `hours` | 24 | Only return jobs posted within this many hours |

## Notes

- Close Chrome before running searches for best results — Chrome locks its profile when open, causing a fallback to a logged-out session
- LinkedIn and Glassdoor return more data when logged in
- Results vary by how many jobs were posted in the time window
