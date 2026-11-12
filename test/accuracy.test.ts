/**
 * PatchProof Accuracy & Precision Verification Script
 * Validates vulnerability detection without self-scanning false positives.
 */
import { runEvaluationSuite } from '../src/data/evaluationSuite';

console.log('===========================================================');
console.log('   PATCHPROOF CODE SECURITY ENGINE - EVALUATION SUITE      ');
console.log('===========================================================');

const results = runEvaluationSuite();

console.log(`\nEvaluation Timestamp: ${results.timestamp}`);
console.log(`Total Test Cases   : ${results.totalTestCases}`);
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
  console.log('✓ ALL EVALUATION TESTS PASSED.');
  process.exit(0);
} else {
  console.error('✗ EVALUATION FAILED: Misclassifications detected.');
  process.exit(1);
}
