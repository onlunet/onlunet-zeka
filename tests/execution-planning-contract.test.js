/**
 * AI Development OS - Execution Planning Contract Test Suite
 * Validates Phase 3 Execution Planning Contract Foundation
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ErrorCodes,
  createExecutionPlan,
  createExecutionPlanContract,
  ProjectState,
  JobState,
  TaskState,
  ValidProjectTransitions,
  ValidJobTransitions,
  ValidTaskTransitions,
  validateStateTransition,
  createOrchestrationPlan,
  resolveExecutionOrder
} from "../src/index.js";

test("Test 1: Valid ExecutionPlanContract construction", () => {
  const plan = createExecutionPlanContract({
    id: "epc-01",
    taskId: "task-01",
    steps: ["step-1", "step-2"],
    expectedCommands: ["npm test"],
    expectedFileChanges: ["src/index.js"],
    expectedEvidence: ["ev-01"],
    expectedValidation: ["val-01"],
    requiredApprovals: ["app-01"],
    policyReferences: ["scope-policy-1", "execution-policy-1", "security-policy-1"],
    scopeReference: "change-intent-101",
    executionBoundaryReference: "boundary-proj-root",
    preconditions: ["task-state-ready", "approval-granted"],
    risk: "LOW"
  });

  assert.equal(plan.id, "epc-01");
  assert.equal(plan.taskId, "task-01");
  assert.deepEqual(plan.steps, ["step-1", "step-2"]);
  assert.deepEqual(plan.expectedCommands, ["npm test"]);
  assert.deepEqual(plan.expectedFileChanges, ["src/index.js"]);
  assert.deepEqual(plan.expectedEvidence, ["ev-01"]);
  assert.deepEqual(plan.expectedValidation, ["val-01"]);
  assert.deepEqual(plan.requiredApprovals, ["app-01"]);
  assert.deepEqual(plan.policyReferences, ["scope-policy-1", "execution-policy-1", "security-policy-1"]);
  assert.equal(plan.scopeReference, "change-intent-101");
  assert.equal(plan.executionBoundaryReference, "boundary-proj-root");
  assert.deepEqual(plan.preconditions, ["task-state-ready", "approval-granted"]);
  assert.equal(plan.risk, "LOW");
});

test("Test 2: Required field rejection", () => {
  assert.throws(() => createExecutionPlanContract({ id: "", taskId: "t-1" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createExecutionPlanContract({ id: null, taskId: "t-1" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createExecutionPlanContract({ id: "epc-1", taskId: "" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createExecutionPlanContract({ id: "epc-1", taskId: null }), new RegExp(ErrorCodes.INVALID_CONTRACT));
});

test("Test 3: Invalid collection type rejection", () => {
  assert.throws(() => createExecutionPlanContract({ id: "epc-1", taskId: "t-1", steps: "not-an-array" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createExecutionPlanContract({ id: "epc-1", taskId: "t-1", expectedCommands: 123 }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createExecutionPlanContract({ id: "epc-1", taskId: "t-1", policyReferences: {} }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createExecutionPlanContract({ id: "epc-1", taskId: "t-1", preconditions: "precond" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
});

test("Test 4: Immutability", () => {
  const plan = createExecutionPlanContract({
    id: "epc-imm",
    taskId: "t-1",
    steps: ["step-1"],
    expectedCommands: ["cmd-1"],
    policyReferences: ["pol-1"]
  });

  assert.throws(() => { plan.id = "modified"; }, TypeError);
  assert.throws(() => { plan.steps.push("step-2"); }, TypeError);
  assert.throws(() => { plan.expectedCommands.push("cmd-2"); }, TypeError);
  assert.throws(() => { plan.policyReferences.push("pol-2"); }, TypeError);
});

test("Test 5: Policy reference preservation", () => {
  const plan = createExecutionPlanContract({
    id: "epc-pol",
    taskId: "t-1",
    policyReferences: ["scope-policy-01", "security-policy-01"]
  });

  assert.equal(plan.policyReferences.length, 2);
  assert.equal(plan.policyReferences[0], "scope-policy-01");
  assert.equal(plan.policyReferences[1], "security-policy-01");
  assert.equal(plan.executePolicy, undefined);
  assert.equal(plan.runPolicy, undefined);
});

test("Test 6: Scope reference preservation", () => {
  const plan = createExecutionPlanContract({
    id: "epc-scope",
    taskId: "t-1",
    scopeReference: "change-intent-xyz"
  });

  assert.equal(plan.scopeReference, "change-intent-xyz");
});

test("Test 7: Execution boundary reference preservation", () => {
  const plan = createExecutionPlanContract({
    id: "epc-bound",
    taskId: "t-1",
    executionBoundaryReference: "boundary-root"
  });

  assert.equal(plan.executionBoundaryReference, "boundary-root");
});

test("Test 8: Precondition preservation", () => {
  const plan = createExecutionPlanContract({
    id: "epc-pre",
    taskId: "t-1",
    preconditions: ["pre-auth", "pre-check"]
  });

  assert.deepEqual(plan.preconditions, ["pre-auth", "pre-check"]);
});

test("Test 9: Risk metadata preservation", () => {
  const planLow = createExecutionPlanContract({ id: "epc-r1", taskId: "t-1", risk: "LOW" });
  assert.equal(planLow.risk, "LOW");

  const planMed = createExecutionPlanContract({ id: "epc-r2", taskId: "t-1", risk: "MEDIUM" });
  assert.equal(planMed.risk, "MEDIUM");

  const planHigh = createExecutionPlanContract({ id: "epc-r3", taskId: "t-1", risk: "HIGH" });
  assert.equal(planHigh.risk, "HIGH");

  assert.throws(() => createExecutionPlanContract({ id: "epc-rx", taskId: "t-1", risk: "EXTREME" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
});

test("Test 10: No executable methods exposed (Negative security test)", () => {
  const plan = createExecutionPlanContract({
    id: "epc-neg",
    taskId: "t-1"
  });

  assert.equal(plan.run, undefined);
  assert.equal(plan.execute, undefined);
  assert.equal(plan.dispatch, undefined);
  assert.equal(plan.spawn, undefined);
  assert.equal(plan.fork, undefined);
  assert.equal(plan.queue, undefined);
  assert.equal(plan.schedule, undefined);
  assert.equal(plan.start, undefined);
  assert.equal(plan.shell, undefined);
});

test("Test 11: Existing FAZ 1.1 state transition tests remain valid", () => {
  assert.equal(validateStateTransition("PROJECT", ProjectState.DISCOVERY, ProjectState.BLUEPRINTING), true);
  assert.equal(validateStateTransition("JOB", JobState.PENDING, JobState.READY), true);
  assert.equal(validateStateTransition("TASK", TaskState.PENDING, TaskState.READY), true);
});

test("Test 12: Existing FAZ 2 orchestration tests remain valid & original createExecutionPlan intact", () => {
  const plan = createOrchestrationPlan({
    id: "o-test",
    workflowId: "w-test",
    projectId: "p-test",
    tasks: ["t-1", "t-2"],
    taskDependencies: { "t-2": ["t-1"] }
  });

  assert.deepEqual(resolveExecutionOrder(plan), ["t-1", "t-2"]);

  // Verify existing createExecutionPlan from Phase 1 remains completely intact
  const origPlan = createExecutionPlan({ id: "orig-1", taskId: "t-1", steps: ["stepA"] });
  assert.equal(origPlan.id, "orig-1");
  assert.equal(origPlan.steps[0], "stepA");
});
