import type { AppInfo } from "@agent-starters/kit/agent"
import { createBroker } from "@agent-starters/kit/tools/broker"
import { webTools } from "@agent-starters/kit/tools/web"

import { handoff } from "@/lib/handoffs"
import { workspaceTools } from "@/lib/workspace"
import type { ToolDefinition } from "@agent-starters/kit/tools/types"

export const app: AppInfo = { id: "open-coworkers", version: "0.1.0" }

/** Every tool this app can run; each coworker's policies in coworkers.config.ts decide who may use what. */
export const broker = createBroker([...webTools(app), ...workspaceTools, handoff as ToolDefinition<unknown>])
