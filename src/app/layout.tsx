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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${manrope.variable} ${noto.variable}`}>
      <body>
        <header className="sticky top-0 z-40 border-b border-ivory-300 bg-ivory-50/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
            <a href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-mark.png" alt="ArogyaBhog monogram" className="h-10 w-10" />
              <span className="font-display text-xl font-semibold tracking-tight text-ink-900">ArogyaBhog</span>
            </a>
            <nav className="ml-auto flex items-center gap-5 text-sm font-semibold text-ink-500">
              <a href="#premade" className="hover:text-gold-700">
                Shop
              </a>
              <a href="#lab" className="hover:text-gold-700">
                The Lab
              </a>
              <a href="#promise" className="hidden hover:text-gold-700 sm:block">
                Our promise
              </a>
              <span className="rounded-ctrl border border-gold-400 px-3 py-1.5 text-gold-700">Cart · 0</span>
            </nav>
          </div>
        </header>

        {children}

        <footer className="mt-24 bg-ink-900 text-ivory-100">
          <div className="gold-rule" />
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-3">
            <div>
              <div className="font-hindi text-lg text-gold-300">रोटी में स्वाद, स्वास्थ्य के साथ</div>
              <p className="mt-3 max-w-xs text-sm leading-6 text-ink-300">
                Milled weekly in Kanpur, delivered by our own drivers. COD and UPI QR — your money reaches us directly,
                never a middleman.
              </p>
            </div>
            <div className="text-sm leading-7 text-ink-300">
              <div className="font-semibold uppercase tracking-widest text-gold-300">Transparency</div>
              Nutrition is estimated from published composition tables (IFCT 2017, USDA where IFCT is silent) — never
              lab-analysed, and labelled so everywhere.
            </div>
            <div className="text-sm leading-7 text-ink-300">
              <div className="font-semibold uppercase tracking-widest text-gold-300">House rules</div>
              No returns, by design — we would rather mill it right the first time. FSSAI licence number appears here at
              launch.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
