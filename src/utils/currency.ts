export async function convertCurrency(
  amount: number,
  from: string = 'INR',
  to: string = 'INR'
): Promise<number> {
  if (from === to) return amount

  try {
    const response = await fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`)
    if (!response.ok) {
      throw new Error('Currency conversion service unavailable')
    }
    const data = await response.json()
    return data.rates[to] || amount
  } catch (err) {
    console.error('Failed to convert currency, using static fallback rate:', err)
    // Fallback static conversion rates (INR base)
    if (from === 'USD' && to === 'INR') return amount * 83.5
    if (from === 'INR' && to === 'USD') return amount / 83.5
    return amount
  }
}
