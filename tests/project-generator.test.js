/**
 * ONLUNET ZEKA - Project Generator Engine & HTTP API Test Suite
 * Verifies project synthesis, multi-template support, controlled mutation,
 * and HTTP endpoints for automated project production.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import {
  createProjectGenerator,
  ProjectTemplates,
  TemplateMetadata
} from '../src/autonomous/project-generator.js';
import { createApplicationServer } from '../src/app/server.js';
import { createStandardLocalProvider } from '../src/app/ai-gateway.js';

describe('ONLUNET ZEKA — Project Generator Engine', () => {
  const testWorkspaceRoot = path.join(process.cwd(), 'scratch-test-workspace');

  before(() => {
    if (!fs.existsSync(testWorkspaceRoot)) {
      fs.mkdirSync(testWorkspaceRoot, { recursive: true });
    }
  });

  after(() => {
    if (fs.existsSync(testWorkspaceRoot)) {
      fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
    }
  });

  test('1. Discovers all built-in project templates', () => {
    const generator = createProjectGenerator();
    const templates = generator.getTemplates();
    assert.ok(Array.isArray(templates));
    assert.strictEqual(templates.length, 7);

    const ids = templates.map(t => t.id);
    assert.ok(ids.includes(ProjectTemplates.EXPRESS_API));
    assert.ok(ids.includes(ProjectTemplates.WEB_APP));
    assert.ok(ids.includes(ProjectTemplates.PYTHON_CLI));
    assert.ok(ids.includes(ProjectTemplates.FULLSTACK_TODO));
    assert.ok(ids.includes(ProjectTemplates.NODE_CLI));
    assert.ok(ids.includes(ProjectTemplates.ECOMMERCE_B2B));
    assert.ok(ids.includes(ProjectTemplates.SAAS_PORTAL));
  });

  test('2. Accurately detects project type from natural language prompt', () => {
    const generator = createProjectGenerator();
    assert.strictEqual(generator.detectProjectType('Bana bir Express REST API üret'), ProjectTemplates.EXPRESS_API);
    assert.strictEqual(generator.detectProjectType('Modern web frontend arayüzü yap'), ProjectTemplates.WEB_APP);
    assert.strictEqual(generator.detectProjectType('Python ile veri işleme aracı yap'), ProjectTemplates.PYTHON_CLI);
    assert.strictEqual(generator.detectProjectType('Todo uygulaması oluştur'), ProjectTemplates.FULLSTACK_TODO);
  });

  test('3. Synthesizes complete Express REST API project with valid files and tests', async () => {
    const generator = createProjectGenerator();
    const syn = await generator.synthesizeProject({
      prompt: 'Sipariş takip için Express REST API projesi üret',
      projectName: 'order-api',
      projectType: ProjectTemplates.EXPRESS_API
    });

    assert.strictEqual(syn.projectName, 'order-api');
    assert.strictEqual(syn.projectType, ProjectTemplates.EXPRESS_API);
    assert.ok(syn.files.length >= 6);

    const paths = syn.files.map(f => f.path);
    assert.ok(paths.includes('package.json'));
    assert.ok(paths.includes('src/server.js'));
    assert.ok(paths.includes('src/routes/items.js'));
    assert.ok(paths.includes('src/storage/db.js'));
    assert.ok(paths.includes('tests/api.test.js'));
    assert.ok(paths.includes('README.md'));

    // Check package.json has test and start scripts
    const pkgFile = syn.files.find(f => f.path === 'package.json');
    const pkgJson = JSON.parse(pkgFile.content);
    assert.strictEqual(pkgJson.scripts.start, 'node src/server.js');
    assert.strictEqual(pkgJson.scripts.test, 'node --test tests/*.test.js');
  });

  test('4. Synthesizes complete Web SPA project with HTML, CSS, JS', async () => {
    const generator = createProjectGenerator();
    const syn = await generator.synthesizeProject({
      prompt: 'Web kontrol paneli üret',
      projectName: 'panel-app',
      projectType: ProjectTemplates.WEB_APP
    });

    assert.strictEqual(syn.projectType, ProjectTemplates.WEB_APP);
    const paths = syn.files.map(f => f.path);
    assert.ok(paths.includes('index.html'));
    assert.ok(paths.includes('css/style.css'));
    assert.ok(paths.includes('js/app.js'));
    assert.ok(paths.includes('README.md'));
  });

  test('5. Synthesizes Python CLI tool with core engine, CLI, and unittest', async () => {
    const generator = createProjectGenerator();
    const syn = await generator.synthesizeProject({
      prompt: 'Python veri analiz aracı',
      projectName: 'data-tool',
      projectType: ProjectTemplates.PYTHON_CLI
    });

    assert.strictEqual(syn.projectType, ProjectTemplates.PYTHON_CLI);
    const paths = syn.files.map(f => f.path);
    assert.ok(paths.includes('main.py'));
    assert.ok(paths.includes('core/engine.py'));
    assert.ok(paths.includes('tests/test_engine.py'));
    assert.ok(paths.includes('requirements.txt'));
  });

  test('6. Creates authoritative ExecutionPlanContract with authoritativeFileMutations', async () => {
    const generator = createProjectGenerator();
    const syn = await generator.synthesizeProject({
      prompt: 'Hızlı API servisi',
      projectName: 'quick-api',
      targetDirectory: 'quick-api'
    });

    const plan = generator.createProjectPlan({ synthesis: syn, workspaceRoot: testWorkspaceRoot });
    assert.ok(plan.id.startsWith('plan-proj-'));
    assert.ok(plan.taskId.startsWith('task-proj-'));
    assert.strictEqual(plan.workspaceRoot, testWorkspaceRoot);
    assert.strictEqual(plan.authoritativeFileMutations.length, syn.files.length);
    assert.strictEqual(plan.expectedFileChanges.length, syn.files.length);
  });

  test('7. Safely executes project generation with full preflight & controlled mutation', async () => {
    const generator = createProjectGenerator();
    const syn = await generator.synthesizeProject({
      prompt: 'Test mikroservisi',
      projectName: 'micro-svc',
      targetDirectory: 'micro-svc'
    });

    const plan = generator.createProjectPlan({ synthesis: syn, workspaceRoot: testWorkspaceRoot });
    const result = await generator.applyProjectPlan({
      plan,
      workspaceRoot: testWorkspaceRoot,
      approval: true,
      dryRun: false
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.failedFiles.length, 0);
    assert.strictEqual(result.writtenFiles.length, syn.files.length);
    assert.ok(result.totalBytesWritten > 0);

    // Verify files exist on actual disk
    for (const file of syn.files) {
      const diskPath = path.join(testWorkspaceRoot, 'micro-svc', file.path);
      assert.ok(fs.existsSync(diskPath), `Expected file to exist on disk: ${diskPath}`);
      const content = fs.readFileSync(diskPath, 'utf-8');
      assert.ok(content.length > 0, `Expected file to have content: ${diskPath}`);
    }
  });

  test('8. Rejects mutation when approval is explicitly denied', async () => {
    const generator = createProjectGenerator();
    const syn = await generator.synthesizeProject({
      prompt: 'Onaysız proje',
      projectName: 'denied-proj',
      targetDirectory: 'denied-proj'
    });

    const plan = generator.createProjectPlan({ synthesis: syn, workspaceRoot: testWorkspaceRoot });
    const result = await generator.applyProjectPlan({
      plan,
      workspaceRoot: testWorkspaceRoot,
      approval: false // Denied
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.writtenFiles.length, 0);
    assert.strictEqual(result.failedFiles.length, syn.files.length);
  });
});

describe('ONLUNET ZEKA — Server Project Generation HTTP API', () => {
  let server;
  let baseUrl;
  const httpWorkspace = path.join(process.cwd(), 'scratch-http-workspace');

  before((t, done) => {
    if (!fs.existsSync(httpWorkspace)) {
      fs.mkdirSync(httpWorkspace, { recursive: true });
    }
    server = createApplicationServer();
    server.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });

  after((t, done) => {
    if (fs.existsSync(httpWorkspace)) {
      fs.rmSync(httpWorkspace, { recursive: true, force: true });
    }
    server.close(done);
  });

  test('1. GET /api/templates returns available project templates', async () => {
    const res = await fetch(`${baseUrl}/api/templates`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.templates));
    assert.strictEqual(data.templates.length, 7);
  });

  test('2. POST /api/project/plan synthesizes project and builds authoritative plan', async () => {
    // Select workspace first
    await fetch(`${baseUrl}/api/workspace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath: httpWorkspace })
    });

    const res = await fetch(`${baseUrl}/api/project/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Express REST API projesi üret',
        projectName: 'demo-api',
        targetDirectory: 'demo-api'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.synthesis.projectName, 'demo-api');
    assert.ok(data.synthesis.files.length >= 6);
    assert.ok(data.authoritativePlanId);
  });

  test('3. POST /api/project/generate applies plan mutations to disk and verifies', async () => {
    const res = await fetch(`${baseUrl}/api/project/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approval: true })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.status, 'COMPLETED');
    assert.ok(data.result.writtenFiles.length >= 6);
    assert.ok(data.result.verification.allFilesExist);

    // Verify files created in httpWorkspace
    const serverJsPath = path.join(httpWorkspace, 'demo-api', 'src', 'server.js');
    assert.ok(fs.existsSync(serverJsPath));
  });

  test('4. Default AI Provider in ai-gateway.js generates project plan when asked', async () => {
    const localProvider = createStandardLocalProvider();
    const chatRes = await localProvider.chat({ task: 'Yeni bir Express REST API projesi üret' });
    assert.ok(chatRes.proposedFileMutations.length >= 6);
    assert.ok(chatRes.analysis.includes('Otonom Proje'));
  });
});
