import { VulnerabilityFinding } from '../types/security';

export interface FindingOriginCounts {
  aiHypothesesCount: number;
  deterministicCount: number;
}

/** Count only active findings and derive origin from the finding's actual engine tag. */
export function countFindingOrigins(findings: readonly VulnerabilityFinding[]): FindingOriginCounts {
  const active = findings.filter(finding => finding.verificationStatus !== 'FALSE_POSITIVE');
  const aiHypothesesCount = active.filter(finding => finding.verificationType === 'AI_HYPOTHESIS').length;
  return {
    aiHypothesesCount,
    deterministicCount: active.length - aiHypothesesCount
  };
}

export interface AiCoverageNoticeInput {
  attempted: number;
  completed: number;
  failed: number;
  truncated: number;
  truncatedFiles?: string[];
  maxCharactersPerFile: number;
  skippedByBudget?: number;
  offlineMode: boolean;
  cloudConsentRequired: boolean;
  cloudConsentGranted: boolean;
}

/** Produce an explicit, bounded explanation of which analysis path actually ran. */
export function buildAiCoverageNotice(input: AiCoverageNoticeInput): string {
  const {
    attempted, completed, failed, truncated, maxCharactersPerFile,
    offlineMode, cloudConsentRequired, cloudConsentGranted,
    skippedByBudget = 0, truncatedFiles = []
  } = input;

  if (completed > 0) {
    const partial = truncated > 0
      ? `; ${truncated} file(s) were truncated for AI review while local static checks covered the full accepted files. Truncated AI-reviewed paths: ${truncatedFiles.join(', ') || 'path list unavailable'}`
      : '';
    const failures = failed > 0 ? ` AI review also failed for ${failed} file(s); local checks were retained.` : '';
    const budget = skippedByBudget > 0 ? ` ${skippedByBudget} additional eligible file(s) received static-only review because the per-project AI request cap was reached.` : '';
    return `AI review completed for ${completed} of ${attempted} attempted files. At most the first ${maxCharactersPerFile.toLocaleString()} characters per file were sent to AI${partial}. AI findings remain hypotheses until independently reviewed.${failures}${budget}`;
  }
  if (attempted > 0) {
    const budget = skippedByBudget > 0 ? ` ${skippedByBudget} additional eligible file(s) received static-only review because the per-project AI request cap was reached.` : '';
    return `AI review did not complete for the attempted files${failed > 0 ? ` (${failed} failure(s))` : ''}. Local static checks completed; no AI coverage is claimed.${budget}`;
  }
  if (skippedByBudget > 0) return `${skippedByBudget} eligible file(s) received static-only review because the per-project AI request cap was reached.`;
  if (offlineMode) return 'Offline mode is active. Only local static checks ran.';
  if (cloudConsentRequired && !cloudConsentGranted) {
    return 'Cloud AI was not used because explicit cloud consent is not enabled. Local static checks ran.';
  }
  return 'Only local static checks ran for this review.';
}
