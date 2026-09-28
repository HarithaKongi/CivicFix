"use client"

import { ConvexReactClient } from "convex/react"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import type { ReactNode } from "react"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
const client = convexUrl ? new ConvexReactClient(convexUrl) : null

export function CivicFixConvexProvider({ children }: { children: ReactNode }) {
  if (!client) return <>{children}</>
  return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>
}
