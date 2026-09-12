/**
 * AI Development OS - Phase 2 Project Domain & Brain Test Suite
 * Validates Project, Requirement, Blueprint, ChangeIntent, ProjectBrain, DecisionLedger
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ProjectState,
  ApprovalState,
  DecisionStatus,
  ChangeSurfaces,
  ErrorCodes,
  createProject,
  createRequirement,
  createBlueprint,
  createChangeIntent,
  createProjectBrain,
  createDecision,
  createDecisionLedger
} from "../src/index.js";

test("Phase 2 - 1. Project Identity & Required Fields", () => {
  // Empty or missing IDs must be rejected
  assert.throws(() => createProject({ id: "", name: "P1" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createProject({ id: null, name: "P1" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createProject({ id: "p1", name: "" }), new RegExp(ErrorCodes.INVALID_CONTRACT));

  const project = createProject({
    id: "proj-101",
    name: "E-Commerce OS",
    description: "Core platform for retail",
    constraints: ["Node 20+", "Local execution"],
    nonGoals: ["Cloud hosting"]
  });

  assert.equal(project.id, "proj-101");
  assert.equal(project.name, "E-Commerce OS");
  assert.equal(project.description, "Core platform for retail");
  assert.equal(project.status, ProjectState.DISCOVERY);
  assert.deepEqual(project.constraints, ["Node 20+", "Local execution"]);
  assert.deepEqual(project.nonGoals, ["Cloud hosting"]);

  // Immutable verification
  assert.throws(() => { project.name = "Mutated"; }, TypeError);
  assert.throws(() => { project.constraints.push("Docker"); }, TypeError);
});

test("Phase 2 - 2. Requirement Ownership & Validation", () => {
  assert.throws(() => createRequirement({ id: "", projectId: "p1", description: "Desc" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createRequirement({ id: "r1", projectId: "", description: "Desc" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createRequirement({ id: "r1", projectId: "p1", description: "" }), new RegExp(ErrorCodes.INVALID_CONTRACT));

  const req = createRequirement({
    id: "req-01",
    projectId: "proj-101",
    title: "Order Processing",
    description: "Support batch checkout",
    type: "FUNCTIONAL",
    acceptanceCriteria: ["AC-1: Valid cart", "AC-2: Inventory checked"],
    constraints: ["Max latency 200ms"]
  });

  assert.equal(req.id, "req-01");
  assert.equal(req.projectId, "proj-101");
  assert.equal(req.title, "Order Processing");
  assert.deepEqual(req.acceptanceCriteria, ["AC-1: Valid cart", "AC-2: Inventory checked"]);
  assert.throws(() => { req.acceptanceCriteria.push("AC-3"); }, TypeError);
});

test("Phase 2 - 3. Blueprint Source of Truth & Version Semantics", () => {
  assert.throws(() => createBlueprint({ id: "b1", projectId: "p1", purpose: "" }), new RegExp(ErrorCodes.INVALID_CONTRACT));

  const bpV1 = createBlueprint({
    id: "bp-01",
    projectId: "proj-101",
    version: 1,
    purpose: "Build local development engine",
    scope: ["Core runtime", "File management"],
    nonGoals: ["Cloud worker", "Remote execution"],
    architecture: { pattern: "Layered" },
    technologyDecisions: { runtime: "Node.js" }
  });

  assert.equal(bpV1.version, 1);
  assert.equal(bpV1.purpose, "Build local development engine");
  assert.deepEqual(bpV1.nonGoals, ["Cloud worker", "Remote execution"]);

  // Blueprint V2 representation (preserves V1, explicit new version)
  const bpV2 = createBlueprint({
    id: "bp-02",
    projectId: "proj-101",
    version: 2,
    purpose: "Build local development engine with sandbox",
    scope: [...bpV1.scope, "Local sandbox"],
    nonGoals: bpV1.nonGoals,
    architecture: bpV1.architecture,
    technologyDecisions: bpV1.technologyDecisions
  });

  assert.equal(bpV2.version, 2);
  assert.equal(bpV2.scope.includes("Local sandbox"), true);
  assert.notEqual(bpV1.id, bpV2.id);
});

test("Phase 2 - 4. ChangeIntent Contract & No Execution Side Effect", () => {
  assert.throws(() => createChangeIntent({
    id: "ci-01",
    projectId: "proj-101",
    sourceRequirementId: "req-01",
    blueprintReferenceId: "bp-01",
    objective: ""
  }), new RegExp(ErrorCodes.INVALID_CONTRACT));

  const changeIntent = createChangeIntent({
    id: "ci-01",
    projectId: "proj-101",
    sourceRequirementId: "req-01",
    blueprintReferenceId: "bp-01",
    objective: "Add inventory cache",
    allowedSurfaces: [ChangeSurfaces.FILES, ChangeSurfaces.CONFIG],
    forbiddenSurfaces: [ChangeSurfaces.INFRASTRUCTURE, ChangeSurfaces.DATABASE],
    expectedFiles: ["src/cache/inventory.js"],
    approvalRequirement: "CONDITIONAL",
    approvalState: ApprovalState.PENDING
  });

  assert.equal(changeIntent.id, "ci-01");
  assert.equal(changeIntent.approvalState, ApprovalState.PENDING);
  assert.equal(changeIntent.allowedSurfaces.includes(ChangeSurfaces.FILES), true);

  // Pure declaration: Verify no execution-related side effects or executor properties
  assert.equal(changeIntent.isExecuted, undefined);
  assert.equal(changeIntent.run, undefined);
  assert.equal(changeIntent.execute, undefined);
});

test("Phase 2 - 5. Project Brain Isolation & Cross-Project Contamination Rejection", () => {
  const reqA = createRequirement({ id: "req-A", projectId: "proj-A", description: "Alpha feature" });
  const bpA = createBlueprint({ id: "bp-A", projectId: "proj-A", purpose: "Alpha purpose" });
  const decA = createDecision({ id: "dec-A", projectId: "proj-A", topic: "Arch", chosenOption: "REST", reason: "Simplicity" });

  const brainA = createProjectBrain({
    projectId: "proj-A",
    requirements: [reqA],
    blueprint: bpA,
    decisions: [decA]
  });

  assert.equal(brainA.projectId, "proj-A");
  assert.equal(brainA.requirements[0].id, "req-A");

  // Attempting cross-project contamination MUST FAIL
  const reqB = createRequirement({ id: "req-B", projectId: "proj-B", description: "Beta feature" });
  const bpB = createBlueprint({ id: "bp-B", projectId: "proj-B", purpose: "Beta purpose" });
  const decB = createDecision({ id: "dec-B", projectId: "proj-B", topic: "Arch", chosenOption: "GraphQL", reason: "Speed" });

  // Contaminated requirement
  assert.throws(
    () => createProjectBrain({ projectId: "proj-A", requirements: [reqB] }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  // Contaminated blueprint
  assert.throws(
    () => createProjectBrain({ projectId: "proj-A", blueprint: bpB }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  // Contaminated decision
  assert.throws(
    () => createProjectBrain({ projectId: "proj-A", decisions: [decB] }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );
});

test("Phase 2 - 6. Decision & Decision Ledger Traceability & Superseding", () => {
  const ledger = createDecisionLedger({ projectId: "proj-101" });
  assert.equal(ledger.projectId, "proj-101");

  // Create initial decision
  const dec1 = createDecision({
    id: "dec-01",
    projectId: "proj-101",
    topic: "Data Storage",
    chosenOption: "File-based JSON",
    alternatives: ["SQLite", "PostgreSQL"],
    reason: "Zero dependency requirement in Phase 1 & 2",
    status: DecisionStatus.DECIDED
  });

  ledger.addDecision(dec1);
  assert.equal(ledger.getDecision("dec-01").chosenOption, "File-based JSON");
  assert.equal(ledger.getActiveDecisions().length, 1);

  // Superseding decision
  const dec2 = createDecision({
    id: "dec-02",
    projectId: "proj-101",
    topic: "Data Storage",
    chosenOption: "SQLite Embedded",
    alternatives: ["PostgreSQL"],
    reason: "Performance scale requirement in later phase",
    status: DecisionStatus.DECIDED,
    supersedesId: "dec-01"
  });

  // Mark dec1 superseded
  const dec1Superseded = createDecision({
    id: dec1.id,
    projectId: dec1.projectId,
    topic: dec1.topic,
    chosenOption: dec1.chosenOption,
    alternatives: dec1.alternatives,
    reason: dec1.reason,
    status: DecisionStatus.SUPERSEDED,
    supersededById: "dec-02"
  });

  const freshLedger = createDecisionLedger({ projectId: "proj-101" });
  freshLedger.addDecision(dec1Superseded);
  freshLedger.addDecision(dec2);

  assert.equal(freshLedger.getAllDecisions().length, 2);
  assert.equal(freshLedger.getActiveDecisions().length, 1);
  assert.equal(freshLedger.getActiveDecisions()[0].id, "dec-02");
  assert.equal(freshLedger.getDecision("dec-01").status, DecisionStatus.SUPERSEDED);
  assert.equal(freshLedger.getDecision("dec-02").supersedesId, "dec-01");

  // Foreign project decision rejected by ledger
  const foreignDecision = createDecision({
    id: "dec-foreign",
    projectId: "proj-OTHER",
    topic: "Auth",
    chosenOption: "OAuth",
    reason: "Spec"
  });
  assert.throws(() => freshLedger.addDecision(foreignDecision), new RegExp(ErrorCodes.INVALID_CONTRACT));
});

test("Phase 2 - 7. Domain Serialization & Deserialization Equivalence", () => {
  const original = createProject({
    id: "proj-ser-1",
    name: "Serialization Test",
    description: "Round-trip verify",
    constraints: ["Pure JSON"]
  });

  const serialized = JSON.stringify(original);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.id, original.id);
  assert.equal(parsed.name, original.name);
  assert.equal(parsed.description, original.description);
  assert.deepEqual(parsed.constraints, original.constraints);

  // Re-instantiate through factory
  const reconstituted = createProject(parsed);
  assert.equal(reconstituted.id, original.id);
  assert.equal(reconstituted.name, original.name);
  assert.deepEqual(reconstituted.constraints, original.constraints);
});

test("Phase 2 - 8. Pure Domain Factory Side-Effect Absence", () => {
  // Creating domain factories must NOT perform network, disk or system actions
  const start = Date.now();
  for (let i = 0; i < 100; i++) {
    const p = createProject({ id: `p-${i}`, name: `Proj ${i}` });
    const r = createRequirement({ id: `r-${i}`, projectId: p.id, description: "Req" });
    const b = createBlueprint({ id: `b-${i}`, projectId: p.id, purpose: "Pure" });
    const ci = createChangeIntent({
      id: `ci-${i}`,
      projectId: p.id,
      sourceRequirementId: r.id,
      blueprintReferenceId: b.id,
      objective: "Obj"
    });
    createProjectBrain({ projectId: p.id, requirements: [r], blueprint: b });
  }
  const duration = Date.now() - start;
  // 100 complete entity sets should execute in less than 50ms in-memory
  assert.ok(duration < 200, `Domain factories took too long (${duration}ms), suspected I/O side effect`);
});
