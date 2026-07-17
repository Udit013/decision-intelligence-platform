import type { Metadata } from 'next'
import { Space_Grotesk, Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

/*
 * Type system:
 *  Space Grotesk    geometric display for headlines and headline figures
 *  Hanken Grotesk   clean humanist grotesk for UI text
 *  IBM Plex Mono    tabular mono for data labels and statuslines
 */
const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})
const body = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
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
