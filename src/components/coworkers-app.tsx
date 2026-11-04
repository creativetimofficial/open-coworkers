"use client"

import { Badge } from "@agent-starters/ui/components/badge"
import { Button } from "@agent-starters/ui/components/button"
import { Input, Textarea } from "@agent-starters/ui/components/input"
import { AppShell, SidebarBrand, SidebarSection, StatusChips, ThreadList } from "@agent-starters/ui/agent/app-shell"
import { ChatView } from "@agent-starters/ui/agent/chat-view"
import { Markdown } from "@agent-starters/ui/agent/markdown"
import { AuditPanel, CapabilityTable, Empty, List, Panel, PolicyList, Row, SearchProviders } from "@agent-starters/ui/agent/panels"
import { useAgentChat } from "@agent-starters/ui/agent/use-agent-chat"
import { ConfirmationField } from "@agent-starters/ui/elements/confirmation"
import { ConversationEmptyState } from "@agent-starters/ui/elements/conversation"
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@agent-starters/ui/elements/prompt-input"
import { Suggestion, Suggestions } from "@agent-starters/ui/elements/suggestion"
import { cn } from "@agent-starters/ui/lib/utils"
import { ChevronLeft, FileText, Users } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import type { Capabilities } from "@/lib/capabilities"

type Coworker = Capabilities["team"][number]

interface DocSummary {
  id: string
  title: string
  version: number
  author_agent_id: string
  updated_at: string
}

const TOOL_LABEL: Record<string, string> = {
  "search.web": "Web search",
  "page.read": "Read page",
  "doc.list": "List documents",
  "doc.read": "Read document",
  "doc.write": "Save document",
  "team.handoff": "Hand off",
}
const toolLabel = (tool: string) => TOOL_LABEL[tool] ?? tool

export function CoworkersApp({ initialCapabilities: caps }: { initialCapabilities: Capabilities }) {
  const [team, setTeam] = useState<Coworker[]>(caps.team)
  const [selected, setSelected] = useState<string>(caps.team[0]?.id ?? "")
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const [version, setVersion] = useState(0)
  const chat = useAgentChat({
    body: () => ({ coworkerId: selectedRef.current }),
    onEvent: (e) => {
      if (e.type === "tool_result" && e.ok && e.tool === "doc.write") setVersion((v) => v + 1)
    },
    onSettled: () => setVersion((v) => v + 1),
  })
  const [tab, setTab] = useState("workspace")
  const [input, setInput] = useState("")

  const nameOf = (id: string) => team.find((c) => c.id === id)?.name ?? id
  const me = team.find((c) => c.id === selected)

  const switchTo = (id: string) => {
    if (chat.running) return
    setSelected(id)
    selectedRef.current = id
    chat.reset()
  }

  const send = (text: string, coworkerId = selected) => {
    if (chat.running) return
    if (coworkerId !== selected) switchTo(coworkerId)
    setInput("")
    void chat.send(text, { id: coworkerId, name: nameOf(coworkerId) }, { coworkerId })
  }

  return (
    <AppShell
      sidebar={
        <>
          <SidebarBrand name={caps.workspace.name} tagline={caps.workspace.tagline} icon={<Users />} />
          <SidebarSection title="Team">
            <ul className="space-y-0.5">
              {team.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => switchTo(c.id)}
                    className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors", c.id === selected ? "bg-brand/12" : "hover:bg-foreground/5")}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-brand/80 to-brand text-sm font-semibold text-white shadow-soft">{c.name.slice(0, 1)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.role}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </SidebarSection>
          <SidebarSection
            title={`With ${me?.name ?? ""}`}
            className="min-h-0 flex-1 overflow-y-auto"
            action={
              <button onClick={() => switchTo(selected)} className="text-brand hover:underline">
                New
              </button>
            }
          >
            <ThreadList
              threads={chat.threads.filter((t) => t.agent_id === selected)}
              activeId={chat.threadId}
              onSelect={(t) => void chat.openThread(t.id, { id: t.agent_id, name: nameOf(t.agent_id) })}
              onDelete={(id) => void chat.deleteThread(id)}
            />
          </SidebarSection>
        </>
      }
      header={<StatusChips caps={caps} />}
      composer={
        <PromptInput onSubmit={() => send(input)}>
          <PromptInputTextarea value={input} onChange={(e) => setInput(e.target.value)} onSubmit={() => send(input)} placeholder={`Message ${me?.name ?? ""}…`} />
          <PromptInputFooter>
            <PromptInputTools>
              To <span className="font-medium text-foreground">{me?.name}</span>, {me?.role}
            </PromptInputTools>
            <PromptInputSubmit running={chat.running} disabled={!input.trim()} onStop={() => void chat.stop()} />
          </PromptInputFooter>
        </PromptInput>
      }
      tab={tab}
      onTabChange={setTab}
      tabs={[
        { id: "workspace", label: "Workspace", content: <WorkspacePanel version={version} nameOf={nameOf} /> },
        { id: "activity", label: "Activity", content: <AuditPanel version={version} label={toolLabel} agentName={nameOf} /> },
        { id: "team", label: "Team", content: <TeamPanel team={team} onSaved={setTeam} /> },
        {
          id: "setup",
          label: "Setup",
          content: (
            <div className="space-y-6">
              <Panel title="Search">
                <SearchProviders search={caps.search} />
              </Panel>
              <Panel title="Lite vs Hermes">
                <CapabilityTable matrix={caps.matrix} />
              </Panel>
            </div>
          ),
        },
      ]}
    >
      <ChatView
        turns={chat.turns}
        approvals={chat.approvals}
        onDecide={(id, d) => void chat.decide(id, d)}
        error={chat.error}
        toolLabel={toolLabel}
        renderApproval={(a) => {
          if (a.tool !== "doc.write") return null
          const { title, body } = (a.input ?? {}) as { title?: string; body?: string }
          return {
            title: `${a.agentId ? nameOf(a.agentId) : "A coworker"} wants to save a document`,
            approveLabel: "Save",
            body: (
              <div className="space-y-2">
                <ConfirmationField label="Title">{title}</ConfirmationField>
                <div className="max-h-56 overflow-y-auto rounded-lg bg-muted p-3">
                  <Markdown text={body ?? ""} />
                </div>
              </div>
            ),
          }
        }}
        empty={
          <ConversationEmptyState icon={<Users className="size-6" />} title={`Working with ${me?.name ?? "the team"}`} description={me?.role}>
            <Suggestions className="mt-4 max-w-2xl">
              {caps.suggestions.map((s) => (
                <Suggestion key={s.text} suggestion={s.text} label={`To ${nameOf(s.coworker)}`} onClick={(text) => send(text, s.coworker)} />
              ))}
            </Suggestions>
          </ConversationEmptyState>
        }
      />
    </AppShell>
  )
}

