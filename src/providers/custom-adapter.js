/**
 * ONLUNET ZEKA - Real Local / Custom AI Provider Adapter
 * FAZ 58 Foundation: Outbound OpenAI-Compatible HTTP Adapter (Ollama, vLLM, LocalAI, LM Studio)
 *
 * Implements real HTTP communication with any local or custom OpenAI-compatible endpoint.
 * Configurable baseUrl, apiKey, model, and timeoutMs.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js fetch & AbortController only.
 */
import { sanitizeString, sanitizeHeaders, sanitizeError } from './credential-sanitizer.js';
import { calculateCost, estimateTokenCount } from './cost-tracker.js';
import { ProviderCapabilities } from './provider-gateway.js';
import { ErrorCodes } from '../contracts/constants.js';

/**
 * Validates and normalizes custom/local provider baseURL with strict SSRF defense.
 * - Enforces http: or https: protocols
 * - Rejects embedded credentials (username/password)
 * - Rejects cloud metadata endpoints (169.254.169.254, metadata.google.internal, etc.)
 * - Rejects path traversal in pathname
 * - Permits localhost, 127.0.0.1, [::1], and valid remote HTTP/HTTPS endpoints
 */
export function validateAndNormalizeProviderURL(rawURL) {
  if (!rawURL || typeof rawURL !== 'string' || rawURL.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Provider baseURL must be a non-empty string`);
  }
  const trimmed = rawURL.trim().replace(/\/+$/, '');

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (e) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid provider baseURL format: '${trimmed}'`);
  }

  // 1. Strict protocol validation (only http and https)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prohibited protocol '${parsed.protocol}'. Only http: and https: are allowed.`);
  }

  // 2. Reject embedded credentials in URL
  if (parsed.username || parsed.password) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Provider baseURL must not contain embedded credentials`);
  }

  // 3. Reject cloud metadata and link-local addresses (SSRF defense)
  const hostname = parsed.hostname.toLowerCase();
  const cleanHost = hostname.replace(/^\[|\]$/g, '');
  const blockedHosts = [
    '169.254.169.254',
    '169.254.169.253',
    'metadata.google.internal',
    'instance-data',
    'fd00:ec2::254'
  ];
  if (blockedHosts.includes(cleanHost) || cleanHost.startsWith('169.254.') || cleanHost.startsWith('fe80:')) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] SSRF blocked: Access to link-local/cloud metadata endpoint '${hostname}' is prohibited`);
  }

  // 4. Reject path traversal in pathname
  if (trimmed.includes('..') || parsed.pathname.includes('..')) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Path traversal prohibited in provider baseURL pathname: '${parsed.pathname}'`);
  }

  // 5. Reject control characters and protocol smuggling attempts
  if (trimmed.includes('\r') || trimmed.includes('\n') || trimmed.includes('\0')) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prohibited control characters in provider baseURL`);
  }

  return trimmed;
}

export function createCustomProviderAdapter({
  providerId = 'custom',
  name = 'Custom / Local AI Provider Gateway',
  baseURL = null,
  apiKey = null,
  model = null,
  timeoutMs = 15000,
  defaultSystemPrompt = 'You are a specialist AI agent. Output strictly valid JSON with keys: rationale, operations (array of {type, target, description}), proposedFiles, proposedTests, risks, assumptions.'
} = {}) {
  const candidateBaseURL = (
    baseURL ||
    process.env.CUSTOM_AI_BASE_URL ||
    process.env.LOCAL_AI_BASE_URL ||
    'http://localhost:11434/v1'
  );
  const resolvedBaseURL = validateAndNormalizeProviderURL(candidateBaseURL);

  const resolvedApiKey = apiKey || process.env.CUSTOM_AI_API_KEY || process.env.LOCAL_AI_API_KEY || null;
  const resolvedModel = model || process.env.CUSTOM_AI_MODEL || process.env.LOCAL_AI_MODEL || 'llama3';

  const capabilities = Object.freeze([
    ProviderCapabilities.TEXT,
    ProviderCapabilities.STRUCTURED_OUTPUT,
    ProviderCapabilities.CODE_GENERATION,
    ProviderCapabilities.LOCAL
  ]);

  async function checkHealth() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const headers = {};
      if (resolvedApiKey) {
        headers['Authorization'] = `Bearer ${resolvedApiKey}`;
      }

      const res = await fetch(`${resolvedBaseURL}/models`, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'error'
      });
      clearTimeout(timeout);

      if (res.ok) {
        return {
          status: 'HEALTHY',
          providerId,
          ready: true,
          endpoint: resolvedBaseURL,
          model: resolvedModel
        };
      }
      return {
        status: 'DEGRADED',
        providerId,
        ready: false,
        httpStatus: res.status,
        error: sanitizeString(await res.text())
      };
    } catch (err) {
      return {
        status: 'UNAVAILABLE',
        providerId,
        ready: false,
        endpoint: resolvedBaseURL,
        error: sanitizeString(err.message)
      };
    }
  }

  async function invoke({
    prompt,
    agentRole = 'DEVELOPER',
    systemPrompt = null,
    constraints = {},
    metadata = {},
    signal = null
  } = {}) {
    const promptText = typeof prompt === 'string' ? prompt : (prompt && prompt.task ? prompt.task : JSON.stringify(prompt));
    const roleSystemPrompt = systemPrompt || `${defaultSystemPrompt} Your assigned role is: ${agentRole}.`;

    const requestBody = {
      model: resolvedModel,
      messages: [
        { role: 'system', content: roleSystemPrompt },
        { role: 'user', content: promptText }
      ],
      temperature: 0.2
    };

    const headers = {
      'Content-Type': 'application/json'
    };
    if (resolvedApiKey) {
      headers['Authorization'] = `Bearer ${resolvedApiKey}`;
    }

    const startTime = Date.now();
    let response;

    try {
      response = await fetch(`${resolvedBaseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal,
        redirect: 'error'
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
      const err = new Error(`Custom AI Provider API error (${response.status}): ${cleanedMsg}`);
      err.status = response.status;
      err.code = response.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_ERROR';
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
      const err = new Error(`Failed to parse JSON response from custom provider: ${sanitizeString(parseErr.message)}`);
      err.code = 'PROVIDER_INVALID_RESPONSE';
      err.status = response.status;
      throw err;
    }

    if (!rawJson || typeof rawJson !== 'object') {
      const err = new Error('Invalid non-object JSON payload received from custom provider');
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
      providerId: 'custom',
      model: resolvedModel,
      inputTokens,
      outputTokens
    });

    return {
      ...parsedPayload,
      model: rawJson.model || resolvedModel,
      providerId,
      latencyMs,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: totalTokens
      },
      cost: costInfo,
      finishReason: choice.finish_reason || 'stop',
      rawContent: messageContent,
      output: messageContent
    };
  }

  return Object.freeze({
    providerId,
    name,
    model: resolvedModel,
    baseURL: resolvedBaseURL,
    isLocal: true,
    isCustom: true,
    hasCredentials: Boolean(resolvedApiKey || resolvedBaseURL.includes('localhost') || resolvedBaseURL.includes('127.0.0.1')),
    capabilities,
    invoke,
    checkHealth,
    healthCheck: checkHealth
  });
}

export const createOpenAICompatibleAdapter = createCustomProviderAdapter;
