# DESIGN.md — ONLUNET ZEKA Visual Design System Contract

> **Target Audience:** AI Coding Agents (Antigravity, Cursor, Stitch, Claude Code) and Platform Engineers.  
> **Standard:** Based on [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) and Google Stitch Enterprise UI principles.  
> **Purpose:** Authoritative single source of truth for all UI generation, styling tokens, layout hierarchy, and visual consistency across the ONLUNET ZEKA Platform.  
> **Rule Enforcement:** All generated dashboards, panels, modals, components, and CSS changes MUST strictly adhere to this document. Visual drift, amateur flat colors, and inconsistent styling are strictly prohibited.

---

## 🎨 1. Visual Theme & Atmosphere (Vibe)

- **Sector / Archetype:** Executive Developer Studio / Autonomous AI Software Factory (`TECH_SOFTWARE`)
- **Brand Vibe:** Deep Obsidian Slate, Electric Indigo accents, ultra-refined typography, razor-sharp card anatomy with micro inner-highlights, and high-density information layout (Linear / Vercel / Raycast / Stripe developer tier).
- **Information Density:** High & Structured — data-rich telemetry cards, clean single-line navigation, clear visual hierarchy.
- **Visual Tone:** Professional, authoritative, futuristic yet calm and distraction-free.

---

## 🌈 2. Color Palette & Semantic Tokens

### Canvas & Surface Hierarchy
```css
:root {
  /* Canvas & Backgrounds */
  --bg-canvas: #07090e;             /* Deep Obsidian Void — Main background */
  --bg-surface: #0d111a;            /* Elevated surface — Top bar, sub-navbar, drawer */
  --bg-surface-elevated: #111622;   /* Section headers, modal containers */
  --bg-card: #121824;               /* Primary card surface */
  --bg-card-hover: #162032;         /* Hover state for interactive cards */
  --bg-input: #0a0e17;              /* Input, textarea and select background */

  /* Borders & Dividers */
  --border-subtle: rgba(255, 255, 255, 0.06); /* Very subtle separator */
  --border-default: rgba(255, 255, 255, 0.10); /* Default card & input border */
  --border-hover: rgba(255, 255, 255, 0.20);  /* Hover border */
  --border-focus: #6366f1;                    /* Focus ring border (Electric Indigo) */
  --border-card-highlight: inset 0 1px 0 0 rgba(255, 255, 255, 0.08); /* Inner top edge highlight */

  /* Typography Colors */
  --text-main: #f8fafc;             /* 900 — Pure headings and primary values */
  --text-body: #cbd5e1;             /* 700 — Crisp body text and instructions */
  --text-muted: #94a3b8;            /* 500 — Secondary descriptions, captions */
  --text-dim: #64748b;              /* 400 — Placeholders, metadata, hints */

  /* Primary Brand Accent (Electric Indigo / Modern Violet) */
  --primary: #6366f1;               /* Main interactive CTA, active tabs */
  --primary-hover: #4f46e5;         /* Deep indigo on hover */
  --primary-active: #4338ca;        /* Pressed state */
  --primary-light: rgba(99, 102, 241, 0.12); /* Subtle badge / pill backdrop */
  --primary-glow: rgba(99, 102, 241, 0.28);  /* Ambient focus & highlight glow */

  /* Semantic State Colors */
  --success: #10b981;               /* Emerald — Online, 100/100 scores, passed tests */
  --success-light: rgba(16, 185, 129, 0.12);
  --warning: #f59e0b;               /* Amber — Notice, medium impact, quota warnings */
  --warning-light: rgba(245, 158, 11, 0.12);
  --danger: #ef4444;                /* Crimson — Errors, 0 launches, failed checks */
  --danger-light: rgba(239, 68, 68, 0.12);
  --info: #0ea5e9;                  /* Sky Blue — Informative telemetry, links */
  --info-light: rgba(14, 165, 233, 0.12);
  --ai-purple: #a855f7;             /* Purple — Autonomous AI squad execution */
  --ai-purple-light: rgba(168, 85, 247, 0.14);

  /* Geometry & Radius */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
  --radius-full: 9999px;

  /* Elevation Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.25);
  --shadow-md: 0 4px 14px -2px rgba(0, 0, 0, 0.45);
  --shadow-lg: 0 10px 25px -4px rgba(0, 0, 0, 0.55);
  --shadow-card: 0 4px 20px -2px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.08);
}
```

---

## 🔤 3. Typography Rules

Web fonts MUST be loaded via Google Fonts CDN in all HTML shells:
- **Headings & Display:** `"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif`
- **UI Elements & Body:** `"Inter", -apple-system, BlinkMacSystemFont, sans-serif`
- **Telemetry, Code, SKU, Logs & Shell Commands:** `"JetBrains Mono", "Fira Code", monospace`

