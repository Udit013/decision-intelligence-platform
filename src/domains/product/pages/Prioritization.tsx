import { getProductDataset } from '../dataset'
import { wsjfAvailable } from '../prioritization'
import { PRODUCT_META } from '../config'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { MissingData } from '@/ui/components/MissingData'
import { PrioritizationView } from './PrioritizationView'

export default async function Prioritization() {
  const ds = await getProductDataset()
  return (
    <>
      <PageHeader title="Prioritization" tagline="RICE · ICE · WSJF — ranked & tiered by the shared scoring engine." />
      {ds.source.kind === 'demo' && <DemoBanner note={PRODUCT_META.demoNote} />}
      {ds.initiatives.length ? (
        <PrioritizationView items={ds.initiatives} wsjfEnabled={wsjfAvailable(ds.initiatives)} />
      ) : (
        <MissingData kind="product.backlog" why="Prioritization ranks your backlog by RICE, ICE and WSJF." />
      )}
    </>
  )
}
