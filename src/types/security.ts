export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type VerificationType = 'AI_HYPOTHESIS' | 'STATIC_RULE_MATCH' | 'TAINT_FLOW_ANALYSIS';
export type VerificationStatus = 'CONFIRMED' | 'LIKELY' | 'NEEDS_REVIEW' | 'FALSE_POSITIVE' | 'NOT_REPRODUCIBLE';
export type FindingStatus = 'OPEN' | 'REVIEWED' | 'FIXED' | 'FALSE_POSITIVE' | 'IGNORED';
export type UserFindingResolution = 'ACTIVE' | 'FALSE_POSITIVE' | 'ACCEPTED_RISK' | 'FIXED';

export interface VulnerabilityFinding {
  id: string;
  title: string;
  filePath?: string;
  cwe: string;
  owaspCategory: string;
  severity: Severity;
  confidence: Confidence;
  verificationStatus: VerificationStatus;
  verificationType: VerificationType;
  verificationMethod?: string;
  startLine: number;
  endLine: number;
  snippet: string;
  surroundingContext?: string;
  evidence?: string;
  explanation: string;
  attackScenario: string;
  exploitConditions?: string;
  classificationReason?: string;
  reasoning?: string;
  remainingUncertainty?: string;
  remediation: string;
  suggestedPatch: string;
  patchVerificationStatus?: 'VERIFIED_STATIC' | 'UNVERIFIED_REVIEW_REQUIRED';
  fixValidation?: FixValidationResult;
  status: FindingStatus;
  userResolution?: UserFindingResolution;
  notes?: string;
  dedupKey?: string;
  analysisEngine?: string;
}

export type FixValidationStatus = 'VALIDATED' | 'PARTIALLY_VALIDATED' | 'NEEDS_REVIEW' | 'INVALID';
export interface FixCheckResult {
  passed: boolean;
  status: 'PASS' | 'WARN' | 'FAIL';
  name: string;
  message: string;
  details?: string[];
}
export interface FixValidationResult {
  status: FixValidationStatus;
  overallScore: number;
  vulnerabilityResolved: boolean;
  securityImprovement: string;
  potentialCompatibilityIssues: string[];
  syntaxCheck: FixCheckResult;
  scopeAndImportsCheck: FixCheckResult;
  securityRegressionCheck: FixCheckResult;
  completenessCheck: FixCheckResult;
  missingImports: string[];
  undefinedVariables: string[];
  introducedVulnerabilities: string[];
  insecureFallbacks: string[];
  timestamp: string;
  executionMode: 'STATIC_ISOLATED_CHECKS';
  validationChecksRun?: string[];
  limitations?: string[];
  fullFileValidationPassed?: boolean;
}
export interface FixValidationTestCase {
  id: string;
  title: string;
  category: string;
  description: string;
  fileName: string;
  language: string;
  vulnerabilityCwe: string;
  vulnerabilityTitle: string;
  originalSnippet: string;
  proposedPatch: string;
  surroundingContext: string;
  expectedStatus: FixValidationStatus;
  expectedCheckFailures?: string[];
  notes: string;
}
export interface SecurityMetrics {
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  totalFindings: number;
  confirmedCount: number;
  likelyCount: number;
  needsReviewCount: number;
  falsePositiveCount: number;
  aiHypothesesCount: number;
  deterministicCount: number;
  linesAnalyzed: number;
}
export interface ProjectFileRecord {
  filePath: string;
  language: string;
  content: string;
  patchedContent?: string;
  lines: number;
  size: number;
  findingsCount?: number;
}
export interface ScanResult {
  id: string;
  projectName: string;
  fileName: string;
  language: string;
  timestamp: string;
  modelUsed: string;
  executionTimeMs: number;
  originalCode: string;
  patchedFullCode?: string;
  metrics: SecurityMetrics;
  findings: VulnerabilityFinding[];
  summary: string;
  recommendations: string[];
  isMultiFile?: boolean;
  files?: ProjectFileRecord[];
  transmissionMode?: 'LOCAL_ONLY' | 'CLOUD_AI_TRANSMITTED';
  cloudDisclosed?: boolean;
  /** Explains whether AI ran, any partial coverage, and the limits of this review. */
  analysisNotice?: string;
}
export interface StagedFile {
  id: string;
  name: string;
  relativePath: string;
  size: number;
  language: string;
  content: string;
  lines: number;
}
export interface UploadLimits {
  maxSingleFileSize: number;
  maxArchiveSize: number;
  maxTotalExtractedSize: number;
  maxFileCount: number;
  maxArchiveEntries: number;
}
export interface SampleCode {
  id: string;
  title: string;
  language: string;
  fileName: string;
  category: string;
  description: string;
  code: string;
  expectedVulnerabilities: string[];
}
export interface HistoryItem {
  id: string;
  projectName: string;
  fileName: string;
  language: string;
  timestamp: string;
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  scanResult: ScanResult;
}
export interface EvaluationTestCase {
  id: string;
  title: string;
  category: string;
  description: string;
  code: string;
  fileName: string;
  language: string;
  expectedOutcome: 'VULNERABILITY' | 'SECURE' | 'FALSE_POSITIVE_SUPPRESSED' | 'NEEDS_REVIEW';
  expectedClassification: VerificationStatus;
  expectedCwe?: string;
  rationale: string;
}
export interface EvaluationMetrics {
  totalTestCases: number;
  /** Cases eligible for binary precision/recall scoring; review-only cases are excluded. */
  evaluatedCases: number;
  /** Cases requiring human/context review and therefore excluded from binary scoring. */
  excludedCases: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  timestamp: string;
  results: Array<{
    id: string;
    title: string;
    passed: boolean;
    actualOutcome: string;
    actualClassification: string;
    actualCwes: string[];
    cweMatches: boolean;
    lineRangesValid: boolean;
    includedInMetrics: boolean;
    reason: string;
  }>;
}
export type ProviderType = 'gemini' | 'gemma' | 'openai' | 'anthropic' | 'ollama' | 'custom';
export interface ProviderConfig {
  id: ProviderType;
  name: string;
  description: string;
  models: string[];
  selectedModel: string;
  apiKey?: string;
  hasKeyStored?: boolean;
  endpoint?: string;
  isConfigured: boolean;
  isActive: boolean;
  requiresKey: boolean;
  supportsLocal: boolean;
}
export interface OllamaModelInfo {
  name: string;
  model: string;
  size: number;
  digest?: string;
  modified_at?: string;
  isGemma: boolean;
}
export interface SystemStatus {
  status: string;
  offlineMode: boolean;
  cloudConsentGranted: boolean;
  deploymentBoundary: string;
  activeProvider: ProviderType;
  activeModel: string;
  activeProviderEndpoint?: string | null;
  hasApiKey: boolean;
  engine: string;
  serviceName: string;
  ollama: {
    available: boolean;
    endpoint: string;
    installedModels: string[];
    gemmaModels: string[];
    error?: string;
  };
  activeProviderStatus?: 'connected' | 'error' | 'disconnected' | 'testing';
  lastConnectionTest?: {
    success: boolean;
    latencyMs: number;
    message: string;
    timestamp: string;
    provider?: ProviderType;
    model?: string;
  };
}
