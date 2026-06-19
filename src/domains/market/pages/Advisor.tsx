import { MARKET_META } from '../config'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { AdvisorChat } from '@/ui/components/AdvisorChat'

export default function Advisor() {
  return (
    <>
      <PageHeader title="AI Advisor" tagline="Grounded in the modeled market scores — local Ollama if available, deterministic fallback always." />
      <DemoBanner note={MARKET_META.demoNote} />
      <AdvisorChat
        endpoint="/api/market/advisor"
        suggestions={['Which market should we expand to?', 'Which markets are too risky?', 'Where is the best modeled ROI?']}
      />
    </>
  )
}
