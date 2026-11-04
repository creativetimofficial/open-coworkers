/**
 * The team: each coworker's role, starting instructions, the tools it may use
 * and on what terms. Names, roles and instructions can be edited in the app
 * (Team tab); tool policies only here, so what a coworker may do is decided
 * in code you review, never from the browser.
 *
 * Policies are enforced by the tool broker on the server for every runtime:
 *   allow    runs without asking
 *   approve  waits for a person to approve each call
 *   deny     (or missing) never runs, and is not offered to the model
 */

import { DEFAULT_LIMITS, type AgentLimits, type ToolPolicy } from "@agent-starters/kit/agent"

export interface CoworkerSeed {
  id: string
  name: string
  role: string
  instructions: string
  tools: Record<string, ToolPolicy>
  limits: AgentLimits
}

export const workspace = {
  name: "Open Coworkers",
  tagline: "Specialist AI coworkers that share a workspace and hand work to each other.",
}

export const coworkers: CoworkerSeed[] = [
  {
    id: "researcher",
    name: "Ria",
    role: "Researcher",
    instructions: [
      "You find and check facts. Search the web, read the most relevant pages, and keep notes in the workspace.",
      "Cite every fact with a numbered marker like [1] that refers to a source you retrieved in this turn. Never invent a source.",
      "Save your findings as a workspace document (doc_write) with the sources listed, so teammates can use them.",
      "When the user wants something written from your research, hand it off to the Writer with a clear task and the document ids.",
    ].join("\n"),
    tools: {
      "search.web": "allow",
      "page.read": "allow",
      "doc.list": "allow",
      "doc.read": "allow",
      "doc.write": "allow",
      "team.handoff": "allow",
    },
    limits: DEFAULT_LIMITS,
  },
  {
    id: "writer",
    name: "Wes",
    role: "Writer",
    instructions: [
      "You turn research into clear writing: drafts, summaries, posts, briefs.",
      "Work only from workspace documents and what the user gives you; you cannot search the web. If facts are missing, hand the gap back to the Researcher.",
      "Keep the numbered citations from the research notes you use, and list those sources at the end.",
      "Save drafts as workspace documents (doc_write); a person approves each save.",
    ].join("\n"),
    tools: {
      "doc.list": "allow",
      "doc.read": "allow",
      "doc.write": "approve",
      "team.handoff": "allow",
    },
    limits: DEFAULT_LIMITS,
  },
]

export const suggestions = [
  { coworker: "researcher", text: "Research what changed in the EU AI Act for 2026, save notes, then have Wes write a one-page brief." },
  { coworker: "researcher", text: "Find three credible sources on the four-day work week and save them to the workspace." },
  { coworker: "writer", text: "Draft a short LinkedIn post from the latest research notes in the workspace." },
]
