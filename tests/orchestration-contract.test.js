/**
 * AI Development OS - Orchestration Contract Test Suite
 * Validates descriptive orchestration modeling, topological ordering, agent assignments,
 * dependency checking, circularity rejection, and zero side effect guarantee.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  AgentRoles,
  ErrorCodes,
  createWorkflow,
  createJob,
  createTask,
  createOrchestrationPlan,
  resolveExecutionOrder
} from "../src/index.js";

test("Orchestration - 1. Valid OrchestrationPlan Construction & Immutability", () => {
  const plan = createOrchestrationPlan({
    id: "orch-01",
    workflowId: "wf-101",
    projectId: "proj-101",
    tasks: ["task-audit", "task-lint", "task-build"],
    taskDependencies: {
      "task-lint": ["task-audit"],
      "task-build": ["task-lint"]
    },
    agentAssignments: {
      "task-audit": AgentRoles.SECURITY,
      "task-lint": AgentRoles.REVIEWER,
      "task-build": AgentRoles.DEVELOPER
    },
    approvalGates: ["approval-gate-pre-build"],
    validationCriteria: {
      "task-build": "zero-compilation-errors"
    }
  });

  assert.equal(plan.id, "orch-01");
  assert.equal(plan.workflowId, "wf-101");
  assert.equal(plan.projectId, "proj-101");
  assert.deepEqual(plan.tasks, ["task-audit", "task-lint", "task-build"]);
  assert.equal(plan.agentAssignments["task-audit"], AgentRoles.SECURITY);
  assert.equal(plan.approvalGates[0], "approval-gate-pre-build");

  // Immutability checks
  assert.throws(() => { plan.tasks.push("task-leak"); }, TypeError);
  assert.throws(() => { plan.taskDependencies["task-audit"] = []; }, TypeError);
});

test("Orchestration - 2. Missing Required Fields Rejection", () => {
  assert.throws(() => createOrchestrationPlan({ id: "", workflowId: "wf-1", projectId: "p-1" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createOrchestrationPlan({ id: "o-1", workflowId: "", projectId: "p-1" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createOrchestrationPlan({ id: "o-1", workflowId: "wf-1", projectId: "" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
});

test("Orchestration - 3. Invalid Agent Role Rejection", () => {
  assert.throws(() => createOrchestrationPlan({
    id: "o-1",
    workflowId: "wf-1",
    projectId: "p-1",
    tasks: ["t-1"],
    agentAssignments: {
      "t-1": "INVALID_NON_EXISTENT_ROLE"
    }
  }), new RegExp(ErrorCodes.INVALID_CONTRACT));
});

test("Orchestration - 4. Unknown Dependency Reference Rejection", () => {
  assert.throws(() => createOrchestrationPlan({
    id: "o-1",
    workflowId: "wf-1",
    projectId: "p-1",
    tasks: ["t-1"],
    taskDependencies: {
      "t-1": ["unknown-task-999"]
    }
  }), new RegExp(ErrorCodes.INVALID_CONTRACT));
});

test("Orchestration - 5. Self-Dependency Rejection", () => {
  assert.throws(() => createOrchestrationPlan({
    id: "o-1",
    workflowId: "wf-1",
    projectId: "p-1",
    tasks: ["t-1"],
    taskDependencies: {
      "t-1": ["t-1"]
    }
  }), new RegExp(ErrorCodes.INVALID_CONTRACT));
});

test("Orchestration - 6. Topological Execution Order Resolution", () => {
  const plan = createOrchestrationPlan({
    id: "orch-order",
    workflowId: "wf-1",
    projectId: "p-1",
    tasks: ["deploy", "test", "build", "compile"],
    taskDependencies: {
      "compile": [],
      "build": ["compile"],
      "test": ["build"],
      "deploy": ["test"]
    }
  });

  const order = resolveExecutionOrder(plan);
  assert.deepEqual(order, ["compile", "build", "test", "deploy"]);
});

test("Orchestration - 7. Circular Dependency Detection & Rejection", () => {
  const cyclicPlan = createOrchestrationPlan({
    id: "orch-cycle",
    workflowId: "wf-1",
    projectId: "p-1",
    tasks: ["task-a", "task-b"],
    taskDependencies: {
      "task-a": ["task-b"],
      "task-b": ["task-a"]
    }
  });

  assert.throws(() => resolveExecutionOrder(cyclicPlan), new RegExp(ErrorCodes.INVALID_CONTRACT));
});

test("Orchestration - 8. Zero Execution Side Effects Guarantee", () => {
  const plan = createOrchestrationPlan({
    id: "orch-pure",
    workflowId: "wf-1",
    projectId: "p-1",
    tasks: ["t-1"]
  });

  // Verify plan has zero runtime execution methods or triggers
  assert.equal(plan.run, undefined);
  assert.equal(plan.execute, undefined);
  assert.equal(plan.dispatch, undefined);
  assert.equal(plan.spawn, undefined);
  assert.equal(plan.queue, undefined);
});
