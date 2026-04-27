// These are Store 318 specific — each store gets its own config folder
import type { StoreConfig } from "../../types"
import { associates } from "./associates"
import { inventoryItems } from "./inventory"

export const store318: StoreConfig = {
  storeId: '00000000-0000-0000-0000-000000000002',
  orgId: 'b357cedf-cafe-43a6-bc84-232c58ef4362',
  storeNumber: '318',
  storeName: 'Sheetz Store 318',
  associates,
  inventoryItems,
}
