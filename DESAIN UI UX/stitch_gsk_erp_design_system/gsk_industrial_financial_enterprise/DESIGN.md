---
name: GSK Industrial & Financial Enterprise
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#45464d'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002113'
  on-tertiary-container: '#009668'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  numeric-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  numeric-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  numeric-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-compact: 0.5rem
  margin: 1.5rem
  margin-sm: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

The design system embodies **Modern Corporate Industrial & Clean Financial SaaS**, engineered specifically for heavy construction, manufacturing workflows, and rigorous GAAP-compliant financial ledger oversight. It serves site project managers, procurement directors, plant controllers, and corporate accountants who demand instant operational visibility without visual noise.

The aesthetic reconciles two distinct worlds:
1. **Civil & Industrial Engineering:** High-durability utility, structural rhythm, safety signaling, and authoritative operational discipline.
2. **Modern Financial SaaS:** High-density ledger sheets, zero-compromise legibility, sub-pixel data alignment, and precise auditing clarity.

The visual tone is pragmatic, steadfast, and technical. Surfaces feel milled, structural, and organized. Every element exists to process complex enterprise resource workflows with zero latency and maximum confidence.

## Colors

The palette delivers a high-contrast industrial utility layout set against an immaculate neutral foundation:

- **Primary (`#0F172A` - Deep Steel Navy):** Anchors headers, primary action buttons, key structural chrome, and main navigational hierarchies.
- **Secondary (`#F59E0B` / `#D97706` - Industrial Safety Amber):** Reserved for primary interactive accents, work-order status indicators, high-priority manufacturing notices, and critical transactional callouts.
- **Tertiary (`#10B981` / `#DCFCE7` - Profit Emerald):** Positive fiscal ledgers, credit entries, operational equipment uptime, and completed production batches.
- **Neutral Surface & Base:**
  - Base Canvas: `#F8FAFC` (Light Cool Slate)
  - Card & Table Surface: `#FFFFFF` (Surface White)
  - Secondary Chrome / Panel Surface: `#F1F5F9` (Milled Slate)
  - Structural Borders & Gridlines: `#E2E8F0` (Border Slate)
- **Status & Auditing Indicators:**
  - Danger / Debit Variance: `#EF4444` with `#FEE2E2` soft container
  - Attention / Hazard / In-Review: `#F59E0B` with `#FEF3C7` soft container
  - Audit Trail / Inactive: `#64748B` with `#F1F5F9` container

Ensure data grids leverage alternating row fills (`#FFFFFF` to `#F8FAFC`) with `#E2E8F0` dividing lines to prevent cognitive fatigue during deep ledger scans.

## Typography

The type system blends the architectural structure of **Plus Jakarta Sans** for display, section titles, and module banners with the precision of **Inter** for dense transactional tables, data sheets, and component controls.

All numerical financial entries, bill of materials (BOM) quantities, inventory stock units, and operational balances must enforce `font-feature-settings: "tnum" 1, "cv05" 1` (tabular numerals) to guarantee vertical alignment across all decimal and currency positions. Code snippets, batch IDs, serial tracking tokens, and machine telemetry IDs must be set in uppercase tracking styles with high-contrast baseline alignment.

## Layout & Spacing

The layout is built on a 12-column fluid grid system pinned to a maximum workstation canvas of 1680px for wide industrial dashboards, scaling down gracefully to 100% viewport width.

- **Desktop (1280px+):** 12 columns, 16px gutter (`gutter`), 24px outer margins (`margin`). Dense data tables allow toggleable compact grid modes using 8px gutters (`gutter-compact`).
- **Tablet (768px - 1279px):** 8 columns, 16px gutter, 16px outer margins (`margin-sm`). Multi-pane financial views collapse into stacked tabs or horizontally scrolling sub-grids.
- **Mobile (<768px):** 4 columns, 12px gutter, 12px outer margins. Secondary data columns hide behind expandable row triggers or responsive sheet drawers.

Component interior spacing follows an 4px baseline rhythm optimized for information density: form controls, cell rows, and metadata badges favor `space-sm` (8px) and `space-md` (12px) over expansive open spacing.

## Elevation & Depth

This system avoids heavy shadows, instead using crisp borders, structural surface tints, and micro-elevation to preserve industrial utility:

