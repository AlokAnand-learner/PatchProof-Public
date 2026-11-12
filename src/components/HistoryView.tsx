/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Trash2, 
  ExternalLink, 
  Download, 
  Search, 
  Calendar, 
  FileCode, 
  FolderOpen,
  Globe,
  CheckSquare,
  Square,
  AlertTriangle,
  CheckCircle2,
  X
} from 'lucide-react';
import { HistoryItem, ScanResult } from '../types/security';
import { 
  getScanHistory, 
  deleteScanFromHistoryWithStatus, 
  deleteMultipleScansFromHistoryWithStatus,
  clearScanHistory, 
  getGradeBadge, 
  downloadTextFile, 
  generateMarkdownReport,
  generateHtmlReport 
} from '../utils/securityUtils';

interface HistoryViewProps {
  onLoadScan: (scan: ScanResult) => void;
  onStartNewReview: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onLoadScan, onStartNewReview }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // In-app confirmation dialog state (iframe-safe, never blocked by sandbox)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'single' | 'selected' | 'clear-all';
    targetId?: string;
    targetTitle?: string;
    count?: number;
  }>({
    isOpen: false,
    type: 'clear-all'
  });

  const refreshList = () => {
    const list = getScanHistory();
    setHistory(list);
    // Cleanup any selected IDs that no longer exist
    setSelectedIds(prev => {
      const validIds = new Set(list.map(i => i.id));
      const next = new Set<string>();
      prev.forEach(id => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  };

  useEffect(() => {
    refreshList();
    window.addEventListener('patchproof_history_updated', refreshList);
    return () => window.removeEventListener('patchproof_history_updated', refreshList);
  }, []);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setNotice({ text, type });
    setTimeout(() => {
      setNotice(null);
    }, 3500);
  };

  // Toggle single item selection
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select / Deselect All
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredHistory.length && filteredHistory.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredHistory.map(i => i.id)));
    }
  };

  // Open confirm dialog for single record
  const promptDeleteSingle = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      type: 'single',
      targetId: item.id,
      targetTitle: item.fileName,
      count: 1
    });
  };

  // Open confirm dialog for selected records
  const promptDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setConfirmDialog({
      isOpen: true,
      type: 'selected',
      count: selectedIds.size
    });
  };

  // Open confirm dialog for clear all
  const promptClearAll = () => {
    if (history.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      type: 'clear-all',
      count: history.length
    });
  };

  // Execute deletion confirmed by user
  const handleExecuteDeletion = () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (confirmDialog.type === 'single' && confirmDialog.targetId) {
        const idToDelete = confirmDialog.targetId;
        const result = deleteScanFromHistoryWithStatus(idToDelete);
        setHistory(result.history);
        if (!result.saved) {
          showFeedback('Review could not be deleted because browser storage rejected the change.', 'error');
          return;
        }
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(idToDelete);
          return next;
        });
        showFeedback(`Successfully deleted review "${confirmDialog.targetTitle || 'record'}".`);
      } else if (confirmDialog.type === 'selected') {
        const idsArray = Array.from(selectedIds);
        const result = deleteMultipleScansFromHistoryWithStatus(idsArray);
        setHistory(result.history);
        if (!result.saved) {
          showFeedback('Selected reviews could not be deleted because browser storage rejected the change.', 'error');
          return;
        }
        setSelectedIds(new Set());
        showFeedback(`Successfully deleted ${idsArray.length} selected review ${idsArray.length === 1 ? 'record' : 'records'}.`);
      } else if (confirmDialog.type === 'clear-all') {
        const cleared = clearScanHistory();
        if (!cleared) {
          showFeedback('History could not be cleared. Check browser storage permissions or available space.', 'error');
          return;
        }
        setHistory([]);
        setSelectedIds(new Set());
        showFeedback('Successfully cleared all review history.');
      }
    } catch (err: any) {
      console.error('Deletion error:', err);
      showFeedback('An error occurred during deletion. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
      setConfirmDialog({ isOpen: false, type: 'clear-all' });
    }
  };

  const handleDownloadMd = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const md = generateMarkdownReport(item.scanResult);
    downloadTextFile(`PatchProof-Report-${item.projectName}.md`, md, 'text/markdown');
  };

  const handleDownloadHtml = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const html = generateHtmlReport(item.scanResult);
    downloadTextFile(`PatchProof-Report-${item.projectName}.html`, html, 'text/html');
  };

  const filteredHistory = history.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.projectName.toLowerCase().includes(q) ||
      item.fileName.toLowerCase().includes(q) ||
      item.language.toLowerCase().includes(q)
    );
  });

  const isAllSelected = filteredHistory.length > 0 && selectedIds.size === filteredHistory.length;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DCE3ED] dark:border-[#35445A]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17243B] dark:text-[#F1F5FC] flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#2458D3] dark:text-emerald-400" />
            <span>Review History</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#526078] dark:text-[#C2CDDC] mt-1">
            Manage past code reviews, select records for deletion, or export reports.
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={promptClearAll}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 transition self-start sm:self-auto disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All History</span>
          </button>
        )}
      </div>

      {/* Action Notification Banner */}
      {notice && (
        <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 transition ${
          notice.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
        }`}>
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* In-App Deletion Confirmation Modal Dialog (Iframe-Safe) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#17243B] dark:text-[#F1F5FC]">
                  {confirmDialog.type === 'clear-all'
                    ? 'Clear All Review History?'
                    : confirmDialog.type === 'selected'
                    ? `Delete ${confirmDialog.count} Selected Reviews?`
                    : 'Delete Review Record?'}
                </h3>
                <p className="text-xs text-[#526078] dark:text-[#C2CDDC] leading-relaxed">
                  {confirmDialog.type === 'clear-all'
                    ? `This will permanently delete all ${confirmDialog.count} scan records from your local storage. This action cannot be undone.`
                    : confirmDialog.type === 'selected'
                    ? `This will permanently remove ${confirmDialog.count} selected scan records from your local storage.`
                    : `This will permanently delete the review record for "${confirmDialog.targetTitle}".`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE3ED] dark:border-[#35445A]">
              <button
                type="button"
                onClick={() => setConfirmDialog({ isOpen: false, type: 'clear-all' })}
                disabled={isProcessing}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-white bg-[#F4F6FA] dark:bg-[#243247] hover:bg-[#EAEFF7] dark:hover:bg-[#2D3E58] border border-[#DCE3ED] dark:border-[#35445A] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDeletion}
                disabled={isProcessing}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition shadow-sm"
              >
                {isProcessing ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Batch Management Toolbar */}
      {history.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#68758A] dark:text-[#9BAAC0] absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reviews by file, project, or language..."
                className="w-full bg-white dark:bg-[#1B2638] text-xs text-[#17243B] dark:text-[#F1F5FC] placeholder-[#68758A] dark:placeholder-[#9BAAC0] pl-9 pr-4 py-2.5 rounded-xl border border-[#DCE3ED] dark:border-[#35445A] focus:outline-none focus:border-[#2458D3] dark:focus:border-[#4779E8]"
              />
            </div>

            {/* Select All Toggle Button */}
            <button
              onClick={handleToggleSelectAll}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#1B2638] hover:bg-[#F4F6FA] dark:hover:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] text-xs text-[#17243B] dark:text-[#F1F5FC] font-medium transition self-start sm:self-auto shrink-0 shadow-sm"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-[#2458D3] dark:text-emerald-400" />
              ) : (
                <Square className="w-4 h-4 text-[#68758A] dark:text-[#9BAAC0]" />
              )}
              <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
            </button>
          </div>

          {/* Batch Actions Floating Bar when items are selected */}
          {selectedIds.size > 0 && (
            <div className="p-3 rounded-xl bg-white dark:bg-[#1B2638] border border-[#2458D3]/40 dark:border-emerald-500/30 flex items-center justify-between gap-3 flex-wrap shadow-sm animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#2458D3] dark:bg-emerald-400" />
                <span className="text-xs font-semibold text-[#17243B] dark:text-[#F1F5FC]">
                  {selectedIds.size} {selectedIds.size === 1 ? 'record' : 'records'} selected
                </span>
                <span className="text-xs text-[#526078] dark:text-[#9BAAC0]">
                  (out of {filteredHistory.length})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-white hover:bg-[#F4F6FA] dark:hover:bg-[#243247] transition"
                >
                  Clear Selection
                </button>

                <button
                  onClick={promptDeleteSelected}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedIds.size})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {history.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] space-y-3 shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#F4F6FA] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] flex items-center justify-center text-[#68758A] dark:text-[#9BAAC0]">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F1F5FC]">
              No saved reviews yet
            </h3>
            <p className="text-xs text-[#526078] dark:text-[#C2CDDC] max-w-sm mx-auto mt-1 mb-4">
              Your completed code reviews will be stored locally and appear here.
            </p>
            <button
              onClick={onStartNewReview}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2458D3] hover:bg-[#1948B8] dark:bg-[#4779E8] dark:hover:bg-[#386AD9] text-white font-medium text-xs transition shadow-sm"
            >
              <span>Start Code Review</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[#DCE3ED] dark:divide-[#35445A] rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] overflow-hidden shadow-sm">
          {filteredHistory.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const dateStr = new Date(item.timestamp).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            return (
              <div
                key={item.id}
                onClick={() => onLoadScan(item.scanResult)}
                className={`p-3.5 sm:p-4 hover:bg-[#F4F6FA] dark:hover:bg-[#243247]/50 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 group ${
                  isSelected ? 'bg-[#F4F6FA] dark:bg-[#243247]/70 border-l-2 border-[#2458D3] dark:border-emerald-400' : ''
                }`}
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  {/* Select Checkbox (Large Touch Target) */}
                  <div
                    onClick={(e) => handleToggleSelect(item.id, e)}
                    className="p-1 -m-1 text-[#68758A] dark:text-[#9BAAC0] hover:text-[#2458D3] dark:hover:text-emerald-400 transition cursor-pointer shrink-0"
                    title={isSelected ? 'Deselect record' : 'Select record'}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#2458D3] dark:text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-[#68758A] dark:text-[#9BAAC0] hover:text-[#17243B] dark:hover:text-slate-300" />
                    )}
                  </div>

                  {/* Grade Badge */}
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${getGradeBadge(
                      item.grade
                    )}`}
                  >
                    {item.grade}
                  </div>

                  {/* Record Details */}
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-semibold text-[#17243B] dark:text-[#F1F5FC] group-hover:text-[#2458D3] dark:group-hover:text-emerald-400 transition truncate max-w-xs sm:max-w-md">
                        {item.fileName}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#F4F6FA] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] text-[#526078] dark:text-[#C2CDDC]">
                        {item.language}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#526078] dark:text-[#9BAAC0] font-mono tabular-nums">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#68758A] dark:text-[#9BAAC0]" />
                        {dateStr}
                      </span>
                      <span>·</span>
                      <span>Score: <strong className="text-[#17243B] dark:text-[#F1F5FC]">{item.score}/100</strong></span>
                    </div>
                  </div>
                </div>

                {/* Right Actions Toolbar */}
                <div className="flex items-center justify-between md:justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-[#DCE3ED] dark:border-[#35445A] flex-wrap">
                  <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                    {item.criticalCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 font-semibold">
                        {item.criticalCount} Critical
                      </span>
                    )}
                    <span className="text-[#526078] dark:text-[#C2CDDC]">
                      {item.totalFindings} {item.totalFindings === 1 ? 'issue' : 'issues'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDownloadHtml(item, e)}
                      title="Download HTML Report"
                      className="p-1.5 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] hover:bg-[#EAEFF7] dark:hover:bg-[#2D3E58] text-[#2458D3] dark:text-cyan-400 border border-[#DCE3ED] dark:border-[#35445A] transition"
                    >
                      <Globe className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => handleDownloadMd(item, e)}
                      title="Download Markdown Report"
                      className="p-1.5 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] hover:bg-[#EAEFF7] dark:hover:bg-[#2D3E58] text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-white border border-[#DCE3ED] dark:border-[#35445A] transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => promptDeleteSingle(item, e)}
                      title="Delete this record"
                      className="p-1.5 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] hover:bg-rose-500/10 text-[#526078] dark:text-[#C2CDDC] hover:text-rose-600 dark:hover:text-rose-400 border border-[#DCE3ED] dark:border-[#35445A] hover:border-rose-500/30 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <span className="text-xs text-[#17243B] dark:text-[#F1F5FC] font-medium px-2.5 py-1 rounded-md bg-[#F4F6FA] dark:bg-[#243247] group-hover:bg-[#2458D3] dark:group-hover:bg-emerald-500 group-hover:text-white dark:group-hover:text-slate-950 transition flex items-center gap-1 border border-[#DCE3ED] dark:border-[#35445A]">
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
