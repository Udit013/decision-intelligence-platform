import type { ComponentType } from 'react'
import ExpansionCenter from './ExpansionCenter'
import Markets from './Markets'
import Competition from './Competition'
import Opportunities from './Opportunities'
import Scenarios from './Scenarios'
import EntryStrategy from './EntryStrategy'
import Reports from './Reports'
import Advisor from './Advisor'

/** Maps market nav slugs (see registry) to page components. */
export const marketPages: Record<string, ComponentType> = {
  '': ExpansionCenter,
  markets: Markets,
  competition: Competition,
  opportunities: Opportunities,
  scenarios: Scenarios,
  'entry-strategy': EntryStrategy,
  reports: Reports,
  advisor: Advisor,
}
