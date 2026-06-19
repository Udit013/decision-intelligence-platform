import type { ComponentType } from 'react'
import DecisionCenter from './DecisionCenter'
import Opportunities from './Opportunities'
import Prioritization from './Prioritization'
import Analytics from './Analytics'
import Experiments from './Experiments'
import Roadmap from './Roadmap'
import Reports from './Reports'
import Advisor from './Advisor'

/** Maps product nav slugs (see registry) to page components. */
export const productPages: Record<string, ComponentType> = {
  '': DecisionCenter,
  opportunities: Opportunities,
  prioritization: Prioritization,
  analytics: Analytics,
  experiments: Experiments,
  roadmap: Roadmap,
  reports: Reports,
  advisor: Advisor,
}
