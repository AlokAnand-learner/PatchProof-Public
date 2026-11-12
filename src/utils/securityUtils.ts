/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScanResult, VulnerabilityFinding, HistoryItem } from '../types/security';
import { redactLikelySecrets } from '../engine/untrustedSourceBoundary';

export function getSeverityColor(severity: string) {
  switch ((severity || '').toUpperCase()) {
    case 'CRITICAL':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-700 dark:text-rose-400',
        border: 'border-rose-500/30',
        badge: 'bg-rose-600 text-white',
        ring: 'ring-rose-500/20'
      };
    case 'HIGH':
      return {
        bg: 'bg-orange-500/10',
        text: 'text-orange-700 dark:text-orange-400',
        border: 'border-orange-500/30',
        badge: 'bg-orange-600 text-white',
        ring: 'ring-orange-500/20'
      };
    case 'MEDIUM':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-800 dark:text-amber-400',
        border: 'border-amber-500/30',
        badge: 'bg-amber-600 text-white',
        ring: 'ring-amber-500/20'
      };
    case 'LOW':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-500/30',
        badge: 'bg-blue-600 text-white',
        ring: 'ring-blue-500/20'
      };
    default:
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-700 dark:text-slate-400',
        border: 'border-slate-500/30',
        badge: 'bg-slate-700 text-white',
        ring: 'ring-slate-500/20'
      };
  }
}

export function getGradeBadge(grade: string) {
  switch (grade) {
    case 'A+':
    case 'A':
      return 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30';
    case 'B':
      return 'bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 border border-cyan-500/30';
    case 'C':
      return 'bg-amber-500/15 dark:bg-yellow-500/20 text-amber-900 dark:text-yellow-400 border border-amber-500/30';
    case 'D':
      return 'bg-orange-500/15 dark:bg-orange-500/20 text-orange-800 dark:text-orange-400 border border-orange-500/30';
    default:
      return 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-800 dark:text-rose-400 border border-rose-500/30';
  }
}

const STORAGE_KEY = 'patchproof_scan_history_v1';
const PRIVACY_FLAG_KEY = 'patchproof_privacy_no_source';

const REDACTED_SOURCE = '// Redacted for privacy (source storage disabled)';

/**
 * Redacts likely credentials from retained evidence, then removes complete source
 * files and full-file patches before a review is persisted. Evidence remains useful,
 * but privacy mode must not preserve obvious secret assignments copied into findings.
 */
function redactHistoryText(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) return value;
  return redactLikelySecrets([{ path: 'history-evidence.txt', content: value }])[0]?.content ?? value;
}

function redactScanSource(scan: ScanResult): ScanResult {
  const findings = Array.isArray(scan.findings) ? scan.findings.map(finding => ({
    ...finding,
    title: redactHistoryText(finding.title) as string,
    snippet: redactHistoryText(finding.snippet) as string,
    surroundingContext: redactHistoryText(finding.surroundingContext) as string,
    evidence: redactHistoryText(finding.evidence) as string,
    explanation: redactHistoryText(finding.explanation) as string,
    attackScenario: redactHistoryText(finding.attackScenario) as string,
    exploitConditions: redactHistoryText(finding.exploitConditions) as string,
    remediation: redactHistoryText(finding.remediation) as string,
    suggestedPatch: redactHistoryText(finding.suggestedPatch) as string,
    classificationReason: redactHistoryText(finding.classificationReason) as string,
    reasoning: redactHistoryText(finding.reasoning) as string,
    remainingUncertainty: redactHistoryText(finding.remainingUncertainty) as string
  })) : [];

  return {
    ...scan,
    projectName: redactHistoryText(scan.projectName) as string,
    fileName: redactHistoryText(scan.fileName) as string,
    originalCode: REDACTED_SOURCE,
    patchedFullCode: undefined,
    summary: redactHistoryText(scan.summary) as string,
    recommendations: Array.isArray(scan.recommendations)
      ? scan.recommendations.map(item => redactHistoryText(item) as string)
      : [],
    findings,
    files: Array.isArray(scan.files) ? scan.files.map(file => ({
      ...file,
      content: REDACTED_SOURCE,
      patchedContent: undefined
    })) : undefined
  };
}

