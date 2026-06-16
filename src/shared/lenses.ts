export interface Lens {
  id: string
  label: string
  /** Register-specific instructions appended to the page-generation system prompt. */
  instructions: string
}

export const LENSES: Lens[] = [
  {
    id: 'straight',
    label: 'Straight',
    instructions: [
      'Render the page completely earnestly, as if it were the real site.',
      "Match the real site's visual identity, information architecture and editorial",
      'voice as closely as you can from memory. Do not be intentionally funny,',
      'surreal or self-aware. The content must be invented — plausible but not real:',
      'news from a parallel timeline, products that almost exist, confident facts',
      'that are subtly off, bylines of people who were never born. Never acknowledge',
      'being generated. The uncanny must emerge on its own.',
    ].join(' '),
  },
  {
    id: 'slop',
    label: 'Extra slop',
    instructions: [
      'Maximum AI slop. Surreal, overconfident, algorithm-poisoned content:',
      'impossible products with billions of five-star reviews, listicles that lose',
      'count of themselves, engagement bait, slightly broken marketing English,',
      'maximalist layouts, clashing gradients, too many call-to-action buttons.',
      'The page must still function — the dream logic just leaks from everywhere.',
    ].join(' '),
  },
  {
    id: 'web1998',
    label: '1998',
    instructions: [
      'Render every site as its 1998 self, including sites that could not have',
      'existed then. Table-based layouts, beveled buttons, tiled backgrounds,',
      'web-safe colors, Times New Roman and Comic Sans, hit counters, guestbook',
      'links, web rings, "best viewed in Netscape Navigator 4 at 800x600".',
      'Request images as low-fi pixel art or scanned-photo style.',
    ].join(' '),
  },
  {
    id: 'childlike',
    label: 'Childlike',
    instructions: [
      'Render every page as if drawn by a 6-year-old with crayons:',
      'wobbly hand-drawn shapes, misspelled labels, stick-figure images,',
      'primary colors, and stickers in the margins.',
    ].join(' '),
  },
]

export const DEFAULT_LENS = 'straight'

/** Look up a lens among built-ins and user-defined ones; falls back to the default. */
export function resolveLens(id: string, custom: Lens[] = []): Lens {
  return LENSES.find((l) => l.id === id) ?? custom.find((l) => l.id === id) ?? LENSES[0]!
}

/** Derive a stable, unique lens id from a user-chosen label. */
export function slugifyLensId(label: string, taken: Iterable<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'lens'
  const takenSet = new Set(taken)
  if (!takenSet.has(base)) return base
  let i = 2
  while (takenSet.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}
