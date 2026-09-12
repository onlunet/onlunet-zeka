/**
 * ONLUNET ZEKA - FAZ 64 OpenAI Canonical Response Normalization Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderGateway } from '../src/providers/provider-gateway.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';

describe('FAZ 64.3: OpenAI Canonical Response Normalization', () => {
  it('enforces proposalOnly and executionAuthorized: false contract on all gateway dispatches', async () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const gateway = createProviderGateway({ registry });

    const result = await gateway.dispatch({
      providerId: 'local',
      prompt: 'Generate unit test structure'
    });

    assert.strictEqual(result.executionAuthorized, false);
    assert.strictEqual(result.proposalOnly, true);
    assert.ok(result.authorityGuarantee);
    assert.strictEqual(result.authorityGuarantee.executionAuthorized, false);
  });
});
