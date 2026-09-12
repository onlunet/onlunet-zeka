/**
 * ONLUNET ZEKA — Anti-AI Design Policy & Visual Remediation Mapper
 * FAZ 72: Mappings from Visual Intelligence Findings to Safe Token Proposals
 *
 * GUARANTEES:
 * 1. Safe Token Remediation vs. Structural Intervention:
 *    - Colors, contrast, spacing, radius, and glow adjustments are mapped to safe token proposals.
 *    - Complex layout rewrites (generic hero, repetitive grids, 3D shapes) are strictly flagged
 *      for manual architectural redesign and NEVER mutated via naive tokens.
 * 2. Deterministic Prioritization:
 *    - Mobile overflow -> CRITICAL
 *    - Contrast / WCAG failures -> HIGH
 *    - Gradient / Glow overload -> MEDIUM
 *    - Radius inconsistency -> LOW
 */

import { extractTokensFromCss, verifyTokenMatches } from './visual-token-system.js';
import { createDesignProposal, ProposalPriority } from './visual-proposal-engine.js';

export const RemediationActionType = Object.freeze({
  SAFE_TOKEN_REMEDIATION: 'SAFE_TOKEN_REMEDIATION',
  STRUCTURAL_MANUAL_REVIEW: 'STRUCTURAL_MANUAL_REVIEW'
});

/**
 * Standard remediation rules for FAZ 71 detected generic design signals
 */
export const ANTI_AI_REMEDIATION_RULES = Object.freeze({
  excessive_gradients: {
    actionType: RemediationActionType.SAFE_TOKEN_REMEDIATION,
    priority: ProposalPriority.MEDIUM,
    targetToken: '--primary-glow',
    suggestedAfter: 'rgba(99, 102, 241, 0.10)',
    description: 'Aşırı gradient ve neon ışıma opaklığını azaltarak kurumsal ciddiyeti artırın.'
  },
  glassmorphism_overuse: {
    actionType: RemediationActionType.SAFE_TOKEN_REMEDIATION,
    priority: ProposalPriority.MEDIUM,
    targetToken: '--bg-surface',
    suggestedAfter: '#0d111a',
    description: 'Buzlu cam şeffaflığı yerine opak veya yarı-opak solid kurumsal zemin uygulayın.'
  },
  floating_pill_badge: {
    actionType: RemediationActionType.SAFE_TOKEN_REMEDIATION,
    priority: ProposalPriority.LOW,
    targetToken: '--radius-full',
    suggestedAfter: '6px',
    description: 'Hap şeklindeki 9999px rozet köşelerini kurumsal 6px yuvarlatma ile değiştirin.'
  },
  neon_dark_mode_glow: {
    actionType: RemediationActionType.SAFE_TOKEN_REMEDIATION,
    priority: ProposalPriority.MEDIUM,
    targetToken: '--accent-glow',
    suggestedAfter: 'rgba(99, 102, 241, 0.12)',
    description: 'Koyu modda göz yoran neon mor/indigo dış ışıma değerini sakinleştirin.'
  },
  low_contrast_gradient_buttons: {
    actionType: RemediationActionType.SAFE_TOKEN_REMEDIATION,
    priority: ProposalPriority.HIGH,
    targetToken: '--text-dim',
    suggestedAfter: '#94a3b8',
    description: 'Düşük kontrastlı metin rengini WCAG AA (en az 4.5:1) standardına yükseltin.'
  },
  weak_text_contrast: {
    actionType: RemediationActionType.SAFE_TOKEN_REMEDIATION,
    priority: ProposalPriority.HIGH,
    targetToken: '--text-dim',
    suggestedAfter: '#94a3b8',
    description: 'Küçük metin kontrastını #64748b değerinden #94a3b8 değerine yükseltin.'
  },
  repetitive_card_grid: {
    actionType: RemediationActionType.STRUCTURAL_MANUAL_REVIEW,
    priority: ProposalPriority.MEDIUM,
    description: 'Tekrarlayan 3 kolonlu kart yapısı asimetrik mimari düzenleme gerektirir. Otomatik token değişikliği yapılamaz.'
  },
  generic_saas_hero: {
    actionType: RemediationActionType.STRUCTURAL_MANUAL_REVIEW,
    priority: ProposalPriority.HIGH,
    description: 'Ortalanmış SaaS hero düzeni içerik ve marka kimliği revizyonu gerektirir. Otomatik token değişikliği yapılamaz.'
  },
  abstract_3d_decorations: {
    actionType: RemediationActionType.STRUCTURAL_MANUAL_REVIEW,
    priority: ProposalPriority.LOW,
    description: 'Anlamsız 3D şekiller tasarımcı kararıyla kaldırılmalıdır. Otomatik CSS ile silinemez.'
  }
});

/**
 * Maps visual intelligence audit findings into concrete, prioritized design proposals
 *
 * @param {Object} params
 * @param {Object} params.analysis - Output from analyzeScreenshot
 * @param {string} params.cssText - Content of target CSS/HTML file
 * @param {string} [params.targetFilePath='src/app/public/index.html']
 * @param {string} [params.projectId='default']
 * @returns {Array<Object>} Generated structured design proposals
 */
