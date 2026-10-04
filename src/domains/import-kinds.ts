/**
 * Every importable dataset, by module. Client-safe (the Data Manager renders
 * these to build the mapping UI); the server writers live in src/server/imports.
 * Ranges mirror the CHECK constraints in db/migrations/0001.
 */
import type { ImportKindSpec } from '@/core/imports'
import type { DomainKey } from '@/core/tenancy'

export const ORDER_LINES: ImportKindSpec = {
  id: 'operations.order_lines',
  domain: 'operations',
  label: 'Order lines',
  description: 'One row per product on an order. Powers revenue, forecasting, customers, inventory, pricing and root cause.',
  template: '/templates/operations-order-lines.csv',
  fields: [
    { key: 'invoice', label: 'Order ID', type: 'string', required: true, maxLength: 32, aliases: ['invoice', 'invoiceno', 'invoicenumber', 'orderid', 'orderno', 'ordernumber', 'transactionid'] },
    { key: 'stockCode', label: 'Product code', type: 'string', required: true, maxLength: 32, aliases: ['stockcode', 'sku', 'productid', 'productcode', 'itemid', 'itemcode'] },
    { key: 'quantity', label: 'Quantity', type: 'integer', required: true, min: -1_000_000, max: 1_000_000, aliases: ['quantity', 'qty', 'units'], hint: 'Negative for returns' },
    { key: 'unitPrice', label: 'Unit price', type: 'number', required: true, min: 0, max: 10_000_000, aliases: ['price', 'unitprice', 'unitcost', 'saleprice'] },
    { key: 'invoiceDate', label: 'Order date', type: 'date', required: true, aliases: ['invoicedate', 'date', 'orderdate', 'transactiondate', 'datetime', 'timestamp'] },
    { key: 'description', label: 'Product name', type: 'string', maxLength: 500, aliases: ['description', 'productname', 'itemname', 'product'] },
    { key: 'customerId', label: 'Customer ID', type: 'string', maxLength: 32, aliases: ['customerid', 'customer', 'customerno', 'clientid'] },
    { key: 'country', label: 'Country', type: 'string', maxLength: 100, aliases: ['country', 'region', 'market'] },
  ],
}

const pct = (key: string, label: string, aliases: string[]) => ({ key, label, type: 'number' as const, min: 0, max: 100, aliases })

export const MARKET_INDICATORS: ImportKindSpec = {
  id: 'market.markets',
  domain: 'market',
  label: 'Market indicators',
  description: 'One row per market (country, region, or city) with whatever indicators you track. Scores use only the columns you provide.',
  template: '/templates/market-indicators.csv',
  fields: [
    { key: 'name', label: 'Market', type: 'string', required: true, maxLength: 120, aliases: ['market', 'country', 'name', 'marketname', 'countryname', 'region'] },
    { key: 'code', label: 'Code', type: 'string', maxLength: 12, aliases: ['code', 'iso', 'iso2', 'iso3', 'countrycode'] },
    { key: 'region', label: 'Region', type: 'string', maxLength: 80, aliases: ['continent', 'regiongroup', 'area', 'subregion'] },
    { key: 'gdpUsdBn', label: 'GDP (USD bn)', type: 'number', min: 0, aliases: ['gdp', 'gdpusdbn', 'gdpbn', 'gdpbillions'] },
    { key: 'gdpGrowthPct', label: 'GDP growth %', type: 'number', min: -100, max: 100, aliases: ['gdpgrowth', 'growth', 'gdpgrowthpct', 'growthrate'] },
    { key: 'populationM', label: 'Population (m)', type: 'number', min: 0, aliases: ['population', 'populationm', 'popm', 'pop'] },
    { key: 'avgIncomeUsd', label: 'Avg income (USD)', type: 'number', min: 0, aliases: ['avgincome', 'income', 'gdppercapita', 'percapitaincome', 'averageincome'] },
    pct('internetPct', 'Internet %', ['internet', 'internetpenetration', 'internetpct']),
    pct('mobilePct', 'Mobile %', ['mobile', 'mobileadoption', 'mobilepct', 'smartphone']),
    pct('urbanPct', 'Urban %', ['urban', 'urbanization', 'urbanpct']),
    pct('purchasingPowerIndex', 'Purchasing power (0–100)', ['ppi', 'purchasingpower', 'purchasingpowerindex']),
    pct('easeOfBusiness', 'Ease of business (0–100)', ['ease', 'easeofbusiness', 'easeofdoingbusiness', 'businessease']),
    pct('taxRatePct', 'Tax rate %', ['tax', 'taxrate', 'corporatetax', 'taxratepct']),
    { key: 'inflationPct', label: 'Inflation %', type: 'number', min: -50, max: 1000, aliases: ['inflation', 'inflationrate', 'cpi', 'inflationpct'] },
    pct('currencyStability', 'Currency stability (0–100)', ['currency', 'currencystability', 'fxstability']),
  ],
  atLeast: {
    keys: ['gdpUsdBn', 'gdpGrowthPct', 'populationM', 'avgIncomeUsd', 'internetPct', 'purchasingPowerIndex', 'easeOfBusiness', 'taxRatePct', 'inflationPct', 'currencyStability'],
    count: 3,
    message: 'Map at least 3 indicator columns (e.g. GDP growth, population, ease of business) so markets can be scored.',
  },
}

