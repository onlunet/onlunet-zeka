/**
 * ONLUNET ZEKA - FAZ 62 Streaming Abstraction Suite
 * Validates canonical streaming event model and context preservation
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createStreamContext, StreamEvents } from '../src/providers/streaming.js';

describe('FAZ 62.15: Streaming Abstraction & Event Model', () => {
  it('accumulates stream deltas and emits STREAM_COMPLETE event cleanly', () => {
    const receivedChunks = [];
    const stream = createStreamContext({
      traceId: 'trace-stream-test-1',
      tenantId: 'tenant-stream',
      onDelta: (chunk) => receivedChunks.push(chunk)
    });

    stream.handleDelta('Hello ');
    stream.handleDelta('world ');
    stream.handleDelta('from AI Control Plane.');

    assert.equal(receivedChunks.length, 3);
    assert.equal(stream.getContent(), 'Hello world from AI Control Plane.');

    const completeEvent = stream.complete();
    assert.equal(completeEvent.event, StreamEvents.STREAM_COMPLETE);
    assert.equal(completeEvent.traceId, 'trace-stream-test-1');
    assert.equal(completeEvent.fullContent, 'Hello world from AI Control Plane.');
  });
});
