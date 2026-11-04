import type { AgentProfile } from "@agent-starters/kit/agent"
import { mcpPost } from "@agent-starters/kit/mcp"

import { app, broker } from "@/lib/agent"
import { listCoworkers, OUTSIDE_TURN, profileFor } from "@/lib/team"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// A tools/call can wait for a person's approval.
export const maxDuration = 800

const team = () => listCoworkers().map((c) => profileFor(c.id)).filter((p): p is AgentProfile => p !== undefined)

/** POST /api/mcp: the team's tools as an MCP server, for Hermes. Bearer TOOL_TOKEN required. */
export function POST(request: Request) {
  return mcpPost({ broker, app, agents: team, defaultAgent: () => OUTSIDE_TURN }, request)
}

/** No server-initiated stream is offered. */
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } })
}
