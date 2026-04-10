export type SubscriptionRow = {
  id: string
  vendor: string
  monthly_cost: number
  annual_cost: number
  category?: string | null
  flag: 'none' | 'review' | 'duplicate' | 'unused'
  duplicate_group?: string | null
  last_used_at?: string | null
  notes?: string | null
}

export type SubscriptionSummary = {
  active_count: number
  monthly_total: number
  annual_total: number
  review_count: number
  review_monthly_total: number
  duplicate_count: number
  unused_count: number
}
