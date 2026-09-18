import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmpDir = path.join(os.tmpdir(), 'onlunet_delete_test_' + Date.now());
const projDir = path.join(tmpDir, 'projeler');

function setupTestDir() {
  fs.mkdirSync(projDir, { recursive: true });
}

function cleanupTestDir() {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
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

describe('Project Deletion & Security Suite', () => {
  it('1. Rejects empty or invalid projectId', () => {
    setupTestDir();
    const res = deleteProject(tmpDir, '');
    assert.strictEqual(res.success, false);
    cleanupTestDir();
  });

  it('2. Blocks path traversal attacks (../, nested paths)', () => {
    setupTestDir();
    const res1 = deleteProject(tmpDir, '../../../etc/passwd');
    assert.strictEqual(res1.success, false);
    assert.ok(res1.error.includes('Güvenlik engeli'));

    const res2 = deleteProject(tmpDir, '..\\..\\windows\\system32');
    assert.strictEqual(res2.success, false);
    cleanupTestDir();
  });

  it('3. Returns 404/not found when project directory does not exist', () => {
    setupTestDir();
    const res = deleteProject(tmpDir, 'non-existent-project');
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('bulunamadı'));
    cleanupTestDir();
  });

  it('4. Successfully deletes an existing project and all its subfolders', () => {
    setupTestDir();
    const sampleProj = path.join(projDir, 'sample-firm');
    fs.mkdirSync(path.join(sampleProj, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(sampleProj, 'storage'), { recursive: true });
    fs.writeFileSync(path.join(sampleProj, 'project.json'), JSON.stringify({ id: 'sample-firm' }));
    fs.writeFileSync(path.join(sampleProj, 'storage', 'database.sqlite'), 'DUMMY_DB');

    assert.ok(fs.existsSync(sampleProj));

    const res = deleteProject(tmpDir, 'sample-firm');
    assert.strictEqual(res.success, true);
    assert.strictEqual(fs.existsSync(sampleProj), false);
    cleanupTestDir();
  });
});
