import type { Metadata } from 'next';
import { Manrope, Noto_Sans_Devanagari, Playfair_Display } from 'next/font/google';
import { NavBar } from '@/components/NavBar';
import './globals.css';

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const noto = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-noto', display: 'swap' });

export const metadata: Metadata = {
  title: 'ArogyaBhog — रोटी में स्वाद, स्वास्थ्य के साथ',
  description:
    'Stone-fresh multigrain atta from Kanpur. Compose your own flour in the Lab and see every rupee and every nutrient, line by line.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${manrope.variable} ${noto.variable}`}>
      <body>
        {/* Sticky header, fixed h-16, three zones: brand · nav · cart */}
        <header className="sticky top-0 z-40 border-b border-ivory-300 bg-ivory-50/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-6 sm:px-6">
            <a href="/" className="flex shrink-0 items-center gap-2.5 sm:gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-mark.png" alt="ArogyaBhog monogram" className="h-9 w-9" />
              <span className="font-display text-lg font-semibold tracking-tight text-ink-900">ArogyaBhog</span>
            </a>
            <NavBar />
            <a
              href="/shop"
              className="flex shrink-0 items-center gap-2 rounded-ctrl border border-forest-600 px-2.5 py-1.5 text-xs font-bold text-forest-700 sm:px-3 sm:text-sm"
            >
              Cart
              <span className="tnum rounded-full bg-forest-600 px-1.5 text-[10px] font-bold text-forest-50">0</span>
            </a>
          </div>
        </header>

        {children}

        <footer className="mt-20 bg-forest-950 sm:mt-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/logo-mark.png" alt="" className="h-9 w-9 rounded-full bg-ivory-50 p-0.5" />
                <span className="font-display text-xl font-semibold text-ivory-50">ArogyaBhog</span>
              </div>
              <div className="font-hindi text-lg text-gold-300">रोटी में स्वाद, स्वास्थ्य के साथ</div>
              <p className="max-w-sm text-sm leading-6 text-forest-100/80">
                Milled weekly in Kanpur, delivered by our own drivers. COD and UPI QR — your money reaches us directly,
                never a middleman.
              </p>
            </div>
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-gold-300">Transparency</div>
              <p className="text-sm leading-6 text-forest-100/80">
                Nutrition is estimated from published composition tables (IFCT 2017, USDA where IFCT is silent) — never
                lab-analysed, and labelled so everywhere.
              </p>
            </div>
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-gold-300">House rules</div>
              <p className="text-sm leading-6 text-forest-100/80">
                No returns, by design — we would rather mill it right the first time. FSSAI licence number appears here
                at launch.
              </p>
            </div>
          </div>
          <div className="border-t border-forest-800">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-forest-100/60 sm:px-6">
              <span>© 2026 ArogyaBhog · Kanpur, Uttar Pradesh</span>
              <span className="tnum">Prices GST-inclusive 5% · HSN 11010000</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
