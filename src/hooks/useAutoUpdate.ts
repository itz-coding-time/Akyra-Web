import { useEffect, useState } from "react"

const VERSION_KEY = "akyra_version"
const VERSION_URL = "/version.json"

interface VersionInfo {
  version: string
  released: string
  notes?: string
}

async function fetchServerVersion(): Promise<VersionInfo | null> {
  try {
    // Always bypass cache when checking version
    const res = await fetch(VERSION_URL, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function clearAppCaches(): Promise<void> {
  if (!("caches" in window)) return

  const cacheNames = await caches.keys()
  await Promise.all(cacheNames.map(name => caches.delete(name)))
  console.log(`[Akyra] Cleared ${cacheNames.length} cache(s)`)
}

export function useAutoUpdate() {
  const [isUpdating, setIsUpdating] = useState(false)
  const [newVersion, setNewVersion] = useState<string | null>(null)

  useEffect(() => {
    async function checkVersion() {
      const serverInfo = await fetchServerVersion()
      if (!serverInfo) return

      const storedVersion = localStorage.getItem(VERSION_KEY)

      if (!storedVersion) {
        // First load — store version, no reload needed
        localStorage.setItem(VERSION_KEY, serverInfo.version)
        console.log(`[Akyra] Version initialized: ${serverInfo.version}`)
        return
      }

      if (storedVersion === serverInfo.version) {
        // Up to date
        return
      }

      // New version detected
      console.log(`[Akyra] Update detected: ${storedVersion} → ${serverInfo.version}`)
      setNewVersion(serverInfo.version)
      setIsUpdating(true)

      // Brief delay so the UI can show the update message
      await new Promise(r => setTimeout(r, 1500))

      // Clear caches — passkeys and Supabase auth are unaffected
      await clearAppCaches()

      // Store new version BEFORE reload
      localStorage.setItem(VERSION_KEY, serverInfo.version)

      // Reload to get fresh app shell
      window.location.reload()
    }

    checkVersion()
  }, [])

  return { isUpdating, newVersion }
}
