/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Copy, 
  Check, 
  FileText,
  FileCode,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { ScanResult } from '../types/security';
import { generateMarkdownReport, generateHtmlReport, downloadTextFile, getSeverityColor, getGradeBadge } from '../utils/securityUtils';
import { PatchProofLogo } from './PatchProofLogo';

interface ReportModalProps {
  scan: ScanResult;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ scan, onClose }) => {
  const [copiedMd, setCopiedMd] = React.useState(false);
  const [copyFailed, setCopyFailed] = React.useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdownReport(scan);
    const filename = `PatchProof-Report-${scan.projectName}.md`;
    downloadTextFile(filename, md, 'text/markdown');
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(scan, null, 2);
    const filename = `PatchProof-Report-${scan.projectName}.json`;
    downloadTextFile(filename, jsonStr, 'application/json');
  };

  const handleDownloadHTML = () => {
    const html = generateHtmlReport(scan);
    const filename = `PatchProof-Report-${scan.projectName}.html`;
    downloadTextFile(filename, html, 'text/html');
  };

  const handleCopyMarkdown = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is unavailable in this browser context.');
      }
      const md = generateMarkdownReport(scan);
      await navigator.clipboard.writeText(md);
      setCopyFailed(false);
      setCopiedMd(true);
      window.setTimeout(() => setCopiedMd(false), 2000);
    } catch {
      setCopiedMd(false);
      setCopyFailed(true);
      window.setTimeout(() => setCopyFailed(false), 3500);
    }
  };

  const dateStr = new Date(scan.timestamp).toLocaleString();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 print:p-0 print:bg-white print:static">
      <div className="bg-white dark:bg-[#1B2638] w-full max-w-4xl rounded-2xl border border-[#DCE3ED] dark:border-[#35445A] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:rounded-none">
        {/* Top Control Bar (Hidden when printed) */}
        <div className="no-print p-3 sm:p-4 bg-[#F4F6FA] dark:bg-[#243247] border-b border-[#DCE3ED] dark:border-[#35445A] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <PatchProofLogo variant="icon" size="xs" />
            <h3 className="font-semibold text-xs sm:text-sm text-[#17243B] dark:text-[#F1F5FC]">
              Security Review Report
            </h3>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2458D3] hover:bg-[#1948B8] dark:bg-[#4779E8] dark:hover:bg-[#386AD9] text-white font-semibold text-xs transition shadow-xs cursor-pointer"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Print / PDF</span>
            </button>

            <button
              onClick={handleDownloadHTML}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1B2638] hover:bg-slate-50 dark:hover:bg-[#243247] text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
              title="Download HTML"
            >
              <FileCode className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>HTML</span>
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1B2638] hover:bg-slate-50 dark:hover:bg-[#243247] text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
              title="Download Markdown"
            >
              <FileText className="w-3.5 h-3.5 text-[#526078] dark:text-[#C2CDDC]" />
              <span>MD</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1B2638] hover:bg-slate-50 dark:hover:bg-[#243247] text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
              title="Download JSON"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>JSON</span>
            </button>

            <button
              onClick={handleCopyMarkdown}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1B2638] hover:bg-slate-50 dark:hover:bg-[#243247] text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
              title={copyFailed ? "Clipboard unavailable or permission denied" : "Copy Markdown"}
            >
              {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedMd ? 'Copied' : copyFailed ? 'Copy failed' : 'Copy'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#68758A] dark:text-[#9BAAC0] hover:text-[#17243B] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#35445A] transition ml-1 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-[#17243B] dark:text-[#F1F5FC] bg-[#F4F6FA] dark:bg-[#111827] print:bg-white print:text-black">
          {/* Document Header */}
          <div className="border-b border-[#DCE3ED] dark:border-[#35445A] pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="mb-2">
                <PatchProofLogo variant="full" size="sm" showSubtitle={false} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#17243B] dark:text-white mt-0.5">
                Executive Security Report
              </h1>
              <p className="text-xs text-[#526078] dark:text-[#C2CDDC] mt-1">
                Target: <span className="font-mono font-medium text-[#17243B] dark:text-white">{scan.fileName}</span> ({scan.language.toUpperCase()})
              </p>
            </div>

            {/* Score Box */}
            <div className="flex items-center gap-3 bg-white dark:bg-[#1B2638] p-3 rounded-xl border border-[#DCE3ED] dark:border-[#35445A] shadow-xs">
              <div className="text-right">
                <span className="text-[10px] uppercase text-[#68758A] dark:text-[#9BAAC0] font-medium block">Security Score</span>
                <span className="text-xl font-bold text-[#17243B] dark:text-white block">{scan.metrics.score}/100</span>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-base ${getGradeBadge(scan.metrics.grade)}`}>
                {scan.metrics.grade}
              </div>
            </div>
          </div>

          {/* Details Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-white dark:bg-[#1B2638] rounded-xl border border-[#DCE3ED] dark:border-[#35445A] text-xs">
              <span className="text-[#68758A] dark:text-[#9BAAC0] uppercase text-[10px] block font-mono">Date</span>
              <span className="text-[#17243B] dark:text-[#F1F5FC] font-medium mt-0.5 block">{dateStr}</span>
            </div>
            <div className="p-3 bg-white dark:bg-[#1B2638] rounded-xl border border-[#DCE3ED] dark:border-[#35445A] text-xs">
              <span className="text-[#68758A] dark:text-[#9BAAC0] uppercase text-[10px] block font-mono">Lines Reviewed</span>
              <span className="text-[#17243B] dark:text-[#F1F5FC] font-medium mt-0.5 block">{scan.metrics.linesAnalyzed} LOC</span>
            </div>
            <div className="p-3 bg-white dark:bg-[#1B2638] rounded-xl border border-[#DCE3ED] dark:border-[#35445A] text-xs col-span-2 sm:col-span-1">
              <span className="text-[#68758A] dark:text-[#9BAAC0] uppercase text-[10px] block font-mono">Total Issues</span>
              <span className="text-[#17243B] dark:text-[#F1F5FC] font-medium mt-0.5 block">{scan.metrics.totalFindings}</span>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="p-4 bg-white dark:bg-[#1B2638] rounded-xl border border-[#DCE3ED] dark:border-[#35445A] space-y-1.5">
            <h4 className="text-xs uppercase font-mono tracking-wider text-[#68758A] dark:text-[#9BAAC0] font-semibold">
              Executive Summary
            </h4>
            <p className="text-xs sm:text-sm text-[#526078] dark:text-[#C2CDDC] leading-relaxed">
              {scan.summary}
            </p>
          </div>

          {/* Severity Matrix */}
          <div>
            <h4 className="text-xs uppercase font-mono tracking-wider text-[#68758A] dark:text-[#9BAAC0] font-semibold mb-2.5">
              Severity Distribution
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-center">
                <span className="text-[11px] text-rose-700 dark:text-rose-400 font-medium uppercase block">Critical</span>
                <span className="text-xl font-bold text-rose-800 dark:text-rose-300 mt-0.5 block">{scan.metrics.criticalCount}</span>
              </div>
              <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-center">
                <span className="text-[11px] text-orange-700 dark:text-orange-400 font-medium uppercase block">High</span>
                <span className="text-xl font-bold text-orange-800 dark:text-orange-300 mt-0.5 block">{scan.metrics.highCount}</span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-center">
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium uppercase block">Medium</span>
                <span className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-0.5 block">{scan.metrics.mediumCount}</span>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-center">
                <span className="text-[11px] text-blue-700 dark:text-blue-400 font-medium uppercase block">Low</span>
                <span className="text-xl font-bold text-blue-800 dark:text-blue-300 mt-0.5 block">{scan.metrics.lowCount}</span>
              </div>
            </div>
          </div>

          {/* Findings List */}
          <div>
            <h4 className="text-xs uppercase font-mono tracking-wider text-[#68758A] dark:text-[#9BAAC0] font-semibold mb-3">
              Itemized Findings ({scan.findings.length})
            </h4>

            {scan.findings.length === 0 ? (
              <div className="p-6 text-center bg-white dark:bg-[#1B2638] rounded-xl border border-[#DCE3ED] dark:border-[#35445A] text-xs text-[#526078] dark:text-[#C2CDDC]">
                No vulnerabilities were detected in this review.
              </div>
            ) : (
              <div className="space-y-4">
                {scan.findings.map((f, i) => {
                  const colors = getSeverityColor(f.severity);
                  return (
                    <div
                      key={f.id}
                      className="p-4 rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] space-y-2.5 shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DCE3ED] dark:border-[#35445A] pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${colors.badge}`}>
                            {f.severity}
                          </span>
                          <span className="text-xs font-semibold text-[#17243B] dark:text-[#F1F5FC]">
                            {i + 1}. {f.title}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[#68758A] dark:text-[#9BAAC0]">
                          Lines {f.startLine}-{f.endLine}
                        </div>
                      </div>

                      <div className="text-xs space-y-2 text-[#526078] dark:text-[#C2CDDC]">
                        <p>
                          <strong className="text-[#68758A] dark:text-[#9BAAC0] uppercase text-[10px] block">Explanation</strong>
                          {f.explanation}
                        </p>
                        <p>
                          <strong className="text-[#68758A] dark:text-[#9BAAC0] uppercase text-[10px] block">Potential Impact</strong>
                          {f.attackScenario}
                        </p>
                        <p>
                          <strong className="text-[#68758A] dark:text-[#9BAAC0] uppercase text-[10px] block">Recommended Fix</strong>
                          {f.remediation}
                        </p>
                      </div>

                      {f.suggestedPatch && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <strong className="text-[#68758A] dark:text-[#9BAAC0] uppercase text-[10px] block">
                              Recommended Code Change
                            </strong>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                              (f.fixValidation?.status || (f.patchVerificationStatus === 'VERIFIED_STATIC' ? 'VALIDATED' : 'NEEDS_REVIEW')) === 'VALIDATED'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                : (f.fixValidation?.status || '') === 'PARTIALLY_VALIDATED'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                : (f.fixValidation?.status || '') === 'NEEDS_REVIEW'
                                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            }`}>
                              Fix: {f.fixValidation?.status || (f.patchVerificationStatus === 'VERIFIED_STATIC' ? 'VALIDATED' : 'NEEDS_REVIEW')}
                            </span>
                          </div>
                          <pre className="font-mono text-xs bg-slate-950 p-3 rounded-lg border border-slate-800 text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                            <code>{f.suggestedPatch}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div>
            <h4 className="text-xs uppercase font-mono tracking-wider text-[#68758A] dark:text-[#9BAAC0] font-semibold mb-2">
              Next Steps & Hardening
            </h4>
            <ul className="space-y-1.5 text-xs text-[#526078] dark:text-[#C2CDDC] list-disc list-inside">
              {scan.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>

          {/* Disclaimer Footer */}
          <div className="pt-4 border-t border-[#DCE3ED] dark:border-[#35445A] text-[11px] text-[#68758A] dark:text-[#9BAAC0] flex flex-col sm:flex-row justify-between gap-2">
            <span>Generated by PatchProof Code Security Review Platform</span>
            <span>Automated assessment report</span>
          </div>
        </div>
      </div>
    </div>
  );
};
