---
name: DevOps Workbench
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00885d'
  on-tertiary-container: '#000703'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: '0'
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: '0'
  mono-code:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: -0.01em
  mono-meta:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-desktop: 1rem
  margin: 1rem
  margin-desktop: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system embodies a tactical, developer-native workbench built for production infrastructure, incident mitigation, and automated root cause analysis. It consciously eschews consumer AI tropes—no pulsing purple nebulae, decorative sparkles, or ambiguous conversational fluff. Instead, the interface draws structural authority from Datadog APM, JetBrains IDEs, and Linear's surgical precision.

### Personality & Values
- **Instrumental & Functional:** The UI behaves like an oscilloscope or tactical terminal. Every pixel serves situational awareness, telemetry parsing, and decisive triage.
- **Surgical Density:** Information architecture prioritizes scannable signal over decorative padding, favoring structured monospaced metadata, tight data grids, and state chips.
- **Uncompromising Precision:** 1px hairline borders, discrete visual containers, and deterministic layout geometry ensure operators feel in command during severe incidents.

### Design Movement
**Engineered Minimalism & Structured Utility:** A convergence of dark-surface telemetry design and modular grid systems. It relies on subtle contrast transitions, functional status colors rooted in standard Unix observability norms (healthy, degraded, warning, fatal), and deliberate typographic rhythm.

## Colors

The palette is engineered for prolonged operational focus during day and night on-call shifts. Contrast ratios strictly exceed WCAG AAA standards for critical telemetry metrics.

### Tactical Accents & Telemetry
- **Primary (`#6366F1` - Indigo Runtime):** Used for focal action points, active execution traces, selected workspace states, and targeted inspector tabs.
- **Secondary (`#06B6D4` - Cyan Stream):** Serves real-time network telemetry, payload streams, throughput metrics, and dynamic agent inspections.
- **Tertiary (`#10B981` - Emerald Nominal):** Designates passing health checks, operational uptime, canary verifications, and zero-error deployments.
- **Warning / Degraded (`#F59E0B` - Amber Latency):** Highlights threshold breaches, queue saturation, and drift detection.
- **Fatal / Critical (`#EF4444` - Crimson Incident):** Reserved solely for fatal runtime panics, pipeline terminations, and immediate P0 triage triggers.

### Neutral Surface Tiers
- **Dark Mode (Default):**
  - Base canvas: `#090D16` (Deepest Void)
  - Surface container lowest: `#0F172A` (Panel Ground)
  - Surface container: `#141E33` (Card / Section Interior)
  - Surface container elevated: `#1E293B` (Flyouts / Popovers)
  - Hairline border subtle: `#1E293B` (Grid rules)
  - Hairline border prominent: `#334155` (Active container borders)
- **Light Mode:**
  - Base canvas: `#F8FAFC`
  - Surface container lowest: `#FFFFFF`
  - Surface container: `#F1F5F9`
  - Surface container elevated: `#FFFFFF`
  - Hairline border subtle: `#E2E8F0`
  - Hairline border prominent: `#CBD5E1`

## Typography

Typography balances structural neutral sans-serif typography (`Geist`) with rigorous code-block legibility (`JetBrains Mono`). 

### Hierarchy Roles
- **Display & Headlines (`Geist`):** Set with tight tracking to maintain visual cohesion at medium weights (`600`). Avoid large marketing hero sizes; headers stay compact to maximize above-the-fold telemetry visibility.
- **Body & Data Grid (`Geist`):** Scaled at `13px` and `12px` base baselines for maximum tabular information density without collapsing line scans.
- **Telemetry, Timestamps, Traces & Logs (`JetBrains Mono`):** Applied to log entries, commit SHAs, latency numbers, memory offsets, and terminal streams. Always enforce tabular numbers (`tnum`) across all monospaced counters.
- **Section Headers & Metric Identifiers (`label-caps`):** Formatted in uppercase monospaced text with positive letter spacing (`0.08em`) to demarcate widget groups and terminal panel splits.

## Layout & Spacing

The layout philosophy mirrors a split-pane workstation IDE. The application utilizes a dynamic, constrained multi-column layout with collapsable inspection rails rather than standard consumer card-column flows.

### Shell Architecture
- **Primary Navigation Rail:** Fixed width (`56px` collapsed, `220px` expanded).
- **Core Workspace Area:** Fluid split grid partitioned into tree navigators, central telemetry visualizers, and expandable log stream consoles.
- **Contextual Inspector Rail:** `360px` fixed panel docked to the right viewport edge for diagnostics, AST representations, and remediation suggestions.

