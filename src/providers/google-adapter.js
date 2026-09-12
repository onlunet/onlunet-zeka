/**
 * ONLUNET ZEKA - Google Gemini Real Provider Adapter
 * FAZ 58-66 Architecture: Outbound Google Gemini API Adapter
 *
 * Calls Google Generative Language API via native fetch with timeout,
 * strict secret redaction, and canonical response normalization.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js fetch & AbortController only.
 */
import tls from 'node:tls';
import { sanitizeString, sanitizeHeaders, sanitizeError } from './credential-sanitizer.js';
import { calculateCost, estimateTokenCount } from './cost-tracker.js';
import { ProviderCapabilities } from './provider-capabilities.js';
import { computeCredentialFingerprint } from './credential-pool.js';

// Safely register Windows/System root CA certificates if running in Node 24+ without insecure bypasses
if (typeof tls.getCACertificates === 'function' && typeof tls.setDefaultCACertificates === 'function') {
  try {
    const sysCerts = tls.getCACertificates('system');
    if (Array.isArray(sysCerts) && sysCerts.length > 0) {
      tls.setDefaultCACertificates(sysCerts);
    }
  } catch {
    // Fail-open safely to default Mozilla roots without weakening TLS verification
  }
}

export function createGoogleProviderAdapter({
  providerId = 'google',
  apiKey = undefined,
  model = 'gemini-1.5-flash',
  baseURL = 'https://generativelanguage.googleapis.com/v1beta',
  timeoutMs = 15000,
  defaultSystemPrompt = 'You are a specialist AI agent. Output strictly valid JSON with keys: rationale, operations (array of {type, target, description}), proposedFiles, proposedTests, risks, assumptions.'
} = {}) {
  if (apiKey === undefined && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile('.env');
    } catch {
      // Fail closed silently if .env is missing or invalid
    }
  }

  const resolvedApiKey = apiKey !== undefined ? apiKey : (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null);
  const resolvedModel = model || process.env.GEMINI_MODEL || process.env.GOOGLE_MODEL || 'gemini-1.5-flash';
  const resolvedBaseURL = baseURL || process.env.GEMINI_BASE_URL || process.env.GOOGLE_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
  const cleanProviderId = String(providerId || 'google').trim();

  const capabilities = Object.freeze([
    ProviderCapabilities.TEXT,
    ProviderCapabilities.STRUCTURED_OUTPUT,
    ProviderCapabilities.CODE_GENERATION,
    ProviderCapabilities.REASONING,
    ProviderCapabilities.TOOL_USE,
    ProviderCapabilities.STREAMING,
    ProviderCapabilities.JSON_MODE,
    ProviderCapabilities.FAST_INFERENCE,
    ProviderCapabilities.LONG_CONTEXT
  ]);

  return Object.freeze({
    providerId: cleanProviderId,
    name: 'Google Gemini Provider Gateway',
    model: resolvedModel,
    baseURL: resolvedBaseURL,
    hasCredentials: Boolean(resolvedApiKey),
    capabilities,

    async checkHealth() {
      if (!resolvedApiKey) {
        return {
          status: 'CREDENTIALS_UNCONFIGURED',
          providerId: cleanProviderId,
          message: 'GEMINI_API_KEY / GOOGLE_API_KEY is not set in environment or configuration',
          ready: false
        };
      }

      return {
        status: 'HEALTHY',
        providerId: cleanProviderId,
        message: 'Google Gemini credentials configured and ready',
        ready: true
      };
    },

    healthCheck() {
      return this.checkHealth();
    },

    async discoverModels({ signal = null } = {}) {
      if (!resolvedApiKey) {
        return Object.freeze({
          providerId: cleanProviderId,
          discoveredAt: new Date().toISOString(),
          source: 'error',
          live: false,
          status: 'DEFERRED',
          reason: 'CREDENTIALS_UNCONFIGURED',
          models: Object.freeze([])
        });
      }

      try {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), 15000);
        if (signal) {
          signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        const resp = await fetch(`${resolvedBaseURL}/models?key=${resolvedApiKey}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutHandle);

        if (!resp.ok) {
          return Object.freeze({
            providerId: cleanProviderId,
            discoveredAt: new Date().toISOString(),
            source: 'error',
            live: false,
            status: 'DEFERRED',
            reason: `MODEL_DISCOVERY_FAILED_HTTP_${resp.status}`,
            models: Object.freeze([])
          });
        }

        const data = await resp.json();
        const rawList = Array.isArray(data.models) ? data.models : [];
        const generateModels = rawList.filter(m => {
          if (!m || !m.name) return false;
          if (Array.isArray(m.supportedGenerationMethods)) {
            return m.supportedGenerationMethods.includes('generateContent');
          }
          return true;
        });

        const normalizedModels = generateModels.map(m => {
          const mId = String(m.name || '').replace(/^models\//, '');
          const mCaps = [...capabilities];
          const mLower = mId.toLowerCase();
          if (mLower.includes('flash')) mCaps.push('fast_inference');
          if (mLower.includes('pro')) mCaps.push('reasoning', 'long_context');
          if (mLower.includes('vision') || mLower.includes('gemini')) mCaps.push('vision', 'image_input');

          return Object.freeze({
            id: mId,
            providerId: cleanProviderId,
            capabilities: Object.freeze(Array.from(new Set(mCaps))),
            contextWindow: m.inputTokenLimit || 1048576,
            inputModalities: Object.freeze(['text', 'image']),
            outputModalities: Object.freeze(['text']),
            status: 'AVAILABLE',
            rawMetadata: m
          });
        });

        return Object.freeze({
          providerId: cleanProviderId,
          discoveredAt: new Date().toISOString(),
          source: 'live_api',
          live: true,
          status: 'AVAILABLE',
          models: Object.freeze(normalizedModels)
        });
      } catch (err) {
        return Object.freeze({
          providerId: cleanProviderId,
          discoveredAt: new Date().toISOString(),
          source: 'error',
          live: false,
          status: 'DEFERRED',
          reason: 'DISCOVERY_UNAVAILABLE',
          error: sanitizeString(err.message),
          models: Object.freeze([])
        });
      }
    },

    async invoke({
      prompt,
      agentRole = 'DEVELOPER',
      systemPrompt = null,
      constraints = {},
      metadata = {},
      signal = null
    } = {}) {
      const activeApiKey = (metadata && metadata.apiKey) ? String(metadata.apiKey).trim() : resolvedApiKey;
      if (!activeApiKey) {
        const err = new Error('Google Gemini invocation failed: GEMINI_API_KEY is not configured');
        err.code = 'CREDENTIALS_UNCONFIGURED';
        throw err;
      }

      const credentialId = (metadata && metadata.credentialId) ? String(metadata.credentialId).trim() : 'gemini-account-01';
      const credentialFingerprint = (metadata && metadata.credentialFingerprint) || computeCredentialFingerprint(activeApiKey);

      const promptText = typeof prompt === 'string' ? prompt : (prompt && prompt.task ? prompt.task : JSON.stringify(prompt));
      const roleSystemPrompt = systemPrompt || `${defaultSystemPrompt} Your assigned role is: ${agentRole}.`;

      const userParts = [{ text: promptText }];
      const images = (metadata && metadata.images) || (prompt && prompt.images) || (constraints && constraints.images);
      if (Array.isArray(images)) {
        for (const img of images) {
          if (img && img.data) {
            userParts.push({
              inlineData: {
                mimeType: img.mimeType || 'image/png',
                data: img.data
              }
            });
          } else if (img && img.inlineData) {
            userParts.push({ inlineData: img.inlineData });
          }
        }
      }

      const requestBody = {
        systemInstruction: {
          parts: [{ text: roleSystemPrompt }]
        },
        contents: [
          {
            role: 'user',
            parts: userParts
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      };

      const headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': activeApiKey
      };

      const requestedModel = String((metadata && metadata.model) || (constraints && constraints.model) || resolvedModel).trim();
      let targetModel = requestedModel;
      let isSubstituted = false;
      let substitutionReason = null;

      const endpoint = `${resolvedBaseURL}/models/${targetModel}:generateContent`;

      const startTime = Date.now();
      let response;

      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal
        });

        // Transparent failover for retired models returning HTTP 404 (with explicit telemetry tracking)
        if (!response.ok && response.status === 404) {
          const fallbackCandidates = (metadata && metadata.fallbackModel)
            ? [String(metadata.fallbackModel).trim()]
            : ((targetModel === 'gemini-1.5-flash' || targetModel === 'gemini-2.5-flash') ? ['gemini-3.8-flash', 'gemini-3.6-flash'] : []);

          for (const fallbackModel of fallbackCandidates) {
            const fallbackEndpoint = `${resolvedBaseURL}/models/${fallbackModel}:generateContent`;
            try {
              const fallbackResp = await fetch(fallbackEndpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody),
                signal
              });
              if (fallbackResp.ok) {
                response = fallbackResp;
                targetModel = fallbackModel;
                isSubstituted = true;
                substitutionReason = 'MODEL_NOT_FOUND_404_SUBSTITUTION';
                break;
              }
            } catch {
              // Continue to next fallback candidate
            }
          }
        }
      } catch (networkErr) {
        const cleaned = sanitizeError(networkErr);
        if (networkErr.name === 'AbortError') {
          cleaned.status = 408;
          cleaned.code = 'TIMEOUT';
        } else {
          cleaned.code = cleaned.code || 'NETWORK_ERROR';
        }
        throw cleaned;
      }

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        const cleanedMsg = sanitizeString(errorText);
        const err = new Error(`Google Gemini API error (${response.status}): ${cleanedMsg}`);
        err.status = response.status;
        err.requestedModel = requestedModel;
        err.actualModel = targetModel;
        err.credentialId = credentialId;
        err.credentialFingerprint = credentialFingerprint;
        if (response.status === 404) {
          err.code = 'NOT_FOUND';
        } else if (response.status === 401) {
          err.code = 'AUTHENTICATION_FAILED';
        } else if (response.status === 403) {
          err.code = 'PERMISSION_DENIED';
        } else if (response.status === 429) {
          err.code = 'RATE_LIMITED';
          const retryAfter = response.headers.get('retry-after');
          if (retryAfter) {
            err.retryAfter = parseInt(retryAfter, 10) || 2;
          }
        } else if (response.status >= 500) {
          err.code = 'SERVER_ERROR';
        } else {
          err.code = 'PROVIDER_ERROR';
        }
        throw err;
      }

      let rawJson;
      try {
        rawJson = await response.json();
      } catch (parseErr) {
        const err = new Error(`Failed to parse JSON response from Google Gemini: ${sanitizeString(parseErr.message)}`);
        err.code = 'PROVIDER_INVALID_RESPONSE';
        err.status = response.status;
        throw err;
      }

      if (!rawJson || typeof rawJson !== 'object') {
        const err = new Error('Invalid non-object JSON payload received from Google Gemini');
        err.code = 'PROVIDER_INVALID_RESPONSE';
        err.status = response.status;
        throw err;
      }

      const candidate = (rawJson.candidates && rawJson.candidates[0]) || {};
      const parts = (candidate.content && candidate.content.parts) || [];
      const textContent = parts.map(p => p.text || '').join('\n');

      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(textContent);
      } catch (e) {
        const match = textContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) {
          try {
            parsedPayload = JSON.parse(match[1]);
          } catch {
            parsedPayload = { rationale: textContent };
          }
        } else {
          parsedPayload = { rationale: textContent };
        }
      }

      const usageMetadata = rawJson.usageMetadata || {};
      const inputTokens = usageMetadata.promptTokenCount ?? estimateTokenCount(promptText);
      const thoughtsTokens = usageMetadata.thoughtsTokenCount ?? 0;
      const candidatesTokens = usageMetadata.candidatesTokenCount ?? estimateTokenCount(textContent);
      // In Google Gemini reasoning models, output tokens consist of visible candidates and internal thoughts tokens.
      const outputTokens = candidatesTokens + thoughtsTokens;
      const totalTokens = usageMetadata.totalTokenCount ?? (inputTokens + outputTokens);

      const actualModel = targetModel;
      const modelVersion = rawJson.modelVersion || actualModel;

      if (requestedModel !== actualModel) {
        isSubstituted = true;
        substitutionReason = substitutionReason || 'MODEL_SUBSTITUTION';
      }

      const costInfo = calculateCost({
        providerId: cleanProviderId,
        model: actualModel,
        inputTokens,
        outputTokens
      });

      return {
        ...parsedPayload,
        model: actualModel,
        requestedModel,
        actualModel,
        modelVersion,
        isSubstituted,
        substitutionReason,
        credentialId,
        accountId: credentialId,
        credentialFingerprint,
        providerId: cleanProviderId,
        latencyMs,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          candidatesTokens,
          thoughtsTokens
        },
        cost: costInfo,
        finishReason: candidate.finishReason || 'STOP',
        rawContent: textContent,
        output: textContent,
        proposalOnly: true,
        executionAuthorized: false,
        isProposal: true
      };
    }
  });
}

export function createGeminiProviderAdapter(options = {}) {
  return createGoogleProviderAdapter({ providerId: 'gemini', ...options });
}
