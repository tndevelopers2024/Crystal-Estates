import { Instrument_Serif } from 'next/font/google'

// Editorial serif used only for italic accents on the homepage.
export const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument',
  display: 'swap',
})
