# dsarecx design system

dsarecx is a rebuild of the `recall` app (internally "engram") under a new name and a new look.
The look follows nullchat.tech: a ruled paper notebook, calm and editorial. "Moderate" means
restrained: one accent colour, generous whitespace, hairline borders, very little motion.

## Principles

1. **Paper, ink, ember.** Warm paper surfaces (`bg-background`, `bg-card`), near-black ink text,
   and one hot accent, ember orange (`text-ember`, `bg-ember`). Ember marks the single most
   important thing on a screen (the primary action, "due", the active nav item, an accent word).
   Never use it for large fills.
2. **Three typefaces, three jobs.**
   - `font-serif` (Instrument Serif): page titles and big numbers only. Italic + ember for one accent
     word: `<h1 className="display text-5xl">Today's <em>queue.</em></h1>`.
   - `font-sans` (Geist): all body and UI text.
   - `font-mono` (Geist Mono): eyebrows, labels, table headers, codes, dates, keyboard hints,
     uppercase with wide tracking. Use the `.eyebrow` class: `<p className="eyebrow">(01) Daily review</p>`.
3. **Hairlines, not boxes.** 1px `border-border` rules; cards are `.card` (paper card, xl radius,
   soft shadow). Avoid nested cards. Prefer rows separated by rules over boxed tiles.
4. **Pills.** Buttons and chips are fully rounded (`.btn`, `.chip`). Inputs are `.field` (md radius).
5. **Quiet motion.** 150–200ms transitions; `motion` only for entrance/reorder; respect
   `prefers-reduced-motion` (handled globally in CSS; with `motion` use `useReducedMotion`).
6. **Accessible.** All text meets WCAG AA in both themes (tokens are tuned for it). Visible focus
   (global `:focus-visible` ember ring). Real `<button>`/`<a>`/`<form>`/`<label>`. Keyboard paths
   for every action. `aria-live` for toasts.
7. **Responsive.** Works at 360px wide: 16px side gutters, no horizontal page scroll; tables become
   card lists under 768px. Desktop app content max width ~1200px.

## Tokens (see `src/app/globals.css`)

Tailwind colour utilities available: `background`, `background-deep`, `foreground`, `card`,
`popover`, `primary(-foreground)`, `secondary`, `muted(-foreground)`, `faint`, `accent`,
`border`, `border-strong`, `input`, `ring`, `ember`, `ember-strong`, `ember-soft`,
`destructive`, `error`, `error-bg`, `error-border`, `success(-bg/-border)`, `warning(-bg/-border)`,
`info`, `info-bg`, `easy`, `medium`, `hard`, `chart-1..5`.

Raw CSS variables also exist for: `--topic-1..12` (topic colours), `--heat-0..4` (heatmap scale),
`--easy/medium/hard-{text,bg,border}`, `--shadow-card`, `--shadow-pop`, `--overlay`.

Fonts: `font-serif`, `font-sans`, `font-mono`. Radius: `rounded-md|lg|xl|2xl`, pills `rounded-full`.

## Component classes

| Class | Use |
|---|---|
| `.paper` | Page background with ruled lines and the red margin rule (landing, auth). `.paper-lines` = lines only (app pages, optional) |
| `.grain` | Subtle noise overlay on a page root |
| `.card` | Paper card |
| `.eyebrow` | Mono uppercase label with ember dot. `.eyebrow.eyebrow-plain` = no dot |
| `.display` | Serif heading; `<em>` inside is ember italic |
| `.btn` + `.btn-primary` / `.btn-ember` / `.btn-outline` / `.btn-ghost` / `.btn-danger`; sizes `.btn-sm` `.btn-lg` `.btn-icon` | Buttons |
| `.btn.btn-cta` with `<span className="btn-cta-dot"><ArrowUpRight/></span>` | Hero call-to-action |
| `.link-underline` | Underlined text link ("See how it works ↓") |
| `.field`, `.label` | Inputs/select/textarea and their labels |
| `.chip` + `.chip-ember` / `-easy` / `-medium` / `-hard` / `-success` / `-error` / `-warning`; `.chip-mono` | Chips/badges |
| `.kbd` | Keyboard key |
| `.menu`, `.menu-item` (`data-danger`), `.menu-sep` | Dropdowns/popovers |
| `.overlay`, `.modal` | Dialogs |
| `.table-paper` | Tables (mono uppercase headers, hairline rows, ember-tint hover/selected via `data-selected`) |
| `.skeleton` | Loading shimmer |
| `.ember-dot`, `.ember-dot-pulse` | Status dot |
| `.animate-row-highlight` | Flash a new/changed row |

`<Brand />` from `@/components/brand` renders the wordmark (ember dot + italic serif "dsarecx").
`cn()` from `@/lib/utils`. Icons: `lucide-react`, 16px in UI, stroke 1.75.

## Page anatomy (app)

```
(01) DAILY REVIEW                       ← .eyebrow
Today's queue.                          ← h1.display text-5xl md:text-6xl, accent word in <em>
One-line muted description.             ← text-muted-foreground
────────────────────────────────────── ← border-b
[content]
```

Section numbers in eyebrows go (01), (02)… per page. Sidebar nav is the same system: mono
section label, items with an ember dot for the active one.

## Naming

Product name: **dsarecx** (always lower-case, from `siteConfig.name`). Never show "engram" or
"recall" in the UI. Tagline: "Solve it once. Recall it for *good.*"
