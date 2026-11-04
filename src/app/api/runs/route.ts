import { startTurn } from "@agent-starters/kit/turn"
import { z } from "zod"

import { app, broker } from "@/lib/agent"
import { runDemo } from "@/lib/demo"
import { nextFromHandoff } from "@/lib/handoffs"
import { profileFor } from "@/lib/team"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// A turn (and the hand-offs it starts) can wait minutes for approvals.
export const maxDuration = 800

const body = z.object({
  coworkerId: z.string().min(1),
  threadId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(8000),
})

/**
 * POST /api/runs { coworkerId, message, threadId? }: run a turn with one
 * coworker and stream its events (SSE), followed by any hand-offs it makes.
 */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Send { coworkerId, message, threadId? }." }, { status: 400 })
  const agent = profileFor(parsed.data.coworkerId)
  if (!agent) return Response.json({ error: "No such coworker." }, { status: 404 })
  return startTurn({
    first: { agent, threadId: parsed.data.threadId, message: parsed.data.message },
    broker,
    app,
    demo: runDemo,
    next: nextFromHandoff,
    maxChain: 4,
  })
}
