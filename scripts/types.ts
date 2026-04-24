export interface AssociateEntry {
  eeid: string
  name: string
  role: string
  default_start_time: string
  default_end_time: string
}

export interface InventoryEntry {
  item_name: string
  build_to: string
  category: string
  amount_needed: number
}

export interface StoreConfig {
  storeId: string
  orgId: string
  storeNumber: string
  storeName: string
  associates: AssociateEntry[]
  inventoryItems: InventoryEntry[]
}
