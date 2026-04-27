import { useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
import {
  fetchEquipmentIssues,
  createEquipmentIssue,
  updateEquipmentIssueStatus,
} from "../lib"
import type { Database } from "../types/database.types"

type EquipmentIssue = Database["public"]["Tables"]["equipment_issues"]["Row"]
type IssueStatus = "New" | "Pending" | "Resolved"

export function useEquipmentIssues(storeId: string | null | undefined) {
  const [issues, setIssues] = useState<EquipmentIssue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadIssues = useCallback(async () => {
    if (!storeId) return
    setIsLoading(true)
    const data = await fetchEquipmentIssues(storeId)
    setIssues(data)
    setIsLoading(false)
  }, [storeId])

  useEffect(() => {
    loadIssues()
  }, [loadIssues])

  // Realtime subscription
  useEffect(() => {
    if (!storeId) return

    const channel = supabase
      .channel(`equipment-${storeId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "equipment_issues",
        filter: `store_id=eq.${storeId}`,
      }, () => loadIssues())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [storeId, loadIssues])

  async function submitIssue(
    associateId: string,
    category: string,
    description: string,
    photoFile?: File
  ): Promise<boolean> {
    if (!storeId) return false
    setIsSubmitting(true)

    const result = await createEquipmentIssue(
      storeId,
      storeId, // reported_at_store_id same as store_id for now
      associateId,
      category,
      description,
      photoFile
    )

    setIsSubmitting(false)
    if (result) await loadIssues()
    return !!result
  }

  async function updateStatus(
    issueId: string,
    status: IssueStatus,
    resolvedByAssociateId?: string
  ): Promise<boolean> {
    const success = await updateEquipmentIssueStatus(issueId, status, resolvedByAssociateId)
    if (success) {
      setIssues(prev => prev.map(i =>
        i.id === issueId ? { ...i, status } : i
      ))
    }
    return success
  }

  const newIssues      = issues.filter(i => i.status === "New")
  const pendingIssues  = issues.filter(i => i.status === "Pending")
  const resolvedIssues = issues.filter(i => i.status === "Resolved")

  return {
    issues,
    newIssues,
    pendingIssues,
    resolvedIssues,
    isLoading,
    isSubmitting,
    submitIssue,
    updateStatus,
    refetch: loadIssues,
  }
}