- **Flat Baseline (Level 0):** Background canvas (`#F8FAFC`). Data tables and static inspection forms sit directly at this depth.
- **Outlined Surface (Level 1):** Standard panels, cards, and data cards sit on `#FFFFFF` encapsulated by a 1px solid border (`#E2E8F0`) with a micro-drop shadow: `0 1px 2px 0 rgba(15, 23, 42, 0.05)`.
- **Raised Interactive (Level 2):** Dropdown menus, hovered rows, contextual popovers, and filter toolbars use `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)` wrapped in `#CBD5E1` boundary lines.
- **Overlay & Modal (Level 3):** Batch approval modals, ledger drawer panels, and manufacturing run overrides use `0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)` over a scrim of `#0F172A` with 40% opacity.

## Shapes

The shape geometry is **Soft (Level 1)**, reflecting industrial machinery and enterprise precision:

- Small controls (inputs, dropdown selects, table chips, segmented controls): `0.25rem` (4px).
- Standard containers (data cards, metric summary modules, table containers): `0.5rem` (8px).
- Modal dialogues, full-screen drawer overlays, and floating notification banners: `0.75rem` (12px).
- Status pill dots and circular icon badges: full round (`9999px`).

Avoid large rounded corners or bubbly aesthetics; surfaces must feel engineered and structurally sound.

## Components

### Buttons
- **Primary Industrial:** Deep Steel Navy (`#0F172A`) solid fill, white text, 4px corner radius, height 36px (standard) or 32px (compact data-table action). Hover: `#1E293B`. Active: `#020617`.
- **Secondary Accent:** Amber (`#F59E0B`) solid fill with `#0F172A` text for mission-critical batch runs, machine approvals, or invoice submissions. Hover: `#D97706`.
- **Outlined Utility:** `#FFFFFF` fill with 1px `#CBD5E1` border and `#1E293B` text. Hover: `#F8FAFC`.
- **Destructive:** Solid `#EF4444` fill or 1px `#FCA5A5` outline with `#DC2626` text for journal reversal and order termination.

### Input Fields & Data Controls
- **Height & Form Factor:** 36px standard, 30px compact (in-line editable table grids).
- **Surface:** `#FFFFFF` background with 1px `#CBD5E1` border; text in `#0F172A`.
- **Focus State:** 1px `#0F172A` border with a 2px `#F59E0B` focus ring outline offset by 1px.
- **Prefix / Suffix Elements:** Currency symbols (`IDR`, `USD`) and unit of measure (`kg`, `m³`, `pcs`) are encased in `#F1F5F9` background chips with 1px `#E2E8F0` separators.

### Data Tables & Ledgers (Core Component)
- **Header:** Background `#F8FAFC`, uppercase `#475569` text (11px, weight 600, letter-spacing 0.04em), 36px height, bottom border 2px solid `#CBD5E1`.
- **Rows:** 40px standard height, 32px high-density height. Alternate striped row option with `#F8FAFC`. Hover: `#F1F5F9`.
- **Cell Content:** Tabular numbers right-aligned with fixed column widths; text left-aligned. Negative currency in `#DC2626`; positive ledger balances in `#16A34A`.

### Status Badges & Chips
- **Success / Complete / Balanced:** `#DCFCE7` background, `#15803D` text, 1px `#BBF7D0` border.
- **Pending / In Production / Safety Alert:** `#FEF3C7` background, `#B45309` text, 1px `#FDE68A` border.
- **Halted / Variance Danger:** `#FEE2E2` background, `#B91C1C` text, 1px `#FECACA` border.
- **Neutral / Draft / Queued:** `#F1F5F9` background, `#475569` text, 1px `#E2E8F0` border.

### Checkboxes & Radios
- Size: 16px x 16px with 3px corner radius (checkboxes) or circular (radios).
- Border: 1.5px solid `#94A3B8`.
- Checked State: `#0F172A` fill with white checkmark or center pip.

### Metric KPI Cards
- Base: White background, 1px border `#E2E8F0`, 8px corner radius, internal padding of 16px.
- Title: 12px uppercase `#64748B` with 500 weight.
- Value: 24px `numeric-lg` in `#0F172A`.
- Trend Pill: Integrated pill chip with micro-arrow indicating percentage period-over-period variance.