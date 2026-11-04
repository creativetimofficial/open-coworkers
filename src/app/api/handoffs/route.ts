import { listHandoffs } from "@/lib/handoffs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function GET() {
  return Response.json({ handoffs: listHandoffs() })
}
