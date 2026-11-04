import { listDocs } from "@/lib/workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function GET() {
  return Response.json({ docs: listDocs() })
}
