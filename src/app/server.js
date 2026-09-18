/**
 * ONLUNET ZEKA - Standalone Application Server & HTTP Boundary
 * Phase 13 Foundation, Phase 13.1 Security Remediation & Phase 18 Controlled Change Application
 *
 * Provides a self-hosted HTTP server delivering:
 * 1. Embedded Visual Workspace & Task Execution UI (No VS Code, Antigravity, or Codex required)
 * 2. Workspace Management API (/api/workspace)
 * 3. AI Gateway Natural Language Planning API (/api/plan)
 * 4. Controlled Execution Pipeline API (/api/execute)
 * 5. Controlled File Mutation API (/api/mutate)
 *
 * ZERO EXTERNAL DEPENDENCIES: Native node:http, node:fs, node:path.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';

import { PROJECT_ROOT } from '../interfaces/core.js';
import { ErrorCodes, TaskState } from '../contracts/constants.js';
import { createProjectWorkspace } from './workspace.js';
import { createAIGateway, createStandardLocalProvider } from './ai-gateway.js';
import { assembleAdvisoryContext } from './task-understanding.js';
import { runApplicationPipeline } from './orchestration-runner.js';
import { createExecutionPlanContract } from '../contracts/execution-plan.js';
import { executeAuthorizedFileMutation } from '../contracts/file-mutation.js';
import { createTask } from '../contracts/domain.js';
import { createApproval } from '../contracts/domain.js';
import { evaluateExecutionPreflight } from '../contracts/preflight.js';
import { createExecutionHandoffContract } from '../contracts/handoff.js';
import { consumeExecutionHandoff } from '../contracts/runtime-boundary.js';
import { authorizeExecutionRequest } from '../contracts/execution-authorization.js';
import { createValidation } from '../contracts/domain.js';
import { ValidationResult } from '../contracts/constants.js';
import { evaluatePostExecutionValidation } from '../contracts/orchestrator.js';
import {
  createScopePolicy,
  createExecutionPolicy,
  createSecurityPolicy,
  createApprovalPolicy
} from '../policies/policies.js';
import { createJobEngine } from '../contracts/job-engine.js';
import { createWorkUnit, admitWorkUnit, executeWorkUnit } from '../contracts/work-unit.js';
import { createAutonomousPolicyContract, evaluateAutonomousPolicy } from '../contracts/autonomous-policy.js';
import { createAIProviderContract, normalizeAIProposal, validateAIProposal } from '../contracts/ai-proposal.js';
import { createAgentRegistry, createAgentDefinition } from '../contracts/agent-registry.js';
import { createTaskDefinition, routeTask } from '../contracts/task-routing.js';
import { createAgentProposal, validateAgentProposal } from '../contracts/agent-proposal.js';
import { createInvocationRequest, invokeAIProvider } from '../contracts/provider-invocation.js';
import {
  createMultiAgentOrchestrationPlan,
  composeOrchestrationPlan,
  MultiAgentPlanStatus
} from '../contracts/multi-agent-orchestration.js';
import {
  aggregateAndReviewProposals,
  ProposalReviewStatus
} from '../contracts/proposal-review.js';
import {
  evaluateApprovalAdmission,
  AdmissionStatus
} from '../contracts/approval-admission.js';
import {
  executeAdmittedBridge,
  ExecutionBridgeStatus
} from '../contracts/execution-bridge.js';
import {
  verifyExecutionResult,
  VerificationStatus
} from '../contracts/execution-verification.js';
import {
  orchestrateProjectVerification,
  createProjectVerificationPlan,
  ProjectVerificationStatus
} from '../contracts/project-verification.js';
import {
  orchestrateSelfCorrection,
  createCorrectionProposal,
  analyzeFailureEvidence,
  CorrectionStatus,
  MAX_CORRECTION_CYCLES
} from '../contracts/self-correction.js';
import { createProviderRegistry } from '../providers/provider-registry.js';
import { createProviderGateway } from '../providers/provider-gateway.js';
import { createMultiAgentExecutor } from '../orchestration/multi-agent-executor.js';
import { createBudgetTracker } from '../providers/cost-tracker.js';
import { createAutonomousLoopEngine } from '../autonomous/autonomous-loop-engine.js';
import { sanitizeString, sanitizeFilePath } from '../providers/credential-sanitizer.js';
import { createAIControlPlane } from '../control-plane/control-plane.js';
import { createAIExecutionPipeline } from '../control-plane/ai-execution-pipeline.js';
import { createModelRegistry } from '../providers/model-registry.js';
import { createRoutingEngine } from '../providers/routing-engine.js';
import { ProviderCapabilities } from '../providers/provider-capabilities.js';
import { createRoutingTelemetry } from '../providers/routing-telemetry.js';
import { createProjectGenerator, TemplateMetadata } from '../autonomous/project-generator.js';
import { createCorporateGenerator, CorporatePalettes } from '../autonomous/corporate-generator.js';
import { createZipFromDirectory } from '../autonomous/zip-exporter.js';
import { deployProject } from '../autonomous/deploy-engine.js';
import { inspectAndModernizeWebsite, validateUrlSecurity } from '../autonomous/site-extractor.js';
import { inspectAndModernizeGoogleMaps } from '../autonomous/maps-to-corporate.js';
import { synthesizeAutonomousWebsite, GenerationMode } from '../autonomous/website-synthesis-engine.js';
import { auditStoredDesign, evaluateVisualCommercialDesign } from '../autonomous/visual-commercial-critic.js';
import { normalizeCompanyProfile } from '../autonomous/company-profile-normalizer.js';
import { getBackendCapabilityRegistry, validateBackendCapabilities } from '../autonomous/backend-capability-registry.js';
import { validateReferenceImageSecurity, storeReferenceImageSecurely, analyzeReferenceImage, computeReferenceDesignMatch, buildImageDesignSpec, LayoutFamilies } from '../autonomous/reference-image-analyzer.js';
import { ingestMultiSourceCorporateData } from '../autonomous/multi-source-adapter.js';
import { runSelfHealingAudit } from '../autonomous/browser-qa-inspector.js';
import { runAgentSquadTask } from '../orchestration/agent-squad-runner.js';
import { scrapeGoogleMapsListing } from '../autonomous/maps-scraper.js';
import { auditGoogleMapsListing } from '../autonomous/maps-auditor.js';
import { scrapeWebsiteForSeo } from '../autonomous/seo-scraper.js';
import { auditWebsiteSeo, autoHealProjectSeo } from '../autonomous/seo-auditor.js';
import { captureResponsiveViewports, createVisualBaseline, compareWithBaseline } from '../autonomous/visual-baseline.js';
import { analyzeRenderedUrl } from '../autonomous/visual-analyzer.js';
import { evaluateVisualDesign } from '../autonomous/visual-critic.js';
import { computeCompositeVisualScore } from '../autonomous/visual-score-engine.js';
import { analyzeScreenshot, ANALYSIS_PROFILES } from '../autonomous/visual-intelligence.js';
import { createDesignProposal, validateDesignProposal } from '../autonomous/visual-proposal-engine.js';
import { verifyTokenMatches } from '../autonomous/visual-token-system.js';
import { mapFindingsToProposals } from '../autonomous/visual-remediation-policy.js';
import { executeDesignProposal, rollbackVisualPatch, getAuditLedger } from '../autonomous/visual-refactoring-engine.js';
import { runVisualRegressionCycle } from '../autonomous/visual-regression-loop.js';
import { createExecutionAuthorizationContract, AuthorizationDecision } from '../contracts/execution-authorization.js';

const mapsAuditHistory = [];
const mapsAuditStore = new Map();
const seoAuditHistory = [];
const seoAuditStore = new Map();
const visualAuditHistory = [];
const visualAuditStore = new Map();
const visualBaselineStore = new Map();
const visualProposalStore = new Map();
const visualExecutionStore = new Map();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

// ======================================================================
// ACTIVE CORPORATE PROJECT RUNTIME MANAGER (Phase 67)
// ======================================================================
let activeProjectProcess = null;

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function freePort(port = 8080) {
  if (Number(port) === 8000) {
    return;
  }
  try {
    if (process.platform === 'win32') {
      let out = '';
      try {
        out = execSync(`netstat -ano -p tcp | findstr :${port}`, { encoding: 'utf8' });
      } catch {
        return;
      }
      const lines = out.trim().split('\n');
      for (const line of lines) {
        if (!line.includes('LISTENING')) continue;
        const parts = line.trim().split(/\s+/);
        const localAddr = parts[1] || '';
        if (localAddr.endsWith(`:${port}`)) {
          const pid = parts[parts.length - 1];
          if (pid && Number(pid) > 0 && Number(pid) !== process.pid) {
            try {
              execSync(`taskkill /F /PID ${pid} >nul 2>&1`);
            } catch {}
          }
        }
      }
    } else {
      try {
        const out = execSync(`lsof -ti :${port}`, { encoding: 'utf8' });
        const pids = out.trim().split('\n');
        for (const pid of pids) {
          if (pid && Number(pid) !== process.pid) {
            try { process.kill(Number(pid), 'SIGKILL'); } catch {}
          }
        }
      } catch {}
    }
  } catch {}
}

function stopRunningProject() {
  if (activeProjectProcess) {
    try {
      if (activeProjectProcess.pid && Number(activeProjectProcess.pid) !== process.pid && isPidAlive(activeProjectProcess.pid)) {
        if (process.platform === 'win32') {
          execSync(`taskkill /F /PID ${activeProjectProcess.pid} >nul 2>&1`);
        } else {
          process.kill(activeProjectProcess.pid, 'SIGKILL');
        }
      }
    } catch {}
    const prevPort = activeProjectProcess.port;
    activeProjectProcess = null;
    if (prevPort) freePort(prevPort);
  }
}

function startProjectServer(targetDir, port = 8080) {
  if (Number(port) === 8000) port = 8080;
  stopRunningProject();
  freePort(port);

  const serverScript = path.join(targetDir, 'scripts', 'server.js');
  if (!fs.existsSync(serverScript)) {
    return { success: false, error: `Sunucu betiği bulunamadı: ${serverScript}` };
  }

  try {
    const child = spawn(process.execPath, ['scripts/server.js'], {
      cwd: targetDir,
      env: { ...process.env, PORT: String(port) },
      stdio: 'ignore',
      detached: true
    });
    child.unref();

    const projectId = path.basename(targetDir);
    activeProjectProcess = {
      projectId,
      targetDir,
      pid: child.pid,
      port,
      startedAt: new Date().toISOString()
    };

    child.on('exit', () => {
      if (activeProjectProcess && activeProjectProcess.pid === child.pid) {
        activeProjectProcess = null;
      }
    });

    return {
      success: true,
      projectId,
      port,
      url: `http://localhost:${port}/tr/`,
      adminUrl: `http://localhost:${port}/admin/login`
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function listProjects(workspaceRoot) {
  const projDir = path.resolve(workspaceRoot, 'projeler');
  if (!fs.existsSync(projDir)) {
    return [];
  }

  const entries = fs.readdirSync(projDir, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(projDir, entry.name);
    const serverJs = path.join(fullPath, 'scripts', 'server.js');
    if (!fs.existsSync(serverJs)) continue;

    const projectJsonPath = path.join(fullPath, 'project.json');
    let metadata = {
      id: entry.name,
      name: entry.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      industry: 'Kurumsal',
      theme: 'blue',
      port: 8080,
      createdAt: null
    };

    if (fs.existsSync(projectJsonPath)) {
      try {
        const pj = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
        metadata = { ...metadata, ...pj };
      } catch {}
    } else {
      const tfPath = path.join(fullPath, 'scripts', 'tailored-frontend.js');
      if (fs.existsSync(tfPath)) {
        try {
          const content = fs.readFileSync(tfPath, 'utf-8');
          const nameMatch = content.match(/companyName:\s*['"]([^'"]+)['"]/);
          if (nameMatch) metadata.name = nameMatch[1];
        } catch {}
      }
    }

    const stat = fs.statSync(fullPath);
    if (!metadata.createdAt) {
      metadata.createdAt = stat.birthtime.toISOString();
    }

    const isRunning = Boolean(
      activeProjectProcess &&
      isPidAlive(activeProjectProcess.pid) &&
      (activeProjectProcess.projectId === entry.name || path.resolve(activeProjectProcess.targetDir) === path.resolve(fullPath))
    );

    const resolvedPort = Number(metadata.port) || 8080;
    projects.push({
      ...metadata,
      id: entry.name,
      targetDirectory: path.relative(workspaceRoot, fullPath).replace(/\\/g, '/'),
      isRunning,
      port: resolvedPort,
      url: `http://localhost:${resolvedPort}/tr/`,
      adminUrl: `http://localhost:${resolvedPort}/admin/login`
    });
  }

  projects.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return projects;
}

function deleteProject(workspaceRoot, projectId) {
  if (!projectId || typeof projectId !== 'string') {
    return { success: false, error: 'Geçersiz projectId parametresi.' };
  }
  const cleanId = path.basename(projectId.trim());
  if (!cleanId || cleanId !== projectId.trim() || projectId.includes('..')) {
    return { success: false, error: 'Güvenlik engeli: Geçersiz proje kimliği.' };
  }
  const targetDirAbs = path.resolve(workspaceRoot, 'projeler', cleanId);
  if (!fs.existsSync(targetDirAbs)) {
    return { success: false, error: `Proje klasörü bulunamadı: ${cleanId}` };
  }

  // If this project is currently running, stop it first
  if (activeProjectProcess && (activeProjectProcess.projectId === cleanId || path.resolve(activeProjectProcess.targetDir) === targetDirAbs)) {
    stopRunningProject();
  }

  try {
    fs.rmSync(targetDirAbs, { recursive: true, force: true });
    return {
      success: true,
      projectId: cleanId,
      message: `"${cleanId}" projesi ve tüm dosyaları başarıyla silindi.`
    };
  } catch (err) {
    return { success: false, error: `Proje silinirken hata oluştu: ${err.message}` };
  }
}

/**
 * FAZ 74.2: Canonical Corporate Target Directory Validator
 * Enforces boundary containment and blocks path traversal attacks.
 */
