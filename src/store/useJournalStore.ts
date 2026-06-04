import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { subDays, format } from 'date-fns'

export interface DateRange {
  from: string
  to: string
}

interface JournalState {
  dateRange: DateRange
  selectedAccountId: string // 'all' or specific UUID
  currency: string // 'INR', 'USD', etc.
  setDateRange: (range: DateRange) => void
  setSelectedAccountId: (accountId: string) => void
  setCurrency: (currency: string) => void
}

export const useJournalStore = create<JournalState>()(
  persist(
    (set) => ({
      dateRange: {
        from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        to: format(new Date(), 'yyyy-MM-dd'),
      },
      selectedAccountId: 'all',
      currency: 'INR',
      setDateRange: (dateRange) => set({ dateRange }),
      setSelectedAccountId: (selectedAccountId) => set({ selectedAccountId }),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'peaky-journal-settings',
    }
  )
)
