# 07 — DESIGN SYSTEM (derived from the client's logo, not invented)

> **STATUS: ✅ APPROVED by the client on 2026-10-10 (ADR-022).**
> The heritage-premium direction below is binding for all UI work. Do not
> introduce colours, typefaces or radii outside this system without a new ADR.

**Source of truth for the brand:** `uploads/arogyaBhog_logo.png` (mark) and
`uploads/arogyabhog_name.png` (wordmark + Hindi tagline), copied to
`public/brand/logo-mark.png` and `public/brand/logo-wordmark.png`.

Every token below was **extracted by pixel-sampling the logo's own gradient**, not
chosen by taste. Visual reference: `brand-board.html` (open in a browser).

Brand personality: **authentic, pure, transparent, healthy.** Premium-earthen,
not clinical, not playful.

---

## 1 · Colour tokens

### `ivory` — surfaces & paper
The page is flour-coloured paper. **Never pure `#FFFFFF`.**

| Token | Hex | Use |
|---|---|---|
| `ivory-50` | `#FCFAF5` | page background |
| `ivory-100` | `#F7F2E8` | alternating sections, table zebra |
| `ivory-200` | `#EFE7D8` | hover tint, secondary button bg |
| `ivory-300` | `#E3D7C0` | hairline borders, dividers |
| `ivory-400` | `#D3C3A4` | disabled borders |

### `gold` — the brand voice (sampled from the logo's metallic gradient)
**Gold is an accent, never a page background.**

| Token | Hex | Sampled from | Use |
|---|---|---|---|
| `gold-50` | `#FDF9EE` | — | tint |
| `gold-100` | `#FAF1DA` | — | chip bg, certificate frame |
| `gold-200` | `#F3E4BC` | — | hover tint on gold |
| `gold-300` | `#E5D3AB` | p90 of gradient | hairlines on dark, dark-btn text |
| `gold-400` | `#CDB47E` | — | dividers, seals |
| `gold-500` | `#B28D60` | **median of gradient** | accent, focus ring |
| `gold-600` | `#90724E` | bronze band | small accents, icon stroke |
| `gold-700` | `#6C4E30` | deep bronze band | **primary CTA bg**, gold text on light |
| `gold-800` | `#553C24` | — | CTA hover |
| `gold-900` | `#402917` | p10 dark | deepest bronze |

### `ink` (espresso) — text & depth
| Token | Hex | Sampled from | Use |
|---|---|---|---|
| `ink-900` | `#1B1811` | ring p10 | headings, dark shell bg |
| `ink-800` | `#242422` | ring median | dark surfaces |
| `ink-700` | `#3A352C` | — | body copy |
| `ink-500` | `#6C5A48` | **tagline taupe** | secondary text |
| `ink-400` | `#8A7963` | — | muted, captions |
| `ink-300` | `#A99A85` | — | placeholders |

### `metallic` — the logo gradient (a jewel, max ONE use per screen)
`linear-gradient(90deg, #FFEECA, #E5D3AB, #B28D60, #90724E, #6C4E30)`
Reserved for: the monogram, one hero/footer rule per page, the Lab certificate
edge. Never as text fill on body copy, never as a card background.

### Functional (deliberately earthy so alerts never clash)
| Token | Hex | Bg tint | Use |
|---|---|---|---|
| `leaf-600` | `#4A6B4F` | `#E7EFE6` | success, delivered |
| `amber-700` | `#8A5A18` | `#F6EDDD` | warning, preparing, payment-pending |
| `clay-700` | `#8C3A2E` | `#F6E7E4` | danger, cancelled, validation error |

### `forest` — the one darker accent (ADR-025, client-requested)
A deep botanical green: the functional `leaf` promoted to a brand accent, used
**sparingly** per the careful-use rules below.

