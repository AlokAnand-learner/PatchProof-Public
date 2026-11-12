/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar, Header, NavigationTab } from './components/Navbar';
import { HomeDashboardView } from './components/HomeDashboardView';
import { NewReviewView } from './components/NewReviewView';
import { ResultsView } from './components/ResultsView';
import { HistoryView } from './components/HistoryView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { DeveloperToolsView } from './components/DeveloperToolsView';
import { ScanProgress } from './components/ScanProgress';
import { SAMPLE_CODES } from './data/sampleCodes';
import { ScanResult, SampleCode, HistoryItem, StagedFile, SystemStatus } from './types/security';
import { saveScanToHistoryWithStatus, getScanHistory } from './utils/securityUtils';
import { authenticatedFetch, getSessionToken } from './utils/apiClient';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { PatchProofLogo } from './components/PatchProofLogo';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('patchproof_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return 'light';
    }
    return 'light';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('patchproof_sidebar_collapsed') === 'true';
    }
    return false;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [code, setCode] = useState<string>(SAMPLE_CODES[0].code);
  const [fileName, setFileName] = useState<string>(SAMPLE_CODES[0].fileName);
  const [language, setLanguage] = useState<string>(SAMPLE_CODES[0].language);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingContext, setLoadingContext] = useState<{ isProject: boolean; name: string; count: number }>({
    isProject: false,
    name: 'source_file',
    count: 1
  });
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  // Sync theme with root classList
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('patchproof_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('patchproof_sidebar_collapsed', String(next));
      return next;
    });
  };

  const refreshSystemStatus = () => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => setSystemStatus(data))
      .catch(() => {});
  };

  // Load review history and system status on mount
  useEffect(() => {
    getSessionToken().catch(() => {});
    setHistory(getScanHistory());
    refreshSystemStatus();

    const handleHistoryUpdate = () => {
      setHistory(getScanHistory());
    };
    window.addEventListener('patchproof_history_updated', handleHistoryUpdate);
    return () => window.removeEventListener('patchproof_history_updated', handleHistoryUpdate);
  }, []);

  const refreshHistory = () => {
    setHistory(getScanHistory());
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Single file code review
  const handleStartSingleReview = async () => {
    if (!code || code.trim().length === 0) return;

    setIsLoading(true);
    setLoadingContext({ isProject: false, name: fileName || 'source_file', count: 1 });
    setErrorBanner(null);

    try {
      const response = await authenticatedFetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          fileName: fileName || 'source_file.txt',
          language
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Review failed with HTTP ${response.status}`);
      }

      const data: ScanResult = await response.json();
      setScanResult(data);
      const historySave = saveScanToHistoryWithStatus(data);
      setHistory(historySave.history);
      setActiveTab('results');
      showToast(historySave.saved
        ? `Review complete: ${data.metrics.totalFindings} potential ${data.metrics.totalFindings === 1 ? 'issue' : 'issues'} identified.`
        : 'Review completed, but history could not be saved. Export the report if you need a retained copy.');
    } catch (err: any) {
      console.error('Review error:', err);
      setErrorBanner(err.message || 'Unable to complete code review. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Project review (from folder upload, ZIP archive, or multiple files)
  const handleStartProjectReview = async (projectName: string, stagedFiles: StagedFile[]) => {
    if (!stagedFiles || stagedFiles.length === 0) return;

    setIsLoading(true);
    setLoadingContext({ isProject: true, name: projectName, count: stagedFiles.length });
    setErrorBanner(null);

    try {
      const response = await authenticatedFetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          files: stagedFiles.map(f => ({
            path: f.relativePath,
            content: f.content,
            language: f.language
          }))
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Project review failed with HTTP ${response.status}`);
      }

      const data: ScanResult = await response.json();
      setScanResult(data);
      const historySave = saveScanToHistoryWithStatus(data);
      setHistory(historySave.history);
      setActiveTab('results');
      showToast(historySave.saved
        ? `Project review complete: ${data.metrics.totalFindings} potential issues identified across ${stagedFiles.length} files.`
        : 'Project review completed, but history could not be saved. Export the report if you need a retained copy.');
    } catch (err: any) {
      console.error('Project review error:', err);
      setErrorBanner(err.message || 'Unable to complete project review. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSample = (sample: SampleCode) => {
    setCode(sample.code);
    setFileName(sample.fileName);
    setLanguage(sample.language);
    showToast(`Loaded "${sample.title}"`);
  };

  const handleApplyPatchToSource = (newCode: string, targetFilePath?: string) => {
    setCode(newCode);

    if (scanResult) {
      const updatedFiles = scanResult.files?.map(file => {
        if (!targetFilePath || file.filePath === targetFilePath) {
          return { ...file, content: newCode, patchedContent: newCode };
        }
        return file;
      });
      setScanResult({
        ...scanResult,
        // Keep the active scan's source snapshot synchronized so ResultsView can
        // detect stale edits and offer a safe one-step undo.
        originalCode: scanResult.isMultiFile ? scanResult.originalCode : newCode,
        files: updatedFiles,
      });
    }

    showToast('Fix applied to active code. Re-run review to verify remediation.');
  };

  const handleOpenPastReview = (pastScan: ScanResult) => {
    setScanResult(pastScan);
    setCode(pastScan.originalCode);
    setFileName(pastScan.fileName);
    setLanguage(pastScan.language);
    setActiveTab('results');
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] dark:bg-[#111827] text-[#17243B] dark:text-[#F1F5FC] flex flex-col md:flex-row font-sans selection:bg-[#2458D3]/20 dark:selection:bg-[#4779E8]/30 selection:text-inherit transition-colors duration-150 overflow-x-hidden w-full max-w-full">
      {/* 1. Left Navigation: Dedicated Desktop Sidebar & Mobile Overlays */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasActiveResults={!!scanResult}
        systemStatus={systemStatus}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* 2. Right Dedicated Main Content Column (Takes remaining width, never overlaps sidebar) */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          systemStatus={systemStatus}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 max-w-[calc(100vw-2rem)]">
            <div className="bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] text-[#17243B] dark:text-[#F1F5FC] text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <CheckCircle2 className="w-4 h-4 text-[#147A52] dark:text-[#22C55E] shrink-0" />
              <span className="truncate">{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {errorBanner && (
          <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 mt-4">
            <div className="p-3.5 rounded-xl bg-[#FCEBED] dark:bg-[#3B1A1E] border border-[#C33442]/30 text-[#C33442] dark:text-[#F87171] text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="w-4 h-4 text-[#C33442] dark:text-[#F87171] shrink-0" />
                <span className="truncate">{errorBanner}</span>
              </div>
              <button
                onClick={() => setErrorBanner(null)}
                className="text-[#68758A] dark:text-[#9BAAC0] hover:text-[#17243B] dark:hover:text-[#F1F5FC] text-xs px-2 py-0.5 shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area: Centered inside dedicated content column */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 pb-24 md:pb-8 min-w-0">
          <div key={isLoading ? "loading" : activeTab} className="pp-view-enter">
          {/* Loading Progress State */}
          {isLoading ? (
            <ScanProgress 
              fileName={loadingContext.name} 
              language={language}
              isProject={loadingContext.isProject}
              fileCount={loadingContext.count}
            />
          ) : (
            <>
              {/* View 1: Dashboard */}
              {activeTab === 'dashboard' && (
                <HomeDashboardView
                  history={history}
                  onStartNewReview={() => setActiveTab('new-review')}
                  onOpenReview={handleOpenPastReview}
                  systemStatus={systemStatus}
                />
              )}

              {/* View 2: New Review (Supports Folder, ZIP, Loose Files, Direct Editor) */}
              {activeTab === 'new-review' && (
                <NewReviewView
                  code={code}
                  setCode={setCode}
                  fileName={fileName}
                  setFileName={setFileName}
                  language={language}
                  setLanguage={setLanguage}
                  onStartSingleReview={handleStartSingleReview}
                  onStartProjectReview={handleStartProjectReview}
                  isLoading={isLoading}
                  onSelectSample={handleSelectSample}
                />
              )}

              {/* View 3: Review Results */}
              {activeTab === 'results' && scanResult && (
                <ResultsView
                  scan={scanResult}
                  onApplyPatchToSource={handleApplyPatchToSource}
                  onNewReview={() => setActiveTab('new-review')}
                  onRescan={() => {
                    if (scanResult.isMultiFile && scanResult.files) {
                      handleStartProjectReview(
                        scanResult.projectName,
                        scanResult.files.map(f => ({
                          id: f.filePath,
                          name: f.filePath.split('/').pop() || f.filePath,
                          relativePath: f.filePath,
                          size: f.size,
                          language: f.language,
                          content: f.content,
                          lines: f.lines
                        }))
                      );
                    } else {
                      handleStartSingleReview();
                    }
                  }}
                />
              )}

              {/* View 4: Review History */}
              {activeTab === 'history' && (
                <HistoryView
                  onLoadScan={handleOpenPastReview}
                  onStartNewReview={() => setActiveTab('new-review')}
                />
              )}

              {/* View 5: Reports */}
              {activeTab === 'reports' && (
                <ReportsView
                  history={history}
                  activeScan={scanResult}
                  onOpenReview={handleOpenPastReview}
                />
              )}

              {/* View 6: Settings */}
              {activeTab === 'settings' && (
                <SettingsView
                  onHistoryCleared={() => {
                    refreshHistory();
                    setScanResult(null);
                  }}
                  onOpenDevTools={() => setActiveTab('dev-tools')}
                />
              )}

              {/* View 7: Developer Tools */}
              {activeTab === 'dev-tools' && (
                <DeveloperToolsView
                  systemStatus={systemStatus}
                  onRefreshStatus={refreshSystemStatus}
                  onBackToApp={() => setActiveTab('dashboard')}
                />
              )}
            </>
          )}
          </div>
        </main>

        {/* Minimal Footer */}
        <footer className="no-print w-full border-t border-[#DCE3ED] dark:border-[#35445A] bg-white dark:bg-[#1B2638] py-4 sm:py-5 text-xs text-[#526078] dark:text-[#C2CDDC] pb-24 md:pb-5 transition-colors duration-150">
          <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <PatchProofLogo variant="full" size="xs" showSubtitle={false} />
              <span className="text-[#68758A] dark:text-[#9BAAC0]">· Code Security Review Platform</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#68758A] dark:text-[#9BAAC0]">
              <span>In-Memory Heuristic & AI Engine</span>
              <span>·</span>
              <span>Verified Remediation</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
