/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Check, 
  Copy, 
  Download, 
  ShieldCheck, 
  GitCompare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Cpu,
  ChevronDown,
  ChevronUp,
  AlertOctagon
} from 'lucide-react';
import { VulnerabilityFinding, FixValidationStatus, FixValidationResult } from '../types/security';
import { downloadTextFile } from '../utils/securityUtils';

interface PatchDiffViewerProps {
  finding: VulnerabilityFinding;
  originalCode: string;
  patchedFullCode?: string;
  fileName: string;
  language: string;
  onApplyPatch: (newCode: string) => void;
}

export const PatchDiffViewer: React.FC<PatchDiffViewerProps> = ({
  finding,
  originalCode,
  patchedFullCode,
  fileName,
  language,
  onApplyPatch
}) => {
  const [viewMode, setViewMode] = useState<'snippet' | 'full'>('snippet');
  const [showValidationDetails, setShowValidationDetails] = useState(true);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showInvalidApplyWarning, setShowInvalidApplyWarning] = useState(false);

  const validation: FixValidationResult | undefined = finding.fixValidation;
  const status: FixValidationStatus = validation?.status || 
    (finding.patchVerificationStatus === 'VERIFIED_STATIC' ? 'VALIDATED' : 'NEEDS_REVIEW');

  const handleCopy = () => {
    const textToCopy = viewMode === 'snippet' ? finding.suggestedPatch : (patchedFullCode || originalCode);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const executeApply = () => {
    if (viewMode === 'full' && patchedFullCode) {
      onApplyPatch(patchedFullCode);
    } else {
      const lines = originalCode.split('\n');
      const startIdx = Math.max(0, finding.startLine - 1);
      const endIdx = Math.max(startIdx + 1, finding.endLine);
      const patchLines = finding.suggestedPatch.split('\n');
      
      lines.splice(startIdx, endIdx - startIdx, ...patchLines);
      onApplyPatch(lines.join('\n'));
    }
    setApplied(true);
    setShowInvalidApplyWarning(false);
    setTimeout(() => setApplied(false), 2000);
  };

  const handleApplyClick = () => {
    if (status === 'INVALID') {
      setShowInvalidApplyWarning(true);
    } else {
      executeApply();
    }
  };

  const handleDownloadFixed = () => {
    const content = patchedFullCode || originalCode;
    const fixedFileName = `remediated_${fileName}`;
    downloadTextFile(fixedFileName, content);
  };

  const getValidationBadge = (st: FixValidationStatus) => {
    switch (st) {
      case 'VALIDATED':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
          label: 'Validated',
          badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
          desc: 'Passed all static AST syntax, scope, and regression checks.'
        };
      case 'PARTIALLY_VALIDATED':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
          label: 'Partially Validated',
          badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
          desc: 'Core security issue addressed, but missing imports or placeholders detected.'
        };
      case 'NEEDS_REVIEW':
        return {
          icon: <HelpCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
          label: 'Needs Review',
          badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
          desc: 'Requires human developer evaluation before application.'
        };
      case 'INVALID':
        return {
          icon: <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
          label: 'Invalid',
          badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
          desc: 'Failed validation: syntax error, unmitigated issue, or regression detected.'
        };
    }
  };

  const badgeInfo = getValidationBadge(status);

  return (
    <div className="bg-white dark:bg-[#1B2638] rounded-2xl border border-[#DCE3ED] dark:border-[#35445A] overflow-hidden shadow-xs">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-[#F4F6FA] dark:bg-[#243247] border-b border-[#DCE3ED] dark:border-[#35445A] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <GitCompare className="w-4 h-4 text-[#2458D3] dark:text-[#4779E8] shrink-0" />
          <span className="font-semibold text-[#17243B] dark:text-[#F1F5FC]">Recommended Fix</span>
          <span className="text-[11px] font-mono text-[#68758A] dark:text-[#9BAAC0]">
            Lines {finding.startLine}-{finding.endLine}
          </span>

          {/* Validation Status Pill */}
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium ${badgeInfo.badge}`}>
            {badgeInfo.icon}
            <span>{badgeInfo.label}</span>
          </div>

          {validation && (
            <span className="text-[10px] font-mono text-[#526078] dark:text-[#C2CDDC] bg-white dark:bg-[#1B2638] px-1.5 py-0.5 rounded border border-[#DCE3ED] dark:border-[#35445A]">
              Confidence {validation.overallScore}%
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Switch */}
          <div className="flex items-center bg-white dark:bg-[#1B2638] p-0.5 rounded-lg border border-[#DCE3ED] dark:border-[#35445A] text-[11px]">
            <button
              onClick={() => setViewMode('snippet')}
              className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                viewMode === 'snippet' 
                  ? 'bg-[#2458D3] dark:bg-[#4779E8] text-white shadow-xs' 
                  : 'text-[#68758A] dark:text-[#9BAAC0] hover:text-[#17243B] dark:hover:text-white'
              }`}
            >
              Snippet Diff
            </button>
            {patchedFullCode && (
              <button
                onClick={() => setViewMode('full')}
                className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                  viewMode === 'full' 
                    ? 'bg-[#2458D3] dark:bg-[#4779E8] text-white shadow-xs' 
                    : 'text-[#68758A] dark:text-[#9BAAC0] hover:text-[#17243B] dark:hover:text-white'
                }`}
              >
                Full File
              </button>
            )}
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1B2638] hover:bg-slate-50 dark:hover:bg-[#243247] text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
            title="Copy fix to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#68758A] dark:text-[#9BAAC0]" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownloadFixed}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1B2638] hover:bg-slate-50 dark:hover:bg-[#243247] text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
            title="Export remediated source file"
          >
            <Download className="w-3.5 h-3.5 text-[#68758A] dark:text-[#9BAAC0]" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={handleApplyClick}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold text-xs transition shadow-xs cursor-pointer ${
              applied
                ? 'bg-emerald-600 text-white'
                : status === 'INVALID'
                ? 'bg-rose-600 hover:bg-rose-500 text-white active:scale-95'
                : 'bg-[#2458D3] hover:bg-[#1948B8] dark:bg-[#4779E8] dark:hover:bg-[#386AD9] text-white active:scale-95'
            }`}
          >
            {applied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Applied</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Apply Fix</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Invalid Warning Modal / Bar */}
      {showInvalidApplyWarning && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800/80 p-3.5 text-xs text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-rose-900 dark:text-rose-300 block">Warning: Suggested Fix Failed Validation</span>
              <p className="text-[11px] text-rose-700 dark:text-rose-200/90 leading-relaxed mt-0.5">
                The Fix Validation Engine identified potential syntax errors, unmitigated issues, or secondary regressions. Applying this fix could break your build or compromise security.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              onClick={() => setShowInvalidApplyWarning(false)}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#17243B] dark:text-slate-300 text-[11px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={executeApply}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-[11px] cursor-pointer"
            >
              Apply Anyway
            </button>
          </div>
        </div>
      )}

      {/* Snippet Comparison Mode */}
      {viewMode === 'snippet' && (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#DCE3ED] dark:divide-[#35445A]">
          {/* Current Code */}
          <div className="p-3.5 bg-rose-50/40 dark:bg-rose-950/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-rose-700 dark:text-rose-400 uppercase font-semibold">
                Current Code with Security Issue
              </span>
              <span className="text-[10px] text-[#68758A] dark:text-slate-500 font-mono">Lines {finding.startLine}-{finding.endLine}</span>
            </div>
            <pre className="font-mono text-xs text-rose-900 dark:text-rose-200 whitespace-pre-wrap bg-white dark:bg-slate-950 p-3 rounded-lg border border-rose-200 dark:border-rose-900/30 overflow-x-auto leading-relaxed max-h-64 shadow-xs">
              <code>{finding.snippet || '// Lines ' + finding.startLine + '-' + finding.endLine}</code>
            </pre>
          </div>

          {/* Recommended Fix */}
          <div className="p-3.5 bg-emerald-50/40 dark:bg-emerald-950/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 uppercase font-semibold">
                Recommended Remediation
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400/80">Static Replacement</span>
            </div>
            <pre className="font-mono text-xs text-emerald-900 dark:text-emerald-300 whitespace-pre-wrap bg-white dark:bg-slate-950 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/30 overflow-x-auto leading-relaxed max-h-64 shadow-xs">
              <code>{finding.suggestedPatch}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Full File Mode */}
      {viewMode === 'full' && (
        <div className="p-4 bg-[#F4F6FA] dark:bg-slate-950">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-[#526078] dark:text-slate-400">
              Remediated Source Code ({fileName})
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Safe Preview</span>
          </div>
          <pre className="font-mono text-xs text-[#17243B] dark:text-emerald-300 whitespace-pre-wrap bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-[#DCE3ED] dark:border-slate-800 max-h-80 overflow-y-auto leading-relaxed shadow-xs">
            <code>{patchedFullCode || originalCode}</code>
          </pre>
        </div>
      )}

      {/* Validation Engine Results Section */}
      <div className="border-t border-[#DCE3ED] dark:border-[#35445A] bg-[#FBFCFD] dark:bg-slate-950/60">
        <button
          onClick={() => setShowValidationDetails(!showValidationDetails)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-[#526078] dark:text-slate-300 hover:text-[#17243B] dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900/40 transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-[#2458D3] dark:text-cyan-400" />
            <span className="font-semibold text-[#17243B] dark:text-slate-200">Fix Validation Engine Assessment</span>
            <span className="text-[10px] text-[#68758A] dark:text-slate-500 hidden sm:inline">
              (Isolated Static AST Analysis — Never executes untrusted code)
            </span>
          </div>
          {showValidationDetails ? (
            <ChevronUp className="w-3.5 h-3.5 text-[#68758A] dark:text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#68758A] dark:text-slate-400" />
          )}
        </button>

        {showValidationDetails && validation && (
          <div className="p-4 pt-1 space-y-3.5 text-xs">
            {/* 4 Check Dimension Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Check 1: Syntax & AST Parsing */}
              <div className="bg-white dark:bg-[#243247] p-3 rounded-xl border border-[#DCE3ED] dark:border-[#35445A] shadow-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-[#17243B] dark:text-slate-200">Syntax & Parsing</span>
                  {validation.syntaxCheck.passed ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> PASS
                    </span>
                  ) : (
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-mono font-semibold">
                      <XCircle className="w-3 h-3" /> FAIL
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#526078] dark:text-slate-400 leading-normal">
                  {validation.syntaxCheck.message}
                </p>
              </div>

              {/* Check 2: Scope & Module Imports */}
              <div className="bg-white dark:bg-[#243247] p-3 rounded-xl border border-[#DCE3ED] dark:border-[#35445A] shadow-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-[#17243B] dark:text-slate-200">Scope & Imports</span>
                  {validation.scopeAndImportsCheck.status === 'PASS' ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> PASS
                    </span>
                  ) : validation.scopeAndImportsCheck.status === 'WARN' ? (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-mono font-semibold">
                      <AlertTriangle className="w-3 h-3" /> WARN
                    </span>
                  ) : (
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-mono font-semibold">
                      <XCircle className="w-3 h-3" /> FAIL
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#526078] dark:text-slate-400 leading-normal">
                  {validation.scopeAndImportsCheck.message}
                </p>
                {validation.missingImports.length > 0 && (
                  <span className="inline-block mt-1 text-[9px] font-mono text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/50">
                    Missing: {validation.missingImports.join(', ')}
                  </span>
                )}
                {validation.undefinedVariables.length > 0 && (
                  <span className="inline-block mt-1 text-[9px] font-mono text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/50">
                    Undefined: {validation.undefinedVariables.join(', ')}
                  </span>
                )}
              </div>

              {/* Check 3: Flaw Neutralization */}
              <div className="bg-white dark:bg-[#243247] p-3 rounded-xl border border-[#DCE3ED] dark:border-[#35445A] shadow-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-[#17243B] dark:text-slate-200">Flaw Neutralization</span>
                  {validation.vulnerabilityResolved ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> RESOLVED
                    </span>
                  ) : (
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-mono font-semibold">
                      <XCircle className="w-3 h-3" /> UNRESOLVED
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#526078] dark:text-slate-400 leading-normal">
                  {validation.securityImprovement}
                </p>
              </div>

              {/* Check 4: Regression Check */}
              <div className="bg-white dark:bg-[#243247] p-3 rounded-xl border border-[#DCE3ED] dark:border-[#35445A] shadow-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-[#17243B] dark:text-slate-200">Regression Check</span>
                  {validation.securityRegressionCheck.passed ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> CLEAN
                    </span>
                  ) : (
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-mono font-semibold">
                      <XCircle className="w-3 h-3" /> REGRESSION
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#526078] dark:text-slate-400 leading-normal">
                  {validation.securityRegressionCheck.message}
                </p>
              </div>
            </div>

            {/* Compatibility Issues / Contextual Warnings */}
            {validation.potentialCompatibilityIssues.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
                <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Potential Compatibility Considerations
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900/80 dark:text-amber-200/80">
                  {validation.potentialCompatibilityIssues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
