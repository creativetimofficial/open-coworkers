# Open Coworkers

Open-source AI coworkers: specialist agents with their own roles and tool permissions, a shared workspace of documents, and explicit hand-offs between them.

Out of the box the team is **Ria, a Researcher** (web search, page reading, workspace notes) and **Wes, a Writer** (works only from the workspace; every save he makes waits for your approval). Ask Ria to research something and have Wes write it up: she saves cited notes, hands off, and Wes's turn starts in the same view when hers ends.

Every tool call goes through one tool layer that applies the calling coworker's policy, asks you before anything its policy gates, and writes an audit row first. Wes cannot search the web because his policy denies it on the server, not because a prompt asks him not to.

| | **Lite** | **Hermes** |
|---|---|---|
| Start | `pnpm dev` | `docker compose up` |
| Where each coworker's turn runs | in this Next.js server | in a [Hermes Agent](https://github.com/NousResearch/hermes-agent) container |
| Per-coworker permissions, workspace, hand-offs, approvals, audit | yes | yes |
| Memory across threads | no | yes (shared by the team) |
| Files, terminal, browser in a sandbox | no | available, off by default |
| Recurring responsibilities | no | Hermes cron works; this UI does not manage schedules yet |
| Serverless hosting (Vercel) | yes | no |

> **Status: early.** Verified in CI: install, typecheck, unit and contract tests (permissions per coworker, approvals, workspace versions, hand-offs), production build, and Hermes starting with the team's tools loaded. No model or search call is made in CI without a configured key.

## Quick start (lite)

Needs Node.js 22.13+ (24 recommended; the Docker images use 24) and pnpm. From the repository root:

```bash
pnpm install
cp .env.example .env
pnpm dev
```

With no model key it runs a **DEMO**: scripted turns, clearly labelled, with no model or search call. The workspace tools, permissions, approvals and hand-offs in the demo are the real ones, so Ria's notes land in the workspace and Wes's draft waits for you to approve it.

Model and search setup are the same as [Open Research](https://github.com/creativetimofficial/open-research#choose-a-model): CompanyFabric (`companyfabric/auto`) by default, or OpenAI, or any local OpenAI-compatible endpoint; Parallel search with no key, or Exa.

## Run with Hermes

```bash
cp .env.example .env    # OPENAI_API_KEY, HERMES_API_KEY, TOOL_TOKEN (openssl rand -hex 32)
docker compose up --build
```

Each coworker turn is its own Hermes run with that coworker's instructions. Hermes calls the team's tools back over MCP (`/api/mcp`), and the app attributes each call to the coworker whose turn is running, so per-coworker policies hold in Hermes too. Hermes' own delegation is switched off, so hand-offs go through the app, where permissions apply. A tool call that arrives outside any coworker's turn is denied.

## Change the team

`coworkers.config.ts` defines the coworkers: id, name, role, instructions, and a policy per tool (`allow`, `approve`, or deny by leaving it out). Add a coworker by adding an entry. Tools available to policies:

| Tool id | What it does |
|---|---|
| `search.web` | web search with numbered sources |
| `page.read` | read a public page (SSRF-guarded) |
| `doc.list`, `doc.read` | browse the shared workspace |
| `doc.write` | create a document or save a new version (old versions are kept) |
| `team.handoff` | pass work to a teammate, who starts when the current turn ends |

In the app, the **Team** tab edits a coworker's name, role and instructions (stored as overrides; "Reset to config" drops them). Tool policies are not editable from the browser.

## How it is built

```
coworkers.config.ts        the team: personas and per-tool policies
src/lib/team.ts            profiles (config + persona edits), the outside-a-turn profile
src/lib/workspace.ts       shared documents with versions, and the doc tools
src/lib/handoffs.ts        team_handoff and the queue that starts the next turn
src/lib/demo.ts            the scripted DEMO turns
packages/kit/                    shared with every starter: tool broker, runtimes, MCP server, search, SQLite
```

## License

MIT. See `LICENSE` and `NOTICE`.

Not affiliated with any company whose products offer AI coworkers.


## More open-source agent starters

| | |
|---|---|
| [Open Research](https://github.com/creativetimofficial/open-research?ref=open-coworkers_readme) | Research with numbered citations you can check |
| [Social Autopilot](https://github.com/creativetimofficial/open-social?ref=open-coworkers_readme) | Research, write and schedule posts for your channels |
| [Open Exec](https://github.com/creativetimofficial/open-exec?ref=open-coworkers_readme) | An executive assistant for Gmail and Google Calendar |

Contributing: see [CONTRIBUTING.md](CONTRIBUTING.md). Security: see [SECURITY.md](SECURITY.md).
