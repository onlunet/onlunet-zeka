/**
 * ONLUNET ZEKA - Intelligent Task Analyzer
 * FAZ 63 Foundation: Task Understanding, Capability Inference & Complexity Scoring
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 * NO RECURSIVE LLM CALLS: Deterministic, rule-based extraction without uncontrolled self-calling.
 */
import { ProviderCapabilities } from './provider-capabilities.js';
import { DataClassification } from '../control-plane/data-classifier.js';

export const TaskTypes = Object.freeze({
  GENERAL_QA: 'GENERAL_QA',
  CODING: 'CODING',
  CODE_REVIEW: 'CODE_REVIEW',
  REASONING: 'REASONING',
  SUMMARIZATION: 'SUMMARIZATION',
  CLASSIFICATION: 'CLASSIFICATION',
  EXTRACTION: 'EXTRACTION',
  STRUCTURED_GENERATION: 'STRUCTURED_GENERATION',
  VISION_ANALYSIS: 'VISION_ANALYSIS',
  DOCUMENT_ANALYSIS: 'DOCUMENT_ANALYSIS',
  TRANSLATION: 'TRANSLATION',
  CREATIVE_WRITING: 'CREATIVE_WRITING',
  DATA_ANALYSIS: 'DATA_ANALYSIS',
  AGENT_PLANNING: 'AGENT_PLANNING',
  TOOL_SELECTION: 'TOOL_SELECTION'
});

