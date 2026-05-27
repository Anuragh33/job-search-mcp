# job-search-mcp

MCP server that searches job listings across LinkedIn, Indeed, ZipRecruiter, and Glassdoor in parallel — no login, no API keys. Uses Crawlee's stealth browser to bypass bot detection.

Attach your resume PDF to Claude and it will extract your target role, run all four boards at once, and save results as a CSV on your Desktop.

## How it works

- Stealth browser via Crawlee + Playwright — no Chrome profile or login required
- All four boards scraped in parallel
- Results filtered to jobs posted within the last 24 hours by default
- `search_and_export` saves a ready-to-open Excel CSV to your Desktop

## Requirements

- Node.js 20+
- Claude desktop app

## Setup

**1. Clone and build**

```bash
git clone https://github.com/Anuragh33/job-search-mcp.git
cd job-search-mcp
npm install
npm run build
npx playwright install chromium
```

**2. Add to Claude desktop config**

Open `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows) and add:

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

**3. Restart Claude desktop app**

## Usage

Attach your resume PDF and say:

> "Look at my resume, figure out what role I'm best suited for, and search for matching jobs posted in the last 24 hours"

Or use the built-in prompt `search-from-resume` from the Claude prompts menu.

## Tools

| Tool | Description |
|------|-------------|
| `search_and_export` | Search all 4 boards and save results as a CSV on your Desktop |
| `search_jobs` | Search all 4 boards and return JSON results |
| `search_linkedin` | LinkedIn only |
| `search_indeed` | Indeed only |
| `search_ziprecruiter` | ZipRecruiter only |
| `search_glassdoor` | Glassdoor only |
| `check_setup` | Verify Node.js and Playwright are installed correctly |
| `diagnose_logins` | Check that all four job boards are reachable |

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `role` | required | Job title to search, e.g. `"Full Stack Developer"` |
| `location` | `"United States"` | Location filter, e.g. `"New York"` or `"Remote"` |
| `limit` | `100` | Max results per board |
| `hours` | `24` | Only return jobs posted within this many hours |

## Prompts

| Prompt | Description |
|--------|-------------|
| `setup` | Show setup instructions and verify your environment |
| `search-from-resume` | Attach your resume PDF — Claude extracts your role and runs the full search |

## HTTP server mode

The repo also includes a standalone HTTP server for use without Claude:

```bash
npm run start:server
# Runs on port 3001 by default (override with PORT env var)
```

```
GET /search?role=Software+Engineer&location=Remote&limit=50&hours=48
GET /health
```

## Docker

```bash
docker build -t job-search-mcp .
docker run -p 3001:3001 job-search-mcp
```
