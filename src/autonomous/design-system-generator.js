/**
 * ONLUNET ZEKA - Autonomous Design System Generator
 * Produces structured, authoritative DESIGN.md specifications based on Google Stitch
 * and VoltAgent/awesome-design-md standards for every project.
 *
 * Provides AI coding agents with strict visual contracts to eliminate visual drift,
 * enforce solid headers, high-contrast typography, brand palettes, and component states.
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getSectorPreset, MainCategories } from './sector-presets.js';

export const BrandDesignAesthetics = Object.freeze({
  ENERGY_INDUSTRIAL: {
    name: 'Endüstriyel Enerji & Güç Sistemleri',
    vibe: 'Robust, technical, high-reliability engineering aesthetic. Dark space-slate surfaces with vivid amber/gold electrical highlights.',
    density: 'Comfortable to compact (data-rich with telemetry cards).',
    primaryColor: '#eab308',
    primaryHover: '#ca8a04',
    secondaryColor: '#0f172a',
    accentGlow: 'rgba(234, 179, 8, 0.25)',
    bgDark: '#0b0f19',
    surfaceDark: '#111827',
    surfaceBorder: '#1f293d',
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
    fontDisplay: '"Plus Jakarta Sans", "Inter", sans-serif',
    fontBody: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    fontMono: '"JetBrains Mono", "Fira Code", monospace',
    borderRadius: '8px'
  },
  LOGISTICS_FREIGHT: {
    name: 'Lojistik & Küresel Tedarik Zinciri',
    vibe: 'Dynamic, nautical, precision-timed global logistics aesthetic. Ocean deep blues, signal cyan accents, and live route status indicators.',
    density: 'Compact and structured (metric cards, route timelines).',
    primaryColor: '#0284c7',
    primaryHover: '#0369a1',
    secondaryColor: '#0c4a6e',
    accentGlow: 'rgba(2, 132, 199, 0.25)',
    bgDark: '#081325',
    surfaceDark: '#0f1d36',
    surfaceBorder: '#1b3156',
    textMain: '#f0f9ff',
    textMuted: '#93c5fd',
    fontDisplay: '"Outfit", "Plus Jakarta Sans", sans-serif',
    fontBody: '"Inter", sans-serif',
    fontMono: '"Roboto Mono", monospace',
    borderRadius: '10px'
  },
  HEALTH_MEDICAL: {
    name: 'Sağlık, Medikal & Klinik Teknolojileri',
    vibe: 'Ultra-hygienic, calming, clinical and trustworthy. Clean medical teal and deep emerald on pristine or clinical dark backgrounds.',
    density: 'Spacious and accessible (large touch targets, readable medical cards).',
    primaryColor: '#059669',
    primaryHover: '#047857',
    secondaryColor: '#064e3b',
    accentGlow: 'rgba(5, 150, 105, 0.25)',
    bgDark: '#061a14',
    surfaceDark: '#0b2920',
    surfaceBorder: '#164e3f',
    textMain: '#f0fdf4',
    textMuted: '#86efac',
    fontDisplay: '"Plus Jakarta Sans", "Inter", sans-serif',
    fontBody: '"Inter", sans-serif',
    fontMono: 'monospace',
    borderRadius: '12px'
  },
  TECH_SOFTWARE: {
    name: 'Bilişim, Yazılım & Bulut Mimarisi',
    vibe: 'Modern developer-first, futuristic cyberpunk elegance. Deep obsidian dark mode, neon violet/indigo accents, and terminal widgets.',
    density: 'Medium compact (code widgets, API telemetry, pill badges).',
    primaryColor: '#6366f1',
    primaryHover: '#4f46e5',
    secondaryColor: '#1e1b4b',
    accentGlow: 'rgba(99, 102, 241, 0.3)',
    bgDark: '#090d16',
    surfaceDark: '#111827',
    surfaceBorder: '#243248',
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
    fontDisplay: '"Geist", "Inter", sans-serif',
    fontBody: '"Inter", sans-serif',
    fontMono: '"Geist Mono", "Fira Code", monospace',
    borderRadius: '10px'
  },
  CONSTRUCTION_REAL_ESTATE: {
    name: 'İnşaat, Yapı & Mimari Mühendislik',
    vibe: 'Solid architectural geometry, monolithic elegance. Warm terracotta/crimson accents with structural steel grays.',
    density: 'Spacious hero with dense technical specification grids.',
    primaryColor: '#dc2626',
    primaryHover: '#b91c1c',
    secondaryColor: '#450a0a',
    accentGlow: 'rgba(220, 38, 38, 0.25)',
    bgDark: '#140c0c',
    surfaceDark: '#201414',
    surfaceBorder: '#382222',
    textMain: '#fef2f2',
    textMuted: '#fca5a5',
    fontDisplay: '"Syne", "Plus Jakarta Sans", sans-serif',
    fontBody: '"Inter", sans-serif',
    fontMono: 'monospace',
    borderRadius: '6px'
  },
  CORPORATE_CONSULTING: {
    name: 'Kurumsal Danışmanlık & Finans',
    vibe: 'Executive, dignified, prestigious authority. Deep royal blue and subtle champagne gold trims on crisp dark-navy surfaces.',
    density: 'Comfortable executive layout with high typographical hierarchy.',
    primaryColor: '#2563eb',
    primaryHover: '#1d4ed8',
    secondaryColor: '#172554',
    accentGlow: 'rgba(37, 99, 235, 0.25)',
    bgDark: '#0a0f1d',
    surfaceDark: '#131b2e',
    surfaceBorder: '#202d4a',
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
    fontDisplay: '"Plus Jakarta Sans", sans-serif',
    fontBody: '"Inter", sans-serif',
    fontMono: 'monospace',
    borderRadius: '8px'
  },
  ECOMMERCE_B2B: {
    name: 'E-Ticaret & B2B Sipariş Kataloğu',
    vibe: 'High-conversion, clean retail and B2B wholesale. Emerald green purchasing CTAs, prominent product badges, dynamic cart counter.',
    density: 'Grid-focused with crisp product cards, sticky filter drawers, and floating checkout bar.',
    primaryColor: '#10b981',
    primaryHover: '#059669',
    secondaryColor: '#064e3b',
    accentGlow: 'rgba(16, 185, 129, 0.25)',
    bgDark: '#091310',
    surfaceDark: '#10221c',
    surfaceBorder: '#1c3d32',
    textMain: '#f0fdf4',
    textMuted: '#a7f3d0',
    fontDisplay: '"Plus Jakarta Sans", sans-serif',
    fontBody: '"Inter", sans-serif',
    fontMono: '"JetBrains Mono", monospace',
    borderRadius: '12px'
  },
  SAAS_PORTAL: {
    name: 'SaaS & Müşteri Portalı',
    vibe: 'Polished product dashboard, metrics-focused. Violet-blue primary, pill badges, collapsible sidebar, high-contrast tables.',
    density: 'Compact data tables with sticky actions and live socket telemetry.',
    primaryColor: '#8b5cf6',
    primaryHover: '#7c3aed',
    secondaryColor: '#2e1065',
    accentGlow: 'rgba(139, 92, 246, 0.25)',
    bgDark: '#0d0b18',
    surfaceDark: '#17142b',
    surfaceBorder: '#2b2450',
    textMain: '#f5f3ff',
    textMuted: '#c4b5fd',
    fontDisplay: '"Geist", "Inter", sans-serif',
    fontBody: '"Inter", sans-serif',
    fontMono: '"Geist Mono", monospace',
    borderRadius: '10px'
  }
});

/**
 * Generate a complete DESIGN.md markdown document tailored to a project.
 */
