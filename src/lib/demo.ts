import type { Runtime } from "@agent-starters/kit/runtime/types"

/**
 * DEMO: scripted turns for a fresh clone with no model key. No model and no
 * search provider is called; the search results are fixtures (real, stable
 * pages with excerpts written here). The workspace tools, permissions,
 * approvals and hand-offs are the real ones, so the demo shows exactly how a
 * live team behaves: Ria saves notes and hands off, Wes's save waits for you.
 */

const SOURCES = [
  {
    title: "Model Context Protocol",
    url: "https://modelcontextprotocol.io/",
    snippet: "MCP is an open protocol that standardizes how applications provide context and tools to LLMs.",
  },
  {
    title: "Large language model",
    url: "https://en.wikipedia.org/wiki/Large_language_model",
    snippet: "A large language model is a language model trained with self-supervised learning on a vast amount of text.",
  },
]

const say = async (turn: Parameters<Runtime>[0], text: string) => {
  for (const word of text.split(/(?<=\s)/)) {
    turn.emit({ type: "message_delta", text: word })
    await new Promise((r) => setTimeout(r, 12))
  }
}

export const runDemo: Runtime = async (turn) => {
  const call = (name: string, input: unknown) =>
    turn.broker.runTool(name, input, `demo_${name}_${crypto.randomUUID().slice(0, 6)}`, {
      agent: turn.agent,
      runId: turn.runId,
      threadId: turn.threadId,
      initiator: "demo",
      signal: turn.signal,
      emit: turn.emit,
      sources: turn.sources,
      toolCalls: turn.toolCalls,
    })
  const usage = { inputTokens: 0, outputTokens: 0 }

  if (turn.agent.id === "researcher") {
    turn.emit({ type: "tool_requested", callId: "demo_search", tool: "search.web", input: { query: turn.message.slice(0, 120) } })
    for (const s of SOURCES) turn.sources.add({ ...s, provider: "demo" })
    turn.emit({ type: "tool_result", callId: "demo_search", tool: "search.web", ok: true, summary: `DEMO: ${SOURCES.length} fixture sources` })
    turn.emit({ type: "sources", sources: turn.sources.list() })
    const notes = await call("doc_write", {
      title: "Research notes (DEMO)",
      body: `DEMO notes, written by a script.\n\n- MCP standardizes how apps give tools to models [1].\n- Language models are trained on large text corpora [2].\n\nSources:\n1. ${SOURCES[0].url}\n2. ${SOURCES[1].url}`,
    })
    const docId = notes.content.match(/as ([0-9a-f-]{36})/)?.[1]
    await call("team_handoff", { to: "writer", task: "Write a three-sentence summary of the research notes for a newsletter, keeping the citations.", doc_ids: docId ? [docId] : [] })
    const text = "**DEMO: scripted turn. No model was called.** I saved research notes to the workspace and handed the write-up to Wes. Add a model key in `.env` for live work."
    await say(turn, text)
    return { text, usage }
  }

  const draft = await call("doc_write", {
    title: "Newsletter summary (DEMO)",
    body: "DEMO draft, written by a script.\n\nMCP gives models a standard way to use tools [1]. The models themselves are trained on large amounts of text [2]. Together they make agents that can act, not just answer.\n\nSources:\n1. https://modelcontextprotocol.io/\n2. https://en.wikipedia.org/wiki/Large_language_model",
  })
  const text = draft.ok
    ? "**DEMO: scripted turn. No model was called.** The draft is saved in the workspace."
    : `**DEMO: scripted turn. No model was called.** The draft was not saved: ${draft.content}`
  await say(turn, text)
  return { text, usage }
}
