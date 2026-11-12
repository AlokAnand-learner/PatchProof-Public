/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  CheckCircle, 
  FileText, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw,
  Info,
  Folder,
  FileCode,
  ShieldCheck,
  Ban,
  Check,
  Copy,
  PlusCircle,
  ExternalLink
} from 'lucide-react';
import { 
  ScanResult, 
  VulnerabilityFinding, 
  VerificationStatus,
  UserFindingResolution 
} from '../types/security';
import { getSeverityColor, getGradeBadge } from '../utils/securityUtils';
import { CodeViewer } from './CodeViewer';
import { PatchDiffViewer } from './PatchDiffViewer';
import { ReportModal } from './ReportModal';

interface ResultsViewProps {
  scan: ScanResult;
  onApplyPatchToSource: (newCode: string, targetFilePath?: string) => void;
  onNewReview: () => void;
  onRescan: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  scan,
  onApplyPatchToSource,
  onNewReview,
  onRescan
}) => {
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    scan.findings.length > 0 ? scan.findings[0].id : null
  );
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fixValidationFilter, setFixValidationFilter] = useState<string>('ALL');
  const [fileFilter, setFileFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [findingsState, setFindingsState] = useState<VulnerabilityFinding[]>(scan.findings);
  const [activeFilePath, setActiveFilePath] = useState<string>(
    scan.files && scan.files.length > 0 ? scan.files[0].filePath : scan.fileName
  );

  useEffect(() => {
    setFindingsState(scan.findings);
    if (scan.findings.length > 0) {
      setSelectedFindingId(scan.findings[0].id);
      if (scan.findings[0].filePath) {
        setActiveFilePath(scan.findings[0].filePath);
      }
    }
  }, [scan]);

  const toggleDiff = (id: string) => {
    setExpandedDiffs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleDetails = (id: string) => {
    setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUpdateUserResolution = (id: string, resolution: UserFindingResolution) => {
    setFindingsState(prev =>
      prev.map(f => {
        if (f.id === id) {
          return {
            ...f,
            userResolution: resolution,
            status: resolution === 'FALSE_POSITIVE' ? 'FALSE_POSITIVE' : resolution === 'FIXED' ? 'FIXED' : f.status
          };
        }
        return f;
      })
    );
  };

  const handleSelectFinding = (finding: VulnerabilityFinding) => {
    setSelectedFindingId(finding.id);
    if (finding.filePath) {
      setActiveFilePath(finding.filePath);
    }
  };

  const filteredFindings = findingsState.filter(f => {
    if (severityFilter !== 'ALL' && f.severity !== severityFilter) return false;
    if (statusFilter !== 'ALL' && f.verificationStatus !== statusFilter) return false;
    if (fixValidationFilter !== 'ALL') {
      const fStatus = f.fixValidation?.status || (f.verificationStatus === 'FALSE_POSITIVE' ? 'NOT_APPLICABLE' : 'NEEDS_REVIEW');
      if (fStatus !== fixValidationFilter) return false;
    }
    if (fileFilter !== 'ALL' && f.filePath !== fileFilter) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return (
        f.title.toLowerCase().includes(q) ||
        f.cwe.toLowerCase().includes(q) ||
        f.explanation.toLowerCase().includes(q) ||
        f.attackScenario.toLowerCase().includes(q) ||
        (f.filePath && f.filePath.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const selectedFinding = findingsState.find(f => f.id === selectedFindingId) || findingsState[0];

  const activeFileRecord = scan.files?.find(f => f.filePath === activeFilePath) || {
    filePath: scan.fileName,
    language: scan.language,
    content: scan.originalCode,
    patchedContent: scan.patchedFullCode,
    lines: scan.metrics.linesAnalyzed,
    size: 0
  };

  const fileOptions = scan.files || [];

  const getVerificationStatusBadge = (status: VerificationStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return {
          label: 'Confirmed Issue',
          badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-medium'
        };
      case 'LIKELY':
        return {
          label: 'Likely Issue',
          badge: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-medium'
        };
      case 'NEEDS_REVIEW':
        return {
          label: 'Needs Review',
          badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-medium'
        };
      default:
        return {
          label: 'Incorrect Alert',
          badge: 'bg-[#F4F6FA] dark:bg-[#243247] text-[#526078] dark:text-[#9BAAC0] border border-[#DCE3ED] dark:border-[#35445A]'
        };
    }
  };

  const getRiskLevelBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-semibold';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/30 font-semibold';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-semibold';
      case 'LOW':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-semibold';
      default:
        return 'bg-[#F4F6FA] dark:bg-slate-800 text-[#526078] dark:text-slate-300 border border-[#DCE3ED] dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-[#17243B] dark:text-[#F1F5FC] flex items-center gap-2">
              {scan.isMultiFile && <Folder className="w-4 h-4 text-[#2458D3] dark:text-[#4779E8]" />}
              <span>{scan.projectName}</span>
            </h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#F4F6FA] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] text-[#526078] dark:text-[#C2CDDC]">
              {scan.isMultiFile ? `${scan.files?.length || 0} Files` : scan.language}
            </span>
          </div>
          <p className="text-xs text-[#526078] dark:text-[#C2CDDC] mt-1 font-mono tabular-nums">
            {scan.metrics.totalFindings} active {scan.metrics.totalFindings === 1 ? 'issue' : 'issues'} ({scan.metrics.confirmedCount} confirmed, {scan.metrics.likelyCount} likely, {scan.metrics.needsReviewCount} needs review) across {scan.metrics.linesAnalyzed} lines
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#243247] hover:bg-[#F4F6FA] dark:hover:bg-[#2D3E58] text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-[#2458D3] dark:text-[#4779E8]" />
            <span>Generate Report</span>
          </button>

          <button
            onClick={onRescan}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#243247] hover:bg-[#F4F6FA] dark:hover:bg-[#2D3E58] text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition shadow-sm"
            title="Re-run security check"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Re-run</span>
          </button>

          <button
            onClick={onNewReview}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2458D3] hover:bg-[#1948B8] dark:bg-[#4779E8] dark:hover:bg-[#386AD9] text-white text-xs font-medium transition shadow-sm active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Review</span>
          </button>
        </div>
      </div>

      {scan.analysisNotice && (
        <div role="status" aria-live="polite" className="pp-glass-surface rounded-xl border border-[#DCE3ED] dark:border-[#35445A] px-4 py-3 flex items-start gap-2.5 text-xs text-[#526078] dark:text-[#C2CDDC]">
          <Info className="w-4 h-4 text-[#2458D3] dark:text-[#719CFF] shrink-0 mt-0.5" />
          <p className="leading-relaxed">{scan.analysisNotice}</p>
        </div>
      )}

      {/* Summary Scorecard Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] flex items-center justify-between col-span-2 sm:col-span-1 shadow-sm">
          <div>
            <span className="text-[11px] text-[#526078] dark:text-[#C2CDDC] block font-medium">Heuristic Risk Indicator</span>
            <span className="text-[10px] text-[#68758A] dark:text-[#9BAAC0] block">Weighted static signals, not a security guarantee</span>
            <span className="text-2xl font-bold text-[#17243B] dark:text-[#F1F5FC] mt-0.5 block font-mono tabular-nums">{scan.metrics.score}/100</span>
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${getGradeBadge(scan.metrics.grade)}`}>
            {scan.metrics.grade}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] text-center shadow-sm">
          <span className="text-[11px] text-rose-700 dark:text-rose-400 block font-medium">Critical Risk</span>
          <span className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-0.5 block font-mono tabular-nums">{scan.metrics.criticalCount}</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] text-center shadow-sm">
          <span className="text-[11px] text-orange-700 dark:text-orange-400 block font-medium">High Risk</span>
          <span className="text-2xl font-bold text-orange-700 dark:text-orange-300 mt-0.5 block font-mono tabular-nums">{scan.metrics.highCount}</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] text-center shadow-sm">
          <span className="text-[11px] text-amber-800 dark:text-amber-400 block font-medium">Medium Risk</span>
          <span className="text-2xl font-bold text-amber-800 dark:text-amber-300 mt-0.5 block font-mono tabular-nums">{scan.metrics.mediumCount}</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] text-center shadow-sm">
          <span className="text-[11px] text-blue-700 dark:text-blue-400 block font-medium">Low Risk</span>
          <span className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-0.5 block font-mono tabular-nums">{scan.metrics.lowCount}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#68758A] dark:text-[#9BAAC0] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search issues by title, file, or rule..."
            className="w-full bg-[#F4F6FA] dark:bg-[#243247] text-xs text-[#17243B] dark:text-[#F1F5FC] placeholder-[#68758A] dark:placeholder-[#9BAAC0] pl-9 pr-3 py-2 rounded-lg border border-[#DCE3ED] dark:border-[#35445A] focus:outline-none focus:border-[#2458D3] dark:focus:border-[#4779E8]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Multi-file Project: Filter by File */}
          {scan.isMultiFile && fileOptions.length > 1 && (
            <select
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
              className="bg-[#F4F6FA] dark:bg-[#243247] text-[#17243B] dark:text-[#F1F5FC] px-2.5 py-1.5 rounded-lg border border-[#DCE3ED] dark:border-[#35445A] text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Files ({fileOptions.length})</option>
              {fileOptions.map((f) => (
                <option key={f.filePath} value={f.filePath}>
                  {f.filePath} {f.findingsCount ? `(${f.findingsCount})` : ''}
                </option>
              ))}
            </select>
          )}

          {/* Check Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#F4F6FA] dark:bg-[#243247] text-[#17243B] dark:text-[#F1F5FC] px-2.5 py-1.5 rounded-lg border border-[#DCE3ED] dark:border-[#35445A] text-xs focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Check Statuses</option>
            <option value="CONFIRMED">Confirmed Issues</option>
            <option value="LIKELY">Likely Issues</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
          </select>

          {/* Risk Level Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#F4F6FA] dark:bg-[#243247] text-[#17243B] dark:text-[#F1F5FC] px-2.5 py-1.5 rounded-lg border border-[#DCE3ED] dark:border-[#35445A] text-xs focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Only</option>
            <option value="MEDIUM">Medium Only</option>
            <option value="LOW">Low Only</option>
          </select>

          {/* Fix Validation Status Filter */}
          <select
            value={fixValidationFilter}
            onChange={(e) => setFixValidationFilter(e.target.value)}
            className="bg-[#F4F6FA] dark:bg-[#243247] text-[#17243B] dark:text-[#F1F5FC] px-2.5 py-1.5 rounded-lg border border-[#DCE3ED] dark:border-[#35445A] text-xs focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Fixes</option>
            <option value="VALIDATED">Validated Fixes</option>
            <option value="PARTIALLY_VALIDATED">Partially Validated</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
            <option value="INVALID">Invalid Fixes</option>
            <option value="NOT_APPLICABLE">Not Applicable</option>
          </select>
        </div>
      </div>

      {/* Main Layout: Findings List (Left) + Code Viewer & Patch Diff (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Finding Cards */}
        <div className="lg:col-span-6 space-y-3">
          {filteredFindings.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] text-[#526078] dark:text-[#C2CDDC] text-xs shadow-sm">
              No security issues match your filter criteria.
            </div>
          ) : (
            filteredFindings.map((finding) => {
              const isSelected = selectedFindingId === finding.id;
              const isDiffExpanded = !!expandedDiffs[finding.id];
              const isDetailsExpanded = !!expandedDetails[finding.id];
              const vBadge = getVerificationStatusBadge(finding.verificationStatus);
              const riskBadgeClass = getRiskLevelBadge(finding.severity);
              const displayFilePath = finding.filePath || scan.fileName;
              const isMarkedFP = finding.userResolution === 'FALSE_POSITIVE';
              const isMarkedFixed = finding.userResolution === 'FIXED' || finding.status === 'FIXED';
              const fixStatus = finding.fixValidation?.status || (finding.verificationStatus === 'FALSE_POSITIVE' ? 'NOT_APPLICABLE' : 'NEEDS_REVIEW');

              return (
                <div
                  key={finding.id}
                  onClick={() => handleSelectFinding(finding)}
                  className={`pp-interactive-card p-4 rounded-xl border transition cursor-pointer relative overflow-hidden ${
                    isMarkedFP
                      ? 'opacity-60 bg-[#F4F6FA]/60 dark:bg-[#141B2A]/50 border-[#DCE3ED] dark:border-[#35445A]'
                      : isSelected
                      ? 'bg-white dark:bg-[#243247] border-[#2458D3] dark:border-[#4779E8] shadow-md ring-1 ring-[#2458D3]/30 dark:ring-[#4779E8]/40'
                      : 'bg-white dark:bg-[#1B2638] border-[#DCE3ED] dark:border-[#35445A] hover:border-[#B5C4D9] dark:hover:border-[#4A5D7B] shadow-sm'
                  }`}
                >
                  {/* Finding Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Risk Level Badge */}
                        <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${riskBadgeClass}`}>
                          {finding.severity}
                        </span>

                        {/* Separate Check Status Badge */}
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${vBadge.badge}`}>
                          {vBadge.label}
                        </span>

                        {/* Analysis Method Chip */}
                        {finding.verificationMethod && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-[#F4F6FA] dark:bg-[#141B2A] text-[#526078] dark:text-[#9BAAC0] border border-[#DCE3ED] dark:border-[#35445A]">
                            {finding.verificationMethod}
                          </span>
                        )}

                        {/* Fix Status Badge */}
                        {finding.suggestedPatch && (
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium border ${
                            fixStatus === 'VALIDATED'
                              ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                              : fixStatus === 'PARTIALLY_VALIDATED'
                              ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30'
                              : fixStatus === 'NEEDS_REVIEW'
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                               : fixStatus === 'NOT_APPLICABLE'
                              ? 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                          }`}>
                            Fix: {fixStatus === 'NOT_APPLICABLE' ? 'Not applicable' : fixStatus === 'VALIDATED' ? 'Static checks passed' : fixStatus === 'PARTIALLY_VALIDATED' ? 'Static checks partial' : fixStatus === 'INVALID' ? 'Static checks failed' : 'Needs review'}
                          </span>
                        )}

                        <span className="text-[11px] text-[#2458D3] dark:text-[#719CFF] font-mono font-medium truncate">
                          {displayFilePath}:{finding.startLine}
                          {finding.endLine > finding.startLine ? `-${finding.endLine}` : ''}
                        </span>
                      </div>

                      {/* Issue Title */}
                      <h3 className={`text-sm font-semibold text-[#17243B] dark:text-[#F1F5FC] leading-snug ${isMarkedFP ? 'line-through text-[#68758A] dark:text-[#9BAAC0]' : ''}`}>
                        {finding.title}
                      </h3>
                    </div>

                    {/* Quick Resolution Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {isMarkedFixed ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Fixed
                        </span>
                      ) : isMarkedFP ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[#F4F6FA] dark:bg-[#243247] text-[#68758A] dark:text-[#9BAAC0] border border-[#DCE3ED] dark:border-[#35445A] font-medium">
                          <Ban className="w-3 h-3" />
                          Incorrect Alert
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateUserResolution(finding.id, 'FIXED')}
                            className="text-[10px] px-2 py-0.5 rounded bg-[#F4F6FA] dark:bg-[#243247] hover:bg-[#EAEFF7] dark:hover:bg-[#2D3E58] text-[#526078] dark:text-[#C2CDDC] hover:text-emerald-700 dark:hover:text-emerald-300 border border-[#DCE3ED] dark:border-[#35445A] transition"
                            title="Mark as Fixed"
                          >
                            Mark Fixed
                          </button>
                          <button
                            onClick={() => handleUpdateUserResolution(finding.id, 'FALSE_POSITIVE')}
                            className="text-[10px] px-2 py-0.5 rounded bg-[#F4F6FA] dark:bg-[#243247] hover:bg-[#EAEFF7] dark:hover:bg-[#2D3E58] text-[#526078] dark:text-[#C2CDDC] hover:text-rose-700 dark:hover:text-rose-300 border border-[#DCE3ED] dark:border-[#35445A] transition"
                            title="Mark as Incorrect Alert"
                          >
                            Incorrect Alert
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Short Explanation */}
                  <div className="text-xs text-[#526078] dark:text-[#C2CDDC] leading-relaxed mb-2.5">
                    {finding.explanation}
                  </div>

                  {/* How to Fix Summary */}
                  <div className="text-xs text-[#17243B] dark:text-[#F1F5FC] leading-relaxed mb-3 p-2.5 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A]">
                    <span className="text-[10px] font-semibold text-[#2458D3] dark:text-[#719CFF] uppercase tracking-wider block mb-1">
                      How to fix:
                    </span>
                    <span className="text-[#526078] dark:text-[#C2CDDC]">{finding.remediation}</span>
                  </div>

                  {/* Recommended Fix Toggle */}
                  <div className="pt-2 border-t border-[#DCE3ED] dark:border-[#35445A] flex items-center justify-between text-xs">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDiff(finding.id);
                      }}
                      className="flex items-center gap-1 text-[#2458D3] dark:text-[#4779E8] hover:text-[#1948B8] dark:hover:text-[#719CFF] font-medium text-xs"
                    >
                      <span>{isDiffExpanded ? 'Hide Recommended Code' : 'View Recommended Fix'}</span>
                      {isDiffExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDetails(finding.id);
                      }}
                      className="flex items-center gap-1 text-[#68758A] dark:text-[#9BAAC0] hover:text-[#17243B] dark:hover:text-[#F1F5FC] text-[11px]"
                    >
                      <Info className="w-3 h-3" />
                      <span>{isDetailsExpanded ? 'Hide Details' : 'Technical Details'}</span>
                      {isDetailsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Expandable Technical Details */}
                  {isDetailsExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#DCE3ED] dark:border-[#35445A] space-y-2 text-xs" onClick={(e) => e.stopPropagation()}>
                      <div className="p-2.5 rounded bg-[#F4F6FA] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#68758A] dark:text-[#9BAAC0] block">
                          Potential Attack Scenario & Impact
                        </span>
                        <p className="text-[11px] text-[#526078] dark:text-[#C2CDDC] leading-relaxed">
                          {finding.attackScenario}
                        </p>
                      </div>

                      {finding.evidence && (
                        <div className="p-2.5 rounded bg-[#F4F6FA] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] space-y-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2458D3] dark:text-[#719CFF] block">
                            Direct Code Evidence
                          </span>
                          <p className="text-[11px] font-mono text-[#17243B] dark:text-[#F1F5FC] leading-relaxed">
                            {finding.evidence}
                          </p>
                        </div>
                      )}

                      {finding.reasoning && (
                        <div className="p-2.5 rounded bg-[#F4F6FA] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] space-y-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#68758A] dark:text-[#9BAAC0] block">
                            Engine Detection Reasoning
                          </span>
                          <p className="text-[11px] text-[#526078] dark:text-[#C2CDDC] leading-relaxed">
                            {finding.reasoning}
                          </p>
                        </div>
                      )}

                      {finding.remainingUncertainty && (
                        <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 space-y-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                            Static Analysis Limitations / Remaining Uncertainty
                          </span>
                          <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                            {finding.remainingUncertainty}
                          </p>
                        </div>
                      )}

                      <div className="text-[11px] font-mono text-[#68758A] dark:text-[#9BAAC0] flex items-center gap-2 flex-wrap">
                        <span>Rule: {finding.cwe}</span>
                        {finding.owaspCategory && <span>· {finding.owaspCategory}</span>}
                        {finding.analysisEngine && <span>· Engine: {finding.analysisEngine}</span>}
                      </div>

                      {finding.surroundingContext && (
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#68758A] dark:text-[#9BAAC0] block mb-1">
                            Surrounding Code Context
                          </span>
                          <pre className="p-2.5 rounded bg-[#0F172A] border border-slate-700 font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre leading-relaxed">
                            <code>{finding.surroundingContext}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline Diff if expanded */}
                  {isDiffExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#DCE3ED] dark:border-[#35445A]" onClick={(e) => e.stopPropagation()}>
                      <PatchDiffViewer
                        finding={finding}
                        originalCode={activeFileRecord.content}
                        patchedFullCode={activeFileRecord.patchedContent}
                        fileName={displayFilePath}
                        language={activeFileRecord.language}
                        onApplyPatch={(newCode) => onApplyPatchToSource(newCode, displayFilePath)}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Code Viewer & Selected Diff */}
        <div className="lg:col-span-6 space-y-4 lg:sticky lg:top-20">
          {/* Multi-file active file selector */}
          {scan.isMultiFile && fileOptions.length > 1 && (
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] flex items-center justify-between gap-2 text-xs shadow-sm">
              <span className="text-[#526078] dark:text-[#C2CDDC] font-medium">Viewing File:</span>
              <select
                value={activeFilePath}
                onChange={(e) => setActiveFilePath(e.target.value)}
                className="bg-[#F4F6FA] dark:bg-[#243247] text-[#17243B] dark:text-[#F1F5FC] px-2.5 py-1 rounded-md border border-[#DCE3ED] dark:border-[#35445A] font-mono text-xs focus:outline-none flex-1 max-w-xs cursor-pointer"
              >
                {fileOptions.map(f => (
                  <option key={f.filePath} value={f.filePath}>
                    {f.filePath} ({f.lines} lines)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Synchronized Code Viewer */}
          <div className="h-[400px]">
            <CodeViewer
              code={activeFileRecord.content}
              language={activeFileRecord.language}
              fileName={activeFileRecord.filePath}
              findings={findingsState.filter(f => !f.filePath || f.filePath === activeFileRecord.filePath)}
              selectedFindingId={selectedFindingId}
              onSelectFinding={(id) => {
                const target = findingsState.find(f => f.id === id);
                if (target) handleSelectFinding(target);
              }}
            />
          </div>

          {/* Active Finding Fix Panel */}
          {selectedFinding && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#526078] dark:text-[#C2CDDC] font-medium truncate max-w-sm">
                  Recommended Fix: <strong className="text-[#17243B] dark:text-[#F1F5FC]">{selectedFinding.title}</strong>
                </span>
                <span className="text-[11px] font-mono text-[#68758A] dark:text-[#9BAAC0]">
                  {selectedFinding.filePath || scan.fileName}:{selectedFinding.startLine}-{selectedFinding.endLine}
                </span>
              </div>

              <PatchDiffViewer
                finding={selectedFinding}
                originalCode={activeFileRecord.content}
                patchedFullCode={activeFileRecord.patchedContent}
                fileName={selectedFinding.filePath || scan.fileName}
                language={activeFileRecord.language}
                onApplyPatch={(newCode) => onApplyPatchToSource(newCode, selectedFinding.filePath || scan.fileName)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          scan={{
            ...scan,
            findings: findingsState
          }}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
};
