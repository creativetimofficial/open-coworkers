import { getDb, now, registerSchema } from "@agent-starters/kit/db"
import type { ToolDefinition } from "@agent-starters/kit/tools/types"
import { z } from "zod"

/**
 * The shared workspace: markdown documents every coworker can read, written
 * through the broker so each save is audited (and approved, for coworkers
 * whose policy says so). Every save keeps the previous version.
 */

registerSchema(`
CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  version INTEGER NOT NULL,
  author_agent_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS doc_versions (
  doc_id TEXT NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_agent_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (doc_id, version)
);
`)

export interface Doc {
  id: string
  title: string
  body: string
  version: number
  author_agent_id: string
  created_at: string
  updated_at: string
}

export function listDocs(): Omit<Doc, "body">[] {
  return getDb().prepare("SELECT id, title, version, author_agent_id, created_at, updated_at FROM docs ORDER BY updated_at DESC").all() as unknown as Omit<
    Doc,
    "body"
  >[]
}

export function getDoc(id: string): Doc | undefined {
  return getDb().prepare("SELECT * FROM docs WHERE id = ?").get(id) as unknown as Doc | undefined
}

/** Create a document, or save a new version of an existing one. */
export function writeDoc(input: { id?: string; title: string; body: string }, authorAgentId: string): Doc {
  const at = now()
  const db = getDb()
  const existing = input.id ? getDoc(input.id) : undefined
  if (input.id && !existing) throw new Error(`No document with id ${input.id}. Omit id to create a new one.`)
  const doc: Doc = existing
    ? { ...existing, title: input.title, body: input.body, version: existing.version + 1, author_agent_id: authorAgentId, updated_at: at }
    : { id: crypto.randomUUID(), title: input.title, body: input.body, version: 1, author_agent_id: authorAgentId, created_at: at, updated_at: at }
  if (existing) {
    db.prepare("UPDATE docs SET title = ?, body = ?, version = ?, author_agent_id = ?, updated_at = ? WHERE id = ?").run(
      doc.title,
      doc.body,
      doc.version,
      doc.author_agent_id,
      doc.updated_at,
      doc.id
    )
  } else {
    db.prepare("INSERT INTO docs (id, title, body, version, author_agent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      doc.id,
      doc.title,
      doc.body,
      doc.version,
      doc.author_agent_id,
      doc.created_at,
      doc.updated_at
    )
  }
  db.prepare("INSERT INTO doc_versions (doc_id, version, title, body, author_agent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    doc.id,
    doc.version,
    doc.title,
    doc.body,
    authorAgentId,
    at
  )
  return doc
}

export function docVersions(id: string): { version: number; author_agent_id: string; created_at: string }[] {
  return getDb()
    .prepare("SELECT version, author_agent_id, created_at FROM doc_versions WHERE doc_id = ? ORDER BY version DESC")
    .all(id) as unknown as { version: number; author_agent_id: string; created_at: string }[]
}

const docList: ToolDefinition<Record<string, never>> = {
  id: "doc.list",
  name: "doc_list",
  description: "List the workspace documents (id, title, version, last author).",
  input: z.object({}),
  sideEffect: false,
  async execute() {
    const docs = listDocs()
    return {
      content: docs.length
        ? docs.map((d) => `${d.id}  "${d.title}"  v${d.version}  by ${d.author_agent_id}  ${d.updated_at}`).join("\n")
        : "The workspace is empty.",
      summary: `${docs.length} document(s) in the workspace`,
    }
  },
}

const docRead: ToolDefinition<{ id: string }> = {
  id: "doc.read",
  name: "doc_read",
  description: "Read a workspace document by id (from doc_list).",
  input: z.object({ id: z.string().min(1) }),
  sideEffect: false,
  async execute({ id }) {
    const doc = getDoc(id)
    if (!doc) throw new Error(`No document with id ${id}.`)
    return { content: `# ${doc.title} (v${doc.version}, by ${doc.author_agent_id})\n\n${doc.body}`, summary: `Read "${doc.title}" v${doc.version}` }
  },
}

const docWrite: ToolDefinition<{ id?: string; title: string; body: string }> = {
  id: "doc.write",
  name: "doc_write",
  description:
    "Save a workspace document in markdown. Omit id to create one; pass an id to save a new version of it (the old version is kept). Include the sources it relies on.",
  input: z.object({
    id: z.string().min(1).optional().describe("An existing document's id, to update it."),
    title: z.string().min(3).max(200),
    body: z.string().min(10).max(200_000),
  }),
  sideEffect: true,
  async execute(input, ctx) {
    const doc = writeDoc(input, ctx.agent.id)
    return { content: `Saved "${doc.title}" as ${doc.id} (v${doc.version}).`, summary: `${doc.version > 1 ? "Updated" : "Created"} "${doc.title}" v${doc.version}` }
  },
}

export const workspaceTools = [docList, docRead, docWrite] as ToolDefinition<unknown>[]
