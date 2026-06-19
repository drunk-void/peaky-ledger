export const CurrencySymbolMap: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
}

interface CacheData {
  rates: Record<string, number>
  timestamp: number
}

let memoryCache: CacheData | null = null

export async function getExchangeRate(from: string, to: string): Promise<number> {
  if (from === to) return 1

  const cacheKey = 'peaky-exchange-rates-v1'
  const cacheDuration = 12 * 60 * 60 * 1000 // 12 hours

  const loadCache = (): CacheData | null => {
    if (memoryCache) return memoryCache
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          memoryCache = JSON.parse(cached)
          return memoryCache
        }
      }
    } catch (e) {
      console.error('Failed to load exchange rate cache:', e)
    }
    return null
  }

  const saveCache = (rates: Record<string, number>) => {
    const data: CacheData = { rates, timestamp: Date.now() }
    memoryCache = data
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(cacheKey, JSON.stringify(data))
      }
    } catch (e) {
      console.error('Failed to save exchange rate cache:', e)
    }
  }

  const cache = loadCache()
  const pairKey = `${from}_${to}`

  if (cache && (Date.now() - cache.timestamp < cacheDuration) && cache.rates[pairKey] !== undefined) {
    return cache.rates[pairKey]
  }

  try {
    const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}`)
    if (!response.ok) throw new Error('API failed')
    const data = await response.json()
    
    const currentRates = cache ? { ...cache.rates } : {}
    if (data.rates) {
      for (const target of Object.keys(data.rates)) {
        currentRates[`${from}_${target}`] = data.rates[target]
        currentRates[`${target}_${from}`] = 1 / data.rates[target]
      }
    }
    saveCache(currentRates)

    if (currentRates[pairKey] !== undefined) {
      return currentRates[pairKey]
    }
  } catch (err) {
    console.warn(`Failed to fetch exchange rate for ${from} from API, using defaults:`, err)
  }

  const fallbackRates: Record<string, number> = {
    'USD_INR': 83.5,
    'INR_USD': 1 / 83.5,
    'EUR_INR': 90.0,
    'INR_EUR': 1 / 90.0,
    'GBP_INR': 106.0,
    'INR_GBP': 1 / 106.0,
    'USD_EUR': 0.93,
    'EUR_USD': 1 / 0.93,
    'USD_GBP': 0.79,
    'GBP_USD': 1 / 0.79,
    'EUR_GBP': 0.85,
    'GBP_EUR': 1 / 0.85,
  }

  if (fallbackRates[pairKey] !== undefined) return fallbackRates[pairKey]
  if (fallbackRates[`${to}_${from}`] !== undefined) return 1 / fallbackRates[`${to}_${from}`]
  return 1
}

export async function convertCurrency(
  amount: number,
  from: string = 'INR',
  to: string = 'INR'
): Promise<number> {
  if (from === to) return amount
  const rate = await getExchangeRate(from, to)
  return amount * rate
}

export function formatCurrency(amount: number, currencyCode: string = 'INR'): string {
  const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    const symbol = CurrencySymbolMap[currencyCode] || currencyCode
    return `${symbol}${amount.toFixed(2)}`
  }
}

export async function convertAndFormat(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<string> {
  const converted = await convertCurrency(amount, fromCurrency, toCurrency)
  return formatCurrency(converted, toCurrency)
}
