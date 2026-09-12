/**
 * ONLUNET ZEKA - Streaming Abstraction & Event Model
 * FAZ 62 Foundation: Canonical Streaming Lifecyle Events
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */

export const StreamEvents = Object.freeze({
  STREAM_START: 'STREAM_START',
  STREAM_DELTA: 'STREAM_DELTA',
  STREAM_COMPLETE: 'STREAM_COMPLETE',
  STREAM_ERROR: 'STREAM_ERROR'
});

export function createStreamContext({
  traceId,
  tenantId = 'default-tenant',
  workspaceId = 'default-workspace',
  onDelta = null
} = {}) {
  let accumulated = '';
  let isComplete = false;

  return Object.freeze({
    traceId,
    tenantId,
    workspaceId,

    handleDelta(chunk) {
      if (isComplete) return;
      accumulated += String(chunk || '');
      if (typeof onDelta === 'function') {
        onDelta(chunk, accumulated);
      }
    },

    complete() {
      isComplete = true;
      return Object.freeze({
        event: StreamEvents.STREAM_COMPLETE,
        traceId,
        fullContent: accumulated,
        timestamp: new Date().toISOString()
      });
    },

    getContent() {
      return accumulated;
    }
  });
}
