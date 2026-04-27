import { useEffect, useState } from "react"
import { fetchAssociatesByStore } from "../lib"
import type { Associate } from "../types"

interface UseAssociatesResult {
  associates: Associate[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useAssociates(storeId: string | null | undefined): UseAssociatesResult {
  const [associates, setAssociates] = useState<Associate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!storeId) return

    setIsLoading(true)
    setError(null)

    fetchAssociatesByStore(storeId)
      .then((data) => {
        setAssociates(data)
        setIsLoading(false)
      })
      .catch((err) => {
        setError(err?.message ?? "Failed to load associates")
        setIsLoading(false)
      })
  }, [storeId, tick])

  return {
    associates,
    isLoading,
    error,
    refetch: () => setTick((t) => t + 1),
  }
}
