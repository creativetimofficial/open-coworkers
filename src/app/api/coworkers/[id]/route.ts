import { z } from "zod"

import { resetCoworker, updateCoworker } from "@/lib/team"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Name, role and instructions only: tool policies are set in coworkers.config.ts.
const edit = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  role: z.string().trim().min(1).max(60).optional(),
  instructions: z.string().trim().min(10).max(8000).optional(),
})

/** PATCH /api/coworkers/{id}: edit a coworker's persona. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = edit.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Send { name?, role?, instructions? }." }, { status: 400 })
  const updated = updateCoworker((await params).id, parsed.data)
  if (!updated) return Response.json({ error: "No such coworker." }, { status: 404 })
  return Response.json({ coworker: updated })
}

/** DELETE /api/coworkers/{id}: back to the persona in coworkers.config.ts. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  resetCoworker((await params).id)
  return Response.json({ ok: true })
}