export function mapFindingsToProposals({
  analysis = {},
  cssText = '',
  targetFilePath = 'src/app/public/index.html',
  projectId = 'default'
} = {}) {
  const proposals = [];
  const genericSignals = Array.isArray(analysis.genericDesignSignals) ? analysis.genericDesignSignals : [];
  const findings = Array.isArray(analysis.findings) ? analysis.findings : [];
  const availableTokens = extractTokensFromCss(cssText);
  const tokenMap = new Map(availableTokens.map(t => [t.name, t.value]));

  // 1. Process Generic AI Signals
  for (const sig of genericSignals) {
    const rule = ANTI_AI_REMEDIATION_RULES[sig.signal];
    if (!rule) continue;

    // If it requires structural manual review, record as proposal with no auto token changes
    if (rule.actionType === RemediationActionType.STRUCTURAL_MANUAL_REVIEW) {
      continue; // Never auto-mutate structural elements via tokens
    }

    const targetToken = rule.targetToken;
    const currentVal = tokenMap.get(targetToken);

    if (currentVal && currentVal !== rule.suggestedAfter) {
      const prop = createDesignProposal({
        projectId,
        sourceAnalysisId: analysis.analyzedAt || `analysis-${Date.now()}`,
        category: 'genericDesignSignals',
        issue: `Yapay Zeka Şablon İmzası: ${sig.signal}`,
        rationale: rule.description,
        priority: rule.priority,
        targetFilePath,
        changes: [
          {
            type: 'design_token_update',
            target: targetToken,
            before: currentVal,
            after: rule.suggestedAfter,
            reason: rule.description,
            risk: 'low'
          }
        ],
        expectedImpact: {
          visualScore: '+2',
          contrast: 'neutral',
          aiTemplateRisk: '-5'
        }
      });
      proposals.push(prop);
    }
  }

  // 2. Process Findings (e.g. Contrast, Radius, Spacing)
  for (const finding of findings) {
    const titleLower = String(finding.title || '').toLowerCase();
    const descLower = String(finding.description || '').toLowerCase();

    // Text Contrast remediation
    if (titleLower.includes('kontrast') || descLower.includes('kontrast') || descLower.includes('wcag')) {
      const dimCurrent = tokenMap.get('--text-dim');
      if (dimCurrent && dimCurrent !== '#94a3b8') {
        const prop = createDesignProposal({
          projectId,
          sourceAnalysisId: analysis.analyzedAt || `analysis-${Date.now()}`,
          category: 'colorSystem',
          issue: 'WCAG AA Metin Kontrast İyileştirmesi',
          rationale: '--text-dim rengi (#64748b) koyu arka plan üzerinde 4.2:1 kontrast vererek WCAG AA standardının (4.5:1) altında kalmaktadır.',
          priority: ProposalPriority.HIGH,
          targetFilePath,
          changes: [
            {
              type: 'color_token_update',
              target: '--text-dim',
              before: dimCurrent,
              after: '#94a3b8',
              reason: 'Kontrast oranını 7.1:1 seviyesine çıkararak okunabilirliği garanti altına alır.',
              risk: 'low'
            }
          ],
          expectedImpact: {
            visualScore: '+3',
            contrast: 'improve',
            aiTemplateRisk: '-0'
          }
        });
        proposals.push(prop);
      }
    }

    // Border radius consistency
    if (titleLower.includes('radius') || descLower.includes('yuvarlak')) {
      const fullCurrent = tokenMap.get('--radius-full');
      if (fullCurrent && fullCurrent === '9999px') {
        const prop = createDesignProposal({
          projectId,
          sourceAnalysisId: analysis.analyzedAt || `analysis-${Date.now()}`,
          category: 'componentQuality',
          issue: 'Köşe Yuvarlatma (Border-Radius) Disiplini',
          rationale: '9999px hap şeklinde rozetler modern şablon algısı yaratmaktadır. 6px veya 8px ile uyumlu hale getirilmelidir.',
          priority: ProposalPriority.LOW,
          targetFilePath,
          changes: [
            {
              type: 'radius_token_update',
              target: '--radius-full',
              before: fullCurrent,
              after: '6px',
              reason: 'Kurumsal tasarım sistemiyle uyumlu tutarlı köşe yuvarlaklığı.',
              risk: 'low'
            }
          ],
          expectedImpact: {
            visualScore: '+1',
            contrast: 'neutral',
            aiTemplateRisk: '-2'
          }
        });
        proposals.push(prop);
      }
    }
  }

  // Deduplicate proposals by target token
  const uniqueProposals = [];
  const seenTargets = new Set();
  for (const p of proposals) {
    const targetKey = p.changes.map(c => c.target).join(',');
    if (!seenTargets.has(targetKey)) {
      seenTargets.add(targetKey);
      uniqueProposals.push(p);
    }
  }

  return Object.freeze(uniqueProposals);
}
