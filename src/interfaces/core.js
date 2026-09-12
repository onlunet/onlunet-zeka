/**
 * AI Development OS - Core System Interfaces & Abstractions
 * Phase 1 Foundation & Phase 1.1 Hardened Contract
 */
import path from 'node:path';
import { ErrorCodes } from '../contracts/constants.js';

export function createEnvironmentDoctorInterface({
  discoverEnvironment = async () => { throw new Error(`[${ErrorCodes.NOT_VERIFIED}] discoverEnvironment not implemented`); },
  checkCompatibility = async () => { throw new Error(`[${ErrorCodes.NOT_VERIFIED}] checkCompatibility not implemented`); },
  getMissingCapabilities = async () => { throw new Error(`[${ErrorCodes.NOT_VERIFIED}] getMissingCapabilities not implemented`); }
} = {}) {
  return Object.freeze({
    discoverEnvironment,
    checkCompatibility,
    getMissingCapabilities
  });
}

export function createProviderAdapterInterface({
  providerId,
  name,
  checkHealth = async () => ({ status: 'UNKNOWN', latencyMs: null }),
  getQuota = async () => ({ rpm: null, tpm: null, remaining: null }),
  chat = async () => { throw new Error(`[${ErrorCodes.NOT_VERIFIED}] Live AI provider execution is forbidden in FAZ 1`); }
}) {
  if (!providerId || !name) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ProviderAdapter requires providerId and name`);
  }
  return Object.freeze({
    providerId,
    name,
    checkHealth,
    getQuota,
    chat
  });
}

/**
 * Normalizes and canonicalizes a file system path for safe containment evaluation.
 * Handles Windows backslashes, mixed separators, and case-insensitivity on Windows.
 */
function normalizePathForComparison(p) {
  const resolved = path.resolve(p);
  // On Windows, paths are case-insensitive
  const isWindows = process.platform === 'win32';
  return isWindows ? resolved.toLowerCase() : resolved;
}

/**
 * Checks if targetPath is strictly inside or equal to baseDir.
 * Prevents sibling prefix collisions (e.g. C:\App vs C:\App-Evil),
 * parent traversals (..\), and separator manipulation.
 */
export function isPathInsideDirectory(targetPath, baseDir) {
  const normBase = normalizePathForComparison(baseDir);
  const normTarget = normalizePathForComparison(targetPath);

  if (normBase === normTarget) {
    return true;
  }

  const relative = path.relative(normBase, normTarget);
  // If path is outside, relative will start with '..' or be an absolute root
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Secure Execution Boundary Interface
 * Remediation #2: Safe normalized path containment semantics
 */
export function createExecutionBoundaryInterface({
  projectRoot,
  allowSystemWrite = false,
  allowNetwork = false
}) {
  if (!projectRoot) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ExecutionBoundary requires projectRoot`);
  }
  return Object.freeze({
    projectRoot: path.resolve(projectRoot),
    allowSystemWrite,
    allowNetwork,
    canWriteToPath(targetPath) {
      if (this.allowSystemWrite) return true;
      return isPathInsideDirectory(targetPath, this.projectRoot);
    }
  });
}

/**
 * Audit Ledger Interface
 * Remediation #6: Status clarified:
 * - Tamper-evident architecture: DEFINED
 * - Tamper-evident persistent cryptographic implementation: DEFERRED (Phase 1.1 in-memory harness)
 */
export function createAuditLedgerInterface({
  records = [],
  appendRecord = (record) => { records.push(record); return record; },
  getRecords = () => Object.freeze([...records])
} = {}) {
  return Object.freeze({
    implementationStatus: 'IN_MEMORY_HARNESS',
    architectureSpecification: 'TAMPER_EVIDENT_APPEND_ORIENTED',
    appendRecord,
    getRecords
  });
}
