import Papa from "papaparse"
import { supabase } from "./supabase"
import type { Database } from "../types/database.types"

type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"]
type TableItem = Database["public"]["Tables"]["table_items"]["Row"]

export type ImportTarget = "inventory" | "table_items"
export type ImportCategory = "Prep" | "Bread" | "Starter" | "Finisher A" | "Finisher B"

export interface InferredImport {
  target: ImportTarget
  category: ImportCategory
  displayName: string
}

export interface ImportDiff {
  added: string[]
  updated: string[]
  removed: string[]
  unchanged: string[]
}

export interface ImportPreview {
  inferred: InferredImport
  diff: ImportDiff
  parsedItems: ParsedItem[]
}

export interface ParsedItem {
  item_name: string
  amount_needed?: number // only for inventory
}

// Infer category from filename
export function inferImportFromFilename(filename: string): InferredImport | null {
  const lower = filename.toLowerCase()

  if (lower.includes("prep") && lower.includes("pull")) {
    return { target: "inventory", category: "Prep", displayName: "Prep Pull List" }
  }
  if (lower.includes("bread") && lower.includes("pull")) {
    return { target: "inventory", category: "Bread", displayName: "Bread Pull List" }
  }
  if (lower.includes("starter")) {
    return { target: "table_items", category: "Starter", displayName: "Starter Flip Checklist" }
  }
  if (lower.includes("finisher") && lower.includes("a") && !lower.includes("b")) {
    return { target: "table_items", category: "Finisher A", displayName: "Finisher A Flip Checklist" }
  }
  if (lower.includes("finisher") && lower.includes("b")) {
    return { target: "table_items", category: "Finisher B", displayName: "Finisher B Flip Checklist" }
  }

  return null
}

// Parse CSV — handles both inventory (Item Name + Pull Amount) and table items (Item Name only)
export function parseImportCsv(csvContent: string, target: ImportTarget): ParsedItem[] {
  const { data } = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
  })

  return data
    .map(row => {
      // Normalize header names — UKG exports vary slightly
      const name = (
        row["Item Name"] ??
        row["item_name"] ??
        row["Name"] ??
        Object.values(row)[0]
      )?.trim()

      if (!name) return null

      if (target === "inventory") {
        const amountStr = (
          row["Pull Amount"] ??
          row["amount_needed"] ??
          row["Build To"] ??
          Object.values(row)[1]
        )?.trim()
        const amount = amountStr ? parseInt(amountStr) : undefined
        return { item_name: name, amount_needed: isNaN(amount ?? NaN) ? undefined : amount }
      }

      return { item_name: name }
    })
    .filter((item): item is ParsedItem => item !== null)
}

// Diff parsed CSV items against current DB state
export async function buildImportDiff(
  storeId: string,
  inferred: InferredImport,
  parsedItems: ParsedItem[]
): Promise<ImportDiff> {
  const parsedNames = new Set(parsedItems.map(i => i.item_name))

  let existingNames: Set<string> = new Set()

  if (inferred.target === "inventory") {
    const { data } = await supabase
      .from("inventory_items")
      .select("item_name, amount_needed")
      .eq("store_id", storeId)
      .eq("category", inferred.category)

    existingNames = new Set((data ?? []).map((i: Pick<InventoryItem, "item_name" | "amount_needed">) => i.item_name))

    const diff: ImportDiff = {
      added: [],
      updated: [],
      removed: [],
      unchanged: [],
    }

    parsedItems.forEach(item => {
      if (!existingNames.has(item.item_name)) {
        diff.added.push(item.item_name)
      } else {
        const existing = (data ?? []).find((d: Pick<InventoryItem, "item_name" | "amount_needed">) => d.item_name === item.item_name)
        if (existing?.amount_needed !== item.amount_needed) {
          diff.updated.push(item.item_name)
        } else {
          diff.unchanged.push(item.item_name)
        }
      }
    })

    existingNames.forEach(name => {
      if (!parsedNames.has(name)) diff.removed.push(name)
    })

    return diff
  } else {
    const { data } = await supabase
      .from("table_items")
      .select("item_name")
      .eq("store_id", storeId)
      .eq("station", inferred.category)

    existingNames = new Set((data ?? []).map((i: Pick<TableItem, "item_name">) => i.item_name))

    return {
      added: parsedItems.filter(i => !existingNames.has(i.item_name)).map(i => i.item_name),
      updated: [],
      removed: [...existingNames].filter(n => !parsedNames.has(n)),
      unchanged: parsedItems.filter(i => existingNames.has(i.item_name)).map(i => i.item_name),
    }
  }
}

// Apply the import — upsert new/updated, delete removed
export async function applyImport(
  storeId: string,
  inferred: InferredImport,
  parsedItems: ParsedItem[]
): Promise<{ success: boolean; message: string }> {
  const parsedNames = new Set(parsedItems.map(i => i.item_name))

  if (inferred.target === "inventory") {
    // Upsert all parsed items
    const { error: upsertError } = await supabase
      .from("inventory_items")
      .upsert(
        parsedItems.map(item => ({
          store_id: storeId,
          item_name: item.item_name,
          build_to: inferred.category,
          category: inferred.category,
          amount_needed: item.amount_needed ?? 0,
          amount_have: null,
          is_pulled: false,
        })),
        { onConflict: "store_id,item_name,category" }
      )

    if (upsertError) return { success: false, message: upsertError.message }

    // Delete items not in CSV
    const { data: existing } = await supabase
      .from("inventory_items")
      .select("id, item_name")
      .eq("store_id", storeId)
      .eq("category", inferred.category)

    const toDelete = (existing ?? [])
      .filter((i: Pick<InventoryItem, "id" | "item_name">) => !parsedNames.has(i.item_name))
      .map((i: Pick<InventoryItem, "id" | "item_name">) => i.id)

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("inventory_items")
        .delete()
        .in("id", toDelete)

      if (deleteError) return { success: false, message: deleteError.message }
    }

    return { success: true, message: `Synced ${parsedItems.length} items` }
  } else {
    // table_items — upsert all, delete removed
    const { error: upsertError } = await supabase
      .from("table_items")
      .upsert(
        parsedItems.map(item => ({
          store_id: storeId,
          item_name: item.item_name,
          station: inferred.category,
          is_initialed: true,
        })),
        { onConflict: "store_id,item_name,station" }
      )

    if (upsertError) return { success: false, message: upsertError.message }

    const { data: existing } = await supabase
      .from("table_items")
      .select("id, item_name")
      .eq("store_id", storeId)
      .eq("station", inferred.category)

    const toDelete = (existing ?? [])
      .filter((i: Pick<TableItem, "id" | "item_name">) => !parsedNames.has(i.item_name))
      .map((i: Pick<TableItem, "id" | "item_name">) => i.id)

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("table_items")
        .delete()
        .in("id", toDelete)

      if (deleteError) return { success: false, message: deleteError.message }
    }

    return { success: true, message: `Synced ${parsedItems.length} items` }
  }
}
