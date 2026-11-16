# Agent Instructions & Guidelines for VideoTimmer

> **CRITICAL PROTOCOL**: Before processing any prompt, instruction, or user request, review and adhere strictly to all the rules documented in this file. Every single turn and action must follow these four core laws without exception.

---

## 1. Absolute Ban on Emojis (Never Use Any Emojis)
- **NEVER use any emoji characters anywhere in the project.**
- This applies to:
  - Frontend components, pages, widgets, modals, toasts, tooltips, and badges.
  - Button text, labels, placeholder strings, and copywriting.
  - Server logs, console outputs, and database documents.
  - Direct assistant chat messages, markdown artifacts, and status updates.
- **Strict Enforcement**:
  - Prohibited: Any unicode emoji characters (e.g. rocket, sun, moon, owl, checkmark emoji, fire, sparkles emoji, etc.).
  - Required Replacement: Always use professional SVG icons from **Lucide React** (e.g., `<Sparkles />`, `<CheckCircle2 />`, `<AlertCircle />`, `<Eye />`, `<Calendar />`, `<Folder />`, `<Search />`) or clean typography badges.

---

## 2. Always Use CustomSelect & Custom Options (Never Native `<select>`)
- **NEVER use native HTML `<select>` or `<option>` tags.**
- Always import and use the project's pre-built custom select component:
  - Path: `src/components/ui/CustomSelect.tsx`
  - Types: `import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect';`
- Why this is mandatory:
  - Native browser `<select>` dropdowns break theme consistency, have inconsistent platform styling across OS/browsers, and look jarring against the luxury dark aesthetic.
  - `CustomSelect` provides full keyboard navigation, escape handling, outside click dismissal, icon support, option badges, descriptions, and cohesive theme borders and shadows.

---

## 3. Strict Theme Accuracy & Visual Cohesion
- **Always maintain 100% theme accuracy with the established design system:**
  - Background palette: Deep slate foundations (`bg-slate-950`, `bg-slate-900`, `bg-slate-900/80`).
  - Border tokens: Subtle high-precision borders (`border-slate-800`, `border-slate-800/80`, `border-slate-700/60`).
  - Text hierarchy: High-contrast headings (`text-white`, `text-slate-100`), secondary labels (`text-slate-300`, `text-slate-400`), muted helper text (`text-slate-500`).
  - Accent gradients: Refined indigo, cyan, sky, and purple accents with matching soft glow shadows (`shadow-indigo-600/20`, `bg-indigo-600 hover:bg-indigo-500`).
  - Surface elevations: Card panels must feature consistent padding, rounded-2xl radii, and layered depth.

---

## 4. UI/UX Excellence: Always Apply `ui-ux-pro-max` & `impeccable`
- **Whenever designing, modifying, or creating any user interface, view, modal, or component:**
  - Always activate and apply the principles from **`ui-ux-pro-max`** and **`impeccable`** skills.
  - Prioritize:
    1. **Micro-Interactions & State Clarity**: Loading spinners on active buttons, disabled states, hover transitions, and instant feedback.
    2. **Cognitive Load Reduction**: Chunk complex forms into logical groups, provide smart defaults, and surface helpful presets.
    3. **Responsive Typography & Spacing**: Strict 8px/4px spatial rhythm, proper line heights, and truncation with tooltips on long text.
    4. **Empty & Error States**: Every list or table must have an informative, visually polished empty state and clear error recovery paths.
