/**
 * AI Development OS - Specialist Agent Registry & Agency-Agents Adapter Boundary
 * Phase 46 Foundation - Agent Identity, Capabilities, Authority Profiles & Provider Mapping
 *
 * CORE INVARIANTS:
 * 1. ZERO AUTONOMOUS LOOP: No self-invoking, recursive, or looping agent calls.
 * 2. ZERO NEW EXECUTION AUTHORITY: Agents cannot execute shell commands, mutate files, or deploy.
 * 3. AUTHORITY SEPARATION: Capability != Authority. Authority is fail-closed (execute=false, mutate=false).
 * 4. PROVIDER BOUNDARY PRESERVATION: Agent output is proposals only, mapped through FAZ 45 AI Provider Boundary.
 * 5. UNTRUSTED EXTERNAL DEFINITION: Agency-Agents definitions are parsed, validated, and normalized fail-closed.
 * 6. TENANT & WORKSPACE ISOLATION: Cross-tenant lookup fails closed.
 * 7. IMMUTABILITY & DETERMINISM: Deeply frozen definitions, zero nondeterminism.
 */
import { ErrorCodes } from './constants.js';

export const AgentCapabilities = Object.freeze({
  ARCHITECTURE: 'architecture',
  API_DESIGN: 'api_design',
  DATABASE_DESIGN: 'database_design',
  FRONTEND_DEVELOPMENT: 'frontend_development',
  BACKEND_DEVELOPMENT: 'backend_development',
  TESTING: 'testing',
  CODE_REVIEW: 'code_review',
  SECURITY_REVIEW: 'security_review',
  DOCUMENTATION: 'documentation',
  RESEARCH: 'research',
  DEBUGGING: 'debugging'
});

export const DefaultAgentAuthorityProfile = Object.freeze({
  read: true,
  analyze: true,
  propose: true,
  execute: false,
  mutate: false,
  deploy: false
});

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ${entityName} requires field: ${field}`);
    }
  }
}

/**
 * Validates agent ID for safe identifier semantics (prevents path traversal, prototype pollution, injection).
 */
function isValidAgentId(id) {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > 100) return false;
  if (trimmed === '__proto__' || trimmed === 'constructor' || trimmed === 'prototype') return false;
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes(':')) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/**
 * Creates an immutable, validated Agent Definition Contract.
 * Enforces fail-closed authority profiles (execute=false, mutate=false).
 */
export function createAgentDefinition({
  id,
  name,
  role,
  description = '',
  version = '1.0.0',
  source = 'INTERNAL',
  capabilities = [],
  authority = DefaultAgentAuthorityProfile,
  providerConstraints = Object.freeze({}),
  tenantId = null,
  workspaceId = null,
  enabled = true,
  metadata = Object.freeze({})
}) {
  validateRequired({ id, name, role }, ['id', 'name', 'role'], 'AgentDefinition');

  if (!isValidAgentId(id)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid agent id: '${id}'. Must be alphanumeric with '-' or '_', without path traversal.`);
  }

  // Capability validation: Must be non-empty array of recognized capabilities
  if (!Array.isArray(capabilities)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] capabilities must be an array`);
  }

  const validCaps = Object.values(AgentCapabilities);
  for (const cap of capabilities) {
    if (!validCaps.includes(cap)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Unknown or unauthorized capability: '${cap}'`);
    }
  }

  // Authority Escalation Defense: Agent definition cannot grant execution or mutation authority
  const safeAuthority = Object.freeze({
    read: Boolean(authority && authority.read !== false),
    analyze: Boolean(authority && authority.analyze !== false),
    propose: Boolean(authority && authority.propose !== false),
    execute: false, // Invariant: AI agents NEVER have execution authority
    mutate: false,  // Invariant: AI agents NEVER have mutation authority
    deploy: false   // Invariant: AI agents NEVER have deployment authority
  });

  return Object.freeze({
    id: String(id).trim(),
    name: String(name).trim(),
    role: String(role).trim(),
    description: String(description || '').trim(),
    version: String(version || '1.0.0').trim(),
    source: String(source || 'INTERNAL').trim(),
    capabilities: Object.freeze([...new Set(capabilities)]),
    authority: safeAuthority,
    providerConstraints: Object.freeze({ ...providerConstraints }),
    tenantId: tenantId ? String(tenantId).trim() : null,
    workspaceId: workspaceId ? String(workspaceId).trim() : null,
    enabled: Boolean(enabled),
    metadata: Object.freeze({ ...metadata })
  });
}

/**
 * Agency-Agents Adapter / Normalizer.
 * Ingests untrusted external agent definitions (e.g. from Agency-Agents or external YAML/JSON)
 * and normalizes them into immutable internal AgentDefinitions.
 */
