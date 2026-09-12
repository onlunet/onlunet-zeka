/**
 * ONLUNET ZEKA - FAZ 65 AI Lifecycle Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  AILifecycleState,
  validateLifecycleTransition
} from '../src/control-plane/ai-execution-pipeline.js';

describe('FAZ 65.2: 10-Step AI Request Lifecycle & State Transitions', () => {
  it('allows valid sequential transitions from RECEIVED to FINALIZED', () => {
    assert.ok(validateLifecycleTransition(AILifecycleState.RECEIVED, AILifecycleState.VALIDATED));
    assert.ok(validateLifecycleTransition(AILifecycleState.VALIDATED, AILifecycleState.CLASSIFIED));
    assert.ok(validateLifecycleTransition(AILifecycleState.CLASSIFIED, AILifecycleState.ANALYZED));
    assert.ok(validateLifecycleTransition(AILifecycleState.ANALYZED, AILifecycleState.ROUTED));
    assert.ok(validateLifecycleTransition(AILifecycleState.ROUTED, AILifecycleState.INFERRED));
    assert.ok(validateLifecycleTransition(AILifecycleState.INFERRED, AILifecycleState.NORMALIZED));
    assert.ok(validateLifecycleTransition(AILifecycleState.NORMALIZED, AILifecycleState.VERIFIED));
    assert.ok(validateLifecycleTransition(AILifecycleState.VERIFIED, AILifecycleState.CORRECTED));
    assert.ok(validateLifecycleTransition(AILifecycleState.VERIFIED, AILifecycleState.FINALIZED));
  });

  it('strictly blocks direct invalid transitions like RECEIVED -> EXECUTED or RECEIVED -> INFERRED', () => {
    assert.throws(() => {
      validateLifecycleTransition(AILifecycleState.RECEIVED, 'EXECUTED');
    }, /AI output can never transition to EXECUTED|AI != AUTHORITY/);

    assert.throws(() => {
      validateLifecycleTransition(AILifecycleState.RECEIVED, AILifecycleState.INFERRED);
    }, /Invalid state transition/);
  });
});