function WorkspacePanel({ version, nameOf }: { version: number; nameOf: (id: string) => string }) {
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [open, setOpen] = useState<{ id: string; title: string; body: string; version: number } | null>(null)
  useEffect(() => {
    void fetch("/api/docs")
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then((d: { docs: DocSummary[] }) => setDocs(d.docs))
  }, [version])

  if (open) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setOpen(null)}>
          <ChevronLeft /> All documents
        </Button>
        <div className="rounded-xl border bg-card p-4 shadow-soft">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold tracking-tight">
            {open.title} <Badge variant="outline">v{open.version}</Badge>
          </h2>
          <Markdown text={open.body} />
        </div>
      </div>
    )
  }
  if (docs.length === 0) return <Empty>Documents the team saves appear here. Every save keeps the previous version.</Empty>
  return (
    <List>
      {docs.map((d) => (
        <Row
          key={d.id}
          title={
            <span className="flex items-center gap-2">
              <FileText className="size-3.5 text-brand" /> {d.title}
            </span>
          }
          detail={`v${d.version} · ${nameOf(d.author_agent_id)} · ${new Date(d.updated_at).toLocaleString()}`}
          onClick={async () => {
            const res = await fetch(`/api/docs/${d.id}`)
            if (res.ok) setOpen(((await res.json()) as { doc: { id: string; title: string; body: string; version: number } }).doc)
          }}
        />
      ))}
    </List>
  )
}

function TeamPanel({ team, onSaved }: { team: Coworker[]; onSaved: (team: Coworker[]) => void }) {
  const [editing, setEditing] = useState<Coworker | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    const res = await fetch("/api/coworkers")
    if (res.ok) onSaved(((await res.json()) as { coworkers: Coworker[] }).coworkers)
  }, [onSaved])

  if (editing) {
    return (
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setSaving(true)
          await fetch(`/api/coworkers/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: editing.name, role: editing.role, instructions: editing.instructions }),
          })
          setSaving(false)
          setEditing(null)
          await reload()
        }}
      >
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
          <ChevronLeft /> Team
        </Button>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Name</span>
          <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Role</span>
          <Input value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Instructions</span>
          <Textarea value={editing.instructions} onChange={(e) => setEditing({ ...editing, instructions: e.target.value })} rows={10} className="text-xs" />
        </label>
        <p className="text-xs text-muted-foreground">Tool permissions are set in coworkers.config.ts, not here.</p>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="brand" size="sm" disabled={saving}>
            Save
          </Button>
          {editing.edited && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={async () => {
                await fetch(`/api/coworkers/${editing.id}`, { method: "DELETE" })
                setEditing(null)
                await reload()
              }}
            >
              Reset to config
            </Button>
          )}
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-6">
      {team.map((c) => (
        <Panel
          key={c.id}
          title={`${c.name} · ${c.role}`}
          action={
            <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setEditing(c)}>
              Edit
            </Button>
          }
        >
          <PolicyList policies={c.tools} label={toolLabel} />
        </Panel>
      ))}
    </div>
  )
}
