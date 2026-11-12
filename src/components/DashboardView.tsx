import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Sparkles, 
  FileText, 
  Download, 
  ExternalLink,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  HelpCircle,
  RefreshCw,
  GitCommit,
  Layers,
  ChevronDown,
  ChevronUp,
  BookmarkPlus
} from 'lucide-react';
import { ScanResult, VulnerabilityFinding, FindingStatus } from '../types/security';
import { getSeverityColor, getGradeBadge, generateMarkdownReport, downloadTextFile, saveScanToHistory } from '../utils/securityUtils';
import { CodeViewer } from './CodeViewer';
import { PatchDiffViewer } from './PatchDiffViewer';
import { ReportModal } from './ReportModal';

interface DashboardViewProps {
  scan: ScanResult;
  onApplyPatchToSource: (newCode: string) => void;
  onRescan: () => void;
  onSaveHistoryNotification: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  scan,
  onApplyPatchToSource,
  onRescan,
  onSaveHistoryNotification
}) => {
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    scan.findings.length > 0 ? scan.findings[0].id : null
  );
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [verificationFilter, setVerificationFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const [findingsState, setFindingsState] = useState<VulnerabilityFinding[]>(scan.findings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync findings state if scan changes
  React.useEffect(() => {
    setFindingsState(scan.findings);
    if (scan.findings.length > 0) {
      setSelectedFindingId(scan.findings[0].id);
    }
  }, [scan]);

  const toggleDiff = (id: string) => {
    setExpandedDiffs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateFindingStatus = (id: string, newStatus: FindingStatus) => {
    setFindingsState(prev =>
      prev.map(f => (f.id === id ? { ...f, status: newStatus } : f))
    );
  };

  const handleSaveToHistory = () => {
    saveScanToHistory({
      ...scan,
      findings: findingsState
    });
    setSavedSuccess(true);
    onSaveHistoryNotification();
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const filteredFindings = findingsState.filter(f => {
    if (severityFilter !== 'ALL' && f.severity !== severityFilter) return false;
    if (verificationFilter !== 'ALL' && f.verificationType !== verificationFilter) return false;
    if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return (
        f.title.toLowerCase().includes(q) ||
        f.cwe.toLowerCase().includes(q) ||
        f.explanation.toLowerCase().includes(q) ||
        f.attackScenario.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedFinding = findingsState.find(f => f.id === selectedFindingId) || findingsState[0];

  return (
    <div className="space-y-6">
      {/* Top Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0e1422] p-4 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-white">
              Audit Results: <span className="text-emerald-400 font-mono">{scan.fileName}</span>
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {scan.language.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Analyzed by {scan.modelUsed} in {scan.executionTimeMs} ms
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSaveToHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>{savedSuccess ? 'Saved to Review History!' : 'Save to Review History'}</span>
          </button>

          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-md transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>View Report</span>
          </button>

          <button
            onClick={onRescan}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            title="Re-run security review"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-scan</span>
          </button>
        </div>
      </div>

      {/* Executive Overview Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Score & Grade Card */}
        <div className="bg-[#0e1422] p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono uppercase text-slate-400 tracking-wider">
              Security Health
            </span>
            <div className="text-3xl font-black text-white mt-1">
              {scan.metrics.score}
              <span className="text-xs text-slate-500 font-normal"> / 100</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {scan.metrics.score >= 80 ? 'Low Risk Profile' : scan.metrics.score >= 50 ? 'Moderate Exposure' : 'High Risk Vulnerabilities'}
            </div>
          </div>

          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl ${getGradeBadge(
              scan.metrics.grade
            )}`}
          >
            {scan.metrics.grade}
          </div>
        </div>

        {/* Severity Metrics Counts */}
        <div className="bg-[#0e1422] p-5 rounded-2xl border border-slate-800 grid grid-cols-4 gap-2 text-center lg:col-span-2">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <span className="text-[10px] text-rose-400 font-mono uppercase font-bold block">Critical</span>
            <span className="text-xl font-extrabold text-rose-300 mt-0.5 block">{scan.metrics.criticalCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] text-amber-400 font-mono uppercase font-bold block">High</span>
            <span className="text-xl font-extrabold text-amber-300 mt-0.5 block">{scan.metrics.highCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <span className="text-[10px] text-yellow-400 font-mono uppercase font-bold block">Medium</span>
            <span className="text-xl font-extrabold text-yellow-300 mt-0.5 block">{scan.metrics.mediumCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-[10px] text-blue-400 font-mono uppercase font-bold block">Low</span>
            <span className="text-xl font-extrabold text-blue-300 mt-0.5 block">{scan.metrics.lowCount}</span>
          </div>
        </div>

        {/* AI Hypotheses vs Deterministic breakdown */}
        <div className="bg-[#0e1422] p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Finding Origins</span>
            <span className="text-slate-200 font-bold">{scan.metrics.totalFindings} total</span>
          </div>
          <div className="space-y-1.5 mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-cyan-400 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                AI Hypotheses:
              </span>
              <span className="font-mono text-slate-200 font-semibold">{scan.metrics.aiHypothesesCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Deterministic SAST:
              </span>
              <span className="font-mono text-slate-200 font-semibold">{scan.metrics.deterministicCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Mandatory AI Hypotheses Notice */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/30 to-blue-950/20 border border-cyan-800/40 flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex-shrink-0">
          <HelpCircle className="w-4 h-4" />
        </div>
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-white font-semibold block mb-0.5">
            Transparent AI Review Methodology
          </strong>
          Findings tagged as <span className="text-cyan-400 font-semibold">AI Hypothesis</span> represent probabilistic vulnerability models formulated through deep contextual reasoning. While highly effective at surfacing subtle injection flaws and business logic flaws, developers must verify hypotheses in context or execute automated tests before deployment.
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0e1422] p-3.5 rounded-2xl border border-slate-800">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search findings by CWE, title, or explanation..."
            className="w-full bg-slate-950/80 text-xs text-slate-200 pl-9 pr-4 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950/80 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-800 text-xs focus:outline-none focus:border-emerald-500/50"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Only</option>
            <option value="MEDIUM">Medium Only</option>
            <option value="LOW">Low Only</option>
          </select>

          {/* Verification Type Filter */}
          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="bg-slate-950/80 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-800 text-xs focus:outline-none focus:border-emerald-500/50"
          >
            <option value="ALL">All Types</option>
            <option value="AI_HYPOTHESIS">AI Hypotheses Only</option>
            <option value="STATIC_RULE_MATCH">Static / Contextual Rules</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950/80 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-800 text-xs focus:outline-none focus:border-emerald-500/50"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="FIXED">Marked Fixed</option>
            <option value="FALSE_POSITIVE">False Positive</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Findings List (Left) + Interactive Code / Diff Viewer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Findings List */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
            <span>Showing {filteredFindings.length} of {findingsState.length} findings</span>
            {filteredFindings.length < findingsState.length && (
              <button
                onClick={() => {
                  setSeverityFilter('ALL');
                  setVerificationFilter('ALL');
                  setStatusFilter('ALL');
                  setSearchQuery('');
                }}
                className="text-emerald-400 hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>

          {filteredFindings.length === 0 ? (
            <div className="p-8 text-center bg-[#0e1422] rounded-2xl border border-slate-800 text-slate-400 text-xs">
              No security findings match the selected filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFindings.map((finding, idx) => {
                const colors = getSeverityColor(finding.severity);
                const isSelected = selectedFindingId === finding.id;
                const isDiffExpanded = !!expandedDiffs[finding.id];

                return (
                  <div
                    key={finding.id}
                    onClick={() => setSelectedFindingId(finding.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-[#111928] border-emerald-500/60 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/30'
                        : 'bg-[#0e1422] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Severity accent ribbon */}
                    <div className={`absolute top-0 left-0 bottom-0 w-1 ${colors.badge}`} />

                    {/* Finding Header */}
                    <div className="flex items-start justify-between gap-3 ml-1 mb-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${colors.badge}`}>
                            {finding.severity}
                          </span>

                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                              finding.verificationType === 'AI_HYPOTHESIS'
                                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {finding.verificationType === 'AI_HYPOTHESIS' ? 'AI Hypothesis' : 'Static Match'}
                          </span>

                          <span className="text-[10px] text-slate-400 font-mono">
                            Line {finding.startLine}
                            {finding.endLine > finding.startLine ? `-${finding.endLine}` : ''}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-white leading-snug">
                          {finding.title}
                        </h3>
                      </div>

                      {/* Status indicator button */}
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {finding.status === 'FIXED' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="w-3 h-3" />
                            Fixed
                          </span>
                        ) : (
                          <button
                            onClick={() => updateFindingStatus(finding.id, 'FIXED')}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 border border-slate-700 transition"
                            title="Mark as Fixed"
                          >
                            Mark Fixed
                          </button>
                        )}
                      </div>
                    </div>

                    {/* CWE and OWASP tags */}
                    <div className="ml-1 flex items-center gap-2 text-[10px] font-mono text-slate-400 flex-wrap mb-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {finding.cwe}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {finding.owaspCategory}
                      </span>
                      <span className="text-slate-500">
                        Confidence: <strong className="text-slate-300">{finding.confidence}</strong>
                      </span>
                    </div>

                    {/* Technical explanation */}
                    <p className="ml-1 text-xs text-slate-300 leading-relaxed mb-3">
                      {finding.explanation}
                    </p>

                    {/* Attack scenario preview */}
                    <div className="ml-1 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 mb-3">
                      <span className="text-[10px] font-mono uppercase text-rose-400 font-bold block mb-0.5">
                        Adversary Attack Scenario
                      </span>
                      {finding.attackScenario}
                    </div>

                    {/* Diff toggle button */}
                    <div className="ml-1 flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDiff(finding.id);
                        }}
                        className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isDiffExpanded ? 'Hide Patch Diff' : 'View Remediation Patch'}</span>
                        {isDiffExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      <span className="text-[11px] text-slate-500">
                        Click card to highlight line
                      </span>
                    </div>

                    {/* Inline Diff Preview if expanded */}
                    {isDiffExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-800" onClick={(e) => e.stopPropagation()}>
                        <PatchDiffViewer
                          finding={finding}
                          originalCode={scan.originalCode}
                          patchedFullCode={scan.patchedFullCode}
                          fileName={scan.fileName}
                          language={scan.language}
                          onApplyPatch={onApplyPatchToSource}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Code & Patch Diff Viewer */}
        <div className="lg:col-span-6 space-y-4 lg:sticky lg:top-20">
          {/* Synchronized Code Viewer */}
          <div className="h-[420px]">
            <CodeViewer
              code={scan.originalCode}
              language={scan.language}
              fileName={scan.fileName}
              findings={findingsState}
              selectedFindingId={selectedFindingId}
              onSelectFinding={(id) => setSelectedFindingId(id)}
            />
          </div>

          {/* Active Finding Remediation Card */}
          {selectedFinding && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-slate-400 uppercase font-bold">
                  Active Remediation: {selectedFinding.title}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  Lines {selectedFinding.startLine}-{selectedFinding.endLine}
                </span>
              </div>
              <PatchDiffViewer
                finding={selectedFinding}
                originalCode={scan.originalCode}
                patchedFullCode={scan.patchedFullCode}
                fileName={scan.fileName}
                language={scan.language}
                onApplyPatch={onApplyPatchToSource}
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
