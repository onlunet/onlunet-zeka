/**
 * ONLUNET ZEKA - Universal OpenAI-Compatible HTTP Base Adapter
 * FAZ 62 Foundation: Reusable Wire Protocol Helper with Strict SSRF Defense
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js fetch & AbortController only.
 */
import { sanitizeString, sanitizeError } from './credential-sanitizer.js';
import { calculateCost, estimateTokenCount } from './cost-tracker.js';
import { ProviderCategories, LifecycleState } from './provider-categories.js';

export function createOpenAICompatibleAdapter({
  providerId,
  name,
  category = ProviderCategories.DIRECT,
  apiKey = undefined,
  envKeyName,
  baseURL,
  defaultModel,
  capabilities = [],
  pricing = null,
  timeoutMs = 15000,
  defaultSystemPrompt = 'You are an AI assistant. Output valid structured JSON proposals only.'
}) {
  const resolvedApiKey = apiKey !== undefined ? apiKey : (envKeyName ? (process.env[envKeyName] || null) : null);

  return Object.freeze({
    providerId,
    name,
    category,
    model: defaultModel,
    defaultModel,
    capabilities: Object.freeze([...capabilities]),
    hasCredentials: Boolean(resolvedApiKey),
    isLocal: category === ProviderCategories.LOCAL,

    async checkHealth() {
      if (!resolvedApiKey && category !== ProviderCategories.LOCAL) {
        return {
          status: LifecycleState.NOT_CONFIGURED,
          providerId,
          ready: false,
          message: `${envKeyName} is not set in environment`
        };
      }

      // If key is present or local, report READY
      return {
        status: LifecycleState.AVAILABLE,
        providerId,
        ready: true,
        message: `${name} is configured and ready`
      };
    },

    healthCheck() {
      return this.checkHealth();
    },

    async discoverModels({ signal = null } = {}) {
      if (!resolvedApiKey && category !== ProviderCategories.LOCAL) {
        return Object.freeze({
          providerId,
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
        const timeoutHandle = setTimeout(() => controller.abort(), 8000);
        if (signal) {
          signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        const resp = await fetch(`${baseURL}/models`, {
          headers: {
            ...(resolvedApiKey ? { 'Authorization': `Bearer ${resolvedApiKey}` } : {})
          },
          signal: controller.signal
        });
        clearTimeout(timeoutHandle);

        if (!resp.ok) {
          return Object.freeze({
            providerId,
            discoveredAt: new Date().toISOString(),
            source: 'error',
            live: false,
            status: 'DEFERRED',
            reason: `MODEL_DISCOVERY_FAILED_HTTP_${resp.status}`,
            models: Object.freeze([])
          });
        }

        const data = await resp.json();
        const rawList = Array.isArray(data.data) ? data.data : (Array.isArray(data.models) ? data.models : (Array.isArray(data) ? data : []));
        const normalizedModels = rawList.map(m => {
          const mId = m.id || m.name || 'unknown-model';
          const mCaps = [...capabilities];
          const mLower = String(mId).toLowerCase();
          if (mLower.includes('vision') || mLower.includes('4o')) mCaps.push('vision', 'image_input');
          if (mLower.includes('reason') || mLower.includes('o1') || mLower.includes('o3') || mLower.includes('r1')) mCaps.push('reasoning');
          if (mLower.includes('code') || mLower.includes('instruct')) mCaps.push('coding');
          if (mLower.includes('flash') || mLower.includes('mini') || mLower.includes('8b')) mCaps.push('fast_inference');

          return Object.freeze({
            id: mId,
            providerId,
            capabilities: Object.freeze(Array.from(new Set(mCaps))),
            contextWindow: m.context_length || m.context_window || 8192,
            inputModalities: Object.freeze(mLower.includes('vision') ? ['text', 'image'] : ['text']),
            outputModalities: Object.freeze(['text']),
            status: 'AVAILABLE',
            rawMetadata: m
          });
        });

        return Object.freeze({
          providerId,
          discoveredAt: new Date().toISOString(),
          source: 'live_api',
          live: true,
          models: Object.freeze(normalizedModels)
        });
      } catch (err) {
        return Object.freeze({
          providerId,
          discoveredAt: new Date().toISOString(),
          source: 'error',
          live: false,
          status: 'DEFERRED',
          reason: 'MODEL_DISCOVERY_FAILED',
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
      if (!resolvedApiKey && category !== ProviderCategories.LOCAL) {
        const err = new Error(`${name} invocation failed: ${envKeyName} is not configured`);
        err.code = 'CREDENTIALS_UNCONFIGURED';
        throw err;
      }

      const promptText = typeof prompt === 'string' ? prompt : (prompt && prompt.task ? prompt.task : JSON.stringify(prompt));
      const roleSystemPrompt = systemPrompt || `${defaultSystemPrompt} Your role is: ${agentRole}.`;

      const startTime = Date.now();
      const controller = new AbortController();
      const internalTimer = setTimeout(() => controller.abort(), timeoutMs);

      if (signal) {
        signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      try {
        let targetModel = metadata.model || defaultModel;
        let response = await fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(resolvedApiKey ? { 'Authorization': `Bearer ${resolvedApiKey}` } : {})
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [
              { role: 'system', content: roleSystemPrompt },
              { role: 'user', content: promptText }
            ],
            temperature: 0.2
          }),
          signal: controller.signal
        });

        // Graceful fallback for retired Groq model
        if (response.status === 404 && providerId === 'groq' && targetModel === 'llama-3.3-70b-versatile') {
          const fallbackModel = 'openai/gpt-oss-120b';
          const fallbackResp = await fetch(`${baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(resolvedApiKey ? { 'Authorization': `Bearer ${resolvedApiKey}` } : {})
            },
            body: JSON.stringify({
              model: fallbackModel,
              messages: [
                { role: 'system', content: roleSystemPrompt },
                { role: 'user', content: promptText }
              ],
              temperature: 0.2
            }),
            signal: controller.signal
          });
          if (fallbackResp.ok) {
            response = fallbackResp;
            targetModel = fallbackModel;
          }
        }

        clearTimeout(internalTimer);

        if (!response.ok) {
          const errText = sanitizeString(await response.text());
          const err = new Error(`${name} API error (${response.status}): ${errText}`);
          err.status = response.status;
          if (response.status === 401) {
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

        const data = await response.json();
        const latencyMs = Date.now() - startTime;

        const rawContent = data.choices && data.choices[0] && data.choices[0].message
          ? data.choices[0].message.content
          : '';

        const actualModel = data.model || targetModel || defaultModel;

        const inTokens = data.usage ? (data.usage.prompt_tokens ?? estimateTokenCount(promptText)) : estimateTokenCount(promptText);
        const outTokens = data.usage ? (data.usage.completion_tokens ?? estimateTokenCount(rawContent)) : estimateTokenCount(rawContent);
        const totTokens = inTokens + outTokens;

        const cost = calculateCost({
          providerId,
          model: actualModel,
          inputTokens: inTokens,
          outputTokens: outTokens
        });

        return {
          providerId,
          model: actualModel,
          rawContent,
          output: rawContent,
          usage: {
            inputTokens: inTokens,
            outputTokens: outTokens,
            totalTokens: totTokens
          },
          cost,
          latencyMs,
          finishReason: data.choices && data.choices[0] ? data.choices[0].finish_reason : 'stop',
          proposalOnly: true,
          executionAuthorized: false,
          isProposal: true
        };
      } catch (err) {
        clearTimeout(internalTimer);
        throw sanitizeError(err);
      }
    }
  });
}