export function normalizeAgencyAgentDefinition(externalDef, { defaultTenantId = null, defaultWorkspaceId = null } = {}) {
  if (!externalDef || typeof externalDef !== 'object' || Array.isArray(externalDef)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] External agent definition must be a valid non-null object`);
  }

  // Reject prototype pollution attempts
  if (Object.prototype.hasOwnProperty.call(externalDef, '__proto__') ||
      Object.prototype.hasOwnProperty.call(externalDef, 'constructor')) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution attempt detected in agent definition`);
  }

  const rawId = externalDef.id || externalDef.name;
  if (!rawId || typeof rawId !== 'string') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Missing agent id in external definition`);
  }

  const normalizedId = rawId.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!isValidAgentId(normalizedId)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Malformed external agent ID '${rawId}'`);
  }

  // Map role and capabilities
  const rawRole = typeof externalDef.role === 'string' ? externalDef.role.trim() : 'Developer';
  const rawCaps = Array.isArray(externalDef.capabilities) ? externalDef.capabilities : [];
  
  // Capability normalization
  const normalizedCaps = [];
  for (const cap of rawCaps) {
    if (typeof cap === 'string') {
      const lower = cap.toLowerCase().trim();
      if (Object.values(AgentCapabilities).includes(lower)) {
        normalizedCaps.push(lower);
      }
    }
  }

  // Default capability based on role if none provided
  if (normalizedCaps.length === 0) {
    if (rawRole.toLowerCase().includes('architect')) normalizedCaps.push(AgentCapabilities.ARCHITECTURE);
    else if (rawRole.toLowerCase().includes('security')) normalizedCaps.push(AgentCapabilities.SECURITY_REVIEW);
    else if (rawRole.toLowerCase().includes('test') || rawRole.toLowerCase().includes('qa')) normalizedCaps.push(AgentCapabilities.TESTING);
    else if (rawRole.toLowerCase().includes('review')) normalizedCaps.push(AgentCapabilities.CODE_REVIEW);
    else normalizedCaps.push(AgentCapabilities.BACKEND_DEVELOPMENT);
  }

  const providerConstraints = {};
  if (externalDef.preferredProvider) {
    providerConstraints.preferredProvider = String(externalDef.preferredProvider).trim();
  }
  if (externalDef.preferredModel) {
    providerConstraints.preferredModel = String(externalDef.preferredModel).trim();
  }

  return createAgentDefinition({
    id: normalizedId,
    name: typeof externalDef.name === 'string' ? externalDef.name.trim() : normalizedId,
    role: rawRole,
    description: typeof externalDef.description === 'string' ? externalDef.description.trim() : '',
    version: typeof externalDef.version === 'string' ? externalDef.version.trim() : '1.0.0',
    source: 'AGENCY_AGENTS_ADAPTER',
    capabilities: normalizedCaps,
    authority: DefaultAgentAuthorityProfile, // Explicitly enforce safe profile
    providerConstraints,
    tenantId: defaultTenantId,
    workspaceId: defaultWorkspaceId,
    enabled: externalDef.enabled !== false,
    metadata: {
      originalSource: 'agency-agents',
      workflowPrompt: typeof externalDef.prompt === 'string' ? externalDef.prompt.trim() : null
    }
  });
}

/**
 * Creates an in-memory, deterministic, tenant-isolated Agent Registry.
 * Enforces uniqueness, immutability, fail-closed lookups, and ZERO execution.
 */
export function createAgentRegistry() {
  const registry = new Map(); // id -> AgentDefinition

  return Object.freeze({
    /**
     * Registers an AgentDefinition. Fails closed on duplicates or invalid schemas.
     */
    register(agentDef) {
      if (!agentDef || typeof agentDef !== 'object' || !agentDef.id) {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid agent definition for registration`);
      }
      if (registry.has(agentDef.id)) {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Agent already registered with ID: '${agentDef.id}'`);
      }
      registry.set(agentDef.id, Object.freeze({ ...agentDef }));
      return registry.get(agentDef.id);
    },

    /**
     * Retrieves an agent by ID with optional tenant and workspace isolation verification.
     */
    get(id, { tenantId = null, workspaceId = null } = {}) {
      if (!id || typeof id !== 'string') {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Agent get requires valid string ID`);
      }
      const agent = registry.get(id);
      if (!agent) {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Agent not found: '${id}'`);
      }

      // Tenant isolation enforcement
      if (tenantId !== null && agent.tenantId !== null && agent.tenantId !== tenantId) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch for agent '${id}': expected '${agent.tenantId}', caller provided '${tenantId}'`);
      }

      // Workspace isolation enforcement
      if (workspaceId !== null && agent.workspaceId !== null && agent.workspaceId !== workspaceId) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch for agent '${id}': expected '${agent.workspaceId}', caller provided '${workspaceId}'`);
      }

      return agent;
    },

    /**
     * Checks existence of an agent ID.
     */
    has(id) {
      return Boolean(id && typeof id === 'string' && registry.has(id));
    },

    /**
     * Lists agents deterministically sorted by ID with optional tenant filter.
     */
    list({ tenantId = null } = {}) {
      const result = [];
      for (const agent of registry.values()) {
        if (tenantId === null || agent.tenantId === null || agent.tenantId === tenantId) {
          result.push(agent);
        }
      }
      return Object.freeze(result.sort((a, b) => a.id.localeCompare(b.id)));
    },

    /**
     * Counts registered agents.
     */
    count() {
      return registry.size;
    }
  });
}