export const TaskComplexity = Object.freeze({
  SIMPLE: 'SIMPLE',
  STANDARD: 'STANDARD',
  COMPLEX: 'COMPLEX',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

export const QualityRequirement = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

export const LatencyRequirement = Object.freeze({
  LOW: 'LOW',         // Low latency / fast inference desired
  STANDARD: 'STANDARD',
  BATCH: 'BATCH'
});

export const CostSensitivity = Object.freeze({
  LOW: 'LOW',       // Budget is plentiful; prioritize quality
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'      // Tight budget; prioritize cost efficiency
});

/**
 * Extracts task text representation safely
 */
function extractTaskText(task) {
  if (typeof task === 'string') return task;
  if (!task || typeof task !== 'object') return '';
  return task.task || task.prompt || task.objective || task.description || '';
}

/**
 * Analyzes an inbound task contract and determines requirements
 */
export function analyzeTask({
  task,
  tenantId = null,
  workspaceId = null,
  dataClassification = DataClassification.INTERNAL,
  budget = null,
  latencyTarget = null,
  qualityTarget = null,
  requiredCapabilities = []
} = {}) {
  const taskText = extractTaskText(task);
  const lower = taskText.toLowerCase();

  // 1. Detect Task Type
  let taskType = TaskTypes.GENERAL_QA;

  if (/(?:review|audit|lint|vulnerability|inspect\s+code|code\s+review|güvenlik\s+problemi)/i.test(lower)) {
    taskType = TaskTypes.CODE_REVIEW;
  } else if (/(?:function|class|const|let|def\s+|import\s+|export\s+|refactor|implement|code|script|sql|regex|npm|git|typescript|python|javascript)/i.test(lower)) {
    taskType = TaskTypes.CODING;
  } else if (/(?:solve|proof|step-by-step|calculate|math|theorem|deduce|derive|complex logic|why\s+did|karşılaştır|maliyet\s+ve\s+risk)/i.test(lower)) {
    taskType = TaskTypes.REASONING;
  } else if (/(?:summarize|summary|tldr|brief|key takeaways|executive summary|özetle)/i.test(lower)) {
    taskType = TaskTypes.SUMMARIZATION;
  } else if (/(?:classify|categorize|tag|label|sentiment|intent)/i.test(lower)) {
    taskType = TaskTypes.CLASSIFICATION;
  } else if (/(?:extract|parse|pull out|identify entities|extract\s+data)/i.test(lower)) {
    taskType = TaskTypes.EXTRACTION;
  } else if (/(?:json|schema|json\s+mode|structured\s+output|validate\s+json|return\s+json)/i.test(lower)) {
    taskType = TaskTypes.STRUCTURED_GENERATION;
  } else if (/(?:image|picture|photo|screenshot|diagram|visual|ocr|chart\s+analysis)/i.test(lower)) {
    taskType = TaskTypes.VISION_ANALYSIS;
  } else if (/(?:document|pdf|contract|handbook|entire\s+paper|long\s+text|chapter)/i.test(lower)) {
    taskType = TaskTypes.DOCUMENT_ANALYSIS;
  } else if (/(?:translate|translation|spanish|french|german|turkish|japanese|mandarin)/i.test(lower)) {
    taskType = TaskTypes.TRANSLATION;
  } else if (/(?:creative|story|essay|poem|dialogue|brainstorm)/i.test(lower)) {
    taskType = TaskTypes.CREATIVE_WRITING;
  } else if (/(?:dataset|dataframe|statistics|correlation|data\s+analysis|metrics|telemetry)/i.test(lower)) {
    taskType = TaskTypes.DATA_ANALYSIS;
  } else if (/(?:plan|workflow|orchestrate|multi-agent|sequence|milestone|pipeline)/i.test(lower)) {
    taskType = TaskTypes.AGENT_PLANNING;
  } else if (/(?:tool|function\s+call|call\s+tool|execute\s+tool|terminal|shell|cli)/i.test(lower)) {
    taskType = TaskTypes.TOOL_SELECTION;
  }

  // 2. Infer Capabilities based on taskType and content
  const inferred = new Set(Array.isArray(requiredCapabilities) ? requiredCapabilities : []);
  inferred.add(ProviderCapabilities.TEXT);

  switch (taskType) {
    case TaskTypes.CODING:
    case TaskTypes.STRUCTURED_GENERATION:
      inferred.add(ProviderCapabilities.STRUCTURED_OUTPUT);
      break;
    case TaskTypes.REASONING:
      inferred.add(ProviderCapabilities.REASONING);
      break;
    case TaskTypes.VISION_ANALYSIS:
      inferred.add(ProviderCapabilities.VISION);
      break;
    case TaskTypes.DOCUMENT_ANALYSIS:
      inferred.add(ProviderCapabilities.LONG_CONTEXT);
      break;
    case TaskTypes.TOOL_SELECTION:
    case TaskTypes.AGENT_PLANNING:
      inferred.add(ProviderCapabilities.TOOL_USE);
      break;
    default:
      break;
  }

  if (lower.includes('stream') || lower.includes('sse') || lower.includes('server-sent')) {
    inferred.add(ProviderCapabilities.STREAMING);
  }
  if (lower.includes('json') || lower.includes('schema')) {
    inferred.add(ProviderCapabilities.STRUCTURED_OUTPUT);
    inferred.add(ProviderCapabilities.JSON_MODE);
  }

  // 3. Complexity Scoring
  let complexity = TaskComplexity.LOW;
  let complexityPoints = 0;

  if (taskText.length > 2000) complexityPoints += 3;
  else if (taskText.length > 500) complexityPoints += 1;

  if (inferred.has(ProviderCapabilities.REASONING)) complexityPoints += 3;
  if (inferred.has(ProviderCapabilities.TOOL_USE)) complexityPoints += 2;
  if (inferred.has(ProviderCapabilities.VISION)) complexityPoints += 2;
  if (inferred.has(ProviderCapabilities.LONG_CONTEXT)) complexityPoints += 2;
  if (dataClassification === DataClassification.SECRET || dataClassification === DataClassification.RESTRICTED) {
    complexityPoints += 2;
  }

  // Domain-specific keyword heuristics for CRITICAL and COMPLEX tasks
  const isCriticalKw = /(?:production\s+architecture|security\s+remediation|veri\s+kayb[ıi]|data\s+loss|high\s+impact|critical\s+system|sistem\s+tasar[ıi]m[ıi]|disaster\s+recovery|zero\s+downtime)/i.test(lower);
  const isComplexKw = /(?:architectural\s+analysis|multi-file\s+refactor|[çc]ok\s+dosyal[ıi]|forensic\s+debugging|complex\s+algorithm|karma[şs][ıi]k\s+algoritma|b[üu]y[üu]k\s+kod\s+de[ğg]i[şs]ikli[ğg]i|mimari\s+analiz|adli\s+debugging|g[üu]venlik\s+analizi)/i.test(lower);

  if (isCriticalKw) {
    complexityPoints += 6;
  } else if (isComplexKw) {
    complexityPoints += 4;
  }

  if (complexityPoints >= 6 || isCriticalKw) {
    complexity = TaskComplexity.CRITICAL;
  } else if (complexityPoints >= 4 || isComplexKw) {
    complexity = TaskComplexity.HIGH;
  } else if (complexityPoints >= 2) {
    complexity = TaskComplexity.MEDIUM;
  } else {
    complexity = TaskComplexity.LOW;
  }

  // 4. Quality Requirement
  let resolvedQuality = QualityRequirement.MEDIUM;
  if (qualityTarget && Object.values(QualityRequirement).includes(qualityTarget.toUpperCase())) {
    resolvedQuality = qualityTarget.toUpperCase();
  } else if (complexity === TaskComplexity.CRITICAL) {
    resolvedQuality = QualityRequirement.CRITICAL;
  } else if (complexity === TaskComplexity.HIGH) {
    resolvedQuality = QualityRequirement.HIGH;
  } else if (complexity === TaskComplexity.LOW) {
    resolvedQuality = QualityRequirement.LOW;
  }

  // 5. Latency Requirement
  let resolvedLatency = LatencyRequirement.STANDARD;
  if (latencyTarget) {
    if (typeof latencyTarget === 'string' && Object.values(LatencyRequirement).includes(latencyTarget.toUpperCase())) {
      resolvedLatency = latencyTarget.toUpperCase();
    } else if (typeof latencyTarget === 'number' && latencyTarget < 2000) {
      resolvedLatency = LatencyRequirement.LOW;
    }
  } else if (/(?:fast|quick|low\s+latency|instant|realtime)/i.test(lower)) {
    resolvedLatency = LatencyRequirement.LOW;
  }

  // 6. Cost Sensitivity
  let resolvedCostSensitivity = CostSensitivity.MEDIUM;
  if (typeof budget === 'number') {
    if (budget <= 0.01) {
      resolvedCostSensitivity = CostSensitivity.HIGH;
    } else if (budget >= 0.50) {
      resolvedCostSensitivity = CostSensitivity.LOW;
    }
  } else if (/(?:cheap|budget|cost-effective|minimal\s+cost|free)/i.test(lower)) {
    resolvedCostSensitivity = CostSensitivity.HIGH;
  }

  return Object.freeze({
    taskType,
    requiredCapabilities: Object.freeze(Array.from(inferred)),
    dataClassification,
    complexity,
    qualityRequirement: resolvedQuality,
    latencyRequirement: resolvedLatency,
    costSensitivity: resolvedCostSensitivity,
    inferredMetadata: Object.freeze({
      textLength: taskText.length,
      complexityPoints,
      tenantId,
      workspaceId
    })
  });
}
