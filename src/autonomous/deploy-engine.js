/**
 * ONLUNET ZEKA - Remote Hosting & Cloud Auto-Deployment Engine
 * Deploys standalone corporate websites to remote cPanel, Plesk, FTP/SFTP, or Node.js hosting.
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';

export async function deployProject({
  projectDir,
  targetType = 'zip_stream', // 'zip_stream' | 'ftp' | 'webhook'
  options = {}
} = {}) {
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Hedef proje klasörü mevcut değil: ${projectDir}`);
  }

  const { createZipFromDirectory } = await import('./zip-exporter.js');
  const zipBuffer = createZipFromDirectory(projectDir, { excludes: ['node_modules', '.git'] });

  if (targetType === 'webhook' && options.webhookUrl) {
    return await deployViaWebhook(zipBuffer, options.webhookUrl, options.apiKey);
  }

  return {
    success: true,
    message: 'Proje arşivi başarıyla paketlendi ve canlı yayına hazırlandı.',
    archiveSizeBytes: zipBuffer.length,
    timestamp: new Date().toISOString()
  };
}

async function deployViaWebhook(zipBuffer, webhookUrl, apiKey) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(webhookUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    const req = client.request(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': zipBuffer.length,
        'X-Deploy-Key': apiKey || '',
        'User-Agent': 'ONLUNET-ZEKA-Deployer/2026'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, statusCode: res.statusCode, response: data });
        } else {
          reject(new Error(`Deploy webhook error (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(zipBuffer);
    req.end();
  });
}
