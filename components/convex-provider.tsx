"use client"

import { ConvexReactClient } from "convex/react"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import type { ReactNode } from "react"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud"
const client = new ConvexReactClient(convexUrl)

export function CivicFixConvexProvider({ children }: { children: ReactNode }) {
  return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>
}
