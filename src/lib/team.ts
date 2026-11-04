import type { AgentProfile } from "@agent-starters/kit/agent"
import { getDb, now, registerSchema } from "@agent-starters/kit/db"

import { coworkers, workspace, type CoworkerSeed } from "../../coworkers.config"

/**
 * The team. coworkers.config.ts is the seed and the only source of tool
 * policies; a person can edit a coworker's name, role and instructions in the
 * app, which are kept here as overrides.
 */

registerSchema(`
CREATE TABLE IF NOT EXISTS coworker_overrides (
  id TEXT PRIMARY KEY,
  name TEXT,
  role TEXT,
  instructions TEXT,
  updated_at TEXT NOT NULL
);
`)

export interface Coworker {
  id: string
  name: string
  role: string
  instructions: string
  tools: CoworkerSeed["tools"]
  edited: boolean
}

interface OverrideRow {
  id: string
  name: string | null
  role: string | null
  instructions: string | null
}

function overrides(): Map<string, OverrideRow> {
  const rows = getDb().prepare("SELECT id, name, role, instructions FROM coworker_overrides").all() as unknown as OverrideRow[]
  return new Map(rows.map((r) => [r.id, r]))
}

export function listCoworkers(): Coworker[] {
  const edits = overrides()
  return coworkers.map((seed) => {
    const o = edits.get(seed.id)
    return {
      id: seed.id,
      name: o?.name ?? seed.name,
      role: o?.role ?? seed.role,
      instructions: o?.instructions ?? seed.instructions,
      tools: seed.tools,
      edited: Boolean(o),
    }
  })
}

export function getCoworker(id: string): Coworker | undefined {
  return listCoworkers().find((c) => c.id === id)
}

export function updateCoworker(id: string, edit: { name?: string; role?: string; instructions?: string }): Coworker | undefined {
  if (!coworkers.some((c) => c.id === id)) return undefined
  const current = overrides().get(id)
  getDb()
    .prepare(
      `INSERT INTO coworker_overrides (id, name, role, instructions, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role, instructions = excluded.instructions, updated_at = excluded.updated_at`
    )
    .run(id, edit.name ?? current?.name ?? null, edit.role ?? current?.role ?? null, edit.instructions ?? current?.instructions ?? null, now())
  return getCoworker(id)
}

export function resetCoworker(id: string) {
  getDb().prepare("DELETE FROM coworker_overrides WHERE id = ?").run(id)
}

/** A coworker as the runtimes and the broker see it: its instructions plus who its teammates are. */
export function profileFor(id: string): AgentProfile | undefined {
  const team = listCoworkers()
  const me = team.find((c) => c.id === id)
  const seed = coworkers.find((c) => c.id === id)
  if (!me || !seed) return undefined
  const mates = team.filter((c) => c.id !== id).map((c) => `- ${c.name} (${c.role}), id "${c.id}"`)
  return {
    id: me.id,
    name: me.name,
    limits: seed.limits,
    tools: seed.tools,
    instructions: [
      `You are ${me.name}, the ${me.role} on the ${workspace.name} team.`,
      me.instructions,
      mates.length ? `Your teammates:\n${mates.join("\n")}\nTo pass work on, call team_handoff with their id and a self-contained task; they start when you finish.` : "",
      "The workspace documents are shared with the team; read them before redoing work.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  }
}

/**
 * Who a tool call made outside any chat turn acts as (Hermes running on a
 * schedule, say): nobody, so every tool is denied rather than borrowed from a
 * coworker.
 */
export const OUTSIDE_TURN: AgentProfile = {
  id: "outside-turn",
  name: "No coworker",
  instructions: "",
  tools: {},
  limits: coworkers[0].limits,
}