export function generateDesignMarkdown({
  companyName = 'Kurumsal Firma',
  projectType = 'corporate',
  sectorId = 'ENERGY_INDUSTRIAL',
  customPalette = null
} = {}) {
  const preset = getSectorPreset(sectorId);
  const parentCategory = preset ? MainCategories[preset.parentCategory] : null;

  const aesthetic = preset ? {
    name: preset.name,
    vibe: parentCategory ? parentCategory.vibe : 'Sektöre özel kurumsal tasarım.',
    density: 'Sektöre özel optimize edilmiş bilgi mimarisi ve interaktif araçlar.',
    primaryColor: preset.designTokens.palette.primary,
    primaryHover: preset.designTokens.palette.secondary,
    secondaryColor: preset.designTokens.palette.secondary,
    accentGlow: `${preset.designTokens.palette.primary}40`,
    bgDark: preset.designTokens.palette.bg,
    surfaceDark: preset.designTokens.palette.surface,
    surfaceBorder: preset.designTokens.palette.border,
    textMain: preset.designTokens.palette.text,
    textMuted: '#94a3b8',
    fontDisplay: `"${preset.designTokens.typography.heading}", sans-serif`,
    fontBody: `"${preset.designTokens.typography.body}", sans-serif`,
    fontMono: '"JetBrains Mono", monospace',
    borderRadius: preset.designTokens.borderRadius
  } : (BrandDesignAesthetics[sectorId] || BrandDesignAesthetics.ENERGY_INDUSTRIAL);

  const primary = customPalette?.primary || aesthetic.primaryColor;
  const primaryHover = customPalette?.primaryHover || aesthetic.primaryHover;
  const bgDark = customPalette?.bgDark || aesthetic.bgDark;
  const surfaceDark = customPalette?.surfaceDark || aesthetic.surfaceDark;
  const surfaceBorder = customPalette?.surfaceBorder || aesthetic.surfaceBorder;

  return `# DESIGN.md — ${companyName} Visual Design System Contract

> **Target Audience:** AI Coding Agents (Antigravity, Cursor, Stitch, Claude Code) and Frontend Engineers.
> **Purpose:** Authoritative single source of truth for all UI generation, styling tokens, layout hierarchy, and visual consistency across the ${companyName} application.
> **Rule Enforcement:** All generated pages, modals, components, and CSS changes MUST strictly adhere to this document. Visual drift is prohibited.

---

## 🎨 1. Visual Theme & Atmosphere (Vibe)
- **Sector / Archetype:** ${aesthetic.name}
- **Brand Vibe:** ${aesthetic.vibe}
- **Information Density:** ${aesthetic.density}
- **Visual Tone:** Professional, modern, trustworthy, conversion-focused enterprise tier.

---

## 🌈 2. Color Palette & Semantic Roles

### Primary Brand Colors
- **Primary Accent (\`--primary\`):** \`${primary}\` — Main CTAs, active states, key highlight elements.
- **Primary Hover (\`--primary-hover\`):** \`${primaryHover}\` — Interactive hover states with smooth transition (\`150ms\`).
- **Primary Glow (\`--primary-glow\`):** \`${aesthetic.accentGlow}\` — Subtle focus rings and ambient badge glow.

### Dark Mode Surfaces (Default)
- **Background Canvas (\`--bg-canvas\`):** \`${bgDark}\` — Main page background.
- **Surface Card (\`--bg-surface\`):** \`${surfaceDark}\` — Component cards, dropdown menus, modals, headers.
- **Border / Divider (\`--border-color\`):** \`${surfaceBorder}\` — 1px crisp borders on cards, table rows, and headers.
- **Text Main (\`--text-main\`):** \`${aesthetic.textMain}\` — Headings, high-contrast labels.
- **Text Muted (\`--text-muted\`):** \`${aesthetic.textMuted}\` — Body paragraphs, sub-labels, metadata.

### Light Mode Surfaces (Adaptive)
- **Light Background:** \`#f8fafc\`
- **Light Surface:** \`#ffffff\`
- **Light Border:** \`#e2e8f0\`
- **Light Text Main:** \`#0f172a\`
- **Light Text Muted:** \`#475569\`

---

## 🔤 3. Typography Rules
- **Display Font (Headings H1-H3):** ${aesthetic.fontDisplay}
- **Body Font (Paragraphs, Labels):** ${aesthetic.fontBody}
- **Monospace Font (Telemetry, Code, SKU, Specs):** ${aesthetic.fontMono}

### Scale & Hierarchy
| Level | Font Size | Line Height | Letter Spacing | Font Weight |
|:---|:---|:---|:---|:---|
| **H1 (Hero)** | \`2.75rem\` (44px) | \`1.15\` | \`-0.03em\` | \`800 (ExtraBold)\` |
| **H2 (Section)** | \`2.0rem\` (32px) | \`1.25\` | \`-0.02em\` | \`700 (Bold)\` |
| **H3 (Card Title)** | \`1.25rem\` (20px) | \`1.35\` | \`-0.01em\` | \`600 (SemiBold)\` |
| **Body (Normal)** | \`0.95rem\` (15px) | \`1.6\` | \`normal\` | \`400 / 500\` |
| **Small / Badge** | \`0.75rem\` (12px) | \`1.4\` | \`+0.04em\` | \`700 (Bold, Uppercase)\` |

---

## 🧩 4. Component Stylings & States

### 1. Solid Opaque Sticky Header (Corporate Rule 3)
\`\`\`css
header.site-header {
  position: sticky !important;
  top: 0 !important;
  z-index: 9999 !important;
  background: ${surfaceDark} !important;
  border-bottom: 1px solid ${surfaceBorder} !important;
  backdrop-filter: blur(16px) !important;
}
\`\`\`

### 2. Primary Buttons (\`.btn-primary\`)
- **Background:** \`${primary}\`
- **Text Color:** \`#ffffff\` (or high-contrast dark if yellow)
- **Padding:** \`10px 22px\`
- **Border Radius:** \`${aesthetic.borderRadius}\`
- **Hover State:** \`transform: translateY(-1px); box-shadow: 0 4px 14px ${aesthetic.accentGlow};\`
- **Active State:** \`transform: translateY(0);\`

### 3. Glass & Surface Cards (\`.card\`)
- **Background:** \`${surfaceDark}\`
- **Border:** \`1px solid ${surfaceBorder}\`
- **Border Radius:** \`${aesthetic.borderRadius}\`
- **Padding:** \`20px\`
- **Hover:** \`border-color: ${primary}; transform: translateY(-2px); transition: all 0.2s ease;\`

### 4. Dropdown Navigation (Corporate Rule 6)
- **Default:** \`display: none !important; position: absolute !important;\`
- **Trigger:** Only on \`:hover\`, \`:focus-within\`, or \`.is-open\`.
- **Items:** \`white-space: nowrap !important;\` (No single-word line breaks).
- **Max Height:** \`440px; overflow-y: auto;\`

---

## 📐 5. Layout & Spacing Principles
- **Base Grid Scale:** 4px / 8px incremental scale (\`4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px\`).
- **Container Max-Width:** \`1240px\` with auto margins.
- **Section Padding:** \`64px 24px\` on desktop; \`36px 16px\` on mobile.

---

## 🚫 6. Do's and Don'ts (Strict Guardrails)
- ❌ **DON'T:** Never use transparent or semi-transparent headers that let scrolled content overlap menu text.
- ❌ **DON'T:** Never generate thin, 1-line content for products or services (Corporate Rule 5: Always provide Summary, Technical Body, Specs Table, Features, Workflow, and Lead Form).
- ❌ **DON'T:** Never use arbitrary random hex colors outside of this DESIGN.md palette.
- ❌ **DON'T:** Never break navigation link labels across two lines (e.g. "Ana\\nSayfa").
- ✅ **DO:** Always use \`${aesthetic.borderRadius}\` for uniform border curvature across cards, inputs, and buttons.
- ✅ **DO:** Ensure every form input has an explicit visible label, clear placeholder, and high-contrast focus state.
- ✅ **DO:** Use \`cursor: pointer\` and visible active states for all interactive elements.

---

## 🤖 7. AI Agent Prompt Guide

When asking an AI coding agent to generate or edit pages in this project, use this prompt prefix:

\`\`\`markdown
You are building UI for ${companyName}.
Reference the project's DESIGN.md strictly:
- Primary Accent: ${primary}
- Dark Surface: ${surfaceDark} | Canvas: ${bgDark}
- Display Font: ${aesthetic.fontDisplay}
- Border Radius: ${aesthetic.borderRadius}
Follow all component rules, solid sticky header, and zero thin-content requirements.
\`\`\`
`;
}

/**
 * Writes or updates the DESIGN.md file in the target project directory.
 */
export function writeProjectDesignFile(projectDir, options = {}) {
  const markdown = generateDesignMarkdown(options);
  const targetPath = path.join(projectDir, 'DESIGN.md');
  fs.writeFileSync(targetPath, markdown, 'utf-8');
  return {
    success: true,
    path: targetPath,
    bytes: Buffer.byteLength(markdown, 'utf-8')
  };
}
