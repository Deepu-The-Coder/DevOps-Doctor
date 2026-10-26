# PRD — DevOpsDoctor AI web app (dual theme, multi-page)

## 0. How to use this document
- docs/BUILD_SPEC.md is the technical build spec (backend, probes, sample-app,
  eval, deploy, safety rules). Everything in it still applies.
- This PRD defines the product surface: pages, navigation, theming, design
  system, and acceptance criteria.
- Where the two conflict, THIS PRD wins. Known overrides:
  1. Frontend is multi-page with client-side routing (not single page).
  2. Dual theme: dark (default) and light (not dark only).
  3. Allowed extra frontend dependency: react-router-dom. Nothing else.
- Design source of truth: every file in design/ (Stitch HTML exports + PNG
  screenshots). Read all of them before writing any frontend code. Match their
  layout, spacing, and type. The Stitch designs are dark; derive the light theme
  from the token table in section 6, keeping layout identical.
- Hard deadline: hackathon ends in under 3.5 hours. Respect priorities (P0 > P1
  > P2). Never start a P1 page while a P0 item is broken.

## 1. Problem
When a deployment fails, developers can't tell whether the cause is in code,
dependencies, Docker/platform config, environment variables, or the network.
Existing workflows split this across tools: debuggers and code search on one
side, platform logs and dashboards on the other. Pasting an error into a chatbot
gives a generic checklist because the model never sees the repo or the config.
The most painful bugs live in the gap, e.g. code reads DB_URL while the platform
sets DATABASE_URL.

## 2. Product
DevOpsDoctor reads a GitHub repo and the deployment logs together and produces a
differential diagnosis: 3–5 ranked root-cause hypotheses, each with evidence
(file:line or log line), what would rule it out, and a suggested patch. Probe
Mode lets the model order safe, allowlisted, read-only checks and re-rank.

Powered by Gemma 4 on DigitalOcean serverless inference; deployed on
DigitalOcean App Platform.

Pitch line: "One investigation workflow for both code-level bugs and deployment
failures."

## 3. Users
- Primary: backend / full-stack developer whose deploy just failed, under time
  pressure, comfortable with terminals and GitHub.
- Secondary: hackathon judges evaluating the demo in ~3 minutes. They must see:
  same symptom → different root causes → told apart with evidence → measured.

## 4. Goals and non-goals
Goals
- Correct top hypothesis on the 4 sample cases, with real evidence refs.
- A probe run that visibly changes the ranking (case-c).
- A benchmarks page proving repo context improves accuracy vs logs-only.
- A UI developers trust: dense, calm, keyboard-friendly, readable in both themes.

Non-goals
- Auth, accounts, teams, billing, persistence beyond localStorage.
- Auto-applying patches or opening PRs.
- Supporting private repos beyond GITHUB_TOKEN.
- Mobile-first design. Must not break below 1024px, but desktop is the target.

## 5. Information architecture

Routes (react-router-dom, BrowserRouter):
| Route         | Page              | Priority |
|---------------|-------------------|----------|
| /app          | Workspace         | P0       |
| /cases        | Case library      | P0       |
| /             | Overview          | P1       |
| /benchmarks   | Benchmarks        | P1       |
| /how-it-works | How it works      | P2       |
| *             | 404               | P2       |

Until "/" exists, redirect "/" to "/app".

Global shell (all pages):
- Top bar 48px: product name as plain text (links to /), nav links
  (Workspace, Cases, Benchmarks, How it works), right side: theme toggle,
  GitHub repo link icon. Active nav item marked with a 2px bottom border in
  accent color, not a filled pill.
