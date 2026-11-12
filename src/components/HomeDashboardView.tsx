/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  PlusCircle, 
  FileCode, 
  Clock, 
  ChevronRight, 
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Lock,
  Cpu,
  WifiOff,
  CheckCircle2,
  FileCheck2
} from 'lucide-react';
import { PatchProofLogo } from './PatchProofLogo';
import { HistoryItem, ScanResult, SystemStatus } from '../types/security';

interface HomeDashboardViewProps {
  history: HistoryItem[];
  onStartNewReview: () => void;
  onOpenReview: (scan: ScanResult) => void;
  systemStatus?: SystemStatus | null;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({
  history,
  onStartNewReview,
  onOpenReview,
  systemStatus
}) => {
  // Compute real metrics from history
  const totalReviews = history.length;
  const totalIssuesFound = history.reduce((acc, item) => acc + (item.totalFindings || 0), 0);
  const totalCriticalIssues = history.reduce((acc, item) => acc + (item.criticalCount || 0), 0);
  const avgHealthScore = totalReviews > 0
    ? Math.round(history.reduce((acc, item) => acc + (item.score || 0), 0) / totalReviews)
    : 100;

  const recentReviews = history.slice(0, 5);
  const isOffline = systemStatus?.offlineMode;
  const activeProvider = systemStatus?.activeProvider || 'gemini';
  const activeModel = systemStatus?.activeModel || 'gemini-3.8-flash';

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto">
      {/* 1. Header & Primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DCE3ED] dark:border-[#232E42]">
        <div className="flex items-center gap-3.5">
          <PatchProofLogo variant="square" size="lg" className="hidden sm:inline-flex" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17243B] dark:text-[#F1F4FA] font-heading">
              Security Overview
            </h1>
            <p className="text-xs sm:text-sm text-[#526078] dark:text-[#A6B4C9] mt-0.5">
              Review health, recent security scans, and engine configuration.
            </p>
          </div>
        </div>

        <button
          onClick={onStartNewReview}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2458D3] hover:bg-[#1948B8] dark:bg-[#3978F6] dark:hover:bg-[#4D87F7] text-white font-semibold text-xs transition shadow-xs active:scale-95 self-start sm:self-auto cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2458D3]"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>New Review</span>
        </button>
      </div>

      {/* 2. Review Statistics (4 Metric Cards with WCAG AA Contrast) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Reviews */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#161D2D] border border-[#DCE3ED] dark:border-[#232E42] shadow-xs">
          <span className="text-xs font-semibold text-[#526078] dark:text-[#A6B4C9] uppercase tracking-wider block">
            Total Reviews
          </span>
          <div className="text-3xl font-bold text-[#17243B] dark:text-[#F1F4FA] mt-2 font-mono tabular-nums">
            {totalReviews}
          </div>
          <span className="text-xs text-[#68758A] dark:text-[#7E8D9F] mt-1 block">
            {totalReviews === 1 ? '1 review recorded' : `${totalReviews} reviews in history`}
          </span>
        </div>

        {/* Metric 2: Issues Found */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#161D2D] border border-[#DCE3ED] dark:border-[#232E42] shadow-xs">
          <span className="text-xs font-semibold text-[#526078] dark:text-[#A6B4C9] uppercase tracking-wider block">
            Issues Found
          </span>
          <div className="text-3xl font-bold text-[#17243B] dark:text-[#F1F4FA] mt-2 font-mono tabular-nums">
            {totalIssuesFound}
          </div>
          <span className="text-xs text-[#68758A] dark:text-[#7E8D9F] mt-1 block">
            Security weaknesses identified
          </span>
        </div>

        {/* Metric 3: Critical Issues */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#161D2D] border border-[#DCE3ED] dark:border-[#232E42] shadow-xs">
          <span className="text-xs font-semibold text-[#526078] dark:text-[#A6B4C9] uppercase tracking-wider block">
            Critical Risk Issues
          </span>
          <div className={`text-3xl font-bold mt-2 font-mono tabular-nums ${totalCriticalIssues > 0 ? 'text-[#C33442] dark:text-[#EF4444]' : 'text-[#147A52] dark:text-[#10B981]'}`}>
            {totalCriticalIssues}
          </div>
          <span className="text-xs text-[#68758A] dark:text-[#7E8D9F] mt-1 block">
            {totalCriticalIssues > 0 ? 'Requires immediate patch' : 'Zero critical flaws detected'}
          </span>
        </div>

        {/* Metric 4: Average Health Score */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#161D2D] border border-[#DCE3ED] dark:border-[#232E42] shadow-xs">
          <span className="text-xs font-semibold text-[#526078] dark:text-[#A6B4C9] uppercase tracking-wider block">
            Average Health
          </span>
          <div className="text-3xl font-bold text-[#17243B] dark:text-[#F1F4FA] mt-2 font-mono tabular-nums">
            {totalReviews > 0 ? `${avgHealthScore}/100` : '100%'}
          </div>
          <span className="text-xs text-[#68758A] dark:text-[#7E8D9F] mt-1 block">
            {totalReviews > 0 ? 'Across scanned projects' : 'Baseline security score'}
          </span>
        </div>
      </div>

      {/* 3. System & Status Information Card (Replacing duplicated upload buttons) */}
      <div className="rounded-xl bg-white dark:bg-[#161D2D] border border-[#DCE3ED] dark:border-[#232E42] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DCE3ED] dark:border-[#232E42]">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4 text-[#2458D3] dark:text-[#3978F6]" />
            <h2 className="text-sm font-bold text-[#17243B] dark:text-[#F1F4FA] font-heading">
              Security Engine & Inspection Status
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {isOffline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFF7EB] dark:bg-[#2E210A] text-[#946000] dark:text-[#F59E0B] text-xs font-semibold border border-[#DCE3ED] dark:border-[#232E42]">
                <WifiOff className="w-3.5 h-3.5 text-[#946000] dark:text-[#F59E0B]" />
                <span>Offline Analysis Mode</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EAF7F0] dark:bg-[#0E2E20] text-[#147A52] dark:text-[#10B981] text-xs font-semibold border border-[#DCE3ED] dark:border-[#232E42]">
                <span className="w-2 h-2 rounded-full bg-[#147A52] dark:bg-[#10B981]" />
                <span>Engine Active: {activeProvider.toUpperCase()} ({activeModel})</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs">
          {/* Status Column 1: Privacy & Sandbox */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-[#17243B] dark:text-[#F1F4FA]">
              <Lock className="w-3.5 h-3.5 text-[#2458D3] dark:text-[#3978F6]" />
              <span>In-Memory Sandbox</span>
            </div>
            <p className="text-[#526078] dark:text-[#A6B4C9] leading-relaxed">
              Uploaded files are parsed strictly in-memory. Code is never executed or used to train shared public models.
            </p>
          </div>

          {/* Status Column 2: Supported Formats */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-[#17243B] dark:text-[#F1F4FA]">
              <FileCheck2 className="w-3.5 h-3.5 text-[#2458D3] dark:text-[#3978F6]" />
              <span>Supported Formats</span>
            </div>
            <p className="text-[#526078] dark:text-[#A6B4C9] leading-relaxed">
              Python, JS/TS, Go, Java, PHP, C/C++, Rust, SQL, and plain-text code snippets (.txt) up to 25MB per project.
            </p>
          </div>

          {/* Status Column 3: Dedicated Action Link */}
          <div className="flex flex-col justify-between p-3 rounded-lg bg-[#EAF0FF] dark:bg-[#192742] border border-[#DCE3ED] dark:border-[#232E42]">
            <div>
              <span className="font-semibold text-[#17243B] dark:text-[#F1F4FA] block">
                Start a New Code Review
              </span>
              <p className="text-[#526078] dark:text-[#A6B4C9] text-[11px] mt-0.5 leading-relaxed">
                Upload files, folders, or ZIP archives in the New Review workspace.
              </p>
            </div>
            <button
              onClick={onStartNewReview}
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2458D3] dark:text-[#719CFF] hover:text-[#1948B8] dark:hover:text-[#A6C4FF] transition"
            >
              <span>Go to New Review</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Recent Reviews Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#17243B] dark:text-[#F1F4FA] font-heading">
            Recent Reviews
          </h2>
          {history.length > 5 && (
            <span className="text-xs text-[#68758A] dark:text-[#7E8D9F] font-mono">
              Showing 5 of {history.length}
            </span>
          )}
        </div>

        {recentReviews.length === 0 ? (
          <div className="p-8 sm:p-12 text-center rounded-xl bg-white dark:bg-[#161D2D] border border-[#DCE3ED] dark:border-[#232E42] shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-[#EAF0FF] dark:bg-[#192742] border border-[#DCE3ED] dark:border-[#232E42] flex items-center justify-center mx-auto mb-3 shadow-xs">
              <PatchProofLogo variant="icon" size="sm" />
            </div>
            <h3 className="text-sm font-bold text-[#17243B] dark:text-[#F1F4FA] font-heading">
              No reviews recorded yet
            </h3>
            <p className="text-xs text-[#526078] dark:text-[#A6B4C9] max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
              Start by uploading your project directory, a ZIP archive, or individual source files to inspect security weaknesses.
            </p>
            <button
              onClick={onStartNewReview}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2458D3] hover:bg-[#1948B8] dark:bg-[#3978F6] dark:hover:bg-[#4D87F7] text-white font-semibold text-xs transition shadow-xs active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Start First Review</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#DCE3ED] dark:divide-[#232E42] rounded-xl bg-white dark:bg-[#161D2D] border border-[#DCE3ED] dark:border-[#232E42] shadow-xs overflow-hidden">
            {recentReviews.map((item) => {
              const dateStr = new Date(item.timestamp).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              return (
                <div
                  key={item.id}
                  onClick={() => onOpenReview(item.scanResult)}
                  className="p-4 hover:bg-[#F8FAFC] dark:hover:bg-[#1A2335] transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#EAF0FF] dark:bg-[#192742] border border-[#DCE3ED] dark:border-[#232E42] flex items-center justify-center text-[#2458D3] dark:text-[#719CFF] shrink-0 group-hover:border-[#2458D3] transition">
                      <FileCode className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-[#17243B] dark:text-[#F1F4FA] group-hover:text-[#2458D3] dark:group-hover:text-[#719CFF] transition truncate">
                          {item.projectName || item.fileName}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#F4F6FA] dark:bg-[#101522] border border-[#DCE3ED] dark:border-[#232E42] text-[#526078] dark:text-[#A6B4C9] shrink-0 font-medium">
                          {item.language}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#68758A] dark:text-[#7E8D9F] mt-0.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{dateStr}</span>
                        {item.scanResult?.files && item.scanResult.files.length > 1 && (
                          <>
                            <span>·</span>
                            <span>{item.scanResult.files.length} files</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-semibold text-[#17243B] dark:text-[#F1F4FA] block font-mono tabular-nums">
                        {item.totalFindings} {item.totalFindings === 1 ? 'issue' : 'issues'}
                      </span>
                      {item.criticalCount > 0 ? (
                        <span className="text-xs text-[#C33442] dark:text-[#EF4444] font-semibold font-mono tabular-nums">
                          {item.criticalCount} critical
                        </span>
                      ) : (
                        <span className="text-xs text-[#147A52] dark:text-[#10B981] font-medium">
                          Score: {item.score}/100
                        </span>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-[#68758A] dark:text-[#7E8D9F] group-hover:text-[#17243B] dark:group-hover:text-[#F1F4FA] transition" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
