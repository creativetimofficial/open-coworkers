import { CoworkersApp } from "@/components/coworkers-app"
import { capabilities } from "@/lib/capabilities"

export const dynamic = "force-dynamic"

export default function Page() {
  return <CoworkersApp initialCapabilities={capabilities()} />
}