export const MARKET_COMPETITORS: ImportKindSpec = {
  id: 'market.competitors',
  domain: 'market',
  label: 'Competitor shares',
  description: 'One row per competitor per market with its market share. Enables concentration (HHI), saturation and entry difficulty.',
  template: '/templates/market-competitors.csv',
  fields: [
    { key: 'market', label: 'Market', type: 'string', required: true, maxLength: 120, aliases: ['market', 'country', 'marketname', 'region'] },
    { key: 'competitor', label: 'Competitor', type: 'string', required: true, maxLength: 160, aliases: ['competitor', 'company', 'player', 'brand', 'competitorname'] },
    { key: 'sharePct', label: 'Market share %', type: 'number', required: true, min: 0.0001, max: 100, aliases: ['share', 'marketshare', 'sharepct', 'marketsharepct'] },
  ],
}

export const PRODUCT_EVENTS: ImportKindSpec = {
  id: 'product.events',
  domain: 'product',
  label: 'Product events',
  description: 'One row per tracked event (user, event name, time). Powers retention cohorts, funnels, feature adoption and engagement tiers.',
  template: '/templates/product-events.csv',
  fields: [
    { key: 'userId', label: 'User ID', type: 'string', required: true, maxLength: 128, aliases: ['userid', 'user', 'distinctid', 'anonymousid', 'accountid', 'customerid'] },
    { key: 'event', label: 'Event', type: 'string', required: true, maxLength: 120, aliases: ['event', 'eventname', 'action', 'name', 'eventtype'] },
    { key: 'timestamp', label: 'Timestamp', type: 'date', required: true, aliases: ['timestamp', 'time', 'occurredat', 'eventtime', 'date', 'createdat', 'datetime'] },
    { key: 'plan', label: 'Plan', type: 'string', maxLength: 60, aliases: ['plan', 'tier', 'subscription', 'pricingplan'] },
    { key: 'country', label: 'Country', type: 'string', maxLength: 80, aliases: ['country', 'geo', 'countrycode'] },
  ],
}

export const PRODUCT_EXPERIMENTS: ImportKindSpec = {
  id: 'product.experiments',
  domain: 'product',
  label: 'Experiment results',
  description: 'One row per experiment variant: users exposed and users converted. Significance uses the shared two-proportion z-test.',
  template: '/templates/product-experiments.csv',
  fields: [
    { key: 'experiment', label: 'Experiment', type: 'string', required: true, maxLength: 160, aliases: ['experiment', 'test', 'experimentname', 'testname'] },
    { key: 'variant', label: 'Variant', type: 'string', required: true, maxLength: 80, aliases: ['variant', 'arm', 'group', 'bucket'] },
    { key: 'users', label: 'Users', type: 'integer', required: true, min: 1, aliases: ['users', 'samples', 'visitors', 'exposed', 'participants', 'n'] },
    { key: 'conversions', label: 'Conversions', type: 'integer', required: true, min: 0, aliases: ['conversions', 'converted', 'successes', 'goals'] },
    { key: 'hypothesis', label: 'Hypothesis', type: 'string', maxLength: 500, aliases: ['hypothesis', 'description', 'notes'] },
  ],
}

export const PRODUCT_BACKLOG: ImportKindSpec = {
  id: 'product.backlog',
  domain: 'product',
  label: 'Backlog initiatives',
  description: 'One row per initiative with RICE inputs. Add user value, time criticality and risk reduction to enable WSJF.',
  template: '/templates/product-backlog.csv',
  fields: [
    { key: 'name', label: 'Initiative', type: 'string', required: true, maxLength: 200, aliases: ['initiative', 'name', 'feature', 'title', 'epic'] },
    { key: 'description', label: 'Description', type: 'string', maxLength: 1000, aliases: ['description', 'summary', 'details'] },
    { key: 'reach', label: 'Reach', type: 'number', required: true, min: 0, aliases: ['reach', 'users', 'usersperquarter'] },
    { key: 'impact', label: 'Impact', type: 'number', required: true, min: 0, max: 10, aliases: ['impact'], hint: 'RICE scale, e.g. 0.25–3' },
    { key: 'confidence', label: 'Confidence', type: 'number', required: true, min: 0, max: 100, aliases: ['confidence', 'conf'], hint: '0–1 or 0–100%' },
    { key: 'effort', label: 'Effort', type: 'number', required: true, min: 0.01, aliases: ['effort', 'size', 'personmonths', 'cost'] },
    { key: 'userValue', label: 'User value', type: 'number', min: 0, aliases: ['uservalue', 'businessvalue', 'value'] },
    { key: 'timeCriticality', label: 'Time criticality', type: 'number', min: 0, aliases: ['timecriticality', 'urgency'] },
    { key: 'riskReduction', label: 'Risk reduction', type: 'number', min: 0, aliases: ['riskreduction', 'opportunityenablement', 'rroe'] },
  ],
}

export const IMPORT_KINDS: ImportKindSpec[] = [ORDER_LINES, MARKET_INDICATORS, MARKET_COMPETITORS, PRODUCT_EVENTS, PRODUCT_EXPERIMENTS, PRODUCT_BACKLOG]

export function getImportKind(id: string): ImportKindSpec | undefined {
  return IMPORT_KINDS.find((k) => k.id === id)
}

export function kindsForDomain(domain: DomainKey): ImportKindSpec[] {
  return IMPORT_KINDS.filter((k) => k.domain === domain)
}