function redactHistoryItem(item: HistoryItem): HistoryItem {
  if (!item || typeof item !== 'object' || !item.scanResult || typeof item.scanResult !== 'object') {
    return item;
  }
  return { ...item, scanResult: redactScanSource(item.scanResult) };
}

export function isPrivacyModeEnabled(): boolean {
  try {
    if (typeof window === 'undefined') return true;
    // Privacy-safe default for new installs. Only an explicit opt-out stores full source.
    return localStorage.getItem(PRIVACY_FLAG_KEY) !== 'false';
  } catch {
    return true;
  }
}

/**
 * Updates the source-retention preference. Enabling privacy mode also scrubs all
 * existing history entries so old full-source records are not left behind.
 * Returns false if the preference or existing history could not be updated.
 */
export function setPrivacyMode(enabled: boolean): boolean {
  try {
    if (typeof window === 'undefined') return false;

    // Set the safe preference first so newly saved reviews are redacted even if
    // rewriting an existing history record fails.
    localStorage.setItem(PRIVACY_FLAG_KEY, enabled ? 'true' : 'false');

    if (enabled) {
      const rawHistory = localStorage.getItem(STORAGE_KEY);
      if (rawHistory) {
        const parsedHistory: unknown = JSON.parse(rawHistory);
        if (!Array.isArray(parsedHistory)) {
          throw new Error('Saved review history has an unexpected format.');
        }
        const redactedHistory = parsedHistory.map(item => redactHistoryItem(item as HistoryItem));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(redactedHistory));
      }
    }

    window.dispatchEvent(new CustomEvent('patchproof_history_updated'));
    return true;
  } catch (err) {
    console.error('Failed to update source storage privacy:', err);
    return false;
  }
}

export function getScanHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsedHistory: unknown = JSON.parse(raw);
    if (!Array.isArray(parsedHistory)) {
      throw new Error('Saved review history has an unexpected format.');
    }

    if (!isPrivacyModeEnabled()) return parsedHistory as HistoryItem[];

    // Migrate legacy records automatically when privacy mode is the default or enabled.
    const redactedHistory = parsedHistory.map(item => redactHistoryItem(item as HistoryItem));
    const redactedJson = JSON.stringify(redactedHistory);
    if (redactedJson !== raw) {
      try {
        localStorage.setItem(STORAGE_KEY, redactedJson);
      } catch (writeError) {
        // Never return full-source records to the UI when persistence is unavailable.
        console.error('Could not persist privacy-redacted review history:', writeError);
      }
    }
    return redactedHistory;
  } catch (err) {
    console.error('Failed to read review history:', err);
    return [];
  }
}

/**
 * Saves scan to local storage with quota error handling and optional source-code privacy pruning.
 */
export function saveScanToHistory(scan: ScanResult): HistoryItem[] {
  try {
    const current = getScanHistory();
    const privacyEnabled = isPrivacyModeEnabled();

    // If privacy mode enabled, strip full raw source files before writing to browser storage
    const sanitizedScan: ScanResult = privacyEnabled ? redactScanSource(scan) : scan;

    const newItem: HistoryItem = {
      id: scan.id,
      projectName: scan.projectName,
      fileName: scan.fileName,
      language: scan.language,
      timestamp: scan.timestamp,
      score: scan.metrics.score,
      grade: scan.metrics.grade,
      totalFindings: scan.metrics.totalFindings,
      criticalCount: scan.metrics.criticalCount,
      highCount: scan.metrics.highCount,
      scanResult: sanitizedScan
    };

    let updated = [newItem, ...current.filter(item => item.id !== scan.id)].slice(0, 40);

    // Attempt to save with storage quota safety fallback
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (quotaErr) {
      console.warn('Storage quota exceeded, pruning older history records...');
      // Prune down to 10 entries and strip source code from all but the newest item
      updated = [
        newItem,
        ...current.filter(item => item.id !== scan.id).slice(0, 10).map(item => redactHistoryItem(item))
      ];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (finalQuotaErr) {
        // If still full, store only the latest 3 lightweight entries
        updated = updated.slice(0, 3);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('patchproof_history_updated'));
    }
    return updated;
  } catch (err) {
    console.error('Failed to save review to history:', err);
    return [];
  }
}

