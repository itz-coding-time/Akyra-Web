export interface PullEventSummary {
  itemId: string
  itemName: string
  category: string
  expiresDate: string
  totalPulled: number
  buildTo: number
  likelyUsedThrough: boolean
  pullEventIds: string[]
}

export type CodeCheckStatus =
  | 'verified'      // confirmed used through — no waste
  | 'waste_pending' // not used through — needs waste entry
  | 'waste_done'    // waste recorded and confirmed

export interface WasteEntry {
  itemName: string
  quantity: number
  pulledDate: string
}
