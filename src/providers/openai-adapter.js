/**
 * ONLUNET ZEKA - OpenAI Real Provider Adapter
 * FAZ 58 Foundation: Outbound OpenAI API Gateway Adapter
 *
 * Calls OpenAI Chat Completions API via native fetch with timeout,
 * strict secret redaction, and response normalization.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js fetch & AbortController only.
 */
import { sanitizeString, sanitizeHeaders, sanitizeError } from './credential-sanitizer.js';
import { calculateCost, estimateTokenCount } from './cost-tracker.js';
import { ProviderCapabilities } from './provider-capabilities.js';

export function createOpenAIProviderAdapter({
  apiKey = undefined,
  model = 'gpt-4o-mini',
  baseURL = 'https://api.openai.com/v1',
  organization = null,
  project = null,
  timeoutMs = 15000,
  defaultSystemPrompt = 'You are a specialist AI agent. Output strictly valid JSON with keys: rationale, operations (array of {type, target, description}), proposedFiles, proposedTests, risks, assumptions.'
} = {}) {
  const resolvedApiKey = apiKey !== undefined ? apiKey : (process.env.OPENAI_API_KEY || null);
  const resolvedModel = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const resolvedBaseURL = baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  const capabilities = Object.freeze([
    ProviderCapabilities.TEXT,
    ProviderCapabilities.STRUCTURED_OUTPUT,
    ProviderCapabilities.CODE_GENERATION,
    ProviderCapabilities.REASONING,
    ProviderCapabilities.TOOL_USE,
    ProviderCapabilities.STREAMING,
    ProviderCapabilities.JSON_MODE
  ]);

  return Object.freeze({
    providerId: 'openai',
    name: 'OpenAI Provider Gateway',
    model: resolvedModel,
    baseURL: resolvedBaseURL,
    hasCredentials: Boolean(resolvedApiKey),
    capabilities,

    async checkHealth() {
      if (!resolvedApiKey) {
        return {
          status: 'CREDENTIALS_UNCONFIGURED',
          providerId: 'openai',
          message: 'OPENAI_API_KEY is not set in environment or configuration',
          ready: false
        };
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${baseURL}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${resolvedApiKey}`
          },
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (res.ok) {
          return { status: 'HEALTHY', providerId: 'openai', ready: true };
        }
        if (res.status === 401) {
          return {
            status: 'AUTHENTICATION_FAILED',
            providerId: 'openai',
            ready: false,
            httpStatus: 401,
            error: 'OpenAI API key authentication failed (401)'
          };
        }
        return {
          status: 'DEGRADED',
          providerId: 'openai',
          ready: false,
          httpStatus: res.status,
          error: sanitizeString(await res.text())
        };
      } catch (err) {
        return {
          status: 'UNAVAILABLE',
          providerId: 'openai',
          ready: false,
          error: sanitizeString(err.message)
        };
      }
    },

    healthCheck() {
      return this.checkHealth();
    },

    async invoke({
      prompt,
      agentRole = 'DEVELOPER',
      systemPrompt = null,
      constraints = {},
      metadata = {},
      signal = null
    } = {}) {
      if (!resolvedApiKey) {
        const err = new Error('OpenAI invocation failed: OPENAI_API_KEY is not configured');
        err.code = 'CREDENTIALS_UNCONFIGURED';
        throw err;
      }

      const promptText = typeof prompt === 'string' ? prompt : (prompt && prompt.task ? prompt.task : JSON.stringify(prompt));
      const roleSystemPrompt = systemPrompt || `${defaultSystemPrompt} Your assigned role is: ${agentRole}.`;

      const requestBody = {
        model: resolvedModel,
        messages: [
          { role: 'system', content: roleSystemPrompt },
          { role: 'user', content: promptText }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resolvedApiKey}`
      };
      if (organization) headers['OpenAI-Organization'] = organization;
      if (project) headers['OpenAI-Project'] = project;

      const startTime = Date.now();
      let response;

      try {
        response = await fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal
        });
      } catch (networkErr) {
        const cleaned = sanitizeError(networkErr);
        if (networkErr.name === 'AbortError') {
          cleaned.status = 408;
          cleaned.code = 'TIMEOUT';
        }
        throw cleaned;
      }

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        const cleanedMsg = sanitizeString(errorText);
        const err = new Error(`OpenAI API error (${response.status}): ${cleanedMsg}`);
        err.status = response.status;
        if (response.status === 401) {
          err.code = 'AUTHENTICATION_FAILED';
        } else if (response.status === 403) {
          err.code = 'PERMISSION_DENIED';
        } else if (response.status === 429) {
          err.code = 'RATE_LIMITED';
        } else if (response.status >= 500) {
          err.code = 'SERVER_ERROR';
        } else {
          err.code = 'PROVIDER_ERROR';
        }
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          if (retryAfter) {
            err.retryAfter = parseInt(retryAfter, 10) || 2;
          }
        }
        throw err;
      }

      let rawJson;
      try {
        rawJson = await response.json();
      } catch (parseErr) {
        const err = new Error(`Failed to parse JSON response from OpenAI: ${sanitizeString(parseErr.message)}`);
        err.code = 'PROVIDER_INVALID_RESPONSE';
        err.status = response.status;
        throw err;
      }

      if (!rawJson || typeof rawJson !== 'object') {
        const err = new Error('Invalid non-object JSON payload received from OpenAI');
        err.code = 'PROVIDER_INVALID_RESPONSE';
        err.status = response.status;
        throw err;
      }

      const choice = (rawJson.choices && rawJson.choices[0]) || {};
      const messageContent = (choice.message && choice.message.content) || '{}';

      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(messageContent);
      } catch (e) {
        // Fallback: search for markdown fenced json
        const match = messageContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) {
          try {
            parsedPayload = JSON.parse(match[1]);
          } catch {
            parsedPayload = { rationale: messageContent };
          }
        } else {
          parsedPayload = { rationale: messageContent };
        }
      }

      const usage = rawJson.usage || {};
      const inputTokens = usage.prompt_tokens || estimateTokenCount(promptText);
      const outputTokens = usage.completion_tokens || estimateTokenCount(messageContent);
      const totalTokens = usage.total_tokens || (inputTokens + outputTokens);

      const costInfo = calculateCost({
        providerId: 'openai',
        model: resolvedModel,
        inputTokens,
        outputTokens
      });

      return {
        ...parsedPayload,
        model: rawJson.model || resolvedModel,
        providerId: 'openai',
        latencyMs,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens
        },
        cost: costInfo,
        finishReason: choice.finish_reason || 'stop',
        rawContent: messageContent,
        output: messageContent
      };
    }
  });
}
