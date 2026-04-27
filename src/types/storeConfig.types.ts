export interface StoreConfigAssociate {
  eeid: string
  name: string
  role: string
  default_start_time: string
  default_end_time: string
}

export interface StoreConfigTask {
  task_name: string
  archetype: string
  priority: "Low" | "Normal" | "High" | "Critical"
  is_sticky: boolean
  expected_minutes: number
  sop_content?: string
}

export interface StoreConfigInventoryItem {
  item_name: string
  category: string
  amount_needed: number
  code_life_days?: number
}

export interface StoreConfigTableItem {
  item_name: string
  station: string
}

export interface StoreConfig {
  org?: string
  store_number?: string
  welcome_phrase?: string
  associates?: StoreConfigAssociate[]
  tasks?: StoreConfigTask[]
  inventory?: StoreConfigInventoryItem[]
  table_items?: StoreConfigTableItem[]
}