### Scale & Weight Hierarchy
| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|:---|:---|:---|:---|:---|:---|
| **Display H1** | `2.15rem` (34px) | `800 (ExtraBold)` | `1.18` | `-0.03em` | Hero studio title |
| **Section H2** | `1.4rem` (22px) | `700 (Bold)` | `1.25` | `-0.02em` | Main section titles, Radar Hub |
| **Card Title H3** | `1.05rem` (17px) | `700 (Bold)` | `1.3` | `-0.01em` | Template cards, inspection cards |
| **Body Primary** | `0.92rem` (14.5px) | `400 / 500` | `1.55` | `normal` | General descriptions, file lists |
| **Micro / Badge** | `0.72rem` (11.5px) | `700 (Bold)` | `1.2` | `+0.04em` | Status badges, category pills, SKU |
| **Code / Monospace**| `0.82rem` (13px) | `500 (Medium)` | `1.45` | `normal` | Shell commands, file paths, JSON |

---

## 🧩 4. Component Anatomy & Contracts

### 1. Solid Sticky Header & Sub-Navbar (Corporate Rules 3 & 6)
- **Rules:**
  - `position: sticky !important; top: 0 !important; z-index: 100 !important;`
  - Solid opaque background with blur (`background: rgba(13, 17, 26, 0.95); backdrop-filter: blur(16px);`)
  - Crisp bottom border (`1px solid var(--border-default)`)
  - Navigation links MUST have `white-space: nowrap !important;` to guarantee single-line fit.

### 2. High-End Card Anatomy
Every card in the system MUST feature:
1. `background: var(--bg-card);`
2. `border: 1px solid var(--border-default);`
3. `border-radius: var(--radius-md);`
4. `box-shadow: var(--shadow-card);` (combining shadow with inner highlight)
5. `transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);`
6. Interactive cards on hover: `border-color: rgba(99, 102, 241, 0.4); transform: translateY(-2px);`

### 3. Hero Prompt Bar (Linear / v0 Paradigm)
- Outer container: `background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-lg);`
- Focus state: `border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-glow), var(--shadow-lg);`
- CTA Button: Gradient `#6366f1` -> `#4f46e5`, smooth transform on hover, crisp shadow.
- Quick archetype suggestions: Subtle pill badges with uppercase `letter-spacing: 0.05em`.

### 4. Cohesive Archetype Grid
- No rainbow colored boxes with arbitrary borders.
- Every archetype card shares the same refined Obsidian card background with an archetype icon badge, crisp title, description, and status tag.

### 5. Segmented Controls (Apple / Linear Paradigm)
- Inset dark background (`rgba(0, 0, 0, 0.4)`), `border-radius: 9px`, padding `3px`.
- Active segment: `background: var(--bg-card); border: 1px solid rgba(99, 102, 241, 0.3); color: #fff;`

---

## 🚫 5. Anti-Amateurism Guardrails (Strict Do's & Don'ts)

| ❌ STRICTLY FORBIDDEN (AMATEUR) | ✅ MANDATORY (WORLD-CLASS) |
|:---|:---|
| Using generic raw `#3b82f6` flat blue buttons | Use refined Indigo `--primary: #6366f1` with `--primary-hover: #4f46e5` and subtle gradient |
| Leaving default browser system fonts | Load and use `Plus Jakarta Sans`, `Inter`, and `JetBrains Mono` |
| Flat boxes with harsh 1px borders without depth | Apply `box-shadow: var(--shadow-card)` with `inset 0 1px 0 0 rgba(255,255,255,0.08)` |
| Arbitrary conflicting background colors across cards | Use unified surface tokens (`--bg-card: #121824`, `--bg-surface: #0d111a`) |
| Navigation breaking into multiple wrapped lines | Enforce single-line with `white-space: nowrap !important;` |
| Low contrast gray text that strains readability | Maintain WCAG AA compliance (`--text-main: #f8fafc`, `--text-muted: #94a3b8`) |
| Jagged, unpadded inputs without focus rings | Sleek inputs with smooth 3px ambient focus glow (`var(--primary-glow)`) |

---

## 🤖 6. AI Agent Prompt Guide

When generating or editing any UI component for ONLUNET ZEKA, AI agents MUST follow this instruction:

```markdown
Adhere strictly to D:\Antigravity\ONLUNET ZEKA\DESIGN.md:
- Canvas: #07090e | Surface: #0d111a | Card: #121824 | Border: rgba(255,255,255,0.10)
- Primary: #6366f1 (Indigo) | Hover: #4f46e5 | Glow: rgba(99, 102, 241, 0.28)
- Fonts: "Plus Jakarta Sans" (Headings), "Inter" (Body), "JetBrains Mono" (Telemetry/Code)
- Card elevation: box-shadow: 0 4px 20px -2px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.08)
- Preserve all existing function names, input IDs, and test compatibility blocks.
```
