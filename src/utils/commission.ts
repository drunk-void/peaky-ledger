import { CommissionRule } from '@/types/journal'

export function calculateCommission(
  rules: CommissionRule[],
  trade: { entry_price: number; exit_price: number | null; quantity: number; asset_class: string }
): number {
  let totalFees = 0

  const activeRules = rules.filter(
    (rule) =>
      rule.is_active &&
      (rule.applies_to.length === 0 || rule.applies_to.includes(trade.asset_class))
  )

  for (const rule of activeRules) {
    if (rule.calc_type === 'percent_of_turnover') {
      const turnover = (Number(trade.entry_price) + Number(trade.exit_price ?? 0)) * Number(trade.quantity)
      totalFees += (Number(rule.value) / 100) * turnover
    } else if (rule.calc_type === 'flat_per_trade') {
      totalFees += Number(rule.value)
    } else if (rule.calc_type === 'per_unit') {
      totalFees += Number(rule.value) * Number(trade.quantity)
    }
  }

  return Number(totalFees.toFixed(4))
}
