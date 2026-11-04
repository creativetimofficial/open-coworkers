import { docVersions, getDoc } from "@/lib/workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/docs/{id}: the document and its version history. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const doc = getDoc(id)
  if (!doc) return Response.json({ error: "Document not found." }, { status: 404 })
  return Response.json({ doc, versions: docVersions(id) })
}
