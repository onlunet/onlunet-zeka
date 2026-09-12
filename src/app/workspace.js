/**
 * ONLUNET ZEKA - Application Layer: Project Workspace Boundary
 * Phase 13 Foundation
 *
 * Enforces:
 * - Safe workspace root selection
 * - Path containment check using core isPathInsideDirectory()
 * - Non-leaking project metadata extraction
 * - Zero unauthorized filesystem access outside workspace
 */
import path from 'node:path';
import fs from 'node:fs';
import { isPathInsideDirectory } from '../interfaces/core.js';
import { ErrorCodes } from '../contracts/constants.js';

export function createProjectWorkspace({ rootPath }) {
  if (!rootPath || typeof rootPath !== 'string' || rootPath.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ProjectWorkspace requires valid rootPath`);
  }

  const resolvedRoot = path.resolve(rootPath);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ProjectWorkspace rootPath does not exist or is not a directory: ${resolvedRoot}`);
  }

  return Object.freeze({
    rootPath: resolvedRoot,
    name: path.basename(resolvedRoot),

    assertInside(targetPath) {
      if (!isPathInsideDirectory(targetPath, this.rootPath)) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Path '${targetPath}' is outside workspace root '${this.rootPath}'`);
      }
      return path.resolve(targetPath);
    },

    listFiles({ maxDepth = 2 } = {}) {
      const files = [];

      function scan(currentDir, currentDepth) {
        if (currentDepth > maxDepth) return;
        let entries = [];
        try {
          entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
          const fullPath = path.join(currentDir, entry.name);
          const relPath = path.relative(resolvedRoot, fullPath);

          if (entry.isDirectory()) {
            files.push({ type: 'directory', relativePath: relPath });
            scan(fullPath, currentDepth + 1);
          } else if (entry.isFile()) {
            files.push({ type: 'file', relativePath: relPath });
          }
        }
      }

      scan(resolvedRoot, 1);
      return Object.freeze(files);
    }
  });
}