- Footer only on Overview and How it works (one line: "Gemma 4 · DigitalOcean
  App Platform · built at <hackathon name>"). Workspace has a status bar instead.
- For App Platform static hosting, add a catch-all rewrite so deep links
  (/benchmarks) serve index.html. Put it in .do/app.yaml (catchall_document).

## 6. Design system

### 6.1 Principles
- Feels like a code host or IDE, not a marketing page or "AI product".
- Information density is a feature. Compact 4/8px grid.
- Flat surfaces separated by 1px borders. No shadows except on popovers/menus.
- Monospace for anything a developer would copy: paths, hosts, ports, env var
  names, log lines, numbers, diffs.
- One accent color. Semantic colors only where they carry meaning.

### 6.2 Banned (both themes)
Purple/violet gradients, gradient text, glows, neon, glassmorphism/blur,
floating blobs/orbs, sparkle or magic-wand icons, "AI-powered" badges, emoji,
illustrations, stock imagery, giant hero headings, oversized rounded cards with
soft drop shadows, animated gradient backgrounds, typewriter text effects.

### 6.3 Tokens
Define all colors as CSS variables on :root[data-theme="dark"] and
:root[data-theme="light"]. Components reference tokens only, never raw hex.
If design/ uses slightly different dark values, prefer design/ for dark.

| Token              | Dark      | Light     |
|--------------------|-----------|-----------|
| --bg               | #0d1117   | #ffffff   |
| --bg-subtle        | #161b22   | #f6f8fa   |
| --bg-inset         | #010409   | #eff2f5   |
| --border           | #30363d   | #d0d7de   |
| --border-muted     | #21262d   | #e5e9ed   |
| --text             | #e6edf3   | #1f2328   |
| --text-muted       | #8b949e   | #59636e   |
| --accent           | #2f81f7   | #0969da   |
| --accent-fg        | #ffffff   | #ffffff   |
| --success          | #3fb950   | #1a7f37   |
| --danger           | #f85149   | #cf222e   |
| --warning          | #d29922   | #9a6700   |
| --diff-add-bg      | rgba(46,160,67,0.15)  | #dafbe1 |
| --diff-del-bg      | rgba(248,81,73,0.15)  | #ffebe9 |
| --highlight-line   | rgba(187,128,9,0.15)  | #fff8c5 |
| --focus-ring       | #2f81f7   | #0969da   |

Category tag colors (network, env, config, code, platform, dependency): use
muted tinted backgrounds with readable text in both themes; define as tokens
(--tag-network-bg, --tag-network-fg, etc.). Text contrast must pass WCAG AA in
both themes.

### 6.4 Typography
- UI: Inter (fallback system-ui), 13px base, 14px for body copy on Overview and
  How it works, 20/24px max for page titles.
- Mono: JetBrains Mono (fallback ui-monospace), 12–13px.
- Section labels: 11px, uppercase, letter-spacing 0.06em, --text-muted.
- Load fonts from Google Fonts with display=swap.

### 6.5 Shape and motion
- Radius 6px max (4px for chips/tags). Borders 1px.
- Motion only for state change: 120ms ease for hovers, confidence bar width
  transition 300ms when probes update it. Respect prefers-reduced-motion.

### 6.6 Theme behavior
- Default: follow prefers-color-scheme on first visit; dark if unknown.
- Toggle in top bar cycles dark/light, persisted in localStorage key "dd-theme"
  (wrap all storage access in try/catch).
- Prevent flash of wrong theme: inline script in index.html sets data-theme on
  <html> before the app loads.
- Keyboard shortcut: Shift+T toggles theme.
- Code viewer, log viewer, diff viewer, and charts must all switch correctly.
  Test every page in both themes before marking a phase done.

## 7. Page requirements

### 7.1 /app — Workspace (P0)
Implements Phase 4 of BUILD_SPEC.md exactly (three columns: Case /
Differential / Evidence with Files, Probes, Patch tabs; status bar; all states
including empty, ingesting, diagnosing skeletons, results, probing live,
error with retry, cached-run fallback).
Additions:
- Accepts query params: /app?case=case-c preloads repo URL, branch, and that
  case's log file (served from frontend/public/cases/case-c.log), so the Case
  library and Overview can deep-link into a ready-to-run state.
- Keyboard: Ctrl/Cmd+Enter runs diagnosis, P runs probes, 1–5 focuses
  hypothesis N, F/R/D (when not typing) switches Files/Probes/Patch tabs.
  Show shortcuts in a small "?" popover.
- Each hypothesis card has a "copy as markdown" action (title, confidence,
  evidence refs) for pasting into an issue or Slack.
Acceptance:
- case-a run shows env var mismatch as #1 with a file ref and a config ref.
- case-c probe run shows at least one confidence change in the timeline.
- Clicking a file evidence chip opens that file at the highlighted line.
- Works in both themes; no layout shift when switching.

### 7.2 /cases — Case library (P0)
Purpose: let judges and users run a known failure in one click.
- Dense table/list of the 4 cases. Columns: case id (mono), symptom (one line),
  stack ("Node · Express · Postgres"), platform ("App Platform"), log size, and
  "Open in workspace" button → /app?case=<id>.
- Do NOT reveal the root cause in the list. Each row has a collapsed
  "Reveal answer" disclosure (for after the demo).
- Content comes from frontend/src/data/cases.js. Root-cause text for "Reveal
  answer" is left as TODO placeholders for me to fill in.
Acceptance: each button lands on /app fully preloaded and runnable.

### 7.3 / — Overview (P1)
A product page written for developers. Plain, specific, no marketing fluff.
Sections, in order:
1. Header block: product name, one-sentence description, two buttons:
   "Open workspace" (primary → /app) and "Try a broken app" (secondary →
   /cases). Next to it, a static, real-looking preview: a cropped render of a
   hypothesis list using the real components with hardcoded data, not an image.
2. "Same symptom, four causes": a compact 4-column grid. Each column shows the
   identical log symptom line in mono, then the different root cause category
   underneath. This is the core argument; make it the visual centerpiece.
3. "How a diagnosis runs": 4 numbered steps in a single horizontal row
   (Ingest repo → Extract log signal → Rank hypotheses → Probe and re-rank).
   Text only, small line icons at most.
4. "Compared to pasting the error into a chatbot": a two-column table (Typical
   workflow vs DevOpsDoctor) with rows: input, output, uncertainty,
   verification, code vs infra.
5. "Safety model": short list — allowlisted read-only probes, host
   restriction, secrets never sent to the model, no command execution.
6. Footer line.
Acceptance: no banned visual patterns; reads well in both themes; every claim
on the page is true of the actual build.

### 7.4 /benchmarks — Benchmarks (P1)
Purpose: measured evidence for the pitch.
- scripts/eval.js (from BUILD_SPEC Phase 5) additionally writes
  frontend/public/eval-results.json:
  { generated_at, model, runs: [{ mode: "full"|"logs-only"|"full+probe",
    cases: [{ case, top1_correct, correct_rank, time_ms, false_positives }],
    totals: { top1_accuracy, avg_time_ms, false_positives } }] }
- Page shows: three summary stat blocks (top-1 accuracy, avg time to
  diagnosis, false positives) with a mode switcher; a per-case table; a simple
  bar comparison of full vs logs-only accuracy built with plain SVG/CSS (no
  chart library).
- A visible note: "4 hand-built cases. Small sample; directional, not
  statistically significant." Honesty is part of the pitch.
- If eval-results.json is missing, show an empty state with the command to
  generate it.
Acceptance: numbers on the page match the eval script output exactly.

### 7.5 /how-it-works — How it works (P2)
- Architecture diagram as inline SVG using theme tokens (React frontend →
  Express backend → GitHub API / Gemma 4 on DigitalOcean serverless; probes box
  with the 4 allowlisted tools).
- Short sections: case file construction, the diagnosis JSON schema (render
  schema as a mono code block), probe loop (max 3 rounds), evidence
  verification (refs that don't exist are dropped and flagged).
- API reference: the three endpoints with request/response examples.

### 7.6 404 (P2)
One line of text in mono, e.g. "404 · route not found", plus a link to /app.

## 8. Frontend structure
frontend/src/
  main.jsx, App.jsx (router + shell)
  theme/ (tokens.css, theme.js: get/set/toggle, ThemeToggle.jsx)
  components/ (TopBar, StatusBar, HypothesisCard, ConfidenceBar, EvidenceChip,
    CodeViewer, LogViewer, DiffViewer, ProbeTimeline, Tabs, Tag, Button,
    Skeleton, EmptyState, ShortcutsPopover)
  pages/ (Workspace, Cases, Overview, Benchmarks, HowItWorks, NotFound)
  data/cases.js
  api.js (all fetch calls; base URL from import.meta.env.VITE_API_URL)
Reuse the same HypothesisCard on Overview (static data) and Workspace (live).

## 9. Accessibility and quality bar
- All interactive elements reachable by keyboard with visible --focus-ring.
- Tabs use proper roles (tablist/tab/tabpanel).
- Color is never the only signal: confidence changes show ↑/↓ and numbers;
  diff lines keep +/− gutters; probe results show text labels.
- No console errors. No layout overflow at 1024px and 1440px.

## 10. Build order (replaces BUILD_SPEC Phase 4 ordering)
Backend phases 0–3 from BUILD_SPEC first (if not already done). Then:
- F1 (P0): shell, router, theme system with both token sets, no-flash script,
  Workspace page wired to backend. Stop for review in both themes.
- F2 (P0): Case library + /app?case= deep links + public case logs.
- F3 (P1): Overview page.
- F4 (P1): eval.js JSON output + Benchmarks page.
- F5 (P2): How it works + 404.
- F6: deploy config updates (static site catch-all, env vars), final pass in
  both themes.
After each F-phase: stop, tell me how to run and check it, list anything you
skipped, and wait.

## 11. Cut order if behind
1. How it works and 404 → replace with a README section.
2. Benchmarks page → show eval output in terminal during demo.
3. Overview → "/" redirects to /cases.
4. Keyboard shortcuts and copy-as-markdown.
Never cut: Workspace, theme toggle, Case library deep links, Probe timeline.

## 12. Open items for me (do not guess)
- Hackathon name for footer.
- Root-cause text in cases.js "Reveal answer".
- eval/expected.json.
- GitHub URL of the sample-app repo and of this project's repo.
