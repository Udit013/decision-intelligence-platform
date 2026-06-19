/**
 * ⚠️ DERIVED ASSUMPTIONS — NOT SOURCE DATA.
 *
 * The UCI "Online Retail II" dataset has NO cost price, NO stock levels, and NO
 * category taxonomy — only a free-text Description, Quantity, and Price. To power
 * the inventory and pricing engines we DERIVE two things here, and every figure
 * that depends on them is labeled "estimated" in the UI and PDF:
 *
 *   1. category        — inferred from Description keywords (best-effort buckets).
 *   2. assumedCostRatio — a category-level cost-as-fraction-of-price ASSUMPTION,
 *                         used only to estimate margin/profit. These are editorial
 *                         estimates for a UK gift/homeware retailer, NOT measured.
 *
 * This is the single source of truth for both assumptions; the ETL writes them to
 * the DB and the engines read them back. Revenue, orders, customers, RFM, returns,
 * and forecasts use ONLY real columns and carry no such caveat.
 */

export type OperationsCategory =
  | 'Kitchen & Dining'
  | 'Home & Decor'
  | 'Bags & Storage'
  | 'Stationery & Craft'
  | 'Party & Seasonal'
  | 'Garden & Outdoor'
  | 'Toys & Games'
  | 'Jewellery & Accessories'
  | 'Other'

/** Keyword → category rules, evaluated in order; first hit wins. */
const CATEGORY_RULES: { category: OperationsCategory; keywords: string[] }[] = [
  { category: 'Kitchen & Dining', keywords: ['MUG', 'CAKE', 'BAKING', 'BOWL', 'PLATE', 'CUTLERY', 'TEAPOT', 'JUG', 'BOTTLE', 'JAR', 'KITCHEN', 'NAPKIN', 'CUP', 'SPOON', 'TRAY'] },
  { category: 'Bags & Storage', keywords: ['BAG', 'LUNCH BOX', 'BOX', 'STORAGE', 'BASKET', 'TIN'] },
  { category: 'Stationery & Craft', keywords: ['NOTEBOOK', 'PEN', 'PENCIL', 'CARD', 'PAPER', 'CRAFT', 'CHALK', 'STICKER', 'TAPE', 'JOURNAL'] },
  { category: 'Party & Seasonal', keywords: ['CHRISTMAS', 'EASTER', 'PARTY', 'BUNTING', 'BALLOON', 'GARLAND', 'DECORATION', 'ADVENT', 'VALENTINE', 'HALLOWEEN'] },
  { category: 'Garden & Outdoor', keywords: ['GARDEN', 'PLANT', 'FLOWER POT', 'WATERING', 'BIRD', 'OUTDOOR', 'PARASOL'] },
  { category: 'Toys & Games', keywords: ['TOY', 'GAME', 'PLAYING', 'DOLL', 'PUZZLE', 'SPACEBOY', 'SOLDIER', 'SKITTLES'] },
  { category: 'Jewellery & Accessories', keywords: ['NECKLACE', 'BRACELET', 'EARRING', 'RING', 'JEWELLERY', 'SCARF', 'PURSE', 'UMBRELLA', 'HAT'] },
  { category: 'Home & Decor', keywords: ['HEART', 'LIGHT', 'HOLDER', 'FRAME', 'CANDLE', 'CUSHION', 'CLOCK', 'MIRROR', 'LANTERN', 'SIGN', 'HOOK', 'DOORMAT', 'CABINET', 'DRAWER'] },
]

/** Infer a coarse category from a free-text product description. */
export function deriveCategory(description: string | null | undefined): OperationsCategory {
  if (!description) return 'Other'
  const d = description.toUpperCase()
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => d.includes(k))) return rule.category
  }
  return 'Other'
}

/**
 * ASSUMED cost-as-fraction-of-price per category (editorial estimates, not data).
 * Lower ratio = higher assumed margin. Used ONLY for estimated margin/profit.
 */
export const ASSUMED_COST_RATIO: Record<OperationsCategory, number> = {
  'Kitchen & Dining': 0.55,
  'Home & Decor': 0.5,
  'Bags & Storage': 0.45,
  'Stationery & Craft': 0.4,
  'Party & Seasonal': 0.45,
  'Garden & Outdoor': 0.55,
  'Toys & Games': 0.5,
  'Jewellery & Accessories': 0.35,
  Other: 0.5,
}

/** Human-readable disclaimer surfaced wherever estimated margin is shown. */
export const COST_ASSUMPTION_NOTE =
  'Margin/profit figures are ESTIMATES: Online Retail II has no cost data, so cost is assumed at a category-level ratio of price. Revenue, orders, customers, and forecasts use real data only.'

export function assumedCostRatioFor(category: OperationsCategory): number {
  return ASSUMED_COST_RATIO[category] ?? 0.5
}
