import type { ComponentType } from 'react'
import DecisionCenter from './DecisionCenter'
import Forecasting from './Forecasting'
import Customers from './Customers'
import Inventory from './Inventory'
import Pricing from './Pricing'
import RootCause from './RootCause'
import Reports from './Reports'
import Advisor from './Advisor'

/** Maps a domain nav slug to its page component ('' = the domain home). */
export const operationsPages: Record<string, ComponentType> = {
  '': DecisionCenter,
  forecasting: Forecasting,
  customers: Customers,
  inventory: Inventory,
  pricing: Pricing,
  'root-cause': RootCause,
  reports: Reports,
  advisor: Advisor,
}
