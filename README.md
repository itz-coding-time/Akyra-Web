# Akyra

**Shift Intelligence for 24/7 Operations.**

Akyra is a B2B SaaS platform built for the people actually on the floor — not the office, not corporate, not HR. A fast, installable Progressive Web App that gives associates their task queue and gives supervisors live visibility into what's happening right now.

No app store. No SSO integration. No clipboards.

---

## What It Does

**For Associates**
- Station claiming with a drop sequence — pick your post, get to work
- Task queue — one task at a time, in order, delegated by your supervisor
- Flip checklists with assume-true baseline
- Pull lists with live math — build-to minus on-hand equals what you pull tonight
- Code tracking — pull events create expiry dates automatically
- Radial menu on every task — complete, request help, view SOP, report issue, or burn a task to your MOD
- "Who's working with me?" — see your squad, their station, their current task
- Extraction sequence — final hour and final 15-minute warnings, Helldivers-style

**For Supervisors**
- Live station board — who claimed what, updated in real time via Supabase Realtime
- Task assignment and queuing — "Check Akyra" replaces the verbal task chain
- Trust-But-Verify — associates mark tasks done, supervisors confirm
- Leading By Exception — fast completions trigger photo verification, slow completions prompt reason logging
- Code Check — expiring items surface automatically, waste entry built in
- Equipment Issues kanban — flag broken equipment with photos, track to resolution
- JIT task creation — FAB for creating tasks on the fly
- Ghost Protocol — sessions expire after 10 hours, orphaned tasks escalate automatically

**For Org Admins**
- Full org configuration — branding, terminology, station archetypes, role display names
- Store Setup Wizard — seed any store via CSV upload, JSON import, or manual entry
- Cross-org DB Admin panel — manage organizations, stores, profiles, and licenses

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Auth | EEID + PIN · WebAuthn/FIDO2 Passkeys |
| Deploy | Vercel · PWA via vite-plugin-pwa |
| Data | PapaParse · Supabase Realtime |
| Icons | Lucide React |

---

## Architecture

```
src/
  components/       # Shared UI components + gamification
  context/          # Auth context — org branding, stations, session
  hooks/            # Data hooks — tasks, shifts, pacing, code check
  lib/              # Repository layer + utilities
    repository.ts   # All Supabase interactions
    timeEngine.ts   # Midnight-crossing shift math
    pacing.ts       # Task completion pacing engine
    csvImport.ts    # CSV inference and import
  pages/
    admin/          # DB Admin panel, org setup, store wizard
    associate/      # Station claim, task view, drop sequence
    dashboard/      # Supervisor overview, associates, schedule
    landing/        # Public landing page
  types/            # TypeScript interfaces
scripts/
  seed.ts           # Generalized store seeding (per-store config)
  importSchedule.ts # UKG schedule CSV importer
```

---

## Multi-Tenancy

Every table is scoped to `store_id` or `org_id`. Row-Level Security policies enforce data isolation at the database layer. One Supabase project serves every org — Sheetz and Wawa share the same tables, never the same rows.

New orgs onboard through the DB Admin panel — no SQL, no code changes, no deployments.

---

## Auth

Associates authenticate with their Employee ID (EEID) and a PIN they set on first login. The synthetic email format is:

```
{eeid}.{welcome_phrase}@akyra.internal
```

The Welcome Phrase is org-specific and unique. Two orgs with the same EEID never collide.

After first login, associates can enroll a WebAuthn passkey (Face ID / fingerprint) for biometric sign-in. No password managers, no SSO integrations, no IT tickets.

---

## Gamification

Akyra treats the shift like a match:

- **Drop Sequence** — Champion screen → station select → deployed
- **Radial Menu** — tap+hold any task for contextual actions
- **Leading By Exception** — fast completions trigger verification, slow completions log reasons
- **Extraction** — final hour and final 15-minute warnings surface priority tasks
- **Kill Leader** — highest performer per shift earns a Burn Card
- **Burn Cards** — assign one task to your supervisor. Earned, not given.

---

## Org Configuration

Every org can configure:

- **Brand identity** — name, color, logo
- **Terminology** — rename "Associate" to "Farmhand", "Station" to "Post"
- **Role display names** — rename each permission tier
- **Stations** — add, remove, rename, reorder archetypes
- **Store data** — upload tasks, associates, inventory via CSV or JSON

The same app, configured completely differently for a farm, a Wawa, or a 24/7 convenience store.

---

## License

Copyright © 2026 Brandon Case. All rights reserved.

This software is proprietary. You may not copy, modify, distribute, sublicense, or use this software or any portion of it without explicit written permission from the copyright holder.

See [LICENSE.md](LICENSE.md) for full terms.

---

## Status

Active development. Not open for contributions.

[getakyra.com](https://getakyra.com)