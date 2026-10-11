'use client';

/** Structured navigation with an explicit active state (ui-ux-pro-max rule:
 *  "Current page/section should be visually indicated"). */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/shop', label: 'Shop', mobile: true },
  { href: '/lab', label: 'The Lab', mobile: true },
  { href: '/#promise', label: 'Our promise', mobile: false },
] as const;

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="ml-auto flex items-center gap-4 text-xs font-semibold sm:gap-8 sm:text-sm">
      {LINKS.map((l) => {
        const active = l.href !== '/#promise' && (pathname === l.href || pathname.startsWith(`${l.href}/`));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              (l.mobile ? '' : 'hidden sm:inline ') +
              (active
                ? 'text-forest-800 underline decoration-gold-500 decoration-2 underline-offset-8'
                : 'text-ink-700 transition hover:text-forest-700')
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
