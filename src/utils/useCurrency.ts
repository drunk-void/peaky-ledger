import { useState, useEffect, useCallback } from 'react'
import { useJournalStore } from '@/store/useJournalStore'
import { getExchangeRate, formatCurrency, CurrencySymbolMap } from './currency'

export function useCurrency() {
  const { preferredCurrency } = useJournalStore()
  const [rates, setRates] = useState<Record<string, number>>({})

  useEffect(() => {
    let active = true
    const currencies = ['INR', 'USD', 'EUR', 'GBP']
    
    const loadRates = async () => {
      const newRates: Record<string, number> = {}
      for (const cur of currencies) {
        if (cur === preferredCurrency) {
          newRates[cur] = 1
        } else {
          try {
            const rate = await getExchangeRate(cur, preferredCurrency)
            newRates[cur] = rate
          } catch (e) {
            console.error(`Failed to load rate for ${cur}`, e)
          }
        }
      }
      if (active) {
        setRates(newRates)
      }
    }

    Promise.resolve().then(() => {
      loadRates()
    })
    return () => {
      active = false
    }
  }, [preferredCurrency])

  const formatAmount = useCallback(
    (amount: number, fromCurrency: string = 'INR') => {
      const rate = rates[fromCurrency.toUpperCase()] !== undefined ? rates[fromCurrency.toUpperCase()] : 1
      const converted = amount * rate
      return formatCurrency(converted, preferredCurrency)
    },
    [rates, preferredCurrency]
  )

  const currencySymbol = CurrencySymbolMap[preferredCurrency] || preferredCurrency

  return { formatAmount, currencySymbol, preferredCurrency, rates }
}