function validateCorporateTargetDirectory(targetDir, workspaceRoot) {
  if (!targetDir || typeof targetDir !== 'string') {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Invalid targetDirectory: must be a non-empty string`);
  }

  // 1. Block absolute paths (POSIX /... or Windows C:\... or \\...)
  if (path.isAbsolute(targetDir) || /^[a-zA-Z]:[\\\/]/.test(targetDir) || /^\\\\/.test(targetDir)) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Absolute path not allowed for targetDirectory: ${targetDir}`);
  }

  // 2. Block traversal tokens
  const normalized = targetDir.replace(/\\/g, '/').trim();
  const segments = normalized.split('/');
  if (segments.some(seg => seg === '..' || seg === '.')) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Path traversal blocked in targetDirectory: ${targetDir}`);
  }

  // 3. Resolve canonical path against workspaceRoot
  const resolvedRoot = path.resolve(workspaceRoot || PROJECT_ROOT);
  const resolvedTarget = path.resolve(resolvedRoot, normalized);

  // 4. Must stay strictly within workspaceRoot
  if (!resolvedTarget.startsWith(resolvedRoot + path.sep) && resolvedTarget !== resolvedRoot) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Boundary violation: targetDirectory escapes workspace root`);
  }

  // 5. If targetDir starts with 'projeler' or is intended for projeler:
  if (normalized.startsWith('projeler/') || normalized === 'projeler') {
    const projelerRoot = path.resolve(resolvedRoot, 'projeler');
    if (!resolvedTarget.startsWith(projelerRoot + path.sep) || resolvedTarget === projelerRoot) {
      throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Boundary violation: corporate project must reside inside 'projeler/'`);
    }
  }

  return path.relative(resolvedRoot, resolvedTarget).replace(/\\/g, '/');
}

export function createApplicationServer({
  aiGateway = createAIGateway({ providerAdapter: createStandardLocalProvider() }),
  pipelineRunner = runApplicationPipeline,
  jobEngine = null,
  agentRegistry = null,
  providerAdapter = null,
  providerRegistry = null,
  providerGateway = null,
  multiAgentExecutor = null,
  budgetTracker = null,
  autonomousEngine = null,
  controlPlane = null,
  modelRegistry = null,
  routingEngine = null,
  routingTelemetry = null,
  executionPipeline = null
} = {}) {
  // Authoritative State held securely in application server memory / job engine
  const authoritativeEngine = jobEngine || createJobEngine();
  const authoritativeAgentRegistry = agentRegistry || createAgentRegistry();
  const authoritativeProvider = providerAdapter || (aiGateway && aiGateway.providerAdapter ? aiGateway.providerAdapter : createStandardLocalProvider());
  const authoritativeProviderRegistry = providerRegistry || createProviderRegistry();
  const authoritativeBudget = budgetTracker || createBudgetTracker();
  const authoritativeModelRegistry = modelRegistry || createModelRegistry();
  const authoritativeTelemetry = routingTelemetry || createRoutingTelemetry();
  const authoritativeGateway = providerGateway || createProviderGateway({
    registry: authoritativeProviderRegistry,
    budgetTracker: authoritativeBudget
  });
  const authoritativeRoutingEngine = routingEngine || createRoutingEngine({
    registry: authoritativeProviderRegistry,
    modelRegistry: authoritativeModelRegistry,
    telemetry: authoritativeTelemetry
  });
  const authoritativeExecutor = multiAgentExecutor || createMultiAgentExecutor({
    providerGateway: authoritativeGateway,
    agentRegistry: authoritativeAgentRegistry
  });
  const authoritativeAutonomousEngine = autonomousEngine || createAutonomousLoopEngine({
    workspaceRoot: PROJECT_ROOT,
    jobEngine: authoritativeEngine,
    providerGateway: authoritativeGateway
  });
  const authoritativePipeline = executionPipeline || createAIExecutionPipeline({
    registry: authoritativeProviderRegistry,
    modelRegistry: authoritativeModelRegistry,
    routingEngine: authoritativeRoutingEngine,
    gateway: authoritativeGateway,
    budgetTracker: authoritativeBudget
  });

  const authoritativeControlPlane = controlPlane || createAIControlPlane({
    registry: authoritativeProviderRegistry,
    gateway: authoritativeGateway
  });

  let activeWorkspace = null;
  // FAZ 74.2: Authoritative Corporate Plan Isolation Registry
  // Binds corporate authority strictly by planId, targetDirectory, and slug to eliminate cross-project concurrency leakage.
  const corporatePlanRegistry = new Map();
  let latestActivePlanId = null;
  let legacyActivePlan = null;

  const server = http.createServer(async (req, res) => {
    // Helper to send JSON response
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    const MAX_BODY_SIZE = 15 * 1024 * 1024; // 15MB to allow 10MB binary + base64 overhead
    // Helper to read and parse JSON body
    const readBody = () => new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
        if (data.length > MAX_BODY_SIZE) {
          req.destroy();
          reject(new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Request body size exceeds limit of ${MAX_BODY_SIZE} bytes`));
        }
      });
      req.on('end', () => {
        try {
          if (!data) return resolve({});
          if (/"__proto__"\s*:/i.test(data) || (/"constructor"\s*:/i.test(data) && /"prototype"\s*:/i.test(data))) {
            return reject(new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution attempt detected in request payload`));
          }
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid JSON body: ${e.message}`));
        }
      });
      req.on('error', reject);
    });

    try {
      // 1. Static UI serving
      if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
        const htmlPath = path.join(PUBLIC_DIR, 'index.html');
        if (fs.existsSync(htmlPath)) {
          const html = fs.readFileSync(htmlPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(html);
        }
      }

      // 1.1 Static reference uploads serving (FAZ 78)
      if (req.method === 'GET' && req.url.startsWith('/storage/reference-uploads/')) {
        const cleanUrl = req.url.split('?')[0];
        const rel = cleanUrl.replace(/^\/storage\/reference-uploads\//, '');
        if (!rel.includes('..') && !rel.includes(':')) {
          const filePath = path.join(PROJECT_ROOT, 'storage', 'reference-uploads', rel);
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            const mime = ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' });
            return fs.createReadStream(filePath).pipe(res);
          }
        }
      }

      // 1.2 GrapesJS Visual Web Builder UI
      if (req.method === 'GET' && (req.url === '/admin/editor' || req.url.startsWith('/admin/editor?'))) {
        const editorPath = path.join(PUBLIC_DIR, 'admin-editor.html');
        if (fs.existsSync(editorPath)) {
          const html = fs.readFileSync(editorPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(html);
        }
      }

      // 1.3 GrapesJS Vendor Assets Serving (Open Source Integration)
      if (req.method === 'GET' && req.url.startsWith('/vendor/grapesjs/')) {
        const rel = req.url.replace(/^\/vendor\/grapesjs\//, '').split('?')[0];
        const filePath = path.join(PROJECT_ROOT, 'node_modules', 'grapesjs', 'dist', rel);
        if (fs.existsSync(filePath) && !rel.includes('..')) {
          const ext = path.extname(filePath).toLowerCase();
          const mime = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' });
          return fs.createReadStream(filePath).pipe(res);
        }
      }

      // 2. Workspace Management API
      if (req.method === 'POST' && req.url === '/api/workspace') {
        const body = await readBody();
        const rootPath = body.rootPath;
        if (!rootPath || typeof rootPath !== 'string' || rootPath.trim() === '') {
          throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ProjectWorkspace requires valid rootPath`);
        }
        activeWorkspace = createProjectWorkspace({ rootPath });
        legacyActivePlan = null; // Invalidate legacy plan on workspace change
        const files = activeWorkspace.listFiles();
        return sendJson(200, {
          success: true,
          workspace: {
            name: activeWorkspace.name,
            rootPath: activeWorkspace.rootPath
          },
          files
        });
      }

      // 3. AI Plan API
      if (req.method === 'POST' && req.url === '/api/plan') {
        const body = await readBody();
        if (!activeWorkspace) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] No active workspace selected. Please select a workspace first.`);
        }

        // Phase 30 & 32: Assemble bounded, deterministic, immutable, advisory-only context
        const discoveredFiles = activeWorkspace.listFiles ? activeWorkspace.listFiles() : [];
        const advisoryContext = assembleAdvisoryContext({
          workspace: activeWorkspace,
          taskPrompt: body.task,
          discoveredFiles,
          includeContent: true
        });

        const planProposal = await aiGateway.analyzeAndPlan({
          taskPrompt: body.task,
          workspaceSummary: activeWorkspace,
          advisoryContext
        });

        // Construct authoritative ExecutionPlanContract (Phase 3)
        const basePlan = createExecutionPlanContract({
          id: `plan-${Date.now()}`,
          taskId: `task-${Date.now()}`,
          expectedCommands: planProposal.proposedCommands,
          expectedFileChanges: planProposal.proposedFileChanges,
          risk: planProposal.riskLevel || 'LOW'
        });

        // Phase 19: Authoritative change content binding (declarative immutable mutations map)
        // Phase 20: Explicit workspaceRoot binding to authoritative plan
        const generatedPlan = Object.freeze({
          ...basePlan,
          workspaceRoot: activeWorkspace.rootPath,
          authoritativeFileMutations: Object.freeze(
            (planProposal.proposedFileMutations || []).map(m => Object.freeze({
              file: m.file,
              content: m.content !== undefined ? m.content : '',
              expectedState: m.expectedState !== undefined ? m.expectedState : null
            }))
          )
        });

        // FAZ 38.2 Remediation (DEF-01):
        // If jobId is provided, authoritative plan MUST be bound strictly into jobEngine.
        // If jobId is NOT provided, it is stored in legacyActivePlan ONLY for backward compatibility with legacy non-job tests.
        // legacyActivePlan is strictly non-authoritative for Job-scoped execution.
        if (body.jobId) {
          const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
          authoritativeEngine.setJobPlan(body.jobId, generatedPlan, { tenantId });
        } else {
          legacyActivePlan = generatedPlan;
        }

        return sendJson(200, {
          success: true,
          plan: planProposal,
          authoritativePlanId: generatedPlan.id,
          jobId: body.jobId || null
        });
      }

      // 3.1 Template Discovery API
      if (req.method === 'GET' && req.url === '/api/templates') {
        return sendJson(200, {
          success: true,
          templates: TemplateMetadata
        });
      }

      // 3.2 Project Synthesis & Planning API
      if (req.method === 'POST' && req.url === '/api/project/plan') {
        const body = await readBody();
        if (!activeWorkspace) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] No active workspace selected. Please select a workspace first.`);
        }
        const generator = createProjectGenerator();
        const synthesis = await generator.synthesizeProject({
          prompt: body.prompt || body.task || 'Express REST API projesi üret',
          projectType: body.projectType,
          projectName: body.projectName,
          targetDirectory: body.targetDirectory || 'generated-project'
        });

        const generatedPlan = generator.createProjectPlan({
          synthesis,
          workspaceRoot: activeWorkspace.rootPath
        });

        if (body.jobId) {
          const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
          authoritativeEngine.setJobPlan(body.jobId, generatedPlan, { tenantId });
        } else {
          legacyActivePlan = generatedPlan;
        }

        return sendJson(200, {
          success: true,
          synthesis,
          plan: {
            intent: synthesis.description,
            analysis: `Otonom Proje Tasarlandı: '${synthesis.projectName}' (${synthesis.projectType}). ${synthesis.files.length} dosya ve otomatik test paketi hazırlandı.`,
            proposedCommands: generatedPlan.expectedCommands,
            proposedFileChanges: generatedPlan.expectedFileChanges,
            proposedFileMutations: generatedPlan.authoritativeFileMutations,
            riskLevel: 'LOW',
            requiresApproval: true
          },
          authoritativePlanId: generatedPlan.id,
          jobId: body.jobId || null
        });
      }

      // 3.3 Batch Project File Generation & Mutation API
      if (req.method === 'POST' && (req.url === '/api/project/generate' || req.url === '/api/mutate/batch')) {
        const body = await readBody();
        if (!activeWorkspace) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: No active workspace has been selected.`);
        }

        let targetPlan = null;
        if (body.jobId) {
          const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
          authoritativeEngine.getJob(body.jobId, { tenantId });
          targetPlan = authoritativeEngine.getJobPlan(body.jobId, { tenantId });
        } else {
          targetPlan = legacyActivePlan;
        }

        if (!targetPlan) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: No authoritative plan exists for project generation.`);
        }

        if (body.planId && body.planId !== targetPlan.id) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Client planId '${body.planId}' does not match authoritative planId '${targetPlan.id}'`);
        }

        const generator = createProjectGenerator();
        const result = await generator.applyProjectPlan({
          plan: targetPlan,
          workspaceRoot: activeWorkspace.rootPath,
          approval: body.approval !== false,
          dryRun: body.dryRun === true
        });

        // Record execution result if Job-scoped
        if (body.jobId) {
          const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
          authoritativeEngine.recordExecutionResult(body.jobId, {
            taskId: targetPlan.taskId,
            planId: targetPlan.id,
            outcome: result.success ? 'SUCCEEDED' : 'FAILED',
            result: {
              status: 'COMPLETED',
              projectGenerationResult: result
            }
          }, { tenantId });
        }

        const files = activeWorkspace.listFiles ? activeWorkspace.listFiles() : [];

        return sendJson(200, {
          success: result.success,
          status: 'COMPLETED',
          result,
          files
        });
      }

      // 3.4 Corporate Palettes API
      if (req.method === 'GET' && req.url === '/api/corporate/palettes') {
        return sendJson(200, {
          success: true,
          palettes: CorporatePalettes
        });
      }

      // 3.4.1 Corporate Sectors Taxonomy API (13 Main Categories & 80+ Sub-Sectors)
      if (req.method === 'GET' && req.url === '/api/corporate/sectors') {
        const { getAllCategories, getAllSubSectors } = await import('../autonomous/sector-presets.js');
        return sendJson(200, {
          success: true,
          categories: getAllCategories(),
          subSectors: getAllSubSectors()
        });
      }

      // 3.4.2 FAZ 75: Authoritative Backend Capability Registry API
      if (req.method === 'GET' && req.url === '/api/corporate/capabilities') {
        return sendJson(200, {
          success: true,
          registry: getBackendCapabilityRegistry()
        });
      }

      // 3.4.2b Corporate Project ZIP Export API
      if (req.method === 'GET' && req.url.startsWith('/api/corporate/export-zip/')) {
        const slug = req.url.slice('/api/corporate/export-zip/'.length).split('?')[0].trim();
        const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '');
        const projDir = path.resolve(PROJECT_ROOT, 'projeler', safeSlug);

        if (!fs.existsSync(projDir)) {
          return sendJson(404, { success: false, error: `Proje klasörü bulunamadı: ${safeSlug}` });
        }

        try {
          const zipBuffer = createZipFromDirectory(projDir, { excludes: ['node_modules', '.git'] });
          res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${safeSlug}-onlunet-proje.zip"`,
            'Content-Length': zipBuffer.length
          });
          res.end(zipBuffer);
          return;
        } catch (zipErr) {
          return sendJson(500, { success: false, error: zipErr.message });
        }
      }

      // 3.4.2c Corporate Project Remote Deploy API
      if (req.method === 'POST' && req.url.startsWith('/api/corporate/deploy/')) {
        const slug = req.url.slice('/api/corporate/deploy/'.length).split('?')[0].trim();
        const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '');
        const projDir = path.resolve(PROJECT_ROOT, 'projeler', safeSlug);

        if (!fs.existsSync(projDir)) {
          return sendJson(404, { success: false, error: `Proje klasörü bulunamadı: ${safeSlug}` });
        }

        const body = await readBody();
        try {
          const deployRes = await deployProject({
            projectDir: projDir,
            targetType: body.targetType || 'zip_stream',
            options: body
          });
          return sendJson(200, { success: true, result: deployRes });
        } catch (deployErr) {
          return sendJson(500, { success: false, error: deployErr.message });
        }
      }

      // 3.4.2d Privacy-First Click Radar Analytics Beacon
      if (req.method === 'POST' && (req.url === '/api/v1/analytics/click-event' || req.url === '/api/analytics/click-event')) {
        return sendJson(200, { success: true, recorded: true });
      }

      // 3.4.3 FAZ 75: Backend Capability Validation API
      if (req.method === 'POST' && req.url === '/api/corporate/validate-capabilities') {
        const body = await readBody();
        const validation = validateBackendCapabilities(body.capabilities || body.requiredCapabilities || []);
        return sendJson(validation.blocked ? 409 : 200, {
          success: !validation.blocked,
          validation
        });
      }

      // 3.4.4 FAZ 75 & FAZ 78: Reference Screenshot / Template Image Upload & Analysis API
      if (req.method === 'POST' && req.url === '/api/corporate/upload-reference') {
        const body = await readBody();
        try {
          let buffer = null;
          const origName = body.originalName || body.filename || (body.imagePath ? path.basename(body.imagePath) : (body.referenceImagePath ? path.basename(body.referenceImagePath) : 'reference.png'));
          if (body.imageBase64 && typeof body.imageBase64 === 'string') {
            buffer = Buffer.from(body.imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, ''), 'base64');
          } else if ((body.imagePath || body.referenceImagePath) && typeof (body.imagePath || body.referenceImagePath) === 'string') {
            const rawPath = body.imagePath || body.referenceImagePath;
            const safePath = path.resolve(PROJECT_ROOT, rawPath);
            if (fs.existsSync(safePath)) {
              buffer = fs.readFileSync(safePath);
            }
          }

          if (!buffer) {
            return sendJson(400, {
              success: false,
              error: 'imageBase64 (base64 string) veya imagePath gereklidir.'
            });
          }

          const stored = storeReferenceImageSecurely(buffer, origName, {
            storageBaseDir: PROJECT_ROOT
          });

          const analysis = analyzeReferenceImage({
            imageBuffer: buffer,
            imagePath: stored.storagePath,
            notes: body.notes || body.inspirationNotes || ''
          });

          const fidelityMode = body.fidelityMode || body.referenceImageFidelity || 'exact';
          const designSpec = buildImageDesignSpec({
            analysis,
            fidelityMode,
            viewport: body.viewport
          });

          const relPath = path.relative(PROJECT_ROOT, stored.storagePath).replace(/\\/g, '/');

          return sendJson(200, {
            success: true,
            file: stored,
            referenceId: stored.uuid,
            imagePath: relPath,
            imageUrl: `/${relPath}`,
            analysis,
            designSpec,
            fidelityMode,
            layoutFamily: designSpec.layoutFamily
          });
        } catch (uploadErr) {
          const isSecurity = uploadErr.message && uploadErr.message.includes('SECURITY_VIOLATION');
          return sendJson(isSecurity ? 403 : 500, {
            success: false,
            blocked: isSecurity,
            error: uploadErr.message
          });
        }
      }

      // 3.4.5 FAZ 75: Multi-Source Corporate Ingestion & Normalization API
      if (req.method === 'POST' && req.url === '/api/corporate/multi-source-ingest') {
        const body = await readBody();
        try {
          let websiteData = body.websiteData || null;
          let mapsData = body.mapsData || null;

          if (!websiteData && body.websiteUrl && typeof body.websiteUrl === 'string' && body.websiteUrl.trim()) {
            try {
              websiteData = await inspectAndModernizeWebsite(body.websiteUrl.trim(), { timeoutMs: 10000 });
            } catch (wErr) {
              console.warn('[MULTI-SOURCE WEBPAGE SCRAPE WARNING]:', wErr.message);
            }
          }

          if (!mapsData && body.mapsUrl && typeof body.mapsUrl === 'string' && body.mapsUrl.trim()) {
            try {
              mapsData = await inspectAndModernizeGoogleMaps(body.mapsUrl.trim(), { timeoutMs: 15000 });
            } catch (mErr) {
              console.warn('[MULTI-SOURCE MAPS SCRAPE WARNING]:', mErr.message);
            }
          }

          const result = await ingestMultiSourceCorporateData({
            manual: body.manual || body,
            websiteUrl: body.websiteUrl,
            websiteData,
            mapsUrl: body.mapsUrl,
            mapsData,
            referenceImage: body.referenceImage,
            referenceImagePath: body.referenceImagePath,
            requiredCapabilities: body.requiredCapabilities || [],
            options: { storageBaseDir: PROJECT_ROOT }
          });

          return sendJson(result.isGenerationBlocked ? 409 : 200, {
            success: !result.isGenerationBlocked,
            ...result
          });
        } catch (ingestErr) {
          return sendJson(500, {
            success: false,
            error: `Multi-source veri ayrıştırma başarısız oldu: ${ingestErr.message}`
          });
        }
      }

      // 3.5 Corporate Portal Synthesis & Planning API (FAZ 74.1 Genuine Autonomous Orchestration)
      if (req.method === 'POST' && req.url === '/api/corporate/plan') {
        const body = await readBody();
        if (!activeWorkspace) {
          activeWorkspace = createProjectWorkspace({ rootPath: PROJECT_ROOT });
        }

        // FAZ 75: Capability Gate Check
        const requestedCaps = Array.isArray(body.requiredCapabilities) ? [...body.requiredCapabilities] : [];
        if (body.teamRequired === true) requestedCaps.push('team');
        if (body.testimonialsRequired === true) requestedCaps.push('testimonials');
        if (body.faqRequired === true) requestedCaps.push('faq');
        if (body.caseStudiesRequired === true) requestedCaps.push('case_studies');
        if (body.brandReferencesRequired === true) requestedCaps.push('brand_references');
        if (body.galleryRequired === true) requestedCaps.push('gallery');

        if (requestedCaps.length > 0) {
          const capValidation = validateBackendCapabilities(requestedCaps);
          if (capValidation.blocked && body.bypassCapabilityGate !== true) {
            return sendJson(409, {
              success: false,
              blocked: true,
              error: capValidation.message,
              capabilityValidation: capValidation
            });
          }
        }

        // FAZ 76: SSRF & URL Security Validation
        if (body.websiteUrl) {
          try {
            validateUrlSecurity(body.websiteUrl);
          } catch (urlErr) {
            return sendJson(403, { success: false, blocked: true, error: urlErr.message });
          }
        }
        if (Array.isArray(body.referenceUrls)) {
          for (const refUrl of body.referenceUrls) {
            try {
              if (refUrl && typeof refUrl === 'string' && refUrl.trim()) {
                validateUrlSecurity(refUrl.trim());
              }
            } catch (refErr) {
              return sendJson(403, { success: false, blocked: true, error: refErr.message });
            }
          }
        }

        // FAZ 76 & FAZ 78: Reference Image Security & Ingestion
        let refAnalysis = body.referenceAnalysis || null;
        let imageDesignSpec = body.imageDesignSpec || null;
        const fidelityMode = body.referenceImageFidelity || body.fidelityMode || 'exact';

        if (body.referenceImagePath || body.referenceImage) {
          try {
            const rawBuf = body.referenceImage ? Buffer.from(body.referenceImage.replace(/^data:image\/[a-zA-Z]+;base64,/, ''), 'base64') : null;
            validateReferenceImageSecurity({
              filePath: body.referenceImagePath,
              buffer: rawBuf,
              originalName: body.referenceImageName
            });

            if (!refAnalysis) {
              let buffer = rawBuf;
              if (!buffer && body.referenceImagePath) {
                const p = path.resolve(PROJECT_ROOT, body.referenceImagePath);
                if (fs.existsSync(p)) buffer = fs.readFileSync(p);
              }
              if (buffer) {
                refAnalysis = analyzeReferenceImage({ imageBuffer: buffer, imagePath: body.referenceImagePath });
                imageDesignSpec = buildImageDesignSpec({ analysis: refAnalysis, fidelityMode });
              }
            }
          } catch (imgErr) {
            return sendJson(403, { success: false, blocked: true, error: imgErr.message });
          }
        }

        if (refAnalysis) {
          if (!imageDesignSpec || imageDesignSpec.fidelityMode !== fidelityMode) {
            imageDesignSpec = buildImageDesignSpec({ analysis: refAnalysis, fidelityMode });
          }
        }

        let autonomousResult = null;
        if (body.forceLegacy !== true) {
          try {
            autonomousResult = await synthesizeAutonomousWebsite({
              generationMode: GenerationMode.AUTONOMOUS_SYNTHESIS,
              manual: {
                companyName: body.companyName,
                industry: body.industry,
                subSectorId: body.subSectorId,
                slogan: body.slogan,
                description: body.description,
                services: body.services,
                products: body.products,
                contact: body.contact,
                theme: body.theme,
                inspirationNotes: body.inspirationNotes,
                layoutPreferences: body.layoutPreferences,
                isFoodHospitality: body.isFoodHospitality,
                coverPhotoUrl: body.coverPhotoUrl,
                requiredCapabilities: requestedCaps
              },
              websiteData: (body.referenceUrls && body.referenceUrls.length > 0) ? { url: body.referenceUrls[0] } : null,
              mapsData: (body.googleRating || body.googleReviews || body.googleMapsUrl || body.googleMapsDirectUrl) ? {
                googleRating: body.googleRating,
                googleReviewCount: body.googleReviewCount,
                googleReviews: body.googleReviews,
                googleMapsUrl: body.googleMapsUrl || body.googleMapsDirectUrl,
                coverPhotoUrl: body.coverPhotoUrl
              } : null,
              options: {
                skipBrowserRender: true,
                inspirationNotes: body.inspirationNotes,
                subProfile: body.subSectorId || body.theme,
                requiredCapabilities: requestedCaps,
                referenceImage: body.referenceImage,
                referenceImagePath: body.referenceImagePath,
                referenceAnalysis: refAnalysis,
                fidelityMode
              }
            });
          } catch (synthErr) {
            console.warn('[AUTONOMOUS SYNTHESIS API FALLBACK]', synthErr.message);
          }
        }

        // 1. Genuine Autonomous Synthesis Success Path
        if (autonomousResult && autonomousResult.success) {
          const corporateGen = createCorporateGenerator();
          const targetDirSlug = (body.companyName || 'kurumsal-proje')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
          const rawTargetDirectory = body.targetDirectory || body.targetDir || `projeler/${targetDirSlug}`;
          const targetDirectory = validateCorporateTargetDirectory(rawTargetDirectory, activeWorkspace.rootPath);

          // Prepare scaffolding for disk mutation when user approves
          const diskScaffold = corporateGen.synthesizeCorporateProject({
            companyName: body.companyName,
            subSectorId: body.subSectorId,
            industry: body.industry,
            slogan: body.slogan,
            description: body.description,
            services: body.services,
            products: body.products,
            contact: body.contact,
            theme: body.theme,
            adminUser: body.adminUser,
            targetDir: targetDirectory,
            referenceUrls: body.referenceUrls,
            layoutPreferences: body.layoutPreferences,
            inspirationNotes: body.inspirationNotes,
            googleMapsUrl: body.googleMapsUrl,
            googleMapsDirectUrl: body.googleMapsDirectUrl,
            googleRating: body.googleRating,
            googleReviewCount: body.googleReviewCount,
            googleReviews: body.googleReviews,
            isFoodHospitality: body.isFoodHospitality,
            coverPhotoUrl: body.coverPhotoUrl,
            imageDesignSpec,
            referenceAnalysis: refAnalysis,
            referenceImageFidelity: fidelityMode,
            fidelityMode,
            layoutFamily: body.layoutFamily
          });

          const nonPublicFiles = diskScaffold.files.filter(f => f.path !== 'public/index.html' && !f.path.endsWith('/public/index.html'));
          const files = [
            {
              path: 'public/index.html',
              purpose: 'Otonom Sıfırdan Sentezlenmiş Web Sitesi Arayüzü (HTML5 + Parametrik CSS3)',
              content: (body.referenceImagePath || body.referenceImage || imageDesignSpec || refAnalysis || body.layoutFamily || !autonomousResult?.composition?.html)
                ? (diskScaffold.files.find(f => f.path === 'public/index.html')?.content || autonomousResult.composition.html)
                : autonomousResult.composition.html
            },
            ...nonPublicFiles,
            {
              path: 'storage/design-fingerprint.json',
              purpose: 'Tasarım Parmak İzi & İskelet İmzası',
              content: JSON.stringify(diskScaffold.layoutFingerprint || autonomousResult.designFingerprint, null, 2)
            },
            {
              path: 'storage/design-reasoning.json',
              purpose: '20 Stratejik Tasarım Kararı & Gerekçeleri',
              content: JSON.stringify(autonomousResult.designStrategy, null, 2)
            },
            {
              path: 'storage/layout-graph.json',
              purpose: 'Dinamik Bölüm & Düzen Grafiği',
              content: JSON.stringify(autonomousResult.layoutGraph, null, 2)
            },
            {
              path: 'storage/design-system.json',
              purpose: 'Tasarım Sistemi Tokenları (WCAG AA Uyumlu)',
              content: JSON.stringify(autonomousResult.designSystem, null, 2)
            }
          ];

          const synthesis = {
            ...diskScaffold,
            projectName: body.companyName || diskScaffold.projectName || 'Kurumsal İşletme',
            description: `Sıfırdan Otonom Tasarım Sentezi — ${autonomousResult.designStrategy.industryCategory}`,
            files,
            targetDirectory,
            spec: diskScaffold.spec,
            slug: diskScaffold.slug,
            layoutFamily: diskScaffold.layoutFamily,
            layoutFingerprint: diskScaffold.layoutFingerprint,
            imageDesignSpec: diskScaffold.imageDesignSpec || imageDesignSpec,
            referenceAnalysis: diskScaffold.referenceAnalysis || refAnalysis,
            fidelityMode: diskScaffold.fidelityMode || fidelityMode,
            metadata: {
              ...diskScaffold.metadata,
              industry: body.industry || autonomousResult.designStrategy.industryCategory,
              generationMode: 'AUTONOMOUS_SYNTHESIS',
              generationId: autonomousResult.generationId,
              designFingerprint: diskScaffold.layoutFingerprint || autonomousResult.designFingerprint,
              layoutFamily: diskScaffold.layoutFamily
            }
          };

          const generatedPlan = corporateGen.createCorporatePlan({
            synthesis,
            workspaceRoot: activeWorkspace.rootPath
          });

          // FAZ 74.2: Register in Corporate Plan Isolation Registry
          const planRecord = {
            id: generatedPlan.id,
            plan: generatedPlan,
            targetDirectory,
            projectName: body.companyName || diskScaffold.projectName || 'Kurumsal İşletme',
            slug: path.basename(targetDirectory),
            fingerprint: diskScaffold.layoutFingerprint?.computedHash || autonomousResult.designFingerprint?.computedHash || generatedPlan.id,
            createdAt: Date.now(),
            status: 'ACTIVE',
            consumedAt: null,
            tenantId: body.tenantId || req.headers['x-tenant-id'] || null
          };
          corporatePlanRegistry.set(generatedPlan.id, planRecord);
          latestActivePlanId = generatedPlan.id;

          if (body.jobId) {
            const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
            authoritativeEngine.setJobPlan(body.jobId, generatedPlan, { tenantId });
          } else {
            legacyActivePlan = generatedPlan;
          }

          const plan = {
            id: generatedPlan.id,
            intent: `Sıfırdan Otonom Tasarım Sentezi: '${body.companyName}' (${autonomousResult.designStrategy.industryCategory})`,
            analysis: `Otonom Tasarım Sentez Motoru: ${autonomousResult.layoutGraph.sectionCount} dinamik bölüm, '${diskScaffold.layoutFamily}' düzen ailesi ve özgün tasarım parmak izi ile sıfırdan oluşturuldu. Şablon veya klon kullanılmadı.`,
            proposedCommands: generatedPlan.expectedCommands,
            proposedFileChanges: generatedPlan.expectedFileChanges,
            proposedFileMutations: generatedPlan.authoritativeFileMutations,
            riskLevel: 'LOW',
            requiresApproval: true
          };

          return sendJson(200, {
            success: true,
            generationMode: 'AUTONOMOUS_SYNTHESIS',
            generationId: autonomousResult.generationId,
            previewUrl: autonomousResult.report?.previewUrl,
            designFingerprint: diskScaffold.layoutFingerprint || autonomousResult.designFingerprint,
            layoutFamily: diskScaffold.layoutFamily,
            layoutFingerprint: diskScaffold.layoutFingerprint,
            imageDesignSpec: diskScaffold.imageDesignSpec || imageDesignSpec,
            referenceAnalysis: diskScaffold.referenceAnalysis || refAnalysis,
            fidelityMode: diskScaffold.fidelityMode || fidelityMode,
            referenceImagePath: body.referenceImagePath || null,
            referenceId: body.referenceId || null,
            traceableDecisions: autonomousResult.traceableDecisions,
            referenceDesignMatch: autonomousResult.referenceDesignMatch || null,
            capabilityValidation: autonomousResult.capabilityValidation || null,
            qaReport: generatedPlan.qaReport || null,
            informationArchitecture: generatedPlan.informationArchitecture || null,
            synthesis,
            plan,
            authoritativePlanId: generatedPlan.id,
            jobId: body.jobId || null
          });
        }

        // 2. Legacy Fallback Path (if autonomous synthesis fails or forceLegacy is requested)
        const corporateGen = createCorporateGenerator();
        const rawTargetDir = body.targetDirectory || body.targetDir || `projeler/${(body.companyName || 'kurumsal-proje').toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const targetDirectory = validateCorporateTargetDirectory(rawTargetDir, activeWorkspace.rootPath);

        const synthesis = corporateGen.synthesizeCorporateProject({
          companyName: body.companyName,
          subSectorId: body.subSectorId,
          industry: body.industry,
          slogan: body.slogan,
          description: body.description,
          services: body.services,
          products: body.products,
          contact: body.contact,
          theme: body.theme,
          adminUser: body.adminUser,
          targetDir: targetDirectory,
          referenceUrls: body.referenceUrls,
          layoutPreferences: body.layoutPreferences,
          inspirationNotes: body.inspirationNotes,
          googleMapsUrl: body.googleMapsUrl,
          googleMapsDirectUrl: body.googleMapsDirectUrl,
          googleRating: body.googleRating,
          googleReviewCount: body.googleReviewCount,
          googleReviews: body.googleReviews,
          isFoodHospitality: body.isFoodHospitality,
          coverPhotoUrl: body.coverPhotoUrl,
          imageDesignSpec,
          referenceAnalysis: refAnalysis,
          referenceImageFidelity: fidelityMode,
          fidelityMode,
          layoutFamily: body.layoutFamily
        });

        const generatedPlan = corporateGen.createCorporatePlan({
          synthesis,
          workspaceRoot: activeWorkspace.rootPath
        });

        const planRecord = {
          id: generatedPlan.id,
          plan: generatedPlan,
          targetDirectory,
          projectName: body.companyName || synthesis.projectName || 'Kurumsal İşletme',
          slug: path.basename(targetDirectory),
          fingerprint: synthesis.layoutFingerprint?.computedHash || generatedPlan.id,
          createdAt: Date.now(),
          status: 'ACTIVE',
          consumedAt: null,
          tenantId: body.tenantId || req.headers['x-tenant-id'] || null
        };
        corporatePlanRegistry.set(generatedPlan.id, planRecord);
        latestActivePlanId = generatedPlan.id;

        if (body.jobId) {
          const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
          authoritativeEngine.setJobPlan(body.jobId, generatedPlan, { tenantId });
        } else {
          legacyActivePlan = generatedPlan;
        }

        return sendJson(200, {
          success: true,
          generationMode: 'LEGACY_FALLBACK',
          layoutFamily: synthesis.layoutFamily,
          layoutFingerprint: synthesis.layoutFingerprint,
          imageDesignSpec: synthesis.imageDesignSpec || imageDesignSpec,
          referenceAnalysis: synthesis.referenceAnalysis || refAnalysis,
          fidelityMode: synthesis.fidelityMode || fidelityMode,
          referenceImagePath: body.referenceImagePath || null,
          designFingerprint: synthesis.layoutFingerprint,
          qaReport: generatedPlan.qaReport || null,
          informationArchitecture: generatedPlan.informationArchitecture || null,
          synthesis,
          plan: {
            intent: synthesis.description,
            analysis: `Kurumsal Proje Tasarlandı: '${synthesis.projectName}' (${synthesis.metadata.industry}). Düzen: ${synthesis.layoutFamily}. ${synthesis.files.length} dosya hazırlandı.`,
            proposedCommands: generatedPlan.expectedCommands,
            proposedFileChanges: generatedPlan.expectedFileChanges,
            proposedFileMutations: generatedPlan.authoritativeFileMutations,
            riskLevel: 'LOW',
            requiresApproval: true
          },
          authoritativePlanId: generatedPlan.id,
          jobId: body.jobId || null
        });
      }

      // 3.5c Invalidate Authoritative Corporate Plan API (FAZ 74.2 Stale Authority Protection)
      if (req.method === 'POST' && req.url === '/api/corporate/plan/invalidate') {
        const body = await readBody();
        const planId = body.planId || body.authoritativePlanId || latestActivePlanId;
        if (planId && corporatePlanRegistry.has(planId)) {
          const rec = corporatePlanRegistry.get(planId);
          rec.status = 'STALE';
        }
        if (legacyActivePlan && (!planId || legacyActivePlan.id === planId)) {
          legacyActivePlan = null;
        }
        if (latestActivePlanId === planId) {
          latestActivePlanId = null;
        }
        return sendJson(200, { success: true, invalidatedPlanId: planId });
      }

      // 3.5b Inspect & Modernize Legacy Website API
      if (req.method === 'POST' && req.url === '/api/corporate/inspect-site') {
        const body = await readBody();
        if (!body.url || typeof body.url !== 'string' || body.url.trim() === '') {
          return sendJson(400, {
            success: false,
            error: 'Site URL gereklidir (örneğin: https://falconenerji.com/)'
          });
        }

        try {
          const modernization = await inspectAndModernizeWebsite(body.url.trim(), {
            timeoutMs: body.timeoutMs || 10000
          });

          return sendJson(200, {
            success: true,
            url: modernization.url,
            spec: modernization.spec,
            extracted: modernization.rawExtracted,
            enriched: modernization.enriched
          });
        } catch (err) {
          if (err.message && err.message.includes('[SECURITY_BLOCKED]')) {
            return sendJson(403, {
              success: false,
              blocked: true,
              error: err.message
            });
          }
          return sendJson(500, {
            success: false,
            error: `Site incelenirken hata oluştu: ${err.message}`
          });
        }
      }

      // 3.5c Inspect & Modernize Google Maps Listing API
      if (req.method === 'POST' && req.url === '/api/corporate/inspect-maps') {
        const body = await readBody();
        if (!body.url || typeof body.url !== 'string' || body.url.trim() === '') {
          return sendJson(400, {
            success: false,
            error: 'Google Haritalar URL gereklidir (örneğin: https://maps.app.goo.gl/... veya https://www.google.com/maps/place/...)'
          });
        }

        try {
          const modernization = await inspectAndModernizeGoogleMaps(body.url.trim(), {
            timeoutMs: body.timeoutMs || 15000
          });

          return sendJson(200, {
            success: true,
            url: modernization.url,
            listing: modernization.listing,
            archetype: modernization.archetype,
            spec: modernization.spec,
            enriched: modernization.enriched
          });
        } catch (err) {
          return sendJson(500, {
            success: false,
            error: `Google Haritalar profili incelenirken hata oluştu: ${err.message}`
          });
        }
      }

      // 3.5d Autonomous From-Scratch Website Synthesis API (FAZ 73)
      if (req.method === 'POST' && req.url === '/api/corporate/synthesize') {
        const body = await readBody();
        try {
          let websiteData = null;
          let mapsData = null;

          // If websiteUrl provided, safely inspect
          if (body.websiteUrl && typeof body.websiteUrl === 'string' && body.websiteUrl.trim()) {
            try {
              websiteData = await inspectAndModernizeWebsite(body.websiteUrl.trim(), { timeoutMs: 10000 });
            } catch (wErr) {
              console.warn('[SYNTHESIS WEBPAGE SCRAPE WARNING]:', wErr.message);
            }
          }

          // If mapsUrl provided, safely inspect
          if (body.mapsUrl && typeof body.mapsUrl === 'string' && body.mapsUrl.trim()) {
            try {
              mapsData = await inspectAndModernizeGoogleMaps(body.mapsUrl.trim(), { timeoutMs: 15000 });
            } catch (mErr) {
              console.warn('[SYNTHESIS MAPS SCRAPE WARNING]:', mErr.message);
            }
          }

          const synthesisResult = await synthesizeAutonomousWebsite({
            generationMode: body.generationMode || GenerationMode.SYNTHESIS,
            manual: body.manual || body,
            websiteData,
            mapsData,
            options: {
              storageBaseDir: PROJECT_ROOT,
              skipBrowserRender: body.skipBrowserRender === true,
              requiredCapabilities: body.requiredCapabilities || [],
              referenceImage: body.referenceImage || null,
              referenceImagePath: body.referenceImagePath || null
            }
          });

          if (synthesisResult.blocked) {
            return sendJson(409, {
              success: false,
              blocked: true,
              generationId: synthesisResult.generationId,
              error: synthesisResult.error,
              capabilityValidation: synthesisResult.capabilityValidation
            });
          }

          return sendJson(200, {
            success: true,
            generationId: synthesisResult.generationId,
            generationMode: synthesisResult.generationMode,
            qualityGate: synthesisResult.qualityGate,
            referenceDesignMatch: synthesisResult.referenceDesignMatch || null,
            previewUrl: synthesisResult.report?.previewUrl,
            report: synthesisResult.report,
            proposalOnly: true,
            executionAuthorized: false
          });
        } catch (err) {
          return sendJson(500, {
            success: false,
            error: `Otonom web sitesi sentezi başarısız oldu: ${err.message}`
          });
        }
      }

      // 3.5e Independent Visual & Commercial Critic API (FAZ 74)
      if (req.method === 'POST' && req.url === '/api/corporate/critic') {
        const body = await readBody();
        try {
          const { generationId, runRevision } = body;
          if (!generationId || typeof generationId !== 'string') {
            return sendJson(400, {
              ok: false,
              success: false,
              error: 'generationId is required'
            });
          }

          const criticReport = await auditStoredDesign(generationId.trim(), {
            storageBaseDir: PROJECT_ROOT,
            runRevision: runRevision === true
          });

          return sendJson(200, {
            ok: true,
            success: true,
            generationId: criticReport.generationId,
            critic: {
              criticVersion: criticReport.criticVersion,
              overallScore: criticReport.overallScore,
              grade: criticReport.grade,
              qualityGate: criticReport.qualityGate,
              criticalCount: criticReport.criticalFindings.length,
              majorCount: criticReport.majorFindings.length,
              minorCount: criticReport.minorFindings.length,
              dimensionScores: criticReport.dimensionScores,
              findings: criticReport.criticalFindings.concat(criticReport.majorFindings, criticReport.minorFindings),
              revisionProposal: criticReport.revisionProposal,
              proposalOnly: true,
              executionAuthorized: false
            },
            proposalOnly: true,
            executionAuthorized: false
          });
        } catch (err) {
          return sendJson(500, {
            ok: false,
            success: false,
            error: `Independent critic audit failed: ${err.message}`
          });
        }
      }

      // 3.6 Corporate Portal Generation & Mutation API (/generate & /create)
      if (req.method === 'POST' && (req.url === '/api/corporate/generate' || req.url === '/api/corporate/create')) {
        const body = await readBody();
        if (!activeWorkspace) {
          activeWorkspace = createProjectWorkspace({ rootPath: PROJECT_ROOT });
        }

        let targetPlan = null;
        let planRecord = null;

        if (body.planId || body.authoritativePlanId) {
          const reqPlanId = body.planId || body.authoritativePlanId;
          planRecord = corporatePlanRegistry.get(reqPlanId);
          if (!planRecord) {
            throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Authoritative plan '${reqPlanId}' not found.`);
          }
          targetPlan = planRecord.plan;
        } else if (body.jobId) {
          const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
          authoritativeEngine.getJob(body.jobId, { tenantId });
          targetPlan = authoritativeEngine.getJobPlan(body.jobId, { tenantId });
          if (targetPlan?.id && corporatePlanRegistry.has(targetPlan.id)) {
            planRecord = corporatePlanRegistry.get(targetPlan.id);
          }
        } else {
          // Unkeyed request: resolve from latest active plan, fallback to legacyActivePlan
          if (latestActivePlanId && corporatePlanRegistry.has(latestActivePlanId)) {
            planRecord = corporatePlanRegistry.get(latestActivePlanId);
            targetPlan = planRecord.plan;
          } else {
            targetPlan = legacyActivePlan;
          }
        }

        if (!targetPlan) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: No authoritative plan exists for corporate generation.`);
        }

        // Rule: Explicit rejection of mutation when approval is false
        if (body.approval === false) {
          if (planRecord) {
            planRecord.status = 'FAILED';
          }
          if (legacyActivePlan && legacyActivePlan.id === targetPlan.id) {
            legacyActivePlan = null;
          }
          if (latestActivePlanId === targetPlan.id) {
            latestActivePlanId = null;
          }
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: User approval was rejected for corporate generation.`);
        }

        // FAZ 74.2: Stale & Replay Verifications
        if (planRecord) {
          if (planRecord.status === 'CONSUMED') {
            throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Replay execution blocked: Authoritative plan '${planRecord.id}' has already been consumed.`);
          }
          if (planRecord.status === 'EXPIRED' || planRecord.status === 'STALE' || planRecord.status === 'INVALIDATED' || planRecord.status === 'FAILED') {
            throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Stale plan blocked: Authoritative plan '${planRecord.id}' is ${planRecord.status} and cannot be executed.`);
          }
        }

        // FAZ 74.2: Cross-project authority binding guard
        if (body.targetDirectory || body.targetDir) {
          const reqTarget = validateCorporateTargetDirectory(body.targetDirectory || body.targetDir, activeWorkspace.rootPath);
          const boundTarget = planRecord ? planRecord.targetDirectory : targetPlan.metadata?.targetDirectory;
          if (boundTarget && boundTarget !== reqTarget) {
            throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Cross-project authority violation: Plan is bound to '${boundTarget}', cannot generate for '${reqTarget}'.`);
          }
        }

        if (body.companyName || body.projectName) {
          const reqName = (body.companyName || body.projectName).trim().toLowerCase();
          const boundName = (planRecord ? planRecord.projectName : targetPlan.metadata?.projectName || '').trim().toLowerCase();
          if (boundName && boundName !== reqName) {
            throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Cross-project authority violation: Plan is bound to '${planRecord?.projectName || targetPlan.metadata?.projectName}', cannot generate for '${body.companyName || body.projectName}'.`);
          }
        }

        let result;
        const corporateGen = createCorporateGenerator();
        try {
          result = await corporateGen.applyCorporatePlan({
            plan: targetPlan,
            workspaceRoot: activeWorkspace.rootPath,
            approval: body.approval !== false,
            dryRun: Boolean(body.dryRun)
          });
        } catch (applyErr) {
          if (planRecord) {
            planRecord.status = 'FAILED';
          }
          if (legacyActivePlan && legacyActivePlan.id === targetPlan.id) {
            legacyActivePlan = null;
          }
          if (latestActivePlanId === targetPlan.id) {
            latestActivePlanId = null;
          }
          throw applyErr;
        }

        // Lifecycle state transition: mark consumed or failed
        if (result.success && !body.dryRun) {
          if (planRecord) {
            planRecord.status = 'CONSUMED';
            planRecord.consumedAt = Date.now();
          }
          if (legacyActivePlan && legacyActivePlan.id === targetPlan.id) {
            legacyActivePlan = null;
          }
          if (latestActivePlanId === targetPlan.id) {
            latestActivePlanId = null;
          }
        } else if (!result.success) {
          if (planRecord) {
            planRecord.status = 'FAILED';
          }
          if (legacyActivePlan && legacyActivePlan.id === targetPlan.id) {
            legacyActivePlan = null;
          }
          if (latestActivePlanId === targetPlan.id) {
            latestActivePlanId = null;
          }
        }

        let started = null;
        const shouldAutoStart = body.autoStart === true || (body.autoStart !== false && !process.env.NODE_TEST_CONTEXT);
        if (result.success && !body.dryRun && shouldAutoStart) {
          const targetDirAbs = path.resolve(activeWorkspace.rootPath, result.targetDirectory);
          started = startProjectServer(targetDirAbs, 8080);
        }

        const files = activeWorkspace.listFiles ? activeWorkspace.listFiles() : [];

        return sendJson(200, {
          success: result.success,
          status: 'COMPLETED',
          result,
          files,
          referenceId: body.referenceId || targetPlan.synthesis?.referenceId || null,
          referenceImagePath: body.referenceImagePath || targetPlan.synthesis?.referenceImagePath || null,
          imageDesignSpec: body.imageDesignSpec || targetPlan.synthesis?.imageDesignSpec || null,
          referenceAnalysis: body.referenceAnalysis || targetPlan.synthesis?.referenceAnalysis || null,
          referenceImageFidelity: body.referenceImageFidelity || body.fidelityMode || targetPlan.synthesis?.fidelityMode || null,
          fidelityMode: body.fidelityMode || body.referenceImageFidelity || targetPlan.synthesis?.fidelityMode || null,
          running: Boolean(started?.success),
          port: started?.port || 8080,
          url: started?.url || 'http://localhost:8080/tr/',
          adminUrl: started?.adminUrl || 'http://localhost:8080/admin/login'
        });
      }

      // 3.7 Projects List API
      if (req.method === 'GET' && req.url === '/api/projects') {
        const root = activeWorkspace ? activeWorkspace.rootPath : PROJECT_ROOT;
        const projects = listProjects(root);
        return sendJson(200, {
          success: true,
          projects,
          activeProject: activeProjectProcess ? {
            id: activeProjectProcess.projectId,
            port: activeProjectProcess.port,
            startedAt: activeProjectProcess.startedAt
          } : null
        });
      }

      // 3.8 Start Project API
      if (req.method === 'POST' && req.url === '/api/projects/start') {
        const body = await readBody();
        const root = activeWorkspace ? activeWorkspace.rootPath : PROJECT_ROOT;
        const projectId = body.projectId || (body.targetDirectory ? path.basename(body.targetDirectory) : null);
        if (!projectId) {
          return sendJson(400, { success: false, error: 'projectId veya targetDirectory gereklidir.' });
        }
        const targetDirAbs = path.resolve(root, 'projeler', projectId);
        if (!fs.existsSync(targetDirAbs)) {
          return sendJson(404, { success: false, error: `Proje klasörü bulunamadı: ${targetDirAbs}` });
        }

        let projectPort = 8080;
        const projectJsonPath = path.join(targetDirAbs, 'project.json');
        if (fs.existsSync(projectJsonPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
            if (meta.port) projectPort = meta.port;
          } catch {}
        }

        const startRes = startProjectServer(targetDirAbs, body.port || projectPort);
        if (!startRes.success) {
          return sendJson(500, { success: false, error: startRes.error });
        }

        return sendJson(200, {
          success: true,
          projectId,
          port: startRes.port,
          url: startRes.url,
          adminUrl: startRes.adminUrl,
          message: `${projectId} başarıyla başlatıldı.`
        });
      }

      // 3.9 Stop Project API
      if (req.method === 'POST' && req.url === '/api/projects/stop') {
        stopRunningProject();
        return sendJson(200, {
          success: true,
          message: 'Proje sunucusu durduruldu.'
        });
      }

      // 3.9.0 Delete Project API
      if (req.method === 'POST' && req.url === '/api/projects/delete') {
        const body = await readBody();
        const root = activeWorkspace ? activeWorkspace.rootPath : PROJECT_ROOT;
        const projectId = body.projectId || (body.targetDirectory ? path.basename(body.targetDirectory) : null);
        if (!projectId) {
          return sendJson(400, { success: false, error: 'projectId parametresi gereklidir.' });
        }
        const delRes = deleteProject(root, projectId);
        return sendJson(delRes.success ? 200 : 400, delRes);
      }

      // 3.9.1 GrapesJS Web Builder Get Project Content API
      const projectContentMatch = req.url.match(/^\/api\/projects\/([^\/\?]+)\/content$/);
      if (req.method === 'GET' && projectContentMatch) {
        const root = activeWorkspace ? activeWorkspace.rootPath : PROJECT_ROOT;
        const projectId = decodeURIComponent(projectContentMatch[1]);
        const targetDirAbs = path.resolve(root, 'projeler', projectId);
        if (!fs.existsSync(targetDirAbs)) {
          return sendJson(404, { success: false, error: `Proje bulunamadı: ${projectId}` });
        }
        let html = '';
        const publicIndex = path.join(targetDirAbs, 'public', 'index.html');
        const homePhp = path.join(targetDirAbs, 'resources', 'views', 'frontend', 'home.php');
        if (fs.existsSync(publicIndex)) {
          html = fs.readFileSync(publicIndex, 'utf8');
        } else if (fs.existsSync(homePhp)) {
          html = fs.readFileSync(homePhp, 'utf8');
        }
        return sendJson(200, { success: true, projectId, html });
      }

      // 3.9.2 GrapesJS Web Builder Save Frontend API
      if (req.method === 'POST' && req.url === '/api/projects/save-frontend') {
        const body = await readBody();
        const root = activeWorkspace ? activeWorkspace.rootPath : PROJECT_ROOT;
        const projectId = body.projectId;
        if (!projectId) {
          return sendJson(400, { success: false, error: 'projectId is required' });
        }
        const targetDirAbs = path.resolve(root, 'projeler', projectId);
        if (!fs.existsSync(targetDirAbs)) {
          return sendJson(404, { success: false, error: `Proje bulunamadı: ${projectId}` });
        }
        if (body.html) {
          const publicIndex = path.join(targetDirAbs, 'public', 'index.html');
          fs.writeFileSync(publicIndex, body.html, 'utf8');
          const homePath = path.join(targetDirAbs, 'resources', 'views', 'frontend', 'home.php');
          if (fs.existsSync(path.dirname(homePath))) {
            fs.writeFileSync(homePath, body.html, 'utf8');
          }
        }
        return sendJson(200, { success: true, message: 'Tasarım başarıyla kaydedildi.' });
      }

      // 3.10 Autonomous Browser QA & Console Self-Healing API
      if (req.method === 'POST' && req.url === '/api/projects/browser-audit') {
        const body = await readBody();
        const root = activeWorkspace ? activeWorkspace.rootPath : PROJECT_ROOT;
        const projectId = body.projectId || (body.targetDirectory ? path.basename(body.targetDirectory) : null) || (activeProjectProcess ? activeProjectProcess.projectId : null);
        if (!projectId) {
          return sendJson(400, { success: false, error: 'projectId belirtilmedi veya çalışan aktif bir proje yok.' });
        }

        const targetDirAbs = path.resolve(root, 'projeler', projectId);
        if (!fs.existsSync(targetDirAbs)) {
          return sendJson(404, { success: false, error: `Proje klasörü bulunamadı: ${targetDirAbs}` });
        }

        let projectPort = 8080;
        const projectJsonPath = path.join(targetDirAbs, 'project.json');
        if (fs.existsSync(projectJsonPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
            if (meta.port) projectPort = meta.port;
          } catch {}
        }
        if (body.port) projectPort = body.port;

        // Ensure project server is started if not already running on this project
        if (!activeProjectProcess || activeProjectProcess.projectId !== projectId) {
          startProjectServer(targetDirAbs, projectPort);
          await new Promise(r => setTimeout(r, 1000));
        }

        try {
          const auditResult = await runSelfHealingAudit({
            projectDir: targetDirAbs,
            port: projectPort,
            baseUrl: `http://localhost:${projectPort}`,
            maxIterations: body.maxIterations || 3,
            launchUserBrowser: body.launchUserBrowser === true,
            pageWaitMs: body.pageWaitMs || 2500,
            maxPages: body.maxPages || 6,
            restartServerFn: async () => {
              stopRunningProject();
              await new Promise(r => setTimeout(r, 600));
              startProjectServer(targetDirAbs, projectPort);
            }
          });

          return sendJson(200, {
            success: auditResult.success,
            status: auditResult.status,
            message: auditResult.message,
            iterations: auditResult.iterations,
            history: auditResult.history,
            remainingErrors: auditResult.remainingErrors
          });
        } catch (auditErr) {
          return sendJson(500, {
            success: false,
            error: auditErr.message
          });
        }
      }

      // 3.10.2 Visual Intelligence & Quality Audit APIs (FAZ 71)
      if (req.method === 'POST' && req.url === '/api/visual/audit') {
        const body = await readBody();
        const url = body.url ? String(body.url).trim() : null;
        if (!url) {
          return sendJson(400, { success: false, error: 'url parametresi zorunludur' });
        }

        try {
          // 1. Capture responsive viewports (Desktop, Tablet, Mobile)
          const responsive = await captureResponsiveViewports(url, { timeoutMs: 15000 });

          // 2. Deterministic deep layout/typography/color analysis
          const deterministic = await analyzeRenderedUrl(url, { viewport: { width: 1440, height: 900 } });

          // 3. AI Visual Critic on Desktop screenshot
          const desktopCapturePath = responsive.viewports?.desktop?.capture?.filePath;
          const critic = await evaluateVisualDesign({
            screenshot: desktopCapturePath,
            deterministicMetrics: deterministic,
            providerGateway: authoritativeGateway
          });

          // 4. Composite Explainable Scoring
          const scoreReport = computeCompositeVisualScore({
            deterministicMetrics: deterministic,
            criticEvaluation: critic
          });

          const auditId = `va-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const auditRecord = {
            id: auditId,
            url,
            createdAt: new Date().toISOString(),
            responsive: {
              desktop: { file: responsive.viewports?.desktop?.capture?.filePath, width: 1440, height: 900 },
              tablet: { file: responsive.viewports?.tablet?.capture?.filePath, width: 1024, height: 768 },
              mobile: { file: responsive.viewports?.mobile?.capture?.filePath, width: 390, height: 844 }
            },
            deterministic,
            critic,
            score: scoreReport
          };

          visualAuditStore.set(auditId, auditRecord);
          visualAuditHistory.unshift({
            id: auditId,
            url,
            overallScore: scoreReport.overallScore,
            qualityLevel: scoreReport.qualityLevel,
            aiTemplateRisk: scoreReport.aiTemplateRisk,
            createdAt: auditRecord.createdAt
          });
          if (visualAuditHistory.length > 20) visualAuditHistory.pop();

          return sendJson(200, {
            success: true,
            audit: auditRecord
          });
        } catch (err) {
          return sendJson(500, { success: false, error: err.message });
        }
      }

      if (req.method === 'GET' && req.url === '/api/visual/history') {
        return sendJson(200, {
          success: true,
          history: visualAuditHistory
        });
      }

      if (req.method === 'POST' && req.url === '/api/visual/baseline') {
        const body = await readBody();
        const url = body.url ? String(body.url).trim() : null;
        if (!url) {
          return sendJson(400, { success: false, error: 'url parametresi zorunludur' });
        }

        try {
          const baseline = await createVisualBaseline(url, { baselineId: body.baselineId });
          visualBaselineStore.set(baseline.baselineId, baseline);
          return sendJson(200, { success: true, baseline });
        } catch (err) {
          return sendJson(500, { success: false, error: err.message });
        }
      }

      if (req.method === 'POST' && req.url === '/api/visual/diff') {
        const body = await readBody();
        const url = body.url ? String(body.url).trim() : null;
        const baselineId = body.baselineId ? String(body.baselineId).trim() : null;
        if (!url || !baselineId) {
          return sendJson(400, { success: false, error: 'url ve baselineId zorunludur' });
        }

        const baseline = visualBaselineStore.get(baselineId);
        if (!baseline) {
          return sendJson(404, { success: false, error: `Baseline bulunamadı: ${baselineId}` });
        }

        try {
          const diffResult = await compareWithBaseline(url, baseline.manifestPath);
          return sendJson(200, { success: true, diff: diffResult });
        } catch (err) {
          return sendJson(500, { success: false, error: err.message });
        }
      }

      if (req.method === 'GET' && req.url.startsWith('/api/visual/image')) {
        const parsedUrl = new URL(req.url, 'http://localhost');
        const filePath = parsedUrl.searchParams.get('path');
        if (!filePath) {
          return sendJson(400, { success: false, error: 'path zorunludur' });
        }

        const normalized = path.normalize(filePath);
        // Security check: Must reside within os.tmpdir() and end with .png
        const tmp = path.normalize(os.tmpdir());
        if (!normalized.startsWith(tmp) || !normalized.endsWith('.png') || !fs.existsSync(normalized)) {
          return sendJson(403, { success: false, error: 'Görsel erişim engellendi veya dosya bulunamadı' });
        }

        try {
          const imgBuf = fs.readFileSync(normalized);
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': imgBuf.length,
            'Cache-Control': 'no-cache'
          });
          return res.end(imgBuf);
        } catch (readErr) {
          return sendJson(500, { success: false, error: readErr.message });
        }
      }

      // 3.11 AI Cost & Quota Telemetry API
      if (req.method === 'GET' && req.url === '/api/ai/cost-telemetry') {
        const summary = authoritativeBudget ? authoritativeBudget.getSummary() : { totalTokens: 0, cumulativeCostUsd: 0 };
        return sendJson(200, {
          success: true,
          budget: summary,
          taskTiers: [
            { id: 'TIER_1_LIGHT', name: 'Tier 1: Hafif İşler & Tarama', models: 'Gemini 2.0 Flash / DeepSeek / Ollama', cost: 'Ücretsiz / Minimal ($0.075/Mtok)', desc: 'Dosya tarama, özetleme, SEO meta, i18n çeviri ve log analizi' },
            { id: 'TIER_2_BUILDER', name: 'Tier 2: Kodlama & Düzenleme', models: 'DeepSeek V3 / Groq / Qwen', cost: 'Ekonomik ($0.14/Mtok)', desc: 'Fonksiyon üretimi, diff yazımı, CSS ve test kodlaması' },
            { id: 'TIER_3_ARCHITECT', name: 'Tier 3: Mimar & Güvenlik', models: 'Claude 3.5 Sonnet / GPT-4o / Gemini Pro', cost: 'Premium ($3.00/Mtok)', desc: 'Büyük ölçekli planlama, güvenlik denetimi, karmaşık orkestrasyon' }
          ],
          quotaProviders: [
            { name: 'Google AI Studio (Gemini)', status: 'ONLINE', quota: 'Günlük Ücretsiz Kota Aktif', speed: 'Çok Hızlı' },
            { name: 'DeepSeek Open Engine', status: 'ONLINE', quota: 'Ekonomik Token Havuzu', speed: 'Yüksek' },
            { name: 'Groq Cloud Acceleration', status: 'ONLINE', quota: 'Ultra-Düşük Gecikme', speed: '500+ tok/s' },
            { name: 'Local Ollama / vLLM', status: 'HAZIR', quota: 'Sınırsız / Çevrimdışı', speed: 'Donanım Bağımlı' }
          ],
          estimatedSavingsPercent: 88,
          timestamp: new Date().toISOString()
        });
      }

      // 3.12 Multi-Agent Project Task Dispatcher API
      if (req.method === 'POST' && req.url === '/api/projects/dispatch-task') {
        const body = await readBody();
        const root = activeWorkspace ? activeWorkspace.rootPath : PROJECT_ROOT;
        const projectId = body.projectId || (body.targetDirectory ? path.basename(body.targetDirectory) : null);
        const taskPrompt = (body.prompt || body.taskPrompt || '').trim();

        if (!projectId) {
          return sendJson(400, { success: false, error: 'projectId veya targetDirectory zorunludur.' });
        }
        if (!taskPrompt) {
          return sendJson(400, { success: false, error: 'taskPrompt (yapılacak işlem talimatı) boş olamaz.' });
        }

        let targetDirAbs = path.resolve(root, 'projeler', projectId);
        if (!fs.existsSync(targetDirAbs)) {
          targetDirAbs = path.resolve(root, 'projects', projectId);
        }
        if (!fs.existsSync(targetDirAbs) && body.targetDirectory) {
          targetDirAbs = path.resolve(root, body.targetDirectory);
        }
        if (!fs.existsSync(targetDirAbs)) {
          return sendJson(404, { success: false, error: `Proje dizini bulunamadı: ${targetDirAbs}` });
        }

        try {
          const squadResult = await runAgentSquadTask({
            projectDir: targetDirAbs,
            taskPrompt,
            companyName: projectId,
            budgetTracker: authoritativeBudget
          });

          return sendJson(200, {
            success: squadResult.success,
            projectId,
            taskPrompt,
            totalDurationMs: squadResult.totalDurationMs,
            modifiedFiles: squadResult.modifiedFiles,
            steps: squadResult.steps,
            estimatedCostSavedUsd: squadResult.estimatedCostSavedUsd
          });
        } catch (squadErr) {
          return sendJson(500, {
            success: false,
            error: squadErr.message
          });
        }
      }

      // 3.13 Google Maps & Local SEO Auditor API (ONLUNET LocalRadar)
      if (req.method === 'POST' && req.url === '/api/maps/audit') {
        const body = await readBody();
        const targetUrl = (body.url || body.targetUrl || '').trim();

        if (!targetUrl) {
          return sendJson(400, { success: false, error: 'Google Harita bağlantısı (URL) zorunludur.' });
        }

        try {
          // 1. Scrape listing via resilient CDP / URL resolver
          const listing = await scrapeGoogleMapsListing(targetUrl);

          // 2. Perform 100-point audit & cross-check with website
          const auditResult = await auditGoogleMapsListing(listing);

          const auditId = 'map-' + Date.now().toString(36);
          const historyEntry = {
            id: auditId,
            name: listing.name,
            url: targetUrl,
            category: listing.category,
            totalScore: auditResult.totalScore,
            grade: auditResult.grade,
            gradeLabel: auditResult.gradeLabel,
            gradeColor: auditResult.gradeColor,
            criticalCount: auditResult.criticalIssues.length,
            timestamp: auditResult.timestamp
          };

          mapsAuditHistory.unshift(historyEntry);
          if (mapsAuditHistory.length > 25) mapsAuditHistory.pop();
          mapsAuditStore.set(auditId, auditResult);

          return sendJson(200, {
            success: true,
            id: auditId,
            ...auditResult
          });
        } catch (auditErr) {
          return sendJson(500, {
            success: false,
            error: auditErr.message
          });
        }
      }

      if (req.method === 'GET' && req.url === '/api/maps/history') {
        return sendJson(200, {
          success: true,
          history: mapsAuditHistory
        });
      }

      if (req.method === 'GET' && req.url.startsWith('/api/maps/export/')) {
        const id = req.url.replace('/api/maps/export/', '');
        const record = mapsAuditStore.get(id);
        if (!record) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('Denetim raporu bulunamadı.');
        }

        const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yerel SEO & Harita Denetim Raporu - ${record.listing.name}</title>
  <style>
    :root { --primary: #2563eb; --bg: #f8fafc; --card: #ffffff; --text: #1e293b; --border: #e2e8f0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 30px; margin: 0; }
    .container { max-width: 900px; margin: 0 auto; background: var(--card); border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border); padding-bottom: 20px; margin-bottom: 30px; }
    .score-badge { font-size: 3rem; font-weight: 800; color: ${record.gradeColor}; }
    .dim-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 15px; margin: 25px 0; }
    .dim-card { background: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; }
    .dim-val { font-size: 1.4rem; font-weight: 700; color: var(--primary); }
    .dim-label { font-size: 0.8rem; color: #64748b; margin-top: 4px; }
    .issue-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 12px; border-radius: 4px; }
    .opt-box { background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-top: 20px; }
    pre { background: #0f172a; color: #38bdf8; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 0.85rem; }
    @media print { body { padding: 0; background: #fff; } .container { box-shadow: none; padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1 style="margin:0 0 8px 0; font-size: 1.6rem;">📍 ONLUNET LocalRadar™ Yerel SEO Denetimi</h1>
        <h2 style="margin:0; font-size: 1.2rem; color: #475569;">${record.listing.name}</h2>
        <div style="font-size: 0.85rem; color: #64748b; margin-top: 6px;">Kategori: <strong>${record.listing.category}</strong> | Puan: <strong>${record.listing.rating} ⭐ (${record.listing.reviewCount} Yorum)</strong></div>
      </div>
      <div style="text-align: right;">
        <div class="score-badge">${record.totalScore}<span style="font-size: 1.5rem;">/100</span></div>
        <div style="font-weight: 600; color: ${record.gradeColor};">${record.grade} — ${record.gradeLabel}</div>
      </div>
    </div>

    <div class="dim-grid">
      <div class="dim-card"><div class="dim-val">${record.scores.categoryAndIdentity}/25</div><div class="dim-label">Kategori & Kimlik</div></div>
      <div class="dim-card"><div class="dim-val">${record.scores.napAndWebsite}/25</div><div class="dim-label">NAP & Web Uyumu</div></div>
      <div class="dim-card"><div class="dim-val">${record.scores.reviewsAndReputation}/20</div><div class="dim-label">Yorum & İtibar</div></div>
      <div class="dim-card"><div class="dim-val">${record.scores.visualsAndMedia}/15</div><div class="dim-label">Görsel Varlık</div></div>
      <div class="dim-card"><div class="dim-val">${record.scores.engagementAndPosts}/15</div><div class="dim-label">Etkileşim & Yayın</div></div>
    </div>

    <h3>⚠️ Kritik Eksikler & Acil Düzeltmeler</h3>
    ${record.criticalIssues.length === 0 ? '<p style="color:#10b981;">Tebrikler! Kritik bir eksik bulunamadı.</p>' : record.criticalIssues.map(i => `
      <div class="issue-box">
        <strong>${i.title}</strong> [${i.level}]
        <div style="font-size: 0.9rem; margin-top: 4px; color: #334155;">${i.description}</div>
      </div>
    `).join('')}

    <h3>✨ Yapay Zeka Tarafından Üretilen Hazır Düzeltme Paketi</h3>
    <div class="opt-box">
      <h4>1. Optimize Edilmiş 750 Karakterlik İşletme Açıklaması</h4>
      <p style="font-size: 0.95rem; line-height: 1.6; background: #fff; padding: 12px; border: 1px dashed var(--border); border-radius: 6px;">${record.optimizations.optimizedDescription}</p>
      
      <h4>2. Önerilen İkincil Kategoriler</h4>
      <p style="font-size: 0.95rem;">${record.optimizations.suggestedSecondaries.join(' • ')}</p>

      <h4>3. Web Sitesi İçin LocalBusiness JSON-LD Kodu</h4>
      <pre><code>${record.optimizations.localBusinessJsonLd.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
    </div>

    <div style="margin-top: 30px; text-align: center;" class="no-print">
      <button onclick="window.print()" style="background: var(--primary); color: #fff; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; cursor: pointer;">🖨️ Raporu Yazdır / PDF Olarak Kaydet</button>
    </div>
  </div>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
      }

      // 3.14 Comprehensive Web & Technical SEO Auditor API (ONLUNET SEO Radar™)
      if (req.method === 'POST' && req.url === '/api/seo/audit') {
        const body = await readBody();
        const targetUrl = (body.url || body.targetUrl || '').trim();

        if (!targetUrl) {
          return sendJson(400, { success: false, error: 'Web sitesi bağlantısı (URL) zorunludur.' });
        }

        try {
          // 1. Scrape via Dual-Engine (Fast HTTP + CDP fallback)
          const scrapedData = await scrapeWebsiteForSeo(targetUrl, { forceCdp: Boolean(body.forceCdp) });

          // 2. Compute 100-point multi-dimensional audit, 2026 GEO & AI Remediation package
          const auditResult = await auditWebsiteSeo(scrapedData);

          // 3. Detect if target matches any local project in projeler/
          let isLocalProject = false;
          let matchedProjectSlug = null;
          try {
            const urlObj = new URL(targetUrl);
            const targetPort = urlObj.port ? Number(urlObj.port) : (urlObj.protocol === 'https:' ? 443 : 80);
            const projDir = path.resolve(PROJECT_ROOT, 'projeler');

            if (fs.existsSync(projDir)) {
              const entries = fs.readdirSync(projDir, { withFileTypes: true });

              if (activeProjectProcess && (targetPort === activeProjectProcess.port || targetUrl.includes(activeProjectProcess.projectId))) {
                isLocalProject = true;
                matchedProjectSlug = activeProjectProcess.projectId;
              } else {
                const pageTitleLow = (auditResult.aiPackage?.inferredIdentity?.name || '').toLowerCase();
                for (const ent of entries) {
                  if (!ent.isDirectory()) continue;
                  const slugClean = ent.name.replace(/-/g, ' ').toLowerCase();
                  if (targetUrl.includes(ent.name) || (pageTitleLow && (pageTitleLow.includes(slugClean) || slugClean.includes(pageTitleLow)))) {
                    isLocalProject = true;
                    matchedProjectSlug = ent.name;
                    break;
                  }
                }

                if (!matchedProjectSlug) {
                  for (const ent of entries) {
                    if (!ent.isDirectory()) continue;
                    const pjPath = path.join(projDir, ent.name, 'project.json');
                    if (fs.existsSync(pjPath)) {
                      try {
                        const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
                        if (pj.port && targetPort === pj.port) {
                          isLocalProject = true;
                          matchedProjectSlug = ent.name;
                          break;
                        }
                      } catch {}
                    }
                  }
                }
              }
            }
          } catch {}

          const auditId = 'seo-' + Date.now().toString(36);
          const historyEntry = {
            id: auditId,
            url: auditResult.url,
            name: auditResult.aiPackage?.inferredIdentity?.name || 'Web Sitesi',
            totalScore: auditResult.totalScore,
            grade: auditResult.grade,
            gradeLabel: auditResult.gradeLabel,
            gradeColor: auditResult.gradeColor,
            criticalCount: auditResult.criticalIssues.length,
            isLocalProject,
            projectSlug: matchedProjectSlug,
            timestamp: new Date().toISOString()
          };

          seoAuditHistory.unshift(historyEntry);
          if (seoAuditHistory.length > 30) seoAuditHistory.pop();
          seoAuditStore.set(auditId, { ...auditResult, isLocalProject, projectSlug: matchedProjectSlug });

          return sendJson(200, {
            success: true,
            id: auditId,
            isLocalProject,
            projectSlug: matchedProjectSlug,
            ...auditResult
          });
        } catch (seoErr) {
          return sendJson(500, {
            success: false,
            error: seoErr.message
          });
        }
      }

      if (req.method === 'GET' && req.url === '/api/seo/history') {
        return sendJson(200, {
          success: true,
          history: seoAuditHistory
        });
      }

      if (req.method === 'GET' && req.url.startsWith('/api/seo/export/')) {
        const id = req.url.replace('/api/seo/export/', '');
        const record = seoAuditStore.get(id);
        if (!record) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('SEO Denetim raporu bulunamadı.');
        }

        const reportName = record.aiPackage?.inferredIdentity?.name || 'Web Sitesi';
        const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kapsamlı SEO & Teknik Denetim Raporu - ${reportName}</title>
  <style>
    :root { --primary: #0284c7; --bg: #f8fafc; --card: #ffffff; --text: #1e293b; --border: #e2e8f0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 30px; margin: 0; }
    .container { max-width: 960px; margin: 0 auto; background: var(--card); border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border); padding-bottom: 20px; margin-bottom: 30px; }
    .score-badge { font-size: 3.2rem; font-weight: 800; color: ${record.gradeColor}; }
    .dim-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin: 25px 0; }
    .dim-card { background: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; }
    .dim-val { font-size: 1.4rem; font-weight: 700; color: var(--primary); }
    .dim-label { font-size: 0.8rem; color: #64748b; margin-top: 4px; }
    .issue-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 12px; border-radius: 4px; }
    .opt-box { background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 22px; margin-top: 20px; }
    .geo-box { background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; border-radius: 4px; margin: 20px 0; }
    .roi-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 18px; border-radius: 8px; margin: 20px 0; }
    pre { background: #0f172a; color: #38bdf8; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 0.85rem; }
    @media print { body { padding: 0; background: #fff; } .container { box-shadow: none; padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1 style="margin:0 0 8px 0; font-size: 1.6rem; color: #0f172a;">🔍 ONLUNET OMNI-SEO™ Kapsamlı Web Denetim Raporu</h1>
        <h2 style="margin:0; font-size: 1.25rem; color: #334155;">${reportName}</h2>
        <div style="font-size: 0.85rem; color: #64748b; margin-top: 6px;">URL: <strong>${record.url}</strong> | Yanıt Süresi: <strong>${record.responseTimeMs} ms</strong></div>
      </div>
      <div style="text-align: right;">
        <div class="score-badge">${record.totalScore}<span style="font-size: 1.5rem;">/100</span></div>
        <div style="font-weight: 700; font-size: 1.1rem; color: ${record.gradeColor};">${record.grade} — ${record.gradeLabel}</div>
      </div>
    </div>

    <!-- 5 Dimensions Scorecard -->
    <div class="dim-grid">
      <div class="dim-card"><div class="dim-val">${record.scores?.technical || 0}/25</div><div class="dim-label">Teknik & Taranabilirlik</div></div>
      <div class="dim-card"><div class="dim-val">${record.scores?.onPage || 0}/25</div><div class="dim-label">Sayfa İçi (On-Page)</div></div>
      <div class="dim-card"><div class="dim-val">${record.scores?.content || 0}/20</div><div class="dim-label">İçerik & E-E-A-T</div></div>
      <div class="dim-card"><div class="dim-val">${record.scores?.schema || 0}/15</div><div class="dim-label">Yapılandırılmış Veri</div></div>
      <div class="dim-card"><div class="dim-val">${record.scores?.speedAndGeo || 0}/15</div><div class="dim-label">Hız & 2026 GEO</div></div>
    </div>

    <!-- 2026 GEO Readiness -->
    <div class="geo-box">
      <h3 style="margin:0 0 6px 0; color: #166534; font-size: 1.05rem;">🤖 2026 Google Gemini AI Overviews (GEO) Hazırlığı: ${record.geoReadiness?.score || 70}/100 [${record.geoReadiness?.quotabilityStatus || 'Hazır'}]</h3>
      <p style="margin:0; font-size: 0.9rem; color: #15803d; line-height: 1.5;">${record.geoReadiness?.recommendation || ''}</p>
    </div>

    <!-- Financial ROI Box -->
    <div class="roi-box">
      <h3 style="margin:0 0 6px 0; color: #1e40af; font-size: 1.05rem;">💰 C-Level Finansal Değerleme & Google Ads Tasarrufu</h3>
      <p style="margin:0; font-size: 0.92rem; color: #1e3a8a; line-height: 1.6;">${record.aiPackage?.financialRoi?.roiSummaryText || ''}</p>
    </div>

    <!-- Critical Issues -->
    <h3>⚠️ Kritik Hatalar & Düzeltmeler</h3>
    ${record.criticalIssues?.length === 0 ? '<p style="color:#10b981; font-weight:600;">✅ Tebrikler! Web sitenizde kritik bir SEO engeli tespit edilmedi.</p>' : record.criticalIssues?.map(i => `
      <div class="issue-box">
        <strong>${i.title}</strong> [${i.level || 'ÖNEMLİ'}]
        <div style="font-size: 0.9rem; margin-top: 4px; color: #334155;">${i.description}</div>
      </div>
    `).join('')}

    <!-- AI Remediation Package -->
    <h3>✨ Yapay Zeka Hazır Düzeltme Paketi</h3>
    <div class="opt-box">
      <h4>1. Optimize Edilmiş 60 Karakterlik SEO Başlığı (Title)</h4>
      <p style="font-size: 0.95rem; font-weight: 600; background: #fff; padding: 10px 14px; border: 1px dashed var(--border); border-radius: 6px;">${record.aiPackage?.optimizedTitle || ''}</p>
      
      <h4>2. Tıklama Odaklı Meta Açıklaması (Meta Description)</h4>
      <p style="font-size: 0.95rem; background: #fff; padding: 10px 14px; border: 1px dashed var(--border); border-radius: 6px; line-height: 1.5;">${record.aiPackage?.optimizedDescription || ''}</p>

      <h4>3. 2026 GEO Doğrudan Cevap Bloğu (Direct Answer Snippet)</h4>
      <p style="font-size: 0.9rem; background: #fff; padding: 10px 14px; border: 1px dashed var(--border); border-radius: 6px; line-height: 1.5;">${record.aiPackage?.geoDirectSnippet || ''}</p>

      <h4>4. Organization & FAQPage JSON-LD Şeması</h4>
      <pre><code>${(record.aiPackage?.organizationSchemaJson || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
      <pre><code>${(record.aiPackage?.faqSchemaJson || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
    </div>

    <div style="margin-top: 30px; text-align: center;" class="no-print">
      <button onclick="window.print()" style="background: var(--primary); color: #fff; border: none; padding: 12px 26px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 1rem;">🖨️ Raporu Yazdır / PDF Olarak Kaydet</button>
    </div>
  </div>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
      }

      // Self-Healing Auto-Remediation endpoint for local projects
      if (req.method === 'POST' && req.url === '/api/seo/heal') {
        const body = await readBody();
        const auditId = body.id;
        const projectSlug = body.projectSlug;

        if (!auditId || !projectSlug) {
          return sendJson(400, { success: false, error: 'auditId ve projectSlug zorunludur.' });
        }

        const record = seoAuditStore.get(auditId);
        if (!record || !record.aiPackage) {
          return sendJson(404, { success: false, error: 'Denetim kaydı bulunamadı.' });
        }

        const projectDir = path.resolve(PROJECT_ROOT, 'projeler', projectSlug);
        const healResult = await autoHealProjectSeo(projectDir, record.aiPackage);

        return sendJson(200, {
          success: healResult.success,
          modifications: healResult.modifications,
          message: healResult.message
        });
      }

      // FAZ 71: Visual Intelligence & AI Visual Critic Boundary
      // POST /api/v1/visual/analyze - Deep visual screenshot & layout analysis
      if (req.method === 'POST' && (req.url === '/api/v1/visual/analyze' || req.url === '/api/visual/analyze')) {
        try {
          const body = await readBody();
          const targetUrl = body.url || body.pageUrl || null;
          const imagePath = body.imagePath || null;
          const imageBase64 = body.imageBase64 || null;

          if (!targetUrl && !imagePath && !imageBase64) {
            return sendJson(400, {
              success: false,
              error: 'En az bir görsel (imagePath/imageBase64) veya erişilebilir web sitesi URL adresi belirtilmelidir.'
            });
          }

          const auditId = `vis-${Date.now()}`;
          const analysis = await analyzeScreenshot({
            imagePath,
            imageBase64,
            pageUrl: targetUrl,
            viewport: body.viewport,
            pageType: body.pageType || 'corporate',
            analysisProfile: body.analysisProfile || body.profile || 'corporate',
            model: body.model,
            timeoutMs: body.timeoutMs || 15000,
            providerGateway: aiGateway
          });

          const historyRecord = {
            id: auditId,
            url: targetUrl || 'Screenshot Analysis',
            overallScore: analysis.overallScore,
            qualityLevel: analysis.qualityLevel,
            aiTemplateRisk: analysis.aiTemplateRisk,
            profile: analysis.profile,
            analysisMode: analysis.analysisMode,
            timestamp: analysis.analyzedAt
          };

          visualAuditHistory.unshift(historyRecord);
          if (visualAuditHistory.length > 25) visualAuditHistory.pop();
          visualAuditStore.set(auditId, { id: auditId, ...analysis, url: targetUrl });

          return sendJson(200, {
            success: true,
            id: auditId,
            analysis
          });
        } catch (err) {
          return sendJson(400, {
            success: false,
            error: err.message
          });
        }
      }

      // GET /api/visual/history - Retrieve visual audit history
      if (req.method === 'GET' && req.url === '/api/visual/history') {
        return sendJson(200, {
          success: true,
          history: visualAuditHistory
        });
      }

      // GET /api/visual/profiles - List available analysis profiles
      if (req.method === 'GET' && req.url === '/api/visual/profiles') {
        return sendJson(200, {
          success: true,
          profiles: ANALYSIS_PROFILES
        });
      }

      // FAZ 72: Controlled Visual Refactoring & Design System Token Sync Endpoints
      // POST /api/v1/visual/proposals - Generate structured proposals from an analysis
      if (req.method === 'POST' && (req.url === '/api/v1/visual/proposals' || req.url === '/api/visual/proposals')) {
        try {
          const body = await readBody();
          let analysis = body.analysis || null;
          if (!analysis && body.analysisId) {
            analysis = visualAuditStore.get(body.analysisId);
          }
          if (!analysis) {
            return sendJson(400, { success: false, error: 'Analiz verisi (analysis veya analysisId) gereklidir.' });
          }

          const targetFilePath = body.targetFilePath || 'src/app/public/index.html';
          const workspaceRoot = activeWorkspace ? activeWorkspace.rootPath : PROJECT_ROOT;
          const resolvedPath = path.isAbsolute(targetFilePath) ? targetFilePath : path.resolve(workspaceRoot, targetFilePath);
          let cssText = body.cssText || '';
          if (!cssText && fs.existsSync(resolvedPath)) {
            cssText = fs.readFileSync(resolvedPath, 'utf8');
          }

          const proposals = mapFindingsToProposals({
            analysis,
            cssText,
            targetFilePath,
            projectId: body.projectId || 'default'
          });

          for (const prop of proposals) {
            visualProposalStore.set(prop.proposalId, prop);
          }

          return sendJson(200, {
            success: true,
            count: proposals.length,
            proposals
          });
        } catch (err) {
          return sendJson(400, { success: false, error: err.message });
        }
      }

      // GET /api/v1/visual/proposals - List all generated proposals
      if (req.method === 'GET' && (req.url === '/api/v1/visual/proposals' || req.url === '/api/visual/proposals')) {
        return sendJson(200, {
          success: true,
          proposals: Array.from(visualProposalStore.values())
        });
      }

      // GET /api/v1/visual/proposals/:id - Get single proposal
      if (req.method === 'GET' && req.url.startsWith('/api/v1/visual/proposals/')) {
        const id = req.url.slice('/api/v1/visual/proposals/'.length).split('?')[0].split('/')[0];
        const proposal = visualProposalStore.get(id);
        if (!proposal) {
          return sendJson(404, { success: false, error: `Proposal bulunamadı: ${id}` });
        }
        return sendJson(200, { success: true, proposal });
      }

      // POST /api/v1/visual/proposals/:id/validate - Validate schema and stale state
      if (req.method === 'POST' && req.url.startsWith('/api/v1/visual/proposals/') && req.url.endsWith('/validate')) {
        try {
          const parts = req.url.split('/');
          const id = parts[parts.indexOf('proposals') + 1];
          const proposal = visualProposalStore.get(id);
          if (!proposal) {
            return sendJson(404, { success: false, error: `Proposal bulunamadı: ${id}` });
          }

          validateDesignProposal(proposal);
          const workspaceRoot = activeWorkspace ? activeWorkspace.rootPath : PROJECT_ROOT;
          const resolvedTarget = path.isAbsolute(proposal.targetFilePath)
            ? proposal.targetFilePath
            : path.resolve(workspaceRoot, proposal.targetFilePath);

          let isStale = false;
          if (fs.existsSync(resolvedTarget)) {
            const currentContent = fs.readFileSync(resolvedTarget, 'utf8');
            for (const change of proposal.changes) {
              const match = verifyTokenMatches(currentContent, change.target, change.before);
              if (!match.matches) {
                isStale = true;
                break;
              }
            }
          }

          return sendJson(200, {
            success: true,
            proposalId: id,
            valid: true,
            isStale
          });
        } catch (err) {
          return sendJson(400, { success: false, error: err.message });
        }
      }

      // POST /api/v1/visual/proposals/:id/authorize - Authorize a proposal for execution
      if (req.method === 'POST' && req.url.includes('/proposals/') && req.url.endsWith('/authorize')) {
        try {
          const parts = req.url.split('/');
          const id = parts[parts.indexOf('proposals') + 1];
          const proposal = visualProposalStore.get(id);
          if (!proposal) {
            return sendJson(404, { success: false, error: `Proposal bulunamadı: ${id}` });
          }

          const body = await readBody();
          const authContract = createExecutionAuthorizationContract({
            id: `auth-prop-${Date.now()}`,
            requestId: `req-prop-${id}`,
            taskId: `task-refactor-${id}`,
            planId: `plan-refactor-${id}`,
            admissionId: `adm-${Date.now()}`,
            handoffId: `hand-${Date.now()}`,
            decision: AuthorizationDecision.AUTHORIZED,
            reason: body.reason || 'Human operator approved design token refactoring proposal',
            authorizedContext: {
              workingDirectory: activeWorkspace ? activeWorkspace.rootPath : PROJECT_ROOT,
              expectedCommands: []
            }
          });

          return sendJson(200, {
            success: true,
            proposalId: id,
            authorization: authContract
          });
        } catch (err) {
          return sendJson(400, { success: false, error: err.message });
        }
      }

      // POST /api/v1/visual/proposals/:id/execute - Execute authorized proposal with regression guard
      if (req.method === 'POST' && req.url.includes('/proposals/') && req.url.endsWith('/execute')) {
        try {
          const parts = req.url.split('/');
          const id = parts[parts.indexOf('proposals') + 1];
          const proposal = visualProposalStore.get(id);
          if (!proposal) {
            return sendJson(404, { success: false, error: `Proposal bulunamadı: ${id}` });
          }

          const body = await readBody();
          const authorization = body.authorization;
          if (!authorization || authorization.decision !== AuthorizationDecision.AUTHORIZED) {
            return sendJson(403, {
              success: false,
              error: 'Yetkisiz çalıştırma engellendi (UNAUTHORIZED). Geçerli bir authorization sözleşmesi gereklidir.'
            });
          }

          const workspaceRoot = activeWorkspace ? activeWorkspace.rootPath : PROJECT_ROOT;
          const cycleResult = await runVisualRegressionCycle({
            proposal,
            authorization,
            workspaceRoot,
            targetFilePath: proposal.targetFilePath,
            pageUrl: body.url || null,
            beforeAudit: body.beforeAudit || null
          });

          visualExecutionStore.set(id, cycleResult);

          return sendJson(200, {
            success: true,
            proposalId: id,
            result: cycleResult
          });
        } catch (err) {
          return sendJson(400, { success: false, error: err.message });
        }
      }

      // GET /api/v1/visual/proposals/:id/result - Retrieve execution & regression result
      if (req.method === 'GET' && req.url.includes('/proposals/') && req.url.endsWith('/result')) {
        const parts = req.url.split('/');
        const id = parts[parts.indexOf('proposals') + 1];
        const result = visualExecutionStore.get(id);
        if (!result) {
          return sendJson(404, { success: false, error: `Sonuç bulunamadı: ${id}` });
        }
        return sendJson(200, { success: true, result });
      }

      // GET /api/v1/visual/audit-ledger - Query visual refactoring audit ledger
      if (req.method === 'GET' && (req.url === '/api/v1/visual/audit-ledger' || req.url === '/api/visual/audit-ledger')) {
        return sendJson(200, {
          success: true,
          ledger: getAuditLedger()
        });
      }

      // Phase 38: Authoritative Job Engine Endpoints
      // POST /api/jobs - Create Job
      if (req.method === 'POST' && req.url === '/api/jobs') {
        const body = await readBody();
        const job = authoritativeEngine.createJob({
          id: body.id,
          projectId: body.projectId,
          workflowId: body.workflowId,
          tenantId: body.tenantId,
          scopeReference: body.scopeReference,
          workspaceReference: body.workspaceReference || (activeWorkspace ? activeWorkspace.rootPath : null)
        });
        return sendJson(201, { success: true, job });
      }

      // GET /api/jobs/:id - Get Job
      if (req.method === 'GET' && req.url.startsWith('/api/jobs/') && !req.url.endsWith('/tasks') && !req.url.endsWith('/state') && !req.url.endsWith('/results')) {
        const jobId = req.url.slice('/api/jobs/'.length).split('?')[0];
        const tenantId = req.headers['x-tenant-id'] || null;
        const job = authoritativeEngine.getJob(jobId, { tenantId });
        return sendJson(200, { success: true, job });
      }

      // POST /api/jobs/:id/state - Update Job State
      if (req.method === 'POST' && req.url.startsWith('/api/jobs/') && req.url.endsWith('/state')) {
        const parts = req.url.split('/');
        const jobId = parts[3];
        const body = await readBody();
        const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
        const job = authoritativeEngine.updateJobState(jobId, body.status, {
          reason: body.reason,
          tenantId
        });
        return sendJson(200, { success: true, job });
      }

      // POST /api/jobs/:id/tasks - Create Task in Job
      if (req.method === 'POST' && req.url.startsWith('/api/jobs/') && req.url.endsWith('/tasks')) {
        const parts = req.url.split('/');
        const jobId = parts[3];
        const body = await readBody();
        const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
        const task = authoritativeEngine.createTask({
          id: body.id,
          jobId,
          objective: body.objective,
          taskType: body.taskType,
          tenantId
        });
        return sendJson(201, { success: true, task });
      }

      // GET /api/jobs/:id/tasks - List Tasks in Job
      if (req.method === 'GET' && req.url.startsWith('/api/jobs/') && req.url.endsWith('/tasks')) {
        const parts = req.url.split('/');
        const jobId = parts[3].split('?')[0];
        const tenantId = req.headers['x-tenant-id'] || null;
        const tasks = authoritativeEngine.listJobTasks(jobId, { tenantId });
        return sendJson(200, { success: true, tasks });
      }

      // GET /api/jobs/:id/results - List Execution Results in Job (FAZ 39 Foundation)
      if (req.method === 'GET' && req.url.startsWith('/api/jobs/') && req.url.endsWith('/results')) {
        const parts = req.url.split('/');
        const jobId = parts[3].split('?')[0];
        const tenantId = req.headers['x-tenant-id'] || null;
        const results = authoritativeEngine.listJobExecutionResults(jobId, { tenantId });
        return sendJson(200, { success: true, results });
      }

      // GET /api/tasks/:id - Get Task
      if (req.method === 'GET' && req.url.startsWith('/api/tasks/') && !req.url.endsWith('/state')) {
        const taskId = req.url.slice('/api/tasks/'.length).split('?')[0];
        const tenantId = req.headers['x-tenant-id'] || null;
        const task = authoritativeEngine.getTask(taskId, { tenantId });
        return sendJson(200, { success: true, task });
      }

      // POST /api/tasks/:id/state - Update Task State
      if (req.method === 'POST' && req.url.startsWith('/api/tasks/') && req.url.endsWith('/state')) {
        const parts = req.url.split('/');
        const taskId = parts[3];
        const body = await readBody();
        const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
        const task = authoritativeEngine.updateTaskState(taskId, body.status, {
          reason: body.reason,
          tenantId
        });
        return sendJson(200, { success: true, task });
      }

      // FAZ 40: Work Unit Controlled Execution Endpoints
      // POST /api/work-units/admit - Admit Work Unit against Authority Chain
      if (req.method === 'POST' && req.url === '/api/work-units/admit') {
        const body = await readBody();
        const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
        const workspaceRoot = body.workspaceRoot || (activeWorkspace ? activeWorkspace.rootPath : null);

        const workUnit = createWorkUnit({
          id: body.id || `wu-${Date.now()}`,
          tenantId,
          workspaceRoot,
          jobId: body.jobId,
          taskId: body.taskId,
          planId: body.planId,
          action: body.action
        });

        const admission = admitWorkUnit({ workUnit, jobEngine: authoritativeEngine });
        return sendJson(200, { success: true, admission, workUnit });
      }

      // POST /api/work-units/execute - Execute Admitted Work Unit
      if (req.method === 'POST' && req.url === '/api/work-units/execute') {
        const body = await readBody();
        const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
        const workspaceRoot = body.workspaceRoot || (activeWorkspace ? activeWorkspace.rootPath : null);

        const workUnit = createWorkUnit({
          id: body.id || `wu-${Date.now()}`,
          tenantId,
          workspaceRoot,
          jobId: body.jobId,
          taskId: body.taskId,
          planId: body.planId,
          action: body.action
        });

        const executedUnit = executeWorkUnit({
          workUnit,
          jobEngine: authoritativeEngine,
          userApproval: body.approval !== false
        });

        return sendJson(200, { success: true, workUnit: executedUnit });
      }

      // FAZ 43: Autonomous Policy Evaluation Endpoint
      // POST /api/autonomous-policy/evaluate
      if (req.method === 'POST' && req.url === '/api/autonomous-policy/evaluate') {
        const body = await readBody();
        const policy = createAutonomousPolicyContract(body.policy || {});
        const workUnit = createWorkUnit(body.workUnit || {});
        const evaluation = evaluateAutonomousPolicy({
          policy,
          workUnit,
          currentExecutions: body.currentExecutions || 0,
          currentCommands: body.currentCommands || 0,
          currentMutations: body.currentMutations || 0
        });
        return sendJson(200, { success: true, ...evaluation });
      }

      // FAZ 45: AI Proposal Validation Boundary (Proposal-Only / Zero Execution)
      // POST /api/ai/proposals/validate
      if (req.method === 'POST' && req.url === '/api/ai/proposals/validate') {
        const body = await readBody();
        const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
        const workspaceRoot = body.workspaceRoot || (activeWorkspace ? activeWorkspace.rootPath : null);

        let proposal = body.proposal;
        if (body.rawResponse && body.providerContract) {
          const provider = createAIProviderContract(body.providerContract);
          proposal = normalizeAIProposal({
            id: body.id || `prop-${Date.now()}`,
            providerContract: provider,
            tenantId,
            workspaceRoot,
            jobId: body.jobId || null,
            taskId: body.taskId || null,
            planId: body.planId || null,
            rawResponse: body.rawResponse
          });
        }

        const validation = validateAIProposal(proposal, {
          expectedTenantId: tenantId,
          expectedWorkspaceRoot: workspaceRoot
        });

        return sendJson(200, { success: true, proposal, validation });
      }

      // FAZ 46: Agent Registry Endpoints (Metadata Only / Zero Execution)
      // POST /api/agents - Register Agent
      if (req.method === 'POST' && req.url === '/api/agents') {
        const body = await readBody();
        const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
        const workspaceId = body.workspaceId || (activeWorkspace ? activeWorkspace.rootPath : null);

        const agentDef = createAgentDefinition({
          ...body,
          tenantId,
          workspaceId
        });
        const registered = authoritativeAgentRegistry.register(agentDef);
        return sendJson(201, { success: true, agent: registered });
      }

      // GET /api/agents - List Agents
      if (req.method === 'GET' && req.url === '/api/agents') {
        const tenantId = req.headers['x-tenant-id'] || null;
        const agents = authoritativeAgentRegistry.list({ tenantId });
        return sendJson(200, { success: true, agents, count: agents.length });
      }

      // GET /api/agents/:id - Get Agent by ID
      if (req.method === 'GET' && req.url.startsWith('/api/agents/')) {
        const agentId = req.url.slice('/api/agents/'.length).split('?')[0];
        const tenantId = req.headers['x-tenant-id'] || null;
        const workspaceId = (activeWorkspace ? activeWorkspace.rootPath : null);
        const agent = authoritativeAgentRegistry.get(agentId, { tenantId, workspaceId });
        return sendJson(200, { success: true, agent });
      }

      // FAZ 47: Controlled Task Routing & Agent Orchestration Endpoint (Metadata Only / Zero Execution)
      // POST /api/route - Route task to specialist agent
      if (req.method === 'POST' && req.url === '/api/route') {
        const body = await readBody();
        const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
        const workspaceId = body.workspaceId || (activeWorkspace ? activeWorkspace.rootPath : null);

        const task = createTaskDefinition({
          id: body.id || `task-rt-${Date.now()}`,
          objective: body.objective || body.taskPrompt || '',
          tenantId,
          workspaceId,
          requiredCapabilities: body.requiredCapabilities || [],
          preferredRole: body.preferredRole || null,
          constraints: body.constraints || {},
          metadata: body.metadata || {}
        });

        const policy = body.policy ? createAutonomousPolicyContract(body.policy) : null;
        const routingDecision = routeTask({
          task,
          agentRegistry: authoritativeAgentRegistry,
          callerTenantId: tenantId,
          callerWorkspaceId: workspaceId,
          autonomousPolicy: policy,
          policyEvaluator: policy ? evaluateAutonomousPolicy : null
        });

        return sendJson(200, { success: true, decision: routingDecision });
      }

      // FAZ 48: Controlled Agent Proposal Endpoint (Metadata Only / Zero Execution / Proposal Only)
      // POST /api/proposal - Generate normalized agent proposal
      if (req.method === 'POST' && req.url === '/api/proposal') {
        const body = await readBody();
        const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
        const callerWorkspace = activeWorkspace ? activeWorkspace.rootPath : (req.headers['x-workspace-id'] || null);

        // Fail-closed workspace isolation check
        if (callerWorkspace !== null && body.workspaceId && path.resolve(body.workspaceId) !== path.resolve(callerWorkspace)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Client workspace '${body.workspaceId}' does not match authoritative active workspace '${callerWorkspace}'`);
        }

        const workspaceId = body.workspaceId || callerWorkspace;


        const proposal = createAgentProposal({
          id: body.id || `prop-${Date.now()}`,
          taskId: body.taskId,
          agentId: body.agentId,
          providerId: body.providerId || 'local-provider',
          tenantId,
          workspaceId,
          objective: body.objective || '',
          rationale: body.rationale || '',
          operations: body.operations || [],
          proposedFiles: body.proposedFiles || [],
          proposedTests: body.proposedTests || [],
          risks: body.risks || [],
          assumptions: body.assumptions || [],
          constraints: body.constraints || {},
          metadata: body.metadata || {}
        });

        const validation = validateAgentProposal(proposal, {
          expectedTenantId: tenantId,
          expectedWorkspaceId: workspaceId,
          expectedAgentId: body.agentId,
          agentRegistry: authoritativeAgentRegistry
        });

        if (!validation.valid) {
          return sendJson(400, { success: false, validation, proposal });
        }

        return sendJson(200, { success: true, validation, proposal });
      }

      // FAZ 49: Controlled AI Provider Invocation Endpoint (Metadata Only / Untrusted AI Response Normalization / Proposal Only)
      // POST /api/invoke - Controlled invocation of provider for routed agent
      if (req.method === 'POST' && req.url === '/api/invoke') {
        const body = await readBody();
        const headerTenant = req.headers['x-tenant-id'] || null;
        if (headerTenant !== null && body.tenantId && headerTenant !== body.tenantId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${headerTenant}' does not match body tenant '${body.tenantId}'`);
        }
        const tenantId = body.tenantId || headerTenant || null;
        const callerWorkspace = activeWorkspace ? activeWorkspace.rootPath : (req.headers['x-workspace-id'] || null);

        if (callerWorkspace !== null && body.workspaceId && path.resolve(body.workspaceId) !== path.resolve(callerWorkspace)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Client workspace '${body.workspaceId}' does not match authoritative active workspace '${callerWorkspace}'`);
        }

        const workspaceId = body.workspaceId || callerWorkspace;


        const request = createInvocationRequest({
          id: body.id || `inv-${Date.now()}`,
          taskId: body.taskId,
          agentId: body.agentId,
          providerId: body.providerId || 'local-provider',
          tenantId,
          workspaceId,
          objective: body.objective || '',
          requiredCapabilities: body.requiredCapabilities || [],
          constraints: body.constraints || {},
          metadata: body.metadata || {}
        });

        const invocationResult = await invokeAIProvider({
          request,
          agentRegistry: authoritativeAgentRegistry,
          providerAdapter: authoritativeProvider,
          callerTenantId: tenantId,
          callerWorkspaceId: workspaceId
        });

        if (invocationResult.status !== 'INVOCATION_COMPLETED') {
          return sendJson(400, { success: false, invocationResult });
        }

        return sendJson(200, { success: true, invocationResult });
      }

      // FAZ 50: Deterministic Multi-Agent Orchestration Plan API (Proposal-Only / Zero Execution Authority)
      // POST /api/orchestrate - Composes or creates an orchestration plan
      if (req.method === 'POST' && req.url === '/api/orchestrate') {
        const body = await readBody();
        const headerTenant = req.headers['x-tenant-id'] || null;
        if (headerTenant !== null && body.tenantId && headerTenant !== body.tenantId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${headerTenant}' does not match body tenant '${body.tenantId}'`);
        }
        const tenantId = body.tenantId || headerTenant || null;
        const callerWorkspace = activeWorkspace ? activeWorkspace.rootPath : (req.headers['x-workspace-id'] || null);

        if (callerWorkspace !== null && body.workspaceId && path.resolve(body.workspaceId) !== path.resolve(callerWorkspace)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Client workspace '${body.workspaceId}' does not match authoritative active workspace '${callerWorkspace}'`);
        }
        const workspaceId = body.workspaceId || callerWorkspace;

        let result;
        if (body.taskDefinition) {
          // Automatic composition from task definition
          const compResult = composeOrchestrationPlan({
            taskDefinition: body.taskDefinition,
            agentRegistry: authoritativeAgentRegistry,
            callerTenantId: tenantId,
            callerWorkspaceId: workspaceId,
            requestedDependencies: body.dependencies || []
          });
          if (compResult.status !== MultiAgentPlanStatus.PLANNED) {
            return sendJson(400, { success: false, ...compResult });
          }
          return sendJson(200, { success: true, plan: compResult.plan, ...compResult });
        } else {
          // Explicit plan creation
          result = createMultiAgentOrchestrationPlan({
            id: body.id,
            taskId: body.taskId,
            tenantId,
            workspaceId,
            objective: body.objective,
            members: body.members,
            dependencies: body.dependencies,
            constraints: body.constraints,
            metadata: body.metadata
          });

          if (result.status !== MultiAgentPlanStatus.PLANNED) {
            return sendJson(400, { success: false, plan: result });
          }

          return sendJson(200, { success: true, plan: result });
        }
      }

      // FAZ 51: Multi-Agent Proposal Aggregation & Review Endpoint (Proposal-Only / Zero Direct Execution)
      // POST /api/proposal-review - Aggregates, validates, detects conflicts, and reviews proposals against plan
      if (req.method === 'POST' && req.url === '/api/proposal-review') {
        const body = await readBody();
        const headerTenant = req.headers['x-tenant-id'] || null;
        if (headerTenant !== null && body.tenantId && headerTenant !== body.tenantId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${headerTenant}' does not match body tenant '${body.tenantId}'`);
        }
        const tenantId = body.tenantId || headerTenant || null;
        const callerWorkspace = activeWorkspace ? activeWorkspace.rootPath : (req.headers['x-workspace-id'] || null);

        if (callerWorkspace !== null && body.workspaceId && path.resolve(body.workspaceId) !== path.resolve(callerWorkspace)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Client workspace '${body.workspaceId}' does not match authoritative active workspace '${callerWorkspace}'`);
        }
        const workspaceId = body.workspaceId || callerWorkspace;

        const reviewResult = aggregateAndReviewProposals({
          tenantId,
          workspaceId,
          taskId: body.taskId,
          orchestrationPlan: body.orchestrationPlan,
          proposals: body.proposals || [],
          agentRegistry: authoritativeAgentRegistry
        });

        if (reviewResult.status === ProposalReviewStatus.REVIEW_REJECTED ||
            reviewResult.status === ProposalReviewStatus.INVALID_PROPOSAL ||
            reviewResult.status === ProposalReviewStatus.INCONSISTENT) {
          return sendJson(400, { success: false, reviewResult });
        }

        return sendJson(200, { success: true, reviewResult });
      }

      // FAZ 52: Controlled Approval / Admission Boundary Endpoint (Zero Direct Execution / Zero Mutation)
      // POST /api/admission - Evaluates controlled admission from review result and explicit approval record
      if (req.method === 'POST' && req.url === '/api/admission') {
        const body = await readBody();
        const headerTenant = req.headers['x-tenant-id'] || null;
        if (headerTenant !== null && body.tenantId && headerTenant !== body.tenantId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${headerTenant}' does not match body tenant '${body.tenantId}'`);
        }
        const tenantId = body.tenantId || headerTenant || null;
        const callerWorkspace = activeWorkspace ? activeWorkspace.rootPath : (req.headers['x-workspace-id'] || null);

        if (callerWorkspace !== null && body.workspaceId && path.resolve(body.workspaceId) !== path.resolve(callerWorkspace)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Client workspace '${body.workspaceId}' does not match authoritative active workspace '${callerWorkspace}'`);
        }
        const workspaceId = body.workspaceId || callerWorkspace;

        const admissionDecision = evaluateApprovalAdmission({
          tenantId,
          workspaceId,
          taskId: body.taskId,
          orchestrationPlan: body.orchestrationPlan,
          reviewResult: body.reviewResult,
          approval: body.approval,
          proposals: body.proposals || null
        });

        if (admissionDecision.admissionStatus === AdmissionStatus.ADMISSION_DENIED) {
          return sendJson(400, { success: false, admissionDecision });
        }

        return sendJson(200, { success: true, admissionDecision });
      }

      // FAZ 53: Controlled Execution Bridge Endpoint (Single Execution / Admitted Proposal to WorkUnit Bridge)
      // POST /api/execute-admitted - Executes an admitted proposal through controlled Job and Work Unit
      if (req.method === 'POST' && req.url === '/api/execute-admitted') {
        const body = await readBody();
        const headerTenant = req.headers['x-tenant-id'] || null;
        if (headerTenant !== null && body.tenantId && headerTenant !== body.tenantId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${headerTenant}' does not match body tenant '${body.tenantId}'`);
        }
        const tenantId = body.tenantId || headerTenant || null;
        const callerWorkspace = activeWorkspace ? activeWorkspace.rootPath : (req.headers['x-workspace-id'] || null);

        if (callerWorkspace !== null && body.workspaceId && path.resolve(body.workspaceId) !== path.resolve(callerWorkspace)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Client workspace '${body.workspaceId}' does not match authoritative active workspace '${callerWorkspace}'`);
        }
        const workspaceId = body.workspaceId || callerWorkspace;
        const workspaceRoot = workspaceId || (activeWorkspace ? activeWorkspace.rootPath : PROJECT_ROOT);

        const bridgeResult = executeAdmittedBridge({
          executionId: body.executionId,
          jobEngine: authoritativeEngine,
          admissionDecision: body.admissionDecision,
          approval: body.approval,
          reviewResult: body.reviewResult,
          orchestrationPlan: body.orchestrationPlan,
          proposals: body.proposals || [],
          workspaceRoot,
          tenantId
        });

        if (bridgeResult.status === ExecutionBridgeStatus.EXECUTION_DENIED) {
          return sendJson(400, { success: false, bridgeResult });
        }

        return sendJson(200, { success: true, bridgeResult });
      }

      // FAZ 54: Deterministic Execution Verification Boundary (Read-Only / Zero Execution / Zero Retries)
      // POST /api/verify-execution - Deterministically verifies execution result against expected invariants
      if (req.method === 'POST' && req.url === '/api/verify-execution') {
        const body = await readBody();
        const headerTenant = req.headers['x-tenant-id'] || null;
        if (headerTenant !== null && body.tenantId && headerTenant !== body.tenantId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${headerTenant}' does not match body tenant '${body.tenantId}'`);
        }
        const tenantId = body.tenantId || headerTenant || null;
        const callerWorkspace = activeWorkspace ? activeWorkspace.rootPath : (req.headers['x-workspace-id'] || null);

        if (callerWorkspace !== null && body.workspaceId && path.resolve(body.workspaceId) !== path.resolve(callerWorkspace)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Client workspace '${body.workspaceId}' does not match authoritative active workspace '${callerWorkspace}'`);
        }
        const workspaceId = body.workspaceId || callerWorkspace;

        const verification = verifyExecutionResult({
          verificationId: body.verificationId || `ver-${Date.now()}`,
          executionResult: body.executionResult,
          expectedState: body.expectedState || {},
          expectedProposalFingerprint: body.expectedProposalFingerprint || null,
          context: {
            executionId: body.executionId || (body.executionResult ? body.executionResult.executionId : null),
            jobId: body.jobId || (body.executionResult ? body.executionResult.jobId : null),
            workUnitId: body.workUnitId || (body.executionResult ? body.executionResult.workUnitId : null),
            taskId: body.taskId || (body.executionResult ? body.executionResult.taskId : null),
            planId: body.planId || (body.executionResult ? body.executionResult.planId : null),
            tenantId,
            workspaceId
          }
        });

        if (verification.status === VerificationStatus.VERIFICATION_DENIED) {
          return sendJson(400, { success: false, verification });
        }

        return sendJson(200, { success: true, verification });
      }

      // FAZ 55: Project / Test Verification Orchestration Boundary (Read-Only / Multi-Check Aggregation)
      // POST /api/verify-project - Orchestrates multi-check deterministic project verification
      if (req.method === 'POST' && req.url === '/api/verify-project') {
        const body = await readBody();
        const headerTenant = req.headers['x-tenant-id'] || null;
        if (headerTenant !== null && body.tenantId && headerTenant !== body.tenantId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${headerTenant}' does not match body tenant '${body.tenantId}'`);
        }
        const tenantId = body.tenantId || headerTenant || null;
        const callerWorkspace = activeWorkspace ? activeWorkspace.rootPath : (req.headers['x-workspace-id'] || null);

        if (callerWorkspace !== null && body.workspaceId && path.resolve(body.workspaceId) !== path.resolve(callerWorkspace)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Client workspace '${body.workspaceId}' does not match authoritative active workspace '${callerWorkspace}'`);
        }
        const workspaceId = body.workspaceId || callerWorkspace;

        let plan = body.verificationPlan;
        if (plan && typeof plan === 'object' && !plan.createdAt) {
          try {
            plan = createProjectVerificationPlan({
              ...plan,
              tenantId: plan.tenantId || tenantId,
              workspaceId: plan.workspaceId || workspaceId
            });
          } catch (err) {
            return sendJson(400, { success: false, error: err.message, status: ProjectVerificationStatus.VERIFICATION_DENIED });
          }
        }

        const projectResult = orchestrateProjectVerification({
          verificationId: body.verificationId || `proj-ver-${Date.now()}`,
          verificationPlan: plan,
          executionResults: body.executionResults || [],
          expectedProposalFingerprint: body.expectedProposalFingerprint || null,
          proposals: body.proposals || null,
          context: {
            tenantId,
            workspaceId,
            taskId: body.taskId,
            jobId: body.jobId
          }
        });

        if (projectResult.status === ProjectVerificationStatus.VERIFICATION_DENIED) {
          return sendJson(400, { success: false, projectResult });
        }

        return sendJson(200, { success: true, projectResult });
      }

      // FAZ 56: Bounded Self-Correction Boundary (Controlled Failure Analysis -> Proposal -> Review -> Approval -> Admission -> Execution -> Verification)
      // POST /api/correct - Orchestrates a bounded correction cycle
      if (req.method === 'POST' && req.url === '/api/correct') {
        const body = await readBody();
        const headerTenant = req.headers['x-tenant-id'] || null;
        if (headerTenant !== null && body.tenantId && headerTenant !== body.tenantId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${headerTenant}' does not match body tenant '${body.tenantId}'`);
        }
        const tenantId = body.tenantId || headerTenant || null;
        const callerWorkspace = activeWorkspace ? activeWorkspace.rootPath : (req.headers['x-workspace-id'] || null);

        if (callerWorkspace !== null && body.workspaceId && path.resolve(body.workspaceId) !== path.resolve(callerWorkspace)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Client workspace '${body.workspaceId}' does not match authoritative active workspace '${callerWorkspace}'`);
        }
        const workspaceId = body.workspaceId || callerWorkspace;

        const correctionResult = orchestrateSelfCorrection({
          correctionId: body.correctionId || `corr-${Date.now()}`,
          taskId: body.taskId,
          jobId: body.jobId,
          tenantId,
          workspaceId,
          correctionCycle: body.correctionCycle !== undefined ? body.correctionCycle : 1,
          parentExecutionId: body.parentExecutionId || null,
          parentVerificationId: body.parentVerificationId || null,
          parentProjectVerificationId: body.parentProjectVerificationId || null,
          parentExecutionResult: body.parentExecutionResult || null,
          parentVerificationResult: body.parentVerificationResult || null,
          parentProjectVerificationResult: body.parentProjectVerificationResult || null,
          jobEngine: authoritativeEngine,
          agentRegistry: body.agentRegistry || null,
          orchestrationPlan: body.orchestrationPlan,
          correctionProposal: body.correctionProposal,
          reviewResult: body.reviewResult || null,
          approval: body.approval || null,
          executedAdmissionsTracker: body.executedAdmissionsTracker || null,
          expectedVerificationPlan: body.expectedVerificationPlan || null,
          rawPayload: body
        });

        if (correctionResult.status === CorrectionStatus.CORRECTION_DENIED) {
          return sendJson(400, { success: false, correctionResult });
        }

        return sendJson(200, { success: true, correctionResult });
      }

      // FAZ 58: AI Provider Gateway & Registry Endpoints
      // GET /api/providers - List configured providers (secrets redacted)
      if (req.method === 'GET' && req.url === '/api/providers') {
        const tenantId = req.headers['x-tenant-id'] || null;
        const providers = authoritativeProviderRegistry.listProviders({ tenantId });
        return sendJson(200, { success: true, providers, count: providers.length });
      }

      // GET /api/providers/:id - Get provider details (secrets redacted)
      if (req.method === 'GET' && req.url.startsWith('/api/providers/') && !req.url.endsWith('/health')) {
        const providerId = req.url.slice('/api/providers/'.length).split('?')[0];
        const tenantId = req.headers['x-tenant-id'] || null;
        const workspaceId = activeWorkspace ? activeWorkspace.rootPath : null;
        const adapter = authoritativeProviderRegistry.getProvider(providerId, { tenantId, workspaceId });
        return sendJson(200, {
          success: true,
          provider: {
            providerId: adapter.providerId,
            name: adapter.name,
            model: adapter.model || 'unknown',
            isLocal: Boolean(adapter.isLocal),
            hasCredentials: Boolean(adapter.hasCredentials || adapter.isLocal)
          }
        });
      }

      // POST /api/providers/:id/health - Health check for specific provider
      if (req.method === 'POST' && req.url.startsWith('/api/providers/') && req.url.endsWith('/health')) {
        const parts = req.url.split('/');
        const providerId = parts[3];
        const health = await authoritativeGateway.checkHealth(providerId);
        return sendJson(200, { success: true, health });
      }

      // FAZ 59: AI Control Plane Diagnostic Endpoints (No secrets disclosed)
      // GET /api/ai/status - Overall control plane status & subsystem health
      if (req.method === 'GET' && req.url === '/api/ai/status') {
        return sendJson(200, {
          success: true,
          status: 'ONLINE',
          providers: authoritativeControlPlane.healthMonitor.getAllHealth(),
          budget: authoritativeBudget.getStatus(),
          auditEventsCount: authoritativeControlPlane.auditLedger.count()
        });
      }

      // GET /api/ai/providers - List registered providers with sanitized capabilities
      if (req.method === 'GET' && req.url === '/api/ai/providers') {
        const tenantId = req.headers['x-tenant-id'] || null;
        const providers = authoritativeProviderRegistry.listProviders({ tenantId });
        return sendJson(200, { success: true, providers, count: providers.length });
      }

      // FAZ 63: Intelligent AI Routing & Model Metadata Endpoints
      // GET /api/ai/models - List registered models from model registry
      if (req.method === 'GET' && req.url.startsWith('/api/ai/models')) {
        const urlObj = new URL(req.url, 'http://localhost');
        const providerId = urlObj.searchParams.get('providerId');
        const models = authoritativeModelRegistry.listModels(providerId ? { providerId } : {});
        return sendJson(200, { success: true, models, count: models.length });
      }

      // GET /api/ai/capabilities - Canonical capabilities taxonomy
      if (req.method === 'GET' && req.url === '/api/ai/capabilities') {
        return sendJson(200, { success: true, capabilities: Object.values(ProviderCapabilities) });
      }

      // POST /api/ai/route - Intelligent task analysis and provider+model routing (proposal only)
      if (req.method === 'POST' && req.url === '/api/ai/route') {
        const body = await readBody();
        const headerTenant = req.headers['x-tenant-id'] || null;
        if (headerTenant !== null && body.tenantId && headerTenant !== body.tenantId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${headerTenant}' does not match body tenant '${body.tenantId}'`);
        }
        const tenantId = body.tenantId || headerTenant || null;
        const callerWorkspace = activeWorkspace ? activeWorkspace.rootPath : (req.headers['x-workspace-id'] || null);
        if (callerWorkspace !== null && body.workspaceId && path.resolve(body.workspaceId) !== path.resolve(callerWorkspace)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Client workspace '${body.workspaceId}' does not match authoritative active workspace '${callerWorkspace}'`);
        }
        const workspaceId = body.workspaceId || callerWorkspace || null;

        const decision = authoritativeRoutingEngine.route({
          task: body.task,
          taskType: body.taskType,
          requiredCapabilities: body.requiredCapabilities,
          dataClassification: body.dataClassification,
          preferredProvider: body.preferredProvider,
          preferredModel: body.preferredModel,
          budget: body.budget,
          maxCostUsd: body.maxCostUsd,
          latencyTarget: body.latencyTarget,
          qualityTarget: body.qualityTarget,
          tenantId,
          workspaceId
        });

        return sendJson(200, { success: true, decision });
      }

      // GET /api/ai/providers/:id/health - Health check metrics for provider
      if (req.method === 'GET' && req.url.startsWith('/api/ai/providers/') && req.url.endsWith('/health')) {
        const parts = req.url.split('/');
        const providerId = parts[4];
        const health = authoritativeControlPlane.healthMonitor.getHealth(providerId);
        return sendJson(200, { success: true, health });
      }

      // GET /api/ai/metrics - Multi-tier spend & token metrics
      if (req.method === 'GET' && req.url === '/api/ai/metrics') {
        const tenantId = req.headers['x-tenant-id'] || 'default-tenant';
        const workspaceId = activeWorkspace ? activeWorkspace.rootPath : 'default-workspace';
        const metrics = authoritativeControlPlane.costGovernor.getSpendMetrics({ tenantId, workspaceId });
        return sendJson(200, { success: true, metrics });
      }

      // GET /api/ai/audit - Sanitized append-only audit events
      if (req.method === 'GET' && req.url.startsWith('/api/ai/audit')) {
        const tenantId = req.headers['x-tenant-id'] || null;
        const events = authoritativeControlPlane.auditLedger.getEvents({ tenantId, limit: 100 });
        return sendJson(200, { success: true, events, count: events.length });
      }

      // FAZ 65: Production AI Execution Pipeline Endpoint
      // POST /api/ai/execute - End-to-end task execution pipeline
      if (req.method === 'POST' && (req.url === '/api/ai/execute' || req.url === '/api/ai/pipeline')) {
        const body = await readBody();
        const headerTenant = req.headers['x-tenant-id'] || null;
        if (headerTenant !== null && body.tenantId && headerTenant !== body.tenantId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${headerTenant}' does not match body tenant '${body.tenantId}'`);
        }
        const tenantId = body.tenantId || headerTenant || 'default-tenant';
        const callerWorkspace = activeWorkspace ? activeWorkspace.rootPath : (req.headers['x-workspace-id'] || null);
        if (callerWorkspace !== null && body.workspaceId && path.resolve(body.workspaceId) !== path.resolve(callerWorkspace)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Client workspace '${body.workspaceId}' does not match authoritative active workspace '${callerWorkspace}'`);
        }
        const workspaceId = body.workspaceId || callerWorkspace || 'default-workspace';

        const contract = await authoritativePipeline.execute({
          requestId: body.requestId,
          task: body.task,
          taskType: body.taskType,
          requiredCapabilities: body.requiredCapabilities,
          dataClassification: body.dataClassification,
          preferredProvider: body.preferredProvider,
          preferredModel: body.preferredModel,
          budget: body.budget,
          maxCostUsd: body.maxCostUsd,
          latencyTarget: body.latencyTarget,
          qualityTarget: body.qualityTarget,
          expectedSchema: body.expectedSchema,
          tenantId,
          workspaceId,
          systemPrompt: body.systemPrompt,
          timeoutMs: body.timeoutMs || 15000,
          metadata: body.metadata || {}
        });

        let httpStatus = 200;
        if (contract.status === 'NOT_CONFIGURED') httpStatus = 503;
        else if (contract.status === 'SECURITY_BLOCKED') httpStatus = 403;
        else if (contract.status === 'BUDGET_EXCEEDED') httpStatus = 402;
        else if (contract.status === 'PROVIDER_ERROR') httpStatus = 502;
        else if (contract.status === 'VERIFICATION_FAILED') httpStatus = 422;
        else if (contract.status === 'FAILED') httpStatus = 400;

        return sendJson(httpStatus, { success: contract.status === 'COMPLETED', contract });
      }

      // POST /api/ai/control-plane/dispatch - Central Policy-Aware AI Dispatch
      if (req.method === 'POST' && req.url === '/api/ai/control-plane/dispatch') {
        const body = await readBody();
        const headerTenant = req.headers['x-tenant-id'] || null;
        if (headerTenant !== null && body.tenantId && headerTenant !== body.tenantId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${headerTenant}' does not match body tenant '${body.tenantId}'`);
        }
        const tenantId = body.tenantId || headerTenant || 'default-tenant';
        const callerWorkspace = activeWorkspace ? activeWorkspace.rootPath : (req.headers['x-workspace-id'] || null);
        if (callerWorkspace !== null && body.workspaceId && path.resolve(body.workspaceId) !== path.resolve(callerWorkspace)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Client workspace '${body.workspaceId}' does not match authoritative active workspace '${callerWorkspace}'`);
        }
        const workspaceId = body.workspaceId || callerWorkspace || 'default-workspace';

        const result = await authoritativeControlPlane.executeDispatch({
          prompt: body.prompt || '',
          systemPrompt: body.systemPrompt || null,
          contextData: body.contextData || null,
          agentId: body.agentId || 'agent-default',
          agentRole: body.agentRole || 'DEVELOPER',
          taskType: body.taskType || 'general',
          requiredCapabilities: body.requiredCapabilities || [],
          dataClassification: body.dataClassification || null,
          tenantId,
          workspaceId,
          taskId: body.taskId || null,
          planId: body.planId || null,
          idempotencyKey: body.idempotencyKey || null,
          timeoutMs: body.timeoutMs || 15000,
          maxRetries: body.maxRetries !== undefined ? body.maxRetries : 2,
          metadata: body.metadata || {}
        });

        return sendJson(200, { success: true, result });
      }

      // POST /api/ai/invoke - Controlled AI Provider Gateway Invocation (Proposal-Only / Zero Authority)
      if (req.method === 'POST' && req.url === '/api/ai/invoke') {
        const body = await readBody();
        const headerTenant = req.headers['x-tenant-id'] || null;
        if (headerTenant !== null && body.tenantId && headerTenant !== body.tenantId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${headerTenant}' does not match body tenant '${body.tenantId}'`);
        }
        const tenantId = body.tenantId || headerTenant || null;
        const callerWorkspace = activeWorkspace ? activeWorkspace.rootPath : (req.headers['x-workspace-id'] || null);

        if (callerWorkspace !== null && body.workspaceId && path.resolve(body.workspaceId) !== path.resolve(callerWorkspace)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Client workspace '${body.workspaceId}' does not match authoritative active workspace '${callerWorkspace}'`);
        }
        const workspaceId = body.workspaceId || callerWorkspace;

        const dispatchResult = await authoritativeGateway.dispatch({
          requestId: body.requestId,
          providerId: body.providerId || 'local',
          fallbackProviderId: body.fallbackProviderId || null,
          prompt: body.prompt || body.objective || '',
          agentId: body.agentId || 'agent-default',
          agentRole: body.agentRole || 'DEVELOPER',
          systemPrompt: body.systemPrompt || null,
          constraints: body.constraints || {},
          metadata: body.metadata || {},
          timeoutMs: body.timeoutMs,
          maxRetries: body.maxRetries,
          tenantId,
          workspaceId
        });

        if (dispatchResult.status !== 'SUCCESS') {
          return sendJson(400, { success: false, dispatchResult });
        }

        return sendJson(200, { success: true, dispatchResult });
      }

      // POST /api/orchestration/run - Run Multi-Agent Orchestration Plan (Proposal-Only / Zero Direct Execution)
      if (req.method === 'POST' && req.url === '/api/orchestration/run') {
        const body = await readBody();
        const headerTenant = req.headers['x-tenant-id'] || null;
        if (headerTenant !== null && body.tenantId && headerTenant !== body.tenantId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${headerTenant}' does not match body tenant '${body.tenantId}'`);
        }
        const tenantId = body.tenantId || headerTenant || null;
        const callerWorkspace = activeWorkspace ? activeWorkspace.rootPath : (req.headers['x-workspace-id'] || null);

        if (callerWorkspace !== null && body.workspaceId && path.resolve(body.workspaceId) !== path.resolve(callerWorkspace)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Client workspace '${body.workspaceId}' does not match authoritative active workspace '${callerWorkspace}'`);
        }
        const workspaceId = body.workspaceId || callerWorkspace;

        const execResult = await authoritativeExecutor.executePlan({
          executionId: body.executionId,
          orchestrationPlan: body.orchestrationPlan,
          mode: body.mode,
          context: body.context || {},
          tenantId,
          workspaceId
        });

        if (execResult.status === 'FAILED' || execResult.status === 'BUDGET_EXCEEDED') {
          return sendJson(400, { success: false, ...execResult });
        }

        return sendJson(200, { success: true, ...execResult });
      }

      // FAZ 59: Autonomous Project Job Endpoints
      // POST /api/autonomous/jobs - Create and optionally run an autonomous job
      if (req.method === 'POST' && req.url === '/api/autonomous/jobs') {
        const body = await readBody();
        const headerTenant = req.headers['x-tenant-id'] || null;
        if (headerTenant !== null && body.tenantId && headerTenant !== body.tenantId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${headerTenant}' does not match body tenant '${body.tenantId}'`);
        }
        const tenantId = body.tenantId || headerTenant || 'default-tenant';
        const workspaceId = body.workspaceId || (activeWorkspace ? activeWorkspace.rootPath : 'default-workspace');

        const job = authoritativeAutonomousEngine.createJob({
          userRequest: body.userRequest || '',
          tenantId,
          workspaceId,
          idempotencyKey: body.idempotencyKey || null,
          limits: body.limits || {}
        });

        if (body.executeNow) {
          await authoritativeAutonomousEngine.executeJob(job.jobId, {
            customProposal: body.customProposal || null,
            initialTestOutcome: body.initialTestOutcome || null
          });
        }

        return sendJson(201, { success: true, job: job.toJSON() });
      }

      // GET /api/autonomous/jobs/:jobId - Get job details
      if (req.method === 'GET' && req.url.startsWith('/api/autonomous/jobs/') && !req.url.endsWith('/cancel') && !req.url.endsWith('/resume') && !req.url.endsWith('/events') && !req.url.endsWith('/result')) {
        const jobId = req.url.slice('/api/autonomous/jobs/'.length).split('?')[0];
        const job = authoritativeAutonomousEngine.getJob(jobId);
        if (!job) {
          return sendJson(404, { success: false, error: `Autonomous job not found: ${jobId}` });
        }
        return sendJson(200, { success: true, job: job.toJSON() });
      }

      // POST /api/autonomous/jobs/:jobId/cancel - Cancel job
      if (req.method === 'POST' && req.url.startsWith('/api/autonomous/jobs/') && req.url.endsWith('/cancel')) {
        const parts = req.url.split('/');
        const jobId = parts[parts.length - 2];
        const body = await readBody();
        const status = authoritativeAutonomousEngine.cancelJob(jobId, body.reason || 'User requested cancellation');
        return sendJson(200, { success: true, jobId, status });
      }

      // POST /api/autonomous/jobs/:jobId/resume - Resume job
      if (req.method === 'POST' && req.url.startsWith('/api/autonomous/jobs/') && req.url.endsWith('/resume')) {
        const parts = req.url.split('/');
        const jobId = parts[parts.length - 2];
        const body = await readBody();
        const status = authoritativeAutonomousEngine.resumeJob(jobId, body.targetState);
        return sendJson(200, { success: true, jobId, status });
      }

      // GET /api/autonomous/jobs/:jobId/events - List events
      if (req.method === 'GET' && req.url.startsWith('/api/autonomous/jobs/') && req.url.endsWith('/events')) {
        const parts = req.url.split('/');
        const jobId = parts[parts.length - 2];
        const events = authoritativeAutonomousEngine.getJobEvents(jobId);
        return sendJson(200, { success: true, jobId, events });
      }

      // GET /api/autonomous/jobs/:jobId/result - Get final result
      if (req.method === 'GET' && req.url.startsWith('/api/autonomous/jobs/') && req.url.endsWith('/result')) {
        const parts = req.url.split('/');
        const jobId = parts[parts.length - 2];
        const result = authoritativeAutonomousEngine.getJobResult(jobId);
        if (!result) {
          return sendJson(404, { success: false, error: `Autonomous job not found: ${jobId}` });
        }
        return sendJson(200, { success: true, jobId, result });
      }

      // 4. Controlled Execution Pipeline API (Commands)
      if (req.method === 'POST' && req.url === '/api/execute') {
        const body = await readBody();

        // Security check: Must have an active workspace
        if (!activeWorkspace) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Execution blocked: No active workspace has been selected.`);
        }

        // Security check: If client sends a workspaceRoot, it MUST match the authoritative active workspace!
        if (body.workspaceRoot) {
          const resolvedClientPath = path.resolve(body.workspaceRoot);
          if (resolvedClientPath !== activeWorkspace.rootPath) {
            throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Execution blocked: Client workspaceRoot '${body.workspaceRoot}' does not match authoritative active workspace '${activeWorkspace.rootPath}'`);
          }
        }

        // FAZ 38.2 Remediation (DEF-01):
        // Resolve authoritative plan. If jobId is provided, plan MUST come strictly from jobEngine.
        let executionPlan = null;
        if (body.jobId) {
          const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
          // Validate Job existence and tenant isolation
          authoritativeEngine.getJob(body.jobId, { tenantId });
          executionPlan = authoritativeEngine.getJobPlan(body.jobId, { tenantId });
          if (!executionPlan) {
            throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Execution blocked: No authoritative plan exists for Job '${body.jobId}'`);
          }
        } else {
          // Backward compatibility fallback ONLY for non-job legacy callers
          executionPlan = legacyActivePlan;
        }

        // Security check: Must have an authoritative plan
        if (!executionPlan) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Execution blocked: No authoritative plan generated for execution.`);
        }

        // Security check: Authoritative plan workspace consistency
        if (executionPlan.workspaceRoot && executionPlan.workspaceRoot !== activeWorkspace.rootPath) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Execution blocked: Authoritative plan workspaceRoot '${executionPlan.workspaceRoot}' does not match active workspace '${activeWorkspace.rootPath}'`);
        }

        // Phase 21 Security check: Identity integrity (planId & taskId)
        if (body.planId && body.planId !== executionPlan.id) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Execution blocked: Client planId '${body.planId}' does not match authoritative planId '${executionPlan.id}'`);
        }
        if (body.taskId && body.taskId !== executionPlan.taskId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Execution blocked: Client taskId '${body.taskId}' does not match authoritative taskId '${executionPlan.taskId}'`);
        }

        const result = pipelineRunner({
          workspaceRoot: activeWorkspace.rootPath,
          command: body.command,
          userApproval: body.approval !== false,
          authoritativePlan: executionPlan,
          planId: body.planId,
          taskId: body.taskId
        });

        // FAZ 39 Foundation: Record execution result strictly bound to Job
        if (body.jobId) {
          const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
          const outcome = result && result.status === 'COMPLETED' && result.executionResult && result.executionResult.outcome === 'SUCCEEDED'
            ? 'SUCCEEDED'
            : (result && result.status === 'ADMISSION_DENIED' ? 'DENIED' : 'FAILED');

          authoritativeEngine.recordExecutionResult(body.jobId, {
            taskId: executionPlan.taskId,
            planId: executionPlan.id,
            outcome,
            result
          }, { tenantId });
        }

        return sendJson(200, result);
      }

      // 5. Controlled File Mutation API (Phase 18)
      if (req.method === 'POST' && req.url === '/api/mutate') {
        const body = await readBody();

        // Security check: Must have an active workspace
        if (!activeWorkspace) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: No active workspace has been selected.`);
        }

        // Security check: If client sends workspaceRoot, it must match activeWorkspace
        if (body.workspaceRoot) {
          const resolvedClientWorkspace = path.resolve(body.workspaceRoot);
          if (resolvedClientWorkspace !== activeWorkspace.rootPath) {
            throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Client workspaceRoot '${body.workspaceRoot}' does not match authoritative active workspace '${activeWorkspace.rootPath}'`);
          }
        }

        // FAZ 38.2 Remediation (DEF-01):
        // Resolve authoritative plan. If jobId is provided, plan MUST come strictly from jobEngine.
        let mutationPlan = null;
        if (body.jobId) {
          const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
          // Validate Job existence and tenant isolation
          authoritativeEngine.getJob(body.jobId, { tenantId });
          mutationPlan = authoritativeEngine.getJobPlan(body.jobId, { tenantId });
          if (!mutationPlan) {
            throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: No authoritative plan exists for Job '${body.jobId}'`);
          }
        } else {
          // Backward compatibility fallback ONLY for non-job legacy callers
          mutationPlan = legacyActivePlan;
        }

        // Security check: Must have an authoritative plan
        if (!mutationPlan) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: No authoritative plan generated for mutation.`);
        }

        // Security check: Authoritative plan workspace consistency
        if (mutationPlan.workspaceRoot && mutationPlan.workspaceRoot !== activeWorkspace.rootPath) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Authoritative plan workspaceRoot '${mutationPlan.workspaceRoot}' does not match active workspace '${activeWorkspace.rootPath}'`);
        }

        // Security check: Identity integrity (planId & taskId)
        if (body.planId && body.planId !== mutationPlan.id) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Client planId '${body.planId}' does not match authoritative planId '${mutationPlan.id}'`);
        }
        if (body.taskId && body.taskId !== mutationPlan.taskId) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Client taskId '${body.taskId}' does not match authoritative taskId '${mutationPlan.taskId}'`);
        }

        // Target resolution & verification against authoritative plan expectedFileChanges
        const targetPath = body.targetPath;
        if (!targetPath || typeof targetPath !== 'string' || targetPath.trim() === '') {
          throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] targetPath is required for file mutation`);
        }

        const resolvedTarget = path.resolve(activeWorkspace.rootPath, targetPath);
        const expectedFiles = mutationPlan.expectedFileChanges || [];
        const isAuthorizedTarget = expectedFiles.some(expectedFile => {
          const resolvedExpected = path.resolve(activeWorkspace.rootPath, expectedFile);
          return resolvedExpected === resolvedTarget;
        });

        if (!isAuthorizedTarget) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Target '${targetPath}' is not in authoritative plan expectedFileChanges: [${expectedFiles.join(', ')}]`);
        }

        // Build authoritative preflight policies
        const task = createTask({
          id: mutationPlan.taskId,
          jobId: body.jobId || `job-${Date.now()}`,
          objective: 'Controlled file mutation',
          status: TaskState.READY
        });

        const approvalRecord = createApproval({
          id: `appr-${Date.now()}`,
          actionType: task.objective,
          reason: body.approval !== false ? 'User approved file mutation' : 'User rejected file mutation',
          approvalState: body.approval !== false ? 'APPROVED' : 'REJECTED'
        });

        const scopePolicy = createScopePolicy({
          allowedSurfaces: ['FILES'],
          expectedFiles: [targetPath],
          allowedFiles: [targetPath]
        });
        const execPolicy = createExecutionPolicy({ allowedWorkingDirectories: [activeWorkspace.rootPath] });
        const secPolicy = createSecurityPolicy({});
        const apprPolicy = createApprovalPolicy({
          mandatoryApprovalActions: [task.objective]
        });

        const admission = evaluateExecutionPreflight({
          id: `adm-${Date.now()}`,
          task,
          executionPlan: mutationPlan,
          workingDirectory: activeWorkspace.rootPath,
          scopePolicy,
          executionPolicy: execPolicy,
          securityPolicy: secPolicy,
          approvalPolicy: apprPolicy,
          approval: approvalRecord
        });

        if (admission.decision !== 'ALLOWED') {
          return sendJson(200, {
            status: 'ADMISSION_DENIED',
            admission,
            mutationResult: null,
            postValidation: null
          });
        }

        // Build handoff, request, authorization with exact context binding
        const handoff = createExecutionHandoffContract({
          id: `h-mut-${Date.now()}`,
          taskId: task.id,
          planId: mutationPlan.id,
          admissionResult: admission,
          workingDirectory: activeWorkspace.rootPath,
          expectedCommands: []
        });

        const request = consumeExecutionHandoff({
          requestId: `req-mut-${Date.now()}`,
          handoff,
          admissionResult: admission
        });

        const authorization = authorizeExecutionRequest({
          id: `auth-mut-${Date.now()}`,
          executionRequest: request,
          admissionResult: admission
        });

        // Phase 19: Authoritative content lookup and validation
        const authoritativeMutations = mutationPlan.authoritativeFileMutations || [];
        const matchingAuthMutation = authoritativeMutations.find(m => {
          const resolvedAuthFile = path.resolve(activeWorkspace.rootPath, m.file);
          return resolvedAuthFile === resolvedTarget;
        });

        let targetContentToWrite = '';
        let targetExpectedState = body.expectedState !== undefined ? body.expectedState : null;

        if (matchingAuthMutation) {
          // Authoritative content is defined by the plan
          if (body.content !== undefined && body.content !== null) {
            // Client provided content: MUST strictly match authoritative content
            if (body.content !== matchingAuthMutation.content) {
              throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Client content does not match authoritative plan content for target '${targetPath}'`);
            }
            targetContentToWrite = matchingAuthMutation.content;
          } else {
            // Client omitted content: use authoritative content from plan
            targetContentToWrite = matchingAuthMutation.content;
          }

          // Authoritative expectedState from plan if declared
          if (matchingAuthMutation.expectedState !== null && matchingAuthMutation.expectedState !== undefined) {
            if (body.expectedState !== undefined && body.expectedState !== null && body.expectedState !== matchingAuthMutation.expectedState) {
              throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Client expectedState does not match authoritative plan expectedState for target '${targetPath}'`);
            }
            targetExpectedState = matchingAuthMutation.expectedState;
          }
        } else {
          // Fallback if plan did not specify authoritative mutation details (backward compatibility)
          targetContentToWrite = body.content !== undefined ? body.content : '';
        }

        // Securely augment authorization with authorizedTarget, authorizedContent, and expectedState
        const boundAuthorization = Object.freeze({
          ...authorization,
          authorizedContext: Object.freeze({
            ...authorization.authorizedContext,
            authorizedTarget: resolvedTarget,
            authorizedContent: targetContentToWrite,
            expectedState: targetExpectedState
          })
        });

        const mutationResult = executeAuthorizedFileMutation({
          resultId: `mut-res-${Date.now()}`,
          executionRequest: request,
          authorization: boundAuthorization,
          workspaceRoot: activeWorkspace.rootPath,
          targetPath: resolvedTarget,
          content: targetContentToWrite,
          operation: body.operation || 'WRITE',
          expectedState: targetExpectedState,
          dryRun: body.dryRun === true
        });

        // Post-execution validation
        const validationTask = createTask({
          id: task.id,
          jobId: task.jobId,
          objective: task.objective,
          status: TaskState.VALIDATING
        });

        const validationContract = createValidation({
          id: `val-${Date.now()}`,
          target: targetPath,
          result: mutationResult.outcome === 'SUCCEEDED' ? ValidationResult.PASS : ValidationResult.FAIL,
          failureReason: mutationResult.failureReason
        });

        const postValidation = evaluatePostExecutionValidation({
          task: validationTask,
          validation: validationContract,
          evidences: [`file-mut-${resolvedTarget}`]
        });

        // FAZ 39 Foundation: Record execution/mutation result strictly bound to Job
        if (body.jobId) {
          const tenantId = body.tenantId || req.headers['x-tenant-id'] || null;
          const outcome = mutationResult && mutationResult.outcome === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED';
          authoritativeEngine.recordExecutionResult(body.jobId, {
            taskId: mutationPlan.taskId,
            planId: mutationPlan.id,
            outcome,
            result: {
              status: 'COMPLETED',
              mutationResult,
              postValidation
            }
          }, { tenantId });
        }

        return sendJson(200, {
          status: 'COMPLETED',
          admission,
          authorization: boundAuthorization,
          mutationResult,
          postValidation
        });
      }

      // 404 fallback
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } catch (err) {
      const cleanError = sanitizeFilePath(sanitizeString(err.message || 'Server processing error'));
      sendJson(400, { success: false, error: cleanError });
    }
  });

  server.on('close', () => {
    stopRunningProject();
  });

  return server;
}

// Allow direct standalone run
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const fs = await import('fs');
  const logFile = path.join(os.tmpdir(), 'onlunet_server_debug.log');

  function debugLog(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try { fs.appendFileSync(logFile, line); } catch {}
    console.log(msg);
  }

  process.on('uncaughtException', (err) => {
    debugLog(`[SERVER UNCAUGHT EXCEPTION]: ${err.stack || err}`);
  });
  process.on('unhandledRejection', (reason) => {
    debugLog(`[SERVER UNHANDLED REJECTION]: ${reason}`);
  });
  process.on('exit', (code) => {
    debugLog(`[SERVER EXIT EVENT] Code: ${code}`);
  });
  process.on('SIGINT', () => {
    debugLog('[SERVER RECEIVED SIGINT]');
  });
  process.on('SIGTERM', () => {
    debugLog('[SERVER RECEIVED SIGTERM]');
  });
  process.on('SIGHUP', () => {
    debugLog('[SERVER RECEIVED SIGHUP]');
  });

  const PORT = process.env.PORT || 4200;
  const srv = createApplicationServer();
  srv.listen(PORT, () => {
    debugLog(`[ONLUNET ZEKA] Standalone Application UI running at http://localhost:${PORT}`);
  });
}
