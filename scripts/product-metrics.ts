/** Prints MEASURED product metrics from the synthetic generator. Run: npx tsx scripts/product-metrics.ts */
import { USER_COUNT } from '../src/domains/product/generator'
import { buildRetention, buildFunnel, buildAdoption, buildSegments } from '../src/domains/product/analytics'
import { getExperiments } from '../src/domains/product/experiments'
import { rankInitiatives } from '../src/domains/product/prioritization'

console.log(`\nUSERS: ${USER_COUNT}`)

console.log('\nFUNNEL (measured):')
for (const s of buildFunnel().steps) console.log(`  ${s.step.padEnd(20)} ${s.users.toString().padStart(5)}  ${s.conversionFromTop}% of top`)

console.log('\nRETENTION D1–D90 (measured, pooled):')
for (const p of buildRetention().pooled) console.log(`  D${p.offset}`.padEnd(6) + ` ${p.ratePct}%`)

console.log('\nTOP FEATURE ADOPTION (measured):')
for (const a of buildAdoption().slice(0, 5)) console.log(`  ${a.name.padEnd(22)} ${a.adoptionPct}%${a.isCore ? ' (core)' : ''}`)

console.log('\nSEGMENTS (core/segmentation quintiles):')
for (const s of buildSegments()) console.log(`  ${s.segment.padEnd(10)} ${s.count}`)

console.log('\nEXPERIMENTS (core/stats A/B):')
for (const e of getExperiments()) console.log(`  ${e.name.padEnd(30)} ${e.stats.verdict.padEnd(13)} lift ${e.stats.liftPercent.toFixed(1)}%  p=${e.stats.pValue.toFixed(4)}`)

console.log('\nPRIORITIZATION (RICE via core/scoreAndClassify):')
for (const i of rankInitiatives('rice').slice(0, 5)) console.log(`  #${i.rank} ${i.name.padEnd(28)} RICE ${i.rice}  tier ${i.tier}  (priority ${i.priority})`)
console.log('')
