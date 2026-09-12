/**
 * ONLUNET ZEKA - Data Classification Engine
 * FAZ 59 Foundation: Data Boundary & Provider Policy Enforcement
 *
 * Implements 5 data classification tiers:
 * - PUBLIC: General documentation, public queries (Cloud allowed)
 * - INTERNAL: Enterprise internal data (Enterprise configured cloud allowed)
 * - CONFIDENTIAL: Sensitive project data (Explicitly approved providers only)
 * - RESTRICTED: PII, sensitive business logic (Local / on-premise only)
 * - SECRET: Credentials, keys, high-risk assets (Never leaves local boundary)
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';

export const DataClassification = Object.freeze({
  PUBLIC: 'PUBLIC',
  INTERNAL: 'INTERNAL',
  CONFIDENTIAL: 'CONFIDENTIAL',
  RESTRICTED: 'RESTRICTED',
  SECRET: 'SECRET'
});

export const ClassificationHierarchy = Object.freeze({
  [DataClassification.PUBLIC]: 1,
  [DataClassification.INTERNAL]: 2,
  [DataClassification.CONFIDENTIAL]: 3,
  [DataClassification.RESTRICTED]: 4,
  [DataClassification.SECRET]: 5
});

/**
 * Validates whether a given data classification is permitted to be dispatched
 * to the specified provider.
 */
export function validateDataClassificationPolicy({
  classification = DataClassification.INTERNAL,
  providerId = 'local',
  isLocal = false,
  approvedProviders = []
} = {}) {
  const normClass = String(classification || DataClassification.INTERNAL).trim().toUpperCase();
  const normProvider = String(providerId || 'local').trim().toLowerCase();

  if (!ClassificationHierarchy[normClass]) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Invalid data classification tier: '${classification}'`);
  }

  const isLocalProvider = isLocal || normProvider === 'local' || normProvider === 'local-provider';

  // 1. SECRET: Never leaves trusted boundary (Local execution only)
  if (normClass === DataClassification.SECRET) {
    if (!isLocalProvider) {
      throw new Error(
        `[${ErrorCodes.SECURITY_BLOCKED}] Data classification 'SECRET' cannot leave trusted boundary to provider '${normProvider}'`
      );
    }
    return { allowed: true, classification: normClass, providerId: normProvider, tier: 'AIR_GAPPED' };
  }

  // 2. RESTRICTED: Local / on-prem only
  if (normClass === DataClassification.RESTRICTED) {
    if (!isLocalProvider) {
      throw new Error(
        `[${ErrorCodes.SECURITY_BLOCKED}] Data classification 'RESTRICTED' requires on-prem/local provider, cannot dispatch to '${normProvider}'`
      );
    }
    return { allowed: true, classification: normClass, providerId: normProvider, tier: 'LOCAL_ONLY' };
  }

  // 3. CONFIDENTIAL: Requires explicit whitelist approval
  if (normClass === DataClassification.CONFIDENTIAL) {
    const isApproved = isLocalProvider || approvedProviders.map(p => String(p).toLowerCase()).includes(normProvider);
    if (!isApproved) {
      throw new Error(
        `[${ErrorCodes.SECURITY_BLOCKED}] Data classification 'CONFIDENTIAL' is not approved for provider '${normProvider}'`
      );
    }
    return { allowed: true, classification: normClass, providerId: normProvider, tier: 'EXPLICITLY_APPROVED' };
  }

  // 4. INTERNAL & PUBLIC: Allowed for registered providers
  return { allowed: true, classification: normClass, providerId: normProvider, tier: 'STANDARD' };
}

/**
 * Inspects content and metadata to infer data classification tier.
 */
export function inferDataClassification(content = '', metadata = {}) {
  if (metadata && metadata.classification) {
    const declared = String(metadata.classification).toUpperCase();
    if (ClassificationHierarchy[declared]) {
      return declared;
    }
  }

  const text = typeof content === 'string' ? content : JSON.stringify(content);

  // Check for secrets
  if (
    /sk-[a-zA-Z0-9]{20,}/.test(text) ||
    /AIza[0-9A-Za-z-_]{35}/.test(text) ||
    /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/.test(text) ||
    /postgres:\/\/[^:]+:[^@]+@/.test(text)
  ) {
    return DataClassification.SECRET;
  }

  // Check for restricted / PII signals
  if (
    /\b(password|passphrase|ssn|credit_card|secret_key)\b/i.test(text) &&
    /\b(confidential|restricted|private)\b/i.test(text)
  ) {
    return DataClassification.RESTRICTED;
  }

  return DataClassification.INTERNAL;
}
