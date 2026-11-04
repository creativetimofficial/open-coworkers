import { listCoworkers } from "@/lib/team"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function GET() {
  return Response.json({ coworkers: listCoworkers() })
}
