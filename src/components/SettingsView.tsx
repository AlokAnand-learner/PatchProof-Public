import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Trash2, 
  Download, 
  ShieldCheck, 
  Lock, 
  Cpu, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle,
  Database,
  AlertCircle,
  Target,
  Play,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { getScanHistory, clearScanHistory, downloadTextFile, isPrivacyModeEnabled, setPrivacyMode } from '../utils/securityUtils';
import { authenticatedFetch } from '../utils/apiClient';
import { EvaluationMetrics } from '../types/security';

interface SettingsViewProps {
  onHistoryCleared: () => void;
  onOpenDevTools?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onHistoryCleared, onOpenDevTools }) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [clearedNotice, setClearedNotice] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluationMetrics | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showBenchmarkDetails, setShowBenchmarkDetails] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [privacyModeEnabled, setPrivacyModeEnabled] = useState<boolean>(() => isPrivacyModeEnabled());
  const [cloudConsentError, setCloudConsentError] = useState<string | null>(null);

  useEffect(() => {
    const updateCount = () => {
      const list = getScanHistory();
      setHistoryCount(list.length);
    };
    updateCount();
    window.addEventListener('patchproof_history_updated', updateCount);

    fetch('/api/status')
      .then(res => res.json())
      .then(data => setServerStatus(data))
      .catch(() => setServerStatus({ status: 'offline' }));

    return () => window.removeEventListener('patchproof_history_updated', updateCount);
  }, []);

  const handleRunBenchmark = async () => {
    setEvaluating(true);
    setBenchmarkError(null);
    try {
      const res = await fetch('/api/evaluate');
      if (!res.ok) throw new Error('Benchmark request failed');
      const data: EvaluationMetrics = await res.json();
      setEvalResult(data);
    } catch (err) {
      console.error('Benchmark execution error:', err);
      setBenchmarkError('The benchmark could not complete. Check that the local PatchProof server is running, then try again.');
    } finally {
      setEvaluating(false);
    }
  };

  const executeClearHistory = () => {
    const cleared = clearScanHistory();
    if (!cleared) {
      setShowClearConfirm(false);
      setClearedNotice(false);
      setHistoryError('Review history could not be cleared. Check browser storage permissions and available space.');
      return;
    }
    setHistoryError(null);
    setHistoryCount(0);
    setShowClearConfirm(false);
    setClearedNotice(true);
    onHistoryCleared();
    setTimeout(() => setClearedNotice(false), 3500);
  };

  const handleExportHistory = () => {
    const list = getScanHistory();
    downloadTextFile('patchproof-review-history.json', JSON.stringify(list, null, 2), 'application/json');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="pb-2 border-b border-[#DCE3ED] dark:border-[#35445A]">
        <h1 className="text-2xl font-bold tracking-tight text-[#17243B] dark:text-[#F1F5FC]">
          Settings
        </h1>
        <p className="text-sm text-[#526078] dark:text-[#C2CDDC] mt-1">
          Manage code review preferences, privacy controls, and local data storage.
        </p>
      </div>

      {clearedNotice && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Local review history cleared successfully.</span>
        </div>
      )}
      {historyError && (
        <div role="alert" className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{historyError}</span>
        </div>
      )}

      {/* Section 1: Current Review Behavior */}
      <div className="rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#17243B] dark:text-[#F1F5FC]">
          <ShieldCheck className="w-4 h-4 text-[#2458D3] dark:text-emerald-400" />
          <h2>Current Review Behavior</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#526078] dark:text-[#C2CDDC]">
          <p className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/50 border border-[#DCE3ED] dark:border-slate-800"><strong className="block text-[#17243B] dark:text-white">Remediation</strong> Suggested patches are generated as proposals and require review; PatchProof does not silently rewrite uploaded files.</p>
          <p className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/50 border border-[#DCE3ED] dark:border-slate-800"><strong className="block text-[#17243B] dark:text-white">Finding visibility</strong> Findings are shown with their verification status; severity, status, file, and text filters are available in the Results view.</p>
        </div>
      </div>

      {/* Section 2: Privacy & Data Retention */}
      <div className="rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#17243B] dark:text-[#F1F5FC]">
          <Lock className="w-4 h-4 text-[#2458D3] dark:text-emerald-400" />
          <h2>Privacy & Local Storage</h2>
        </div>

        <div className="text-xs text-[#526078] dark:text-[#C2CDDC] leading-relaxed">
          PatchProof processes submitted code in memory during a review and does not write uploaded source files to its own server-side storage. If Cloud AI Transmission Consent is enabled, code may be sent to the selected external AI provider; that provider's retention and training practices are governed by its own current terms and are not controlled by PatchProof. Review history is stored in this browser's localStorage, which is not encrypted.
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#DCE3ED] dark:border-[#35445A]">
          <div>
            <span className="text-xs font-semibold text-[#17243B] dark:text-[#F1F5FC] block">
              Source Code Storage Privacy
            </span>
            <span className="text-xs text-[#526078] dark:text-[#C2CDDC] block mt-0.5">
              On by default: full source files and full-file patches are removed from saved history. Finding snippets and surrounding evidence remain. Turn this off only if you intentionally want full source retained in this browser.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={privacyModeEnabled}
            aria-label="Enable privacy mode for saved source code"
            onClick={() => {
              const nextState = !privacyModeEnabled;
              const updated = setPrivacyMode(nextState);
              if (!updated) {
                setPrivacyError(nextState
                  ? 'Privacy mode is enabled for new reviews, but existing history could not be fully scrubbed. Clear saved review history to remove older source copies.'
                  : 'Could not change the source storage preference. Please try again.');
                return;
              }
              setPrivacyError(null);
              setPrivacyModeEnabled(nextState);
              setHistoryCount(getScanHistory().length);
            }}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
              privacyModeEnabled ? 'bg-[#2458D3] dark:bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                privacyModeEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {privacyError && (
          <div role="alert" className="text-xs text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
            {privacyError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#DCE3ED] dark:border-[#35445A]">
          <div>
            <span className="text-xs font-semibold text-[#17243B] dark:text-[#F1F5FC] block">
              Cloud AI Transmission Consent
            </span>
            <span className="text-xs text-[#526078] dark:text-[#C2CDDC] block mt-0.5">
              This is a global opt-in that remains active until revoked. It covers the active cloud destination, including remote custom endpoints. When disabled, PatchProof uses local static analysis or a trusted local engine. Provider data handling follows the selected provider's terms.
              {serverStatus?.activeProvider && (
                <span className="block mt-1">
                  Current route: <strong>{String(serverStatus.activeProvider).toUpperCase()}</strong>
                  {serverStatus.activeModel ? ` · ${serverStatus.activeModel}` : ''}
                  {serverStatus.activeProviderEndpoint ? ` · ${serverStatus.activeProviderEndpoint}` : ' · provider-managed endpoint'}
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(serverStatus?.cloudConsentGranted)}
            aria-label="Allow source code transmission to the selected cloud AI provider"
            disabled={!serverStatus || serverStatus.status === 'offline'}
            onClick={async () => {
              const currentConsent = serverStatus?.cloudConsentGranted ?? false;
              try {
                const res = await authenticatedFetch('/api/status/cloud-consent', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ granted: !currentConsent })
                });
                if (!res.ok) throw new Error(`Consent update failed with HTTP ${res.status}`);
                const data = await res.json();
                setServerStatus((prev: any) => ({ ...prev, cloudConsentGranted: data.cloudConsentGranted }));
                setCloudConsentError(null);
              } catch (err) {
                console.error('Failed to update cloud consent:', err);
                setCloudConsentError('Could not update cloud AI consent. The previous setting remains in effect.');
              }
            }}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
              serverStatus?.cloudConsentGranted ? 'bg-[#2458D3] dark:bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                serverStatus?.cloudConsentGranted ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {cloudConsentError && (
          <div role="alert" className="text-xs text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
            {cloudConsentError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#DCE3ED] dark:border-[#35445A]">
          <div>
            <span className="text-xs font-semibold text-[#17243B] dark:text-[#F1F5FC] block">
              Stored Reviews
            </span>
            <span className="text-xs text-[#68758A] dark:text-[#9BAAC0] block mt-0.5">
              {historyCount} {historyCount === 1 ? 'review' : 'reviews'} currently saved in browser storage.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {historyCount > 0 && (
              <button
                onClick={handleExportHistory}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] hover:bg-[#EAEFF7] dark:hover:bg-[#2D3E58] text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
            )}

            {showClearConfirm ? (
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30">
                <span className="text-xs text-rose-700 dark:text-rose-300 font-medium">Delete all records?</span>
                <button
                  onClick={executeClearHistory}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition shadow-sm"
                >
                  Clear All History
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-1 rounded bg-[#F4F6FA] dark:bg-[#243247] hover:bg-slate-200 dark:hover:bg-slate-700 text-[#526078] dark:text-slate-300 text-xs transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={historyCount === 0}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  historyCount === 0
                    ? 'bg-[#F4F6FA] dark:bg-slate-900 text-slate-400 dark:text-slate-600 border border-[#DCE3ED] dark:border-slate-800/60 cursor-not-allowed'
                    : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All History</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Engine Accuracy & Benchmark Suite */}
      <div className="rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#17243B] dark:text-[#F1F5FC]">
            <Target className="w-4 h-4 text-[#2458D3] dark:text-emerald-400" />
            <h2>Security Engine Accuracy & Benchmark Suite</h2>
          </div>
          <button
            onClick={handleRunBenchmark}
            disabled={evaluating}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              evaluating
                ? 'bg-slate-100 dark:bg-slate-800 text-[#68758A] dark:text-slate-400 cursor-wait'
                : 'bg-[#2458D3]/10 hover:bg-[#2458D3]/20 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-[#2458D3] dark:text-emerald-300 border border-[#2458D3]/30 dark:border-emerald-500/30'
            }`}
          >
            {evaluating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2458D3] dark:text-emerald-400" />
                <span>Running Suite...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-[#2458D3] dark:text-emerald-400 fill-current" />
                <span>Run Benchmark Suite</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-[#526078] dark:text-[#C2CDDC] leading-relaxed">
          Runs the built-in synthetic fixture suite. Review-only cases are excluded from binary precision/recall scoring; these small fixtures are not a real-world accuracy guarantee.
        </p>
        {benchmarkError && (
          <div role="alert" className="text-xs text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
            {benchmarkError}
          </div>
        )}

        {evalResult ? (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#68758A] dark:text-[#9BAAC0] block">Scored / Review-only</span>
                <span className="text-xl font-bold text-[#17243B] dark:text-white block mt-0.5 font-mono">{evalResult.evaluatedCases} / {evalResult.excludedCases}</span>
                <span className="text-[10px] text-[#68758A] dark:text-[#9BAAC0]">of {evalResult.totalTestCases} fixtures</span>
              </div>
              <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#68758A] dark:text-[#9BAAC0] block">Precision</span>
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 block mt-0.5 font-mono">{evalResult.precision.toFixed(1)}%</span>
                <span className="text-[10px] text-[#68758A] dark:text-[#9BAAC0]">TP / (TP + FP)</span>
              </div>
              <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#68758A] dark:text-[#9BAAC0] block">Recall</span>
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 block mt-0.5 font-mono">{evalResult.recall.toFixed(1)}%</span>
                <span className="text-[10px] text-[#68758A] dark:text-[#9BAAC0]">TP / (TP + FN)</span>
              </div>
              <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#68758A] dark:text-[#9BAAC0] block">F1 Score</span>
                <span className="text-xl font-bold text-[#2458D3] dark:text-cyan-400 block mt-0.5 font-mono">{evalResult.f1Score.toFixed(1)}%</span>
                <span className="text-[10px] text-[#68758A] dark:text-[#9BAAC0]">Harmonic Mean</span>
              </div>
              <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#68758A] dark:text-[#9BAAC0] block">False Positives</span>
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 block mt-0.5 font-mono">{evalResult.falsePositives}</span>
                <span className={`text-[10px] ${evalResult.falsePositives === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-300'}`}>
                  {evalResult.falsePositives === 0 ? '0 FP Target Met' : 'False-positive target not met'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#526078] dark:text-[#C2CDDC] pt-1">
              <span>{evalResult.evaluatedCases} scored cases; {evalResult.excludedCases} review-only cases excluded (TP: {evalResult.truePositives}, TN: {evalResult.trueNegatives}, FP: {evalResult.falsePositives}, FN: {evalResult.falseNegatives})</span>
              <button
                onClick={() => setShowBenchmarkDetails(!showBenchmarkDetails)}
                className="text-xs text-[#2458D3] dark:text-emerald-400 hover:underline font-medium inline-flex items-center gap-1"
              >
                <span>{showBenchmarkDetails ? 'Hide Test Cases' : 'View All Test Cases'}</span>
                {showBenchmarkDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showBenchmarkDetails && (
              <div className="space-y-2 pt-2 border-t border-[#DCE3ED] dark:border-[#35445A] max-h-72 overflow-y-auto pr-1">
                {evalResult.results.map((tc, idx) => (
                  <div
                    key={tc.id}
                    className="p-2.5 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] flex items-start gap-2.5 text-xs"
                  >
                    {tc.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#17243B] dark:text-[#F1F5FC] truncate">
                          #{idx + 1} {tc.title}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                          !tc.passed
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                            : !tc.includedInMetrics
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20'
                        }`}>
                          {tc.actualClassification}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#526078] dark:text-[#C2CDDC] mt-1">{tc.reason}</p>
                      <p className="text-[10px] text-[#68758A] dark:text-slate-500 mt-1">{tc.includedInMetrics ? 'Included in binary metrics' : 'Review-only: excluded from binary metrics'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] text-xs text-[#526078] dark:text-[#C2CDDC] flex items-center justify-between">
            <span>Benchmark suite ready. Click &quot;Run Benchmark Suite&quot; to execute real-time accuracy testing.</span>
          </div>
        )}
      </div>

      {/* Section 4: Advanced Diagnostics (Developer Only) */}
      <div className="rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] overflow-hidden shadow-sm">
        <button
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#F4F6FA] dark:hover:bg-[#243247] transition"
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#68758A] dark:text-[#9BAAC0]" />
            <span className="text-xs font-semibold text-[#17243B] dark:text-[#F1F5FC]">
              Advanced Diagnostics (Developer Tools)
            </span>
          </div>
          {showDiagnostics ? (
            <ChevronUp className="w-4 h-4 text-[#68758A] dark:text-[#9BAAC0]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#68758A] dark:text-[#9BAAC0]" />
          )}
        </button>

        {showDiagnostics && (
          <div className="p-4 pt-0 border-t border-[#DCE3ED] dark:border-[#35445A] bg-[#F4F6FA]/50 dark:bg-[#141C2A]/60 text-xs font-mono text-[#526078] dark:text-[#C2CDDC] space-y-2">
            <div className="flex justify-between py-1 border-b border-[#DCE3ED] dark:border-[#35445A]">
              <span className="text-[#68758A] dark:text-[#9BAAC0]">Service Status:</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">{serverStatus?.status || 'Connecting...'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#DCE3ED] dark:border-[#35445A]">
              <span className="text-[#68758A] dark:text-[#9BAAC0]">Engine Tier:</span>
              <span className="text-[#17243B] dark:text-[#F1F5FC]">{serverStatus?.engine || 'Standard'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#DCE3ED] dark:border-[#35445A]">
              <span className="text-[#68758A] dark:text-[#9BAAC0]">API Key Configured:</span>
              <span className="text-[#17243B] dark:text-[#F1F5FC]">{serverStatus?.hasApiKey ? 'Yes (Encrypted)' : 'Integrated'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#DCE3ED] dark:border-[#35445A]">
              <span className="text-[#68758A] dark:text-[#9BAAC0]">Platform:</span>
              <span className="text-[#17243B] dark:text-[#F1F5FC]">PatchProof Defensive Security Architecture</span>
            </div>
            {onOpenDevTools && (
              <div className="pt-2">
                <button
                  onClick={onOpenDevTools}
                  className="w-full py-2 px-3 rounded-lg bg-[#2458D3] hover:bg-[#1948B8] dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-white dark:text-emerald-300 font-semibold text-xs border border-transparent dark:border-emerald-500/30 flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Open Developer Tools (AI Model Configuration & Offline Mode)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
