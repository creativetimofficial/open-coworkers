import type { Metadata } from "next"
import type { ReactNode } from "react"

import "./globals.css"

export const metadata: Metadata = {
  title: "Open Coworkers",
  description: "Specialist AI coworkers that share a workspace and hand work to each other.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
