import { convexAuth } from "@convex-dev/auth/server"
import { Password } from "@convex-dev/auth/providers/Password"

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile: (params) => ({
        email: String(params.email ?? "").trim().toLowerCase(),
        name: String(params.name ?? "").trim(),
      }),
      validatePasswordRequirements: (password) => {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.")
      },
    }),
  ],
})

// Authorization helpers
export type UserRole = "citizen" | "department_staff" | "department_admin" | "super_admin"

export function isValidRole(role: unknown): role is UserRole {
  return ["citizen", "department_staff", "department_admin", "super_admin"].includes(String(role))
}

