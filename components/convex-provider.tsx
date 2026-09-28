"use client"

import { ConvexReactClient } from "convex/react"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import type { ReactNode } from "react"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is missing. Deploy CivicFix with the Convex Vercel build command so the production URL is injected.")
}

const client = new ConvexReactClient(convexUrl)

export function CivicFixConvexProvider({ children }: { children: ReactNode }) {
  return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>
}
