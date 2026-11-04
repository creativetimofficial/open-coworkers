import type { TurnRequest, CompletedTurn } from "@agent-starters/kit/turn"
import { getDb, now, registerSchema } from "@agent-starters/kit/db"
import type { ToolDefinition } from "@agent-starters/kit/tools/types"
import { z } from "zod"

import { getDoc } from "@/lib/workspace"
import { getCoworker, profileFor } from "@/lib/team"

/**
 * Hand-offs between coworkers. A coworker calls team_handoff during its turn;
 * the hand-off is recorded, and when that turn finishes the target coworker
 * starts a turn of its own with the task (in a new thread under its name).
 * Queued rather than nested, so it works the same on both runtimes and a
 * Hermes deployment only ever runs one turn at a time.
 */

registerSchema(`
CREATE TABLE IF NOT EXISTS handoffs (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  from_agent_id TEXT NOT NULL,
  to_agent_id TEXT NOT NULL,
  task TEXT NOT NULL,
  doc_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('pending', 'started', 'dropped')),
  created_at TEXT NOT NULL
);
`)

export interface HandoffRow {
  id: string
  run_id: string | null
  from_agent_id: string
  to_agent_id: string
  task: string
  doc_ids_json: string
  status: "pending" | "started" | "dropped"
  created_at: string
}

export function listHandoffs(limit = 50): HandoffRow[] {
  return getDb().prepare("SELECT * FROM handoffs ORDER BY created_at DESC LIMIT ?").all(limit) as unknown as HandoffRow[]
}

export const handoff: ToolDefinition<{ to: string; task: string; doc_ids?: string[] }> = {
  id: "team.handoff",
  name: "team_handoff",
  description:
    "Hand work to a teammate. They start when you finish this turn, with your task and the documents you list. Write the task so it stands on its own.",
  input: z.object({
    to: z.string().min(1).describe("The teammate's id."),
    task: z.string().min(10).max(4000),
    doc_ids: z.array(z.string()).max(10).optional().describe("Workspace documents they should start from."),
  }),
  sideEffect: false,
  async execute({ to, task, doc_ids }, ctx) {
    if (to === ctx.agent.id) throw new Error("You cannot hand off to yourself.")
    const target = getCoworker(to)
    if (!target) throw new Error(`No teammate with id "${to}".`)
    const missing = (doc_ids ?? []).filter((id) => !getDoc(id))
    if (missing.length) throw new Error(`No document with id ${missing.join(", ")}.`)
    // One hand-off per turn: a second one would never run.
    const existing = getDb().prepare("SELECT COUNT(*) AS n FROM handoffs WHERE run_id = ? AND status = 'pending'").get(ctx.runId) as unknown as { n: number }
    if (ctx.runId && existing.n > 0) throw new Error("You already handed off in this turn.")
    getDb()
      .prepare("INSERT INTO handoffs (id, run_id, from_agent_id, to_agent_id, task, doc_ids_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)")
      .run(crypto.randomUUID(), ctx.runId, ctx.agent.id, to, task, JSON.stringify(doc_ids ?? []), now())
    return { content: `Handed off to ${target.name} (${target.role}). They start when you finish; wrap up your answer now.`, summary: `Hand-off to ${target.name}` }
  },
}

/** The turn a completed turn's hand-off starts, if it made one. Used as startTurn's `next`. */
export function nextFromHandoff(done: CompletedTurn): TurnRequest | null {
  const row = getDb().prepare("SELECT * FROM handoffs WHERE run_id = ? AND status = 'pending' ORDER BY created_at LIMIT 1").get(done.runId) as unknown as
    | HandoffRow
    | undefined
  if (!row) return null
  const agent = profileFor(row.to_agent_id)
  if (!agent) {
    getDb().prepare("UPDATE handoffs SET status = 'dropped' WHERE id = ?").run(row.id)
    return null
  }
  getDb().prepare("UPDATE handoffs SET status = 'started' WHERE id = ?").run(row.id)
  const docs = (JSON.parse(row.doc_ids_json) as string[])
    .map((id) => getDoc(id))
    .filter((d) => d !== undefined)
    .map((d) => `- ${d.id} "${d.title}" (v${d.version})`)
  return {
    agent,
    message: [`Hand-off from ${done.agent.name}:`, row.task, docs.length ? `Start from these workspace documents:\n${docs.join("\n")}` : ""].filter(Boolean).join("\n\n"),
  }
}
