import { PageHeader } from '@/ui/components/Kpi'
import { AdvisorChat } from '@/ui/components/AdvisorChat'

export default function Advisor() {
  return (
    <>
      <PageHeader
        title="AI Advisor"
        tagline="Grounded in the operations engines — local Ollama if available, deterministic fallback always."
      />
      <AdvisorChat
        endpoint="/api/operations/advisor"
        suggestions={[
          'What does the revenue forecast say?',
          'Which customers are at risk of churning?',
          'How bad are returns?',
          'How should I think about pricing?',
        ]}
      />
    </>
  )
}
