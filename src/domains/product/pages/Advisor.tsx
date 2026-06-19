import { PRODUCT_META } from '../config'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { AdvisorChat } from '@/ui/components/AdvisorChat'

export default function Advisor() {
  return (
    <>
      <PageHeader title="AI Advisor" tagline="Grounded in the measured product analytics — local Ollama if available, deterministic fallback always." />
      <DemoBanner note={PRODUCT_META.demoNote} />
      <AdvisorChat
        endpoint="/api/product/advisor"
        suggestions={['How is our retention?', 'Where do users drop off?', 'What should we build next?', 'Which experiments won?']}
      />
    </>
  )
}