export function deleteScanFromHistory(id: string): HistoryItem[] {
  try {
    const current = getScanHistory();
    const updated = current.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('patchproof_history_updated'));
    }
    return updated;
  } catch (err) {
    console.error('Failed to delete review:', err);
    return [];
  }
}

export function deleteMultipleScansFromHistory(ids: string[]): HistoryItem[] {
  try {
    const idSet = new Set(ids);
    const current = getScanHistory();
    const updated = current.filter(item => !idSet.has(item.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('patchproof_history_updated'));
    }
    return updated;
  } catch (err) {
    console.error('Failed to delete selected reviews:', err);
    return [];
  }
}

export function clearScanHistory(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('patchproof_history_updated'));
    }
    return true;
  } catch (err) {
    console.error('Failed to clear review history:', err);
    return false;
  }
}


function safeReportNumber(value: unknown, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function generateMarkdownReport(scan: ScanResult): string {
  const dateStr = new Date(scan.timestamp).toLocaleString();
  let md = `# PatchProof Security Review Report\n\n`;
  md += `**Target File:** \`${scan.fileName}\`  \n`;
  md += `**Language:** ${scan.language.toUpperCase()}  \n`;
  md += `**Review Date:** ${dateStr}  \n`;
  md += `**Security Score:** ${scan.metrics.score} / 100 (Grade: ${scan.metrics.grade})  \n`;
  md += `**Analysis Engine:** ${scan.modelUsed || 'Context-Aware Static Rules (Local)'}  \n`;
  md += `**Transmission Boundary:** ${scan.transmissionMode === 'CLOUD_AI_TRANSMITTED' ? 'Remote AI analysis (consent recorded)' : 'Local analysis (no remote AI transmission recorded)'}  \n\n`;

  md += `## Executive Summary\n\n`;
  md += `${scan.summary}\n\n`;

  md += `### Summary of Findings\n\n`;
  md += `- **Critical:** ${scan.metrics.criticalCount}\n`;
  md += `- **High:** ${scan.metrics.highCount}\n`;
  md += `- **Medium:** ${scan.metrics.mediumCount}\n`;
  md += `- **Low:** ${scan.metrics.lowCount}\n`;
  md += `- **Total Findings:** ${scan.metrics.totalFindings}\n`;
  md += `- **Lines Inspected:** ${scan.metrics.linesAnalyzed}\n\n`;

  md += `## Security Findings\n\n`;

  if (scan.findings.length === 0) {
    md += `*No security issues were identified in this review.*  \n\n`;
  } else {
    scan.findings.forEach((f, idx) => {
      const typeLabel = f.verificationMethod || (f.verificationType === 'STATIC_RULE_MATCH' ? 'STATIC_RULE_MATCH' : 'CONTEXTUAL_HEURISTIC');
      md += `### ${idx + 1}. [${f.severity}] ${f.title}\n\n`;
      md += `- **Classification:** ${f.cwe}\n`;
      md += `- **Category:** ${f.owaspCategory}\n`;
      md += `- **Status:** ${f.verificationStatus}\n`;
      md += `- **Method:** ${typeLabel}\n`;
      md += `- **File:** \`${f.filePath || scan.fileName}\` (Lines ${f.startLine}-${f.endLine})\n\n`;
      
      md += `#### Explanation\n${f.explanation}\n\n`;
      md += `#### Potential Impact\n${f.attackScenario}\n\n`;
      if (f.remainingUncertainty) {
        md += `#### Static Analysis Limitations / Remaining Uncertainty\n${f.remainingUncertainty}\n\n`;
      }
      md += `#### Recommended Fix\n${f.remediation}\n\n`;
      
      if (f.snippet) {
        md += `#### Affected Code (Lines ${f.startLine}-${f.endLine})\n`;
        md += `\`\`\`${scan.language}\n${f.snippet}\n\`\`\`\n\n`;
      }

      if (f.suggestedPatch) {
        const valStatus = f.fixValidation?.status || (f.patchVerificationStatus === 'VERIFIED_STATIC' ? 'VALIDATED' : 'NEEDS_REVIEW');
        const valScore = f.fixValidation && typeof f.fixValidation.overallScore === 'number' && Number.isFinite(f.fixValidation.overallScore)
          ? safeReportNumber(f.fixValidation.overallScore, 0, 0, 100)
          : null;
        md += `#### Recommended Code Change\n`;
        md += valScore === null
          ? `*Validation Status: **${valStatus}** (validation was not run for this report)*\n\n`
          : `*Validation Status: **${valStatus}** (Confidence: ${valScore}%) - Evaluated via isolated static checks*\n\n`;
        if (f.fixValidation) {
          md += `- **Syntax Check:** ${f.fixValidation.syntaxCheck.passed ? 'PASS' : 'FAIL'}\n`;
          md += `- **Scope & Imports:** ${f.fixValidation.scopeAndImportsCheck.passed ? 'PASS' : 'WARN/FAIL'}\n`;
          md += `- **Vulnerability Neutralization:** ${f.fixValidation.vulnerabilityResolved ? 'CONFIRMED' : 'UNRESOLVED'}\n`;
          md += `- **Security Regressions:** ${f.fixValidation.securityRegressionCheck.passed ? 'ZERO REGRESSIONS' : 'REGRESSION DETECTED'}\n\n`;
        }
        md += `\`\`\`${scan.language}\n${f.suggestedPatch}\n\`\`\`\n\n`;
      }
      md += `---\n\n`;
    });
  }

  md += `## Recommended Next Steps\n\n`;
  scan.recommendations.forEach(r => {
    md += `- ${r}\n`;
  });
  md += `\n---\n*Generated by PatchProof Code Security Review Platform. All code inspected without dynamic execution.*\n`;

  return md;
}

/**
 * Escapes all characters that could allow HTML injection, script execution, or attribute breakout.
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

const ALLOWED_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);
const ALLOWED_VALIDATION_STATUSES = new Set(['VALIDATED', 'PARTIALLY_VALIDATED', 'NEEDS_REVIEW', 'INVALID']);

export function safeSeverityClass(sev: string): string {
  const normalized = (sev || '').toLowerCase();
  return ALLOWED_SEVERITIES.has(normalized) ? normalized : 'info';
}

export function safeValidationStatus(status: string): string {
  return ALLOWED_VALIDATION_STATUSES.has(status) ? status : 'NEEDS_REVIEW';
}

export function generateHtmlReport(scan: ScanResult): string {
  const dateStr = new Date(scan.timestamp).toLocaleString();
  const metrics = scan.metrics && typeof scan.metrics === 'object' ? scan.metrics : {} as ScanResult['metrics'];
  const findings = Array.isArray(scan.findings) ? scan.findings : [];
  const recommendations = Array.isArray(scan.recommendations) ? scan.recommendations : [];
  const score = safeReportNumber(metrics.score, 0, 0, 100);
  const totalFindings = safeReportNumber(metrics.totalFindings);
  const criticalCount = safeReportNumber(metrics.criticalCount);
  const highCount = safeReportNumber(metrics.highCount);
  const mediumCount = safeReportNumber(metrics.mediumCount);
  const linesAnalyzed = safeReportNumber(metrics.linesAnalyzed);

  const findingsHtml = findings.length === 0
    ? '<div class="empty-state">No security vulnerabilities were identified in this review.</div>'
    : findings.map((f, i) => {
      const sevClass = safeSeverityClass(f.severity);
      const hasFixValidation = Boolean(f.fixValidation && typeof f.fixValidation === 'object');
      const valStatus = hasFixValidation
        ? safeValidationStatus(f.fixValidation?.status || 'NEEDS_REVIEW')
        : 'NOT RUN';
      const valScore = hasFixValidation && typeof f.fixValidation?.overallScore === 'number' && Number.isFinite(f.fixValidation.overallScore)
        ? safeReportNumber(f.fixValidation.overallScore, 0, 0, 100)
        : null;
      const startLine = safeReportNumber(f.startLine, 1, 1);
      const endLine = safeReportNumber(f.endLine, startLine, startLine);

      return `
      <div class="finding-card ${sevClass}">
        <div class="finding-header">
          <div class="title-row">
            <span class="badge ${sevClass}">${escapeHtml(f.severity)}</span>
            <span class="finding-title">#${i + 1} ${escapeHtml(f.title)}</span>
          </div>
          <div class="meta-row">
            <span><strong>CWE:</strong> ${escapeHtml(f.cwe)}</span>
            <span>&bull;</span>
            <span><strong>Category:</strong> ${escapeHtml(f.owaspCategory)}</span>
            <span>&bull;</span>
            <span><strong>Status:</strong> ${escapeHtml(f.verificationStatus || 'NEEDS_REVIEW')}</span>
            <span>&bull;</span>
            <span><strong>Location:</strong> ${escapeHtml(f.filePath || scan.fileName)}:${startLine}-${endLine}</span>
          </div>
        </div>
        
        <div class="finding-body">
          <p><strong>Explanation:</strong> ${escapeHtml(f.explanation)}</p>
          <p><strong>Potential Impact:</strong> ${escapeHtml(f.attackScenario)}</p>
          ${f.exploitConditions ? `<p><strong>Exploit Conditions:</strong> ${escapeHtml(f.exploitConditions)}</p>` : ''}
          ${f.remainingUncertainty ? `<p><strong>Static Verification Limits:</strong> ${escapeHtml(f.remainingUncertainty)}</p>` : ''}
          <p><strong>Recommended Fix:</strong> ${escapeHtml(f.remediation)}</p>
          
          ${f.snippet ? `
            <div class="code-block">
              <div class="code-title">Affected Code (Lines ${startLine}-${endLine})</div>
              <pre><code>${escapeHtml(f.snippet)}</code></pre>
            </div>
          ` : ''}
          
          ${f.suggestedPatch ? `
            <div class="code-block patch">
              <div class="code-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Recommended Patch</span>
                <span style="font-size:10px; font-weight:bold; padding:2px 8px; border-radius:12px; background:${valStatus === 'VALIDATED' ? 'rgba(16,185,129,0.2)' : valStatus === 'PARTIALLY_VALIDATED' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}; color:${valStatus === 'VALIDATED' ? '#34d399' : valStatus === 'PARTIALLY_VALIDATED' ? '#fbbf24' : '#f87171'};">
                  ${escapeHtml(valStatus)}${valScore === null ? ' (not executed)' : ` (Confidence: ${valScore}%)`}
                </span>
              </div>
              <pre><code>${escapeHtml(f.suggestedPatch)}</code></pre>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    }).join('');

  const recommendationsHtml = recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PatchProof Security Report - ${escapeHtml(scan.projectName)}</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #0f1524;
      --border: #1e293b;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --critical: #ef4444;
      --high: #f97316;
      --medium: #f59e0b;
      --low: #3b82f6;
      --info: #64748b;
      --success: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 2.5rem 1.5rem;
    }
    .container { max-width: 900px; margin: 0 auto; }
    .header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .brand { font-size: 1.5rem; font-weight: 800; color: #fff; letter-spacing: -0.02em; }
    .brand span { color: var(--success); }
    .subtitle { color: var(--muted); font-size: 0.875rem; margin-top: 0.25rem; }
    .score-badge {
      background: #111827;
      border: 1px solid var(--border);
      padding: 0.75rem 1.25rem;
      border-radius: 0.75rem;
      text-align: right;
    }
    .score-val { font-size: 1.75rem; font-weight: 800; color: var(--success); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      padding: 1rem;
      border-radius: 0.75rem;
    }
    .stat-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; font-weight: 600; }
    .stat-val { font-size: 1.25rem; font-weight: 700; color: #fff; margin-top: 0.25rem; }
    .section-title { font-size: 1.15rem; font-weight: 700; color: #fff; margin: 2rem 0 1rem; border-left: 3px solid var(--success); padding-left: 0.75rem; }
    .finding-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      margin-bottom: 1.25rem;
      overflow: hidden;
    }
    .finding-header {
      padding: 1rem 1.25rem;
      background: rgba(15, 23, 42, 0.7);
      border-bottom: 1px solid var(--border);
    }
    .title-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .finding-title { font-size: 1rem; font-weight: 700; color: #fff; }
    .badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0.2rem 0.5rem;
      border-radius: 0.375rem;
    }
    .badge.critical { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
    .badge.high { background: rgba(249, 115, 22, 0.2); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.4); }
    .badge.medium { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
    .badge.low { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }
    .badge.info { background: rgba(100, 116, 139, 0.2); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.4); }
    .meta-row { font-size: 0.75rem; color: var(--muted); margin-top: 0.4rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .finding-body { padding: 1.25rem; font-size: 0.875rem; }
    .finding-body p { margin-bottom: 0.75rem; }
    .code-block {
      background: #060911;
      border: 1px solid #1e293b;
      border-radius: 0.5rem;
      margin-top: 0.75rem;
      overflow-x: auto;
    }
    .code-block.patch { border-color: rgba(16, 185, 129, 0.3); }
    .code-title {
      font-size: 0.7rem;
      text-transform: uppercase;
      font-weight: 700;
      padding: 0.4rem 0.75rem;
      background: #0c121e;
      color: var(--muted);
      border-bottom: 1px solid #1e293b;
    }
    pre { padding: 0.75rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.8rem; color: #cbd5e1; }
    .recommendations-box {
      background: var(--card-bg);
      border: 1px solid var(--border);
      padding: 1.25rem;
      border-radius: 0.75rem;
    }
    .recommendations-box ul { padding-left: 1.25rem; font-size: 0.875rem; color: var(--text); }
    .recommendations-box li { margin-bottom: 0.5rem; }
    .footer {
      border-top: 1px solid var(--border);
      padding-top: 1.5rem;
      margin-top: 2.5rem;
      font-size: 0.75rem;
      color: var(--muted);
      text-align: center;
    }
    @media print {
      body { background: #fff; color: #000; padding: 0; }
      .container { max-width: 100%; }
      .finding-card { page-break-inside: avoid; border: 1px solid #ccc; background: #fff; }
      .stat-card, .score-badge, .recommendations-box { background: #fff; border: 1px solid #ccc; }
      .code-block { background: #f8fafc; border: 1px solid #ddd; color: #000; }
      pre { color: #000; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="brand">Patch<span>Proof</span></div>
        <div class="subtitle">Code Security Review Assessment</div>
        <div class="subtitle" style="margin-top: 0.4rem;">
          <strong>Target:</strong> ${escapeHtml(scan.fileName)} &bull; 
          <strong>Language:</strong> ${escapeHtml((typeof scan.language === 'string' ? scan.language : '').toUpperCase())} &bull; 
          <strong>Date:</strong> ${escapeHtml(dateStr)} &bull;
          <strong>Engine:</strong> ${escapeHtml(scan.modelUsed || 'Context-Aware Static Rules (Local)')}
        </div>
      </div>
      <div class="score-badge">
        <div class="stat-label">Security Score</div>
        <div class="score-val">${score} <span style="font-size: 1rem; color: #fff;">/ 100</span></div>
        <div class="stat-label" style="margin-top: 0.2rem;">Grade: ${escapeHtml(metrics.grade)}</div>
      </div>
    </div>

    <div class="grid">
      <div class="stat-card">
        <div class="stat-label">Total Findings</div>
        <div class="stat-val">${totalFindings}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Critical</div>
        <div class="stat-val" style="color: var(--critical);">${criticalCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">High</div>
        <div class="stat-val" style="color: var(--high);">${highCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Medium</div>
        <div class="stat-val" style="color: var(--medium);">${mediumCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Lines Scanned</div>
        <div class="stat-val">${linesAnalyzed}</div>
      </div>
    </div>

    <div class="section-title">Executive Summary</div>
    <div class="recommendations-box" style="margin-bottom: 1.5rem;">
      <p style="font-size: 0.9rem; line-height: 1.6;">${escapeHtml(scan.summary)}</p>
    </div>

    <div class="section-title">Detailed Vulnerability Findings (${findings.length})</div>
    ${findingsHtml}

    <div class="section-title">Recommended Remediations</div>
    <div class="recommendations-box">
      <ul>${recommendationsHtml}</ul>
    </div>

    <div class="footer">
      Generated automatically by PatchProof Code Security Review Platform.<br>
      This document contains defensive vulnerability assessments and remediation recommendations. Source code was analyzed without dynamic execution.
    </div>
  </div>
</body>
</html>`;
}

/** Normalize user-controlled report names before passing them to the browser download attribute. */
export function sanitizeDownloadFilename(filename: unknown): string {
  if (typeof filename !== 'string') return 'PatchProof-Report';
  const safe = filename
    .replace(/[\/\\:\u0000-\u001f\u007f]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 180);
  return safe || 'PatchProof-Report';
}

export function downloadTextFile(filename: string, content: string, contentType: string = 'text/plain') {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeDownloadFilename(filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoking synchronously can race the browser's download navigation on mobile.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
