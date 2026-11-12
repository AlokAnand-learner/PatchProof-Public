/**
 * PatchProof Accuracy & Precision Verification Script
 * Validates vulnerability detection without self-scanning false positives.
 */
import { runEvaluationSuite } from '../src/data/evaluationSuite';
import { EvaluationTestCase } from '../src/types/security';

console.log('===========================================================');
console.log('   PATCHPROOF CODE SECURITY ENGINE - EVALUATION SUITE      ');
console.log('===========================================================');

const results = runEvaluationSuite();

const noPositiveCases: EvaluationTestCase[] = [{
  id: 'metrics-empty-positive-class',
  title: 'Safe code with no predicted vulnerabilities',
  category: 'Precision edge case',
  description: 'A secure fixture verifies zero-denominator metric handling.',
  fileName: 'safe_metrics.ts',
  language: 'typescript',
  expectedOutcome: 'SECURE',
  expectedClassification: 'FALSE_POSITIVE',
  rationale: 'No vulnerable sink or untrusted input is present.',
  code: 'const answer = 42;',
}];
const noPositiveMetrics = runEvaluationSuite(noPositiveCases);
if (noPositiveMetrics.precision !== 0 || noPositiveMetrics.recall !== 0 ||
    noPositiveMetrics.f1Score !== 0 || noPositiveMetrics.accuracy !== 100) {
  throw new Error('Empty positive-class metrics must be conservative (0 precision/recall/F1, 100 accuracy).');
}
console.log('Empty positive-class metric edge case: 4 assertions passed.');

if (results.excludedCases !== 4 || results.evaluatedCases !== 9) {
  throw new Error(`Expected 9 scored cases and 4 review-only cases; got ${results.evaluatedCases} scored and ${results.excludedCases} excluded.`);
}
if (results.falsePositives !== 0 || results.falseNegatives !== 0) {
  throw new Error(`Unexpected binary classification errors: ${results.falsePositives} FP, ${results.falseNegatives} FN.`);
}

console.log(`\nEvaluation Timestamp: ${results.timestamp}`);
console.log(`Total Test Cases   : ${results.totalTestCases}`);
console.log(`Scored Cases       : ${results.evaluatedCases}`);
console.log(`Review-only Cases  : ${results.excludedCases} (excluded from binary metrics)`);
console.log(`True Positives (TP): ${results.truePositives}`);
console.log(`True Negatives (TN): ${results.trueNegatives}`);
console.log(`False Positives(FP): ${results.falsePositives}`);
console.log(`False Negatives(FN): ${results.falseNegatives}`);
console.log(`Precision          : ${results.precision.toFixed(1)}%`);
console.log(`Recall             : ${results.recall.toFixed(1)}%`);
console.log(`F1 Score           : ${results.f1Score.toFixed(1)}%`);
console.log(`Overall Accuracy   : ${results.accuracy.toFixed(1)}%`);
console.log('\n--- Detailed Test Outcomes ---');

let allPassed = true;
results.results.forEach((r, idx) => {
  const statusStr = r.passed ? '✓ PASS' : '✗ FAIL';
  if (!r.passed) allPassed = false;
  console.log(`[${statusStr}] #${idx + 1} ${r.title}`);
  console.log(`       Outcome: ${r.actualOutcome} (${r.actualClassification})`);
  console.log(`       Reason : ${r.reason}`);
});

console.log('===========================================================');
if (allPassed) {
  console.log(`✓ EVALUATION PASSED. ${results.falsePositives} false positives across ${results.evaluatedCases} scored cases; review-only cases excluded.`);
  process.exit(0);
} else {
  console.error('✗ EVALUATION FAILED: Misclassifications detected.');
  process.exit(1);
}
