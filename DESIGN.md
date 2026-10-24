# Design System & Guidelines (VideoTimmer)

Synthesized via **UI/UX Pro Max** and **Impeccable** design specifications.

## 1. Visual Theme & Palette

- **Mode:** Clean, crisp light surfaces with high-contrast text and dark slate navigation (`#0F172A`).
- **Surface Background:** `#FFFFFF` with ultra-light neutral backgrounds (`#F8FAFC`).
- **Primary Text:** High contrast dark slate (`#0F172A`).
- **Muted Text / Labels:** Calm slate gray (`#64748B`).
- **Brand & Trajectory Accent:** Vibrant Rose (`#E11D48`) for YouTube metrics, Blue (`#2563EB`) for core renderer workflows.
- **Success / Positive:** Emerald (`#059669`).
- **Warning / Alert:** Amber (`#D97706`).
- **Separators & Hairlines:** Fine, crisp 1px borders (`#E2E8F0`).

## 2. Typography

- **Font Family:** `Inter`, system-ui, -apple-system, sans-serif.
- **Hierarchy:**
  - Display Metric: `text-3xl` / `text-4xl font-black tracking-tight`
  - Page Titles: `text-xl font-bold text-slate-900 tracking-tight`
  - Card Titles: `text-sm font-semibold text-slate-800`
  - Body & Table Data: `text-xs font-medium text-slate-700`
  - Sublabels & Meta: `text-[10px]` or `text-[11px] font-mono text-slate-400`

## 3. Spacing & Rhythm (UI/UX Pro Max 4/8dp standard)

- Padding inside cards: `16px` to `24px` (`p-4` to `p-6`) to let content breathe.
- Button padding: `px-3.5 py-1.5` for compact controls, `px-4 py-2` for standard.
- Minimum interactive click/tap target: `44px` height/width.

## 4. Components & Affordances

- **Segmented Timeframe Controls:** Pill-style rounded-xl container (`bg-slate-100`) with active white pill button (`bg-white text-slate-900 shadow-sm font-bold`).
- **Custom Selects:** All dropdowns use `CustomSelect.tsx` (strictly no native HTML `<select>`).
- **Notice & Confirmation:** All alerts and confirmations use `NoticeModal.tsx` (strictly no browser `alert()` or `confirm()`).
- **Icons:** Exclusively Lucide SVG vector icons. Strictly zero unicode emojis.

## 5. Anti-Patterns to Refuse

- No nested cards inside cards.
- No multi-layered competing graphs on a single screen.
- No loud gradient text or arbitrary glowing drop shadows.
- No emojis anywhere in the user interface.