### Spacing Scale & Density
- Baseline rhythm is anchored to a strict **4px/8px incremental grid**.
- Compact internal paddings (`space-xs` = 4px, `space-sm` = 8px, `space-md` = 12px) guarantee maximal data presentation per square inch.
- On viewports `< 1024px`, peripheral rails collapse automatically into slide-over panels, preserving the primary metric canvas and terminal stream.

## Elevation & Depth

This design system avoids blurry dropshadows, diffused clouds, or faux-glass blurs. Depth is achieved via **low-contrast hairlines** and **disciplined surface tiering**.

### Layering Model
1. **Canvas Level (0):** Deepest background (`#090D16` in dark mode). The mounting plate for split panes.
2. **Surface Level (1):** Workspaces, code editors, and trace timelines. Delimited by a crisp `1px solid #1E293B` boundary with zero box-shadow.
3. **Elevated Overlays & Inspector Sheets (2):** Command palettes, diagnostics flyouts, and dropdown autocomplete menus. Uses `#1E293B` container filling, bound by a `1px solid #334155` border, augmented with an acute, directional edge shadow: `0 4px 16px -2px rgba(0, 0, 0, 0.45)`.
4. **Active Selection Highlights:** Signaled via micro-borders (e.g., `1px solid #6366F1`) or hairline accent underlines, never through glowing outer radii.

## Shapes

The shape system is crisp, industrial, and understated (`roundedness: 1`). Large circular buttons and pill-shaped overlays are banned.

### Corner Radius Mapping
- **Base Components (`rounded` = 4px):** Buttons, text fields, chips, tabs, log lines, and inline code pills.
- **Panels & Viewport Dividers (`rounded-lg` = 8px):** Diagnostic cards, query modals, terminal panes, and dropdown sheets.
- **Complex Floating Surfaces (`rounded-xl` = 12px):** Command palettes (Cmd+K) and root incident overlays.
- **System Badges & Telemetry Nodes:** Micro-radius of 2px for commit tags and status dots to preserve angular precision.

## Components

### Buttons & Interactive Triggers
- **Primary Action (Remediate / Deploy / Apply):** Solid `#6366F1` background, `#FFFFFF` text, `4px` border radius, `0 1px 2px rgba(0,0,0,0.2)` shadow. Hover transition shifts brightness by +8%. No gradient fills.
- **Secondary / Workbench Utility:** Transparent background, `1px solid #334155` border, `#F1F5F9` text. Hover applies `#1E293B` surface background.
- **Destructive (Rollback / Terminate Pod):** Transparent or subtly tinted `#451A1A` container with a `1px solid #7F1D1D` border and `#FCA5A5` text.

### Telemetry Badges & Chips
- Status chips feature a `10px` monospaced label (`label-caps`) paired with an embedded `6px` status indicator dot.
- Nominal state: Emerald dot (`#10B981`) over `#064E3B` / 20% background with `#A7F3D0` text.
- Warning state: Amber dot (`#F59E0B`) over `#78350F` / 20% background with `#FDE68A` text.
- Critical state: Crimson dot (`#EF4444`) over `#7F1D1D` / 20% background with `#FECACA` text.
- Shape is strictly squared off with `2px` or `4px` corners—never pill-shaped.

### Data Tables & Trace Lists
- Row heights are compact (`28px` dense, `36px` default).
- Alternating row zebra banding is omitted in favor of a single `1px solid #1E293B` row divider.
- Hover states apply an instantaneous `#1E293B` background highlight across the full row.
- Primary keys (trace IDs, timestamps, span IDs) are rendered exclusively in `JetBrains Mono` at `11px`/`12px`.

### Input Fields & Command Palettes
- Input heights are locked to `32px` for standard inputs and `24px` for inline filter tokens.
- Surface: `#0F172A` with a `1px solid #334155` idle border.
- Focus: `1px solid #6366F1` border with zero glowing outer ring.
- Placeholders use `#64748B` with `12px` font sizing.

### Cards & Telemetry Visualizers
- Zero soft dropshadows. Visual distinction is dictated by `#141E33` background with hairline `#1E293B` outer borders.
- Header bars within cards have an explicit bottom border separating the visualizer from its control headers.
- Metric indicators use monospaced values in display weights accompanied by delta tokens (`+12ms`, `-4.2%`) tagged in appropriate telemetry green/red.

### Specialized Developer Artifacts
- **Terminal & Log Viewer:** True black canvas (`#05080F`), gutter with absolute line numbers in `#475569`, active line highlight in `#1E293B`, and log level badges with uniform 3-character abbreviations (`INF`, `WRN`, `ERR`, `DBG`).
- **Diff / Patch Blocks:** Red additions (`#7F1D1D` background tint, `#F87171` text) and green insertions (`#064E3B` background tint, `#4ADE80` text) marked with unambiguous `+` / `-` symbols in the gutter.