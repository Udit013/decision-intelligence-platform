import { describe, it, expect } from 'vitest'
import {
  buildContextText,
  advisorPrompt,
  routeDeterministic,
  sanitizeQuestion,
  MAX_QUESTION_LENGTH,
  type IntentRule,
} from './index'

interface Ctx {
  forecast: string
  churn: string
}

const rules: IntentRule<Ctx>[] = [
  { match: ['forecast', 'predict', 'next'], answer: (c) => c.forecast },
  { match: ['churn', 'retain', 'at risk'], answer: (c) => c.churn },
]
const fallback = () => 'Open the Decision Center for the ranked list.'

describe('sanitizeQuestion', () => {
  it('trims and accepts a normal question', () => {
    expect(sanitizeQuestion('  how is retention?  ')).toBe('how is retention?')
  })

  it('rejects empty, non-string, and over-length input', () => {
    expect(sanitizeQuestion('')).toBeNull()
    expect(sanitizeQuestion('   ')).toBeNull()
    expect(sanitizeQuestion(42)).toBeNull()
    expect(sanitizeQuestion(null)).toBeNull()
    expect(sanitizeQuestion({ q: 'x' })).toBeNull()
    expect(sanitizeQuestion('x'.repeat(MAX_QUESTION_LENGTH + 1))).toBeNull()
  })

  it('accepts exactly the max length', () => {
    expect(sanitizeQuestion('x'.repeat(MAX_QUESTION_LENGTH))).toHaveLength(MAX_QUESTION_LENGTH)
  })
})

describe('buildContextText', () => {
  it('renders labeled sections', () => {
    const text = buildContextText({
      sections: [
        { label: 'forecast', text: 'up 8%' },
        { label: 'inventory', text: '12 reorders' },
      ],
    })
    expect(text).toBe('FORECAST: up 8%\nINVENTORY: 12 reorders')
  })
})

describe('advisorPrompt', () => {
  it('includes persona, context, and question', () => {
    const p = advisorPrompt('You are an analyst.', 'why down?', 'CTX: data')
    expect(p).toContain('You are an analyst.')
    expect(p).toContain('CTX: data')
    expect(p).toContain('why down?')
  })
})

describe('routeDeterministic', () => {
  const ctx: Ctx = { forecast: 'Revenue projected +8%.', churn: '40 customers at risk.' }

  it('routes to the matching intent', () => {
    expect(routeDeterministic('what is the forecast?', ctx, rules, fallback)).toBe('Revenue projected +8%.')
    expect(routeDeterministic('who might churn?', ctx, rules, fallback)).toBe('40 customers at risk.')
  })

  it('falls back when nothing matches', () => {
    expect(routeDeterministic('hello there', ctx, rules, fallback)).toBe(
      'Open the Decision Center for the ranked list.',
    )
  })

  it('defers to the next rule when a rule returns null', () => {
    const partial: IntentRule<Ctx>[] = [
      { match: ['forecast'], answer: () => null },
      { match: ['forecast'], answer: (c) => c.forecast },
    ]
    expect(routeDeterministic('forecast?', ctx, partial, fallback)).toBe('Revenue projected +8%.')
  })
})