| Token | Hex | Use |
|---|---|---|
| `forest-950` | `#12201A` | deepest edge (band borders) |
| `forest-900` | `#1B2E24` | band border / hover deepen |
| `forest-800` | `#24402F` | **the forest band** background |
| `forest-700` | `#2F523C` | forest text on light, chip border |
| `forest-600` | `#3F6B4F` | icons on light (= leaf hue, family tie) |
| `forest-100` | `#E4EDE5` | text/chips on forest bands |
| `forest-50` | `#F1F6F1` | tint behind purity badges |

**Careful-use rules (binding):** (1) at most **one forest band per page**, for
health/purity/transparency statements — never a page background; (2) never a
forest band *and* an espresso band on the same page — one dark voice per
screen; (3) small surfaces: purity/in-stock/referral-credit chips and the Lab's
positive "base-grain minimum met" state; (4) forest never replaces bronze as
the primary CTA, never replaces leaf as the success status colour, and never
enters the metallic gradient.

---

## 2 · Verified contrast (WCAG 2.1) — measured, not assumed

| Pair | Ratio | Grade | Rule |
|---|---|---|---|
| `ink-900` on `ivory-50` | **16.98:1** | AAA | headings |
| `ink-700` on `ivory-50` | **11.67:1** | AAA | body |
| `gold-700` on `ivory-50` | **7.27:1** | AAA | gold text on light |
| `ink-500` on `ivory-50` | **6.30:1** | AA | secondary |
| `gold-100` on `gold-700` | **6.74:1** | AA | **primary button** |
| `gold-300` on `ink-900` | **12.01:1** | AAA | **dark button / dark shell** |
| `gold-600` on `ivory-50` | **4.28:1** | AA-large | **large text / icons only** |
| `ink-400` on `ivory-50` | **4.03:1** | AA-large | **captions ≥ 14 px bold or ≥ 18 px only** |
| `leaf-600` on `leafbg` | 5.10:1 | AA | success |
| `clay-700` on `claybg` | 6.33:1 | AA | danger |
| `amber-700` on `warnbg` | 5.08:1 | AA | warning |
| `ivory-50` on `forest-800` | **10.89:1** | AAA | forest band body text |
| `ivory-50` on `forest-900` | **13.76:1** | AAA | deepest band |
| `forest-700` on `ivory-50` | **8.41:1** | AAA | forest text on light |
| `forest-600` on `ivory-50` | 5.87:1 | AA | icons / large text |
| `gold-300` on `forest-800` | **7.70:1** | AAA | gold hairline/seal on band |
| `forest-100` on `forest-800` | 9.49:1 | AAA | chips on band |

Consequences encoded as rules: **gold-600 and ink-400 never set small body text.**
Primary CTA is bronze-700 with champagne text; the dark CTA (Lab) is ink-900 with
gold-300. Gold-on-gold and gold-on-white are both contrast failures — banned.

---

## 3 · Typography

| Role | Face | Sizes / leading | Notes |
|---|---|---|---|
| Display / headings | **Playfair Display** (500–700) | 32–56 / 1.15 | high-contrast Didone echoing the engraved "AB" monogram |
| Body / UI | **Manrope** (400–800) | 13–16 / 1.6–1.75 | warm geometric humanist; excellent at small dense sizes |
| Hindi | **Noto Sans Devanagari** (400,600) | matches body | the tagline "रोटी में स्वाद, स्वास्थ्य के साथ" always sets here, never in a Latin face |
| Money & nutrition | Manrope + `font-variant-numeric: tabular-nums` | — | columns MUST align; the transparency promise fails if numbers jitter |
| Order refs, SKUs, codes | `ui-monospace` stack | 13–15 | `AB-KNP-000123` |

Letter-spacing: `+0.08em…+0.14em` uppercase 11–12 px eyebrow labels in gold-700.

---

## 4 · Shape, elevation, motif

- **Radii:** 8 px controls, 12 px cards, 999 px chips. Small radii read premium;
  pill-everything reads playful and off-brand.
- **Borders:** 1 px `ivory-300`; accent frames 1 px `gold-400` (the Lab
  "certificate").
