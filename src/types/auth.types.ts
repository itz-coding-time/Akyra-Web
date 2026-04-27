import type { Database } from "./database.types"

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type License = Database["public"]["Tables"]["licenses"]["Row"]
export type Store = Database["public"]["Tables"]["stores"]["Row"]
export type Associate = Database["public"]["Tables"]["associates"]["Row"]

export type AuthStatus =
  | "idle"
  | "loading"
  | "signed-in"
  | "signed-in-past-due"
  | "signed-out"
  | "error"

export type OnboardingStep =
  | "welcome-phrase"
  | "store-number"
  | "name"
  | "pin"
  | "complete"

export interface AuthState {
  status: AuthStatus
  profile: Profile | null
  licenseWarning: string | null
  error: string | null
  showPasskeyPrompt?: boolean
}

export type SignInResult =
  | { kind: "success"; profile: Profile; warning: string | null }
  | { kind: "first-login"; eeid: string }
  | { kind: "new-user"; eeid: string }
  | { kind: "error"; message: string }

export interface OrgBranding {
  id: string
  name: string
  brandName: string | null
  brandColor: string
  logoUrl: string | null
  terminology: {
    associate: string
    supervisor: string
    station: string
    shift: string
    mod: string
    roles: {
      crew: string
      supervisor: string
      assistant_manager: string
      store_manager: string
      district_admin: string
      org_admin: string
      db_admin: string
    }
  }
}

export interface OrgStation {
  id: string
  orgId: string
  name: string
  emoji: string
  description: string | null
  isSupervisorOnly: boolean
  isFloat: boolean
  displayOrder: number
}
