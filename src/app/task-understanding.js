/**
 * ONLUNET ZEKA - Task Understanding & Deterministic Relevance Selection Foundation
 * Phase 29 Foundation
 *
 * Enforces:
 * - Deterministic task normalization (whitespace trimming, lowercase matching token derivation)
 * - Deterministic broad task category classification (INSPECT, EXPLAIN, DEBUG, MODIFY, TEST, BUILD, REFACTOR)
 * - Deterministic relevance selection over ALREADY-DISCOVERED files (zero file reading, zero new crawling)
 * - Path containment via workspace.assertInside()
 * - Strictly advisory metadata output (zero execution authority, zero mutation authority)
 */
import fs from 'node:fs';
import path from 'node:path';
import { ErrorCodes } from '../contracts/constants.js';

export const TaskIntentCategory = Object.freeze({
  INSPECT: 'INSPECT',
  EXPLAIN: 'EXPLAIN',
  DEBUG: 'DEBUG',
  MODIFY: 'MODIFY',
  TEST: 'TEST',
  BUILD: 'BUILD',
  REFACTOR: 'REFACTOR',
  GENERAL: 'GENERAL'
});

export const MAX_TASK_TEXT_LENGTH = 10000;
export const MAX_ADVISORY_CANDIDATES = 50;
export const MAX_FILE_CONTENT_LENGTH = 100000;
export const MAX_CONTENT_CANDIDATES = 10;

export const BLOCKED_BINARY_EXTENSIONS = Object.freeze([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
  '.pdf', '.zip', '.tar', '.gz', '.7z',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.db', '.sqlite', '.sqlite3', '.iso', '.wasm'
]);

export const SENSITIVE_FILENAME_PATTERNS = Object.freeze([
  /^\.env(\..+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /^id_rsa$/i,
  /^id_ed25519$/i,
  /^credentials(\..+)?$/i,
  /^secret.*$/i
]);

const INTENT_KEYWORDS = Object.freeze({
  [TaskIntentCategory.TEST]: ['test', 'spec', 'verify', 'assert', 'check'],
  [TaskIntentCategory.DEBUG]: ['fix', 'bug', 'issue', 'error', 'fail', 'crash', 'repair'],
  [TaskIntentCategory.MODIFY]: ['update', 'change', 'edit', 'add', 'remove', 'delete', 'modify', 'write'],
  [TaskIntentCategory.REFACTOR]: ['refactor', 'clean', 'restructure', 'reorganize', 'rename', 'optimize'],
  [TaskIntentCategory.BUILD]: ['build', 'compile', 'bundle', 'transpile', 'package'],
  [TaskIntentCategory.INSPECT]: ['list', 'find', 'show', 'search', 'inspect', 'discover', 'view'],
  [TaskIntentCategory.EXPLAIN]: ['explain', 'describe', 'document', 'why', 'how', 'summary', 'analyze']
});

/**
 * Normalizes user task text deterministically.
 * Bounded by MAX_TASK_TEXT_LENGTH to prevent unbounded memory expansion.
 */
export function normalizeTask(taskText) {
  if (typeof taskText !== 'string' || taskText.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] normalizeTask requires non-empty string taskText`);
  }
  const original = taskText.length > MAX_TASK_TEXT_LENGTH ? taskText.slice(0, MAX_TASK_TEXT_LENGTH) : taskText;
  const trimmed = original.trim().replace(/\s+/g, ' ');
  const normalized = trimmed.toLowerCase();
  // Extract alphanumeric tokens for deterministic word matching
  const tokens = Object.freeze(normalized.split(/[^a-z0-9_.-]+/).filter(Boolean));

  return Object.freeze({
    original,
    trimmed,
    normalized,
    tokens
  });
}

/**
 * Deterministically classifies task into a broad intent category.
 */
export function classifyTaskIntent(normalizedTask) {
  const norm = typeof normalizedTask === 'string' ? normalizeTask(normalizedTask) : normalizedTask;
  if (!norm || !Array.isArray(norm.tokens)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] classifyTaskIntent requires valid normalized task`);
  }

  for (const [category, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some(kw => norm.tokens.includes(kw))) {
      return category;
    }
  }

  return TaskIntentCategory.GENERAL;
}

