import { baseCapabilities, type CapabilityRow } from "@agent-starters/kit/capabilities"

import { suggestions, workspace } from "../../coworkers.config"
import { app } from "@/lib/agent"
import { listCoworkers } from "@/lib/team"

/** The lite-vs-Hermes matrix shown under Setup, for this starter. */
export const MATRIX: CapabilityRow[] = [
  { capability: "Specialist coworkers with their own tool permissions", lite: "yes", hermes: "yes" },
  { capability: "Shared workspace documents, with versions", lite: "yes", hermes: "yes" },
  { capability: "Hand-offs between coworkers", lite: "yes", hermes: "yes", note: "Queued: the next coworker starts when the current one finishes" },
  { capability: "Approval before side effects", lite: "yes", hermes: "yes" },
  { capability: "Audit row before every tool call", lite: "yes", hermes: "yes" },
  { capability: "Web search with numbered citations", lite: "yes", hermes: "yes" },
  { capability: "Memory across threads", lite: "no", hermes: "yes", note: "Hermes memory is shared by the whole team (one Hermes profile)" },
  { capability: "Files, terminal, browser in a sandbox", lite: "no", hermes: "off-by-default", note: "Enable toolsets in hermes/config.yaml" },
  { capability: "Recurring responsibilities (cron)", lite: "no", hermes: "not-in-ui-yet", note: "Hermes cron works; this UI does not manage schedules yet" },
  { capability: "Runs on serverless hosting (Vercel)", lite: "yes", hermes: "no" },
]

export function capabilities() {
  return {
    ...baseCapabilities(app, MATRIX),
    workspace,
    suggestions,
    team: listCoworkers(),
  }
}

export type Capabilities = ReturnType<typeof capabilities>
