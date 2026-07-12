import type { Metadata } from 'next'
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

/*
 * Type system — "the ledger":
 *  Fraunces        editorial serif for display/headlines (the product's voice)
 *  IBM Plex Sans   engineered grotesk for UI text
 *  IBM Plex Mono   tabular mono for figures, labels, statuslines
 */
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})
const body = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-plex-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})
const data = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CoreSight IQ — Decision Intelligence Platform',
  description:
    'CoreSight IQ: one analytics engine, three domains — operations, market expansion, and product. Data → insight → ranked, confidence-scored decisions → executive report.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${data.variable}`}>
      <body>{children}</body>
    </html>
  )
}
