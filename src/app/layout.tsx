import type { Metadata } from 'next';
import { Manrope, Noto_Sans_Devanagari, Playfair_Display } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const noto = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-noto', display: 'swap' });

export const metadata: Metadata = {
  title: 'ArogyaBhog — रोटी में स्वाद, स्वास्थ्य के साथ',
  description:
    'Stone-fresh multigrain atta from Kanpur. Compose your own flour in the Lab and see every rupee and every nutrient, line by line.',
};

/** Shared document shell only. Storefront and admin chrome live in separate route-group layouts. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${manrope.variable} ${noto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
