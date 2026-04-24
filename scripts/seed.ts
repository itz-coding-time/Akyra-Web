import { createClient } from "@supabase/supabase-js"
import { tasks } from "./shared/tasks"
import { tableItems } from "./shared/tableItems"
import type { StoreConfig } from "./types"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ROLE_RANK: Record<string, number> = {
  crew: 1,
  supervisor: 2,
  assistant_manager: 3,
  store_manager: 4,
  district_admin: 5,
  org_admin: 6,
  db_admin: 7,
}

async function seedAssociates(config: StoreConfig) {
  console.log("Seeding associates...")
  for (const assoc of config.associates) {
    const { error } = await supabase
      .from("associates")
      .upsert({
        store_id: config.storeId,
        name: assoc.name,
        role: assoc.role,
        role_rank: ROLE_RANK[assoc.role] ?? 1,
        current_archetype: "Float",
        scheduled_days: "",
        default_start_time: assoc.default_start_time,
        default_end_time: assoc.default_end_time,
      }, { onConflict: "store_id,name" })

    if (error) console.error(`  ✗ ${assoc.name}: ${error.message}`)
    else console.log(`  ✓ ${assoc.name} (${assoc.role})`)
  }
}

async function seedTasks(config: StoreConfig) {
  console.log("Seeding tasks...")
  await supabase.from("tasks").delete().eq("store_id", config.storeId)

  const { error } = await supabase.from("tasks").insert(
    tasks.map(t => ({
      store_id: config.storeId,
      task_name: t.task_name,
      archetype: t.archetype,
      priority: t.priority,
      is_sticky: t.is_sticky,
      expected_minutes: t.expected_minutes,
      base_points: 10,
      is_completed: false,
      is_pull_task: false,
      is_truck_task: false,
    }))
  )
  if (error) console.error(`  ✗ Tasks: ${error.message}`)
  else console.log(`  ✓ ${tasks.length} tasks seeded`)
}

async function seedTableItems(config: StoreConfig) {
  console.log("Seeding table items...")
  await supabase.from("table_items").delete().eq("store_id", config.storeId)

  const { error } = await supabase.from("table_items").insert(
    tableItems.map(item => ({
      store_id: config.storeId,
      item_name: item.item_name,
      station: item.station,
      is_initialed: true,
    }))
  )
  if (error) console.error(`  ✗ Table items: ${error.message}`)
  else console.log(`  ✓ ${tableItems.length} table items seeded`)
}

async function seedInventory(config: StoreConfig) {
  console.log("Seeding inventory...")
  await supabase.from("inventory_items").delete().eq("store_id", config.storeId)

  const { error } = await supabase.from("inventory_items").insert(
    config.inventoryItems.map(item => ({
      store_id: config.storeId,
      item_name: item.item_name,
      build_to: item.build_to,
      category: item.category,
      amount_needed: item.amount_needed,
      amount_have: null,
      is_pulled: false,
    }))
  )
  if (error) console.error(`  ✗ Inventory: ${error.message}`)
  else console.log(`  ✓ ${config.inventoryItems.length} inventory items seeded`)
}

async function main() {
  const storeArg = process.argv[2]
  if (!storeArg) {
    console.error("Usage: npx tsx --env-file=.env.local scripts/seed.ts <store-id>")
    console.error("Example: npx tsx --env-file=.env.local scripts/seed.ts store-318")
    process.exit(1)
  }

  let config: StoreConfig
  try {
    const module = await import(`./config/${storeArg}/index.ts`)
    config = Object.values(module)[0] as StoreConfig
  } catch {
    console.error(`No config found for "${storeArg}". Create scripts/config/${storeArg}/index.ts`)
    process.exit(1)
  }

  console.log(`\n🌱 Akyra Seed Script`)
  console.log(`Store: ${config.storeName} (#${config.storeNumber})`)
  console.log(`Store ID: ${config.storeId}`)
  console.log(`Org ID:   ${config.orgId}\n`)

  await seedAssociates(config)
  await seedTasks(config)
  await seedTableItems(config)
  await seedInventory(config)

  console.log("\n✅ Seed complete.\n")
}

main().catch(console.error)