- **Shadow (warm, never grey):** `0 1px 2px rgba(64,41,23,.05), 0 10px 28px rgba(64,41,23,.07)`
- **Motifs:** thin gold hairline rules that fade to transparent
  (`linear-gradient(90deg,#B28D60,transparent)`); the wheat-sprig from the mark as
  a section divider; subtle grain-paper texture on hero bands only.
- **Motion:** Framer Motion, 150–250 ms, `ease-out`; stagger ≤ 40 ms. No bounce.

---

## 5 · Component signatures

- **Primary CTA:** bronze-700 bg, champagne text, 8 px radius, hover bronze-800.
- **Dark CTA (Lab only):** ink-900 bg, gold-300 text.
- **Tertiary:** transparent bg, 1 px gold-500 border, bronze-700 text.
- **Product card:** ivory-50 card on ivory-50 page via hairline + shadow; eyebrow
  label, Playfair title, taupe description, tabular price with `/ kg` unit muted.
- **Lab nutrition panel:** gold-framed "certificate" — eyebrow + fading rule +
  tabular rows + `% RDA` in gold-600 + an "estimated" chip. This frame is the
  product's visual signature for transparency.
- **Order status chips:** leaf (delivered/confirmed), amber (preparing/shipped/
  awaiting payment), gold-100 (placed), clay (cancelled/failed).
- **Admin shell:** ink-900 header with gold-300 accents, ivory body — the dark
  ground signals "work surface", the light ground signals "shop".

---

## 6 · Banned

- Pure `#FFFFFF` backgrounds and pure `#000000` text.
- Generic UI-kit greens/reds/blues that clash with the earthy functional set.
- Metallic gradient as body-text fill or as a large background.
- Gold-on-gold and gold-on-white (contrast failures).
- `rounded-2xl`-plus-pill playfulness; glassmorphism; neon glows.
- Hindi set in a Latin typeface.
- Product names or health copy hardcoded in components (ADR-020).
- Forest as a page background, two dark bands (forest + espresso) on one page,
  forest as a CTA colour, or forest inside the metallic gradient (ADR-025).

---

## 7 · Tailwind theme extension (drop-in when the UI layer lands)

```ts
// tailwind.config.ts — theme.extend
colors: {
  ivory:  { 50:'#FCFAF5',100:'#F7F2E8',200:'#EFE7D8',300:'#E3D7C0',400:'#D3C3A4' },
  gold:   { 50:'#FDF9EE',100:'#FAF1DA',200:'#F3E4BC',300:'#E5D3AB',400:'#CDB47E',
            500:'#B28D60',600:'#90724E',700:'#6C4E30',800:'#553C24',900:'#402917' },
  ink:    { 300:'#A99A85',400:'#8A7963',500:'#6C5A48',700:'#3A352C',800:'#242422',900:'#1B1811' },
  leaf:   { DEFAULT:'#4A6B4F', bg:'#E7EFE6' },
  amber:  { DEFAULT:'#8A5A18', bg:'#F6EDDD' },
  clay:   { DEFAULT:'#8C3A2E', bg:'#F6E7E4' },
  forest: { 50:'#F1F6F1',100:'#E4EDE5',600:'#3F6B4F',700:'#2F523C',800:'#24402F',900:'#1B2E24',950:'#12201A' },
},
fontFamily: {
  display: ['"Playfair Display"','serif'],
  sans:    ['Manrope','system-ui','sans-serif'],
  hindi:   ['"Noto Sans Devanagari"','sans-serif'],
  mono:    ['ui-monospace','SFMono-Regular','Menlo','monospace'],
},
borderRadius: { ctrl:'8px', card:'12px' },
boxShadow: { warm:'0 1px 2px rgba(64,41,23,.05), 0 10px 28px rgba(64,41,23,.07)' },
```

Fonts are loaded from Google Fonts at runtime; the in-app preview degrades to
system faces gracefully while the downloaded site renders fully.