/**
 * Deterministically selects relevant file candidates from an ALREADY-DISCOVERED files list.
 *
 * Rules:
 * - Operates ONLY on existing discovery results (zero new filesystem readdir or stat).
 * - Never reads file contents (zero fs.readFileSync / read).
 * - Enforces path containment (via workspace.assertInside).
 * - Deterministic scoring: exact filename match > basename token match > path segment match.
 * - Deterministic ordering: highest score first, then lexicographically by relativePath.
 * - Output is strictly advisory metadata (RELEVANCE IS NOT AUTHORITY).
 */
export function selectTaskRelevantCandidates({
  task,
  workspace,
  discoveredFiles = []
}) {
  if (!workspace || typeof workspace.assertInside !== 'function' || !workspace.rootPath) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] selectTaskRelevantCandidates requires valid ProjectWorkspace`);
  }

  const norm = typeof task === 'string' ? normalizeTask(task) : task;
  const taskCategory = classifyTaskIntent(norm);

  const candidatesMap = new Map();

  for (const entry of discoveredFiles) {
    if (!entry || !entry.relativePath) continue;

    // Strict containment check: must be inside authoritative workspace
    const absolutePath = path.resolve(workspace.rootPath, entry.relativePath);
    try {
      workspace.assertInside(absolutePath);
    } catch {
      // Discard any foreign or traversal paths
      continue;
    }

    const relLower = entry.relativePath.toLowerCase().replace(/\\/g, '/');
    const baseName = path.basename(relLower);
    const reasons = [];
    let score = 0;

    // Signal 1: Exact relative path mention in task
    if (norm.normalized.includes(relLower)) {
      score += 100;
      reasons.push('EXACT_PATH_MENTION');
    }

    // Signal 2: Exact basename mention in task
    if (norm.tokens.includes(baseName) || norm.normalized.includes(baseName)) {
      score += 50;
      reasons.push('EXACT_FILENAME_MENTION');
    } else {
      // Signal 3: Base name without extension mentioned
      const ext = path.extname(baseName);
      const nameWithoutExt = ext ? path.basename(baseName, ext) : baseName;
      if (nameWithoutExt && norm.tokens.includes(nameWithoutExt)) {
        score += 30;
        reasons.push('BASENAME_TOKEN_MENTION');
      }
    }

    // Signal 4: Directory / path segment token overlap
    const segments = relLower.split('/').filter(Boolean);
    for (const seg of segments) {
      if (norm.tokens.includes(seg) && !reasons.includes('PATH_SEGMENT_MATCH')) {
        score += 10;
        reasons.push('PATH_SEGMENT_MATCH');
      }
    }

    if (score > 0) {
      const canonicalKey = relLower;
      const existing = candidatesMap.get(canonicalKey);
      if (!existing || score > existing.score) {
        candidatesMap.set(canonicalKey, {
          relativePath: entry.relativePath,
          type: entry.type || 'file',
          score,
          reasons
        });
      }
    }
  }

  const candidates = Array.from(candidatesMap.values()).map(c => Object.freeze({
    ...c,
    reasons: Object.freeze(c.reasons)
  }));

  // Deterministic sort: score descending, then relativePath ascending
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.relativePath.localeCompare(b.relativePath);
  });

  // Deterministic bounding to MAX_ADVISORY_CANDIDATES
  const boundedCandidates = candidates.slice(0, MAX_ADVISORY_CANDIDATES);

  return Object.freeze({
    taskType: taskCategory,
    normalizedTask: norm.trimmed,
    candidates: Object.freeze(boundedCandidates),
    // Explicit security boundary invariant marker
    isAuthoritative: false
  });
}

/**
 * Phase 32: Reads bounded, read-only content for an already-selected task-relevant candidate.
 *
 * Rules:
 * - Content target must pass workspace.assertInside().
 * - Binary files are safely blocked (content omitted).
 * - Sensitive credential/secret files are safely blocked (content omitted).
 * - Read length is strictly bounded to MAX_FILE_CONTENT_LENGTH characters.
 * - Zero write, zero process launch, zero network, strictly read-only.
 */
export function readSelectedCandidateContent({ workspace, candidate }) {
  if (!workspace || typeof workspace.assertInside !== 'function' || !workspace.rootPath) {
    return null;
  }
  if (!candidate || !candidate.relativePath || candidate.type === 'directory') {
    return null;
  }

  const absolutePath = path.resolve(workspace.rootPath, candidate.relativePath);
  try {
    workspace.assertInside(absolutePath);
  } catch {
    return null;
  }

  const baseName = path.basename(candidate.relativePath);
  const ext = path.extname(baseName).toLowerCase();

  // Check binary extension
  if (BLOCKED_BINARY_EXTENSIONS.includes(ext)) {
    return null;
  }

  // Check sensitive filename patterns
  if (SENSITIVE_FILENAME_PATTERNS.some(pat => pat.test(baseName))) {
    return null;
  }

  // Symlink check: symlink candidates are strictly blocked from content ingestion
  try {
    const lstat = fs.lstatSync(absolutePath);
    if (lstat.isSymbolicLink() || !lstat.isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  // Bounded read: Allocate buffer for at most MAX_FILE_CONTENT_LENGTH * 4 bytes (max possible UTF-8 for 100000 chars)
  // Read strictly bounded chunk using file descriptor so large files are not fully read into memory
  let fd = null;
  try {
    const maxBytesToRead = MAX_FILE_CONTENT_LENGTH * 4;
    const stat = fs.statSync(absolutePath);
    const bytesToRead = Math.min(stat.size, maxBytesToRead);
    if (bytesToRead === 0) {
      return '';
    }

    const buffer = Buffer.alloc(bytesToRead);
    fd = fs.openSync(absolutePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, 0);
    const decoded = buffer.toString('utf-8', 0, bytesRead);

    if (decoded.length > MAX_FILE_CONTENT_LENGTH) {
      return decoded.slice(0, MAX_FILE_CONTENT_LENGTH);
    }
    return decoded;
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Safe fail-closed
      }
    }
  }
}

/**
 * Phase 30 & 32: Assembles a bounded, immutable, advisory-only context object.
 * Integrates workspace descriptor, discovery metadata, normalized task, and relevance candidates
 * with bounded read-only file content for top-ranking candidates.
 *
 * Rules:
 * - Strictly advisory metadata (isAuthoritative: false).
 * - Content read is bounded, read-only, local, non-authoritative.
 * - Entire structure and nested objects/arrays are deeply frozen with Object.freeze.
 */
export function assembleAdvisoryContext({
  workspace,
  taskPrompt,
  discoveredFiles = [],
  includeContent = false
}) {
  if (!workspace || typeof workspace.assertInside !== 'function' || !workspace.rootPath) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] assembleAdvisoryContext requires valid ProjectWorkspace`);
  }

  const normalized = normalizeTask(taskPrompt);
  const taskType = classifyTaskIntent(normalized);
  const relevance = selectTaskRelevantCandidates({
    task: normalized,
    workspace,
    discoveredFiles
  });

  const candidatesWithContent = relevance.candidates.map((c, idx) => {
    if (!includeContent) {
      return c;
    }
    const content = (idx < MAX_CONTENT_CANDIDATES)
      ? readSelectedCandidateContent({ workspace, candidate: c })
      : null;
    return Object.freeze({
      ...c,
      content
    });
  });

  return Object.freeze({
    workspace: Object.freeze({
      name: workspace.name || path.basename(workspace.rootPath),
      rootPath: workspace.rootPath
    }),
    task: Object.freeze({
      original: normalized.original,
      normalizedTask: normalized.trimmed,
      taskType
    }),
    relevantCandidates: Object.freeze(candidatesWithContent),
    isAuthoritative: false
  });
}


