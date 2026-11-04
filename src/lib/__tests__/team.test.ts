import { openDb, useDb } from "@agent-starters/kit/db"
import type { AgentEvent } from "@agent-starters/kit/events"
import { SourceLedger } from "@agent-starters/kit/tools/types"
import { beforeEach, describe, expect, it } from "vitest"

import { broker } from "@/lib/agent"
import { listHandoffs, nextFromHandoff } from "@/lib/handoffs"
import { getCoworker, OUTSIDE_TURN, profileFor, resetCoworker, updateCoworker } from "@/lib/team"
import { docVersions, getDoc, listDocs } from "@/lib/workspace"

beforeEach(() => useDb(openDb(":memory:")))

const ctx = (agentId: string, runId = "run-1", events: AgentEvent[] = []) => ({
  agent: profileFor(agentId)!,
  runId,
  threadId: null,
  initiator: "lite" as const,
  signal: new AbortController().signal,
  emit: (e: AgentEvent) => events.push(e),
  sources: new SourceLedger(),
  toolCalls: { count: 0 },
})

describe("permissions per coworker", () => {
  it("gives the researcher web tools and keeps them from the writer", async () => {
    expect(broker.offeredTools(profileFor("researcher")!).map((t) => t.name).sort()).toEqual(["doc_list", "doc_read", "doc_write", "page_read", "search_web", "team_handoff"])
    expect(broker.offeredTools(profileFor("writer")!).map((t) => t.name).sort()).toEqual(["doc_list", "doc_read", "doc_write", "team_handoff"])
    const refused = await broker.runTool("search_web", { query: "eu ai act" }, "c1", ctx("writer"))
    expect(refused.ok).toBe(false)
    expect(refused.content).toMatch(/not allowed to use search\.web/)
  })

  it("lets the researcher save notes freely, and holds the writer's save for approval", async () => {
    const saved = await broker.runTool("doc_write", { title: "Notes", body: "Facts with sources [1]." }, "c2", ctx("researcher"), async () => {
      throw new Error("must not ask")
    })
    expect(saved.ok).toBe(true)

    const events: AgentEvent[] = []
    const declined = await broker.runTool("doc_write", { title: "Draft", body: "A first draft of the brief." }, "c3", ctx("writer", "run-2", events), async () => "denied")
    expect(declined.ok).toBe(false)
    expect(events.some((e) => e.type === "approval_required")).toBe(true)
    expect(listDocs().map((d) => d.title)).toEqual(["Notes"])
  })

  it("denies every tool to a call made outside any coworker's turn", async () => {
    const result = await broker.runTool("doc_list", {}, "c4", { ...ctx("researcher"), agent: OUTSIDE_TURN })
    expect(result.ok).toBe(false)
  })
})

describe("workspace documents", () => {
  it("keeps every version and records who wrote it", async () => {
    await broker.runTool("doc_write", { title: "Notes", body: "First version of the notes." }, "c1", ctx("researcher"))
    const [doc] = listDocs()
    await broker.runTool("doc_write", { id: doc.id, title: "Notes", body: "Second version of the notes." }, "c2", ctx("researcher"))
    expect(getDoc(doc.id)).toMatchObject({ version: 2, body: "Second version of the notes.", author_agent_id: "researcher" })
    expect(docVersions(doc.id).map((v) => v.version)).toEqual([2, 1])
  })
})

describe("hand-offs", () => {
  it("queues a hand-off and turns it into the writer's next turn, with the documents named", async () => {
    await broker.runTool("doc_write", { title: "AI Act notes", body: "Obligations from August 2026 [1]." }, "c1", ctx("researcher", "run-r"))
    const [doc] = listDocs()
    const result = await broker.runTool("team_handoff", { to: "writer", task: "Write a one-page brief from the notes.", doc_ids: [doc.id] }, "c2", ctx("researcher", "run-r"))
    expect(result.ok).toBe(true)

    const next = nextFromHandoff({ runId: "run-r", threadId: "t1", agent: profileFor("researcher")!, text: "done", sources: [] })
    expect(next?.agent.id).toBe("writer")
    expect(next?.message).toContain("Hand-off from Ria")
    expect(next?.message).toContain(doc.id)
    expect(listHandoffs()[0].status).toBe("started")
    // Started once only.
    expect(nextFromHandoff({ runId: "run-r", threadId: "t1", agent: profileFor("researcher")!, text: "done", sources: [] })).toBeNull()
  })

  it("refuses hand-offs to oneself, to unknown teammates, and a second one in the same turn", async () => {
    expect((await broker.runTool("team_handoff", { to: "researcher", task: "Do it yourself please." }, "c1", ctx("researcher", "run-x"))).ok).toBe(false)
    expect((await broker.runTool("team_handoff", { to: "ghost", task: "Nobody is there to do this." }, "c2", ctx("researcher", "run-x"))).ok).toBe(false)
    expect((await broker.runTool("team_handoff", { to: "writer", task: "Write the summary please." }, "c3", ctx("researcher", "run-x"))).ok).toBe(true)
    expect((await broker.runTool("team_handoff", { to: "writer", task: "And another one, too." }, "c4", ctx("researcher", "run-x"))).ok).toBe(false)
  })
})

describe("persona edits", () => {
  it("edits name, role and instructions, never tool policies, and resets to the config", () => {
    updateCoworker("writer", { name: "Wren", instructions: "Write tight, plain prose for busy readers." })
    expect(getCoworker("writer")).toMatchObject({ name: "Wren", role: "Writer", edited: true })
    expect(profileFor("writer")?.instructions).toContain("You are Wren, the Writer")
    expect(profileFor("writer")?.tools["search.web"]).toBeUndefined()
    resetCoworker("writer")
    expect(getCoworker("writer")).toMatchObject({ name: "Wes", edited: false })
  })
})
