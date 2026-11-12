/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileText, 
  Printer, 
  Download, 
  FileCode, 
  Calendar, 
  FolderOpen, 
  ExternalLink,
  Search,
  Globe,
  Trash2
} from 'lucide-react';
import { HistoryItem, ScanResult } from '../types/security';
import { 
  generateMarkdownReport, 
  generateHtmlReport, 
  downloadTextFile, 
  deleteScanFromHistory 
} from '../utils/securityUtils';
import { ReportModal } from './ReportModal';

interface ReportsViewProps {
  history: HistoryItem[];
  activeScan: ScanResult | null;
  onOpenReview: (scan: ScanResult) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  history,
  activeScan,
  onOpenReview
}) => {
  const [selectedScanForReport, setSelectedScanForReport] = useState<ScanResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDownloadMarkdown = (scan: ScanResult) => {
    const md = generateMarkdownReport(scan);
    const filename = `PatchProof-Report-${scan.projectName}.md`;
    downloadTextFile(filename, md, 'text/markdown');
  };

  const handleDownloadJSON = (scan: ScanResult) => {
    const jsonStr = JSON.stringify(scan, null, 2);
    const filename = `PatchProof-Report-${scan.projectName}.json`;
    downloadTextFile(filename, jsonStr, 'application/json');
  };

  const handleDownloadHTML = (scan: ScanResult) => {
    const html = generateHtmlReport(scan);
    const filename = `PatchProof-Report-${scan.projectName}.html`;
    downloadTextFile(filename, html, 'text/html');
  };

  const handleDeleteReport = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteScanFromHistory(id);
    setDeleteConfirmId(null);
  };

  const filteredHistory = history.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.fileName.toLowerCase().includes(q) || item.projectName.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DCE3ED] dark:border-[#35445A]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17243B] dark:text-[#F1F5FC]">
            Security Reports
          </h1>
          <p className="text-xs sm:text-sm text-[#526078] dark:text-[#C2CDDC] mt-1">
            Export, print, and download executive security review assessments in Markdown, HTML, and JSON formats.
          </p>
        </div>
      </div>

      {/* Active Scan Quick Report Banner */}
      {activeScan && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#2458D3] dark:text-[#4779E8] font-semibold block">
              Current Review Report Available
            </span>
            <h3 className="text-base font-semibold text-[#17243B] dark:text-[#F1F5FC]">
              {activeScan.fileName} ({activeScan.language})
            </h3>
            <p className="text-xs text-[#526078] dark:text-[#C2CDDC]">
              Score: <strong className="text-[#17243B] dark:text-[#F1F5FC]">{activeScan.metrics.score}/100</strong> (Grade {activeScan.metrics.grade}) • {activeScan.metrics.totalFindings} {activeScan.metrics.totalFindings === 1 ? 'issue' : 'issues'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedScanForReport(activeScan)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2458D3] hover:bg-[#1948B8] dark:bg-[#4779E8] dark:hover:bg-[#386AD9] text-white font-semibold text-xs transition shadow-xs cursor-pointer"
              title="Print or view formatted report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={() => handleDownloadHTML(activeScan)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] hover:bg-slate-200/60 dark:hover:bg-slate-700 text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
              title="Download standalone HTML report"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>HTML</span>
            </button>

            <button
              onClick={() => handleDownloadMarkdown(activeScan)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] hover:bg-slate-200/60 dark:hover:bg-slate-700 text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
              title="Download Markdown report"
            >
              <FileText className="w-3.5 h-3.5 text-[#526078] dark:text-[#C2CDDC]" />
              <span>Markdown</span>
            </button>

            <button
              onClick={() => handleDownloadJSON(activeScan)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] hover:bg-slate-200/60 dark:hover:bg-slate-700 text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
              title="Download raw JSON report"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>JSON</span>
            </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {history.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-[#68758A] dark:text-[#9BAAC0] absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter reports by file name..."
            className="w-full bg-white dark:bg-[#1B2638] text-xs text-[#17243B] dark:text-[#F1F5FC] placeholder:text-[#68758A] dark:placeholder:text-[#9BAAC0] pl-9 pr-4 py-2.5 rounded-xl border border-[#DCE3ED] dark:border-[#35445A] focus:outline-none focus:border-[#2458D3] dark:focus:border-[#4779E8] shadow-xs"
          />
        </div>
      )}

      {/* Reports List */}
      {history.length === 0 && !activeScan ? (
        <div className="p-8 sm:p-12 text-center rounded-2xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-[#EFF4FE] dark:bg-[#243247] border border-[#D5E2FC] dark:border-[#35445A] flex items-center justify-center text-[#2458D3] dark:text-[#4779E8] mx-auto mb-3">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F1F5FC]">
            No reports generated yet
          </h3>
          <p className="text-xs text-[#526078] dark:text-[#C2CDDC] max-w-sm mx-auto mt-1">
            Complete a code review to automatically generate downloadable HTML, Markdown, and JSON security reports.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#68758A] dark:text-[#9BAAC0]">
            Archived Reports ({filteredHistory.length})
          </h2>

          <div className="divide-y divide-[#DCE3ED] dark:divide-[#35445A] rounded-2xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] shadow-xs overflow-hidden">
            {filteredHistory.map((item) => {
              const dateStr = new Date(item.timestamp).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              return (
                <div
                  key={item.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#F4F6FA] dark:hover:bg-[#243247]/50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#EFF4FE] dark:bg-[#243247] border border-[#D5E2FC] dark:border-[#35445A] flex items-center justify-center text-[#2458D3] dark:text-[#4779E8] shrink-0">
                      <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-medium text-[#17243B] dark:text-[#F1F5FC] truncate max-w-xs sm:max-w-md">
                          {item.fileName}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#F4F6FA] dark:bg-[#243247] text-[#526078] dark:text-[#C2CDDC] border border-[#DCE3ED] dark:border-[#35445A]">
                          {item.language}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-[#68758A] dark:text-[#9BAAC0]">
                        <Calendar className="w-3 h-3" />
                        <span>{dateStr}</span>
                        <span>•</span>
                        <span>Score: {item.score}/100</span>
                        <span>•</span>
                        <span>{item.totalFindings} {item.totalFindings === 1 ? 'issue' : 'issues'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-[#DCE3ED] dark:border-[#35445A] justify-end">
                    <button
                      onClick={() => setSelectedScanForReport(item.scanResult)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] hover:bg-slate-200/70 dark:hover:bg-slate-700 text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
                      title="Print or view report"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#68758A] dark:text-[#9BAAC0]" />
                      <span className="hidden sm:inline">Print</span>
                    </button>

                    <button
                      onClick={() => handleDownloadHTML(item.scanResult)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] hover:bg-slate-200/70 dark:hover:bg-slate-700 text-[#17243B] dark:text-cyan-300 text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
                      title="Download HTML"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>HTML</span>
                    </button>

                    <button
                      onClick={() => handleDownloadMarkdown(item.scanResult)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] hover:bg-slate-200/70 dark:hover:bg-slate-700 text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
                      title="Download Markdown"
                    >
                      <Download className="w-3.5 h-3.5 text-[#68758A] dark:text-[#9BAAC0]" />
                      <span>MD</span>
                    </button>

                    <button
                      onClick={() => handleDownloadJSON(item.scanResult)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] hover:bg-slate-200/70 dark:hover:bg-slate-700 text-[#17243B] dark:text-amber-300 text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
                      title="Download JSON"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>JSON</span>
                    </button>

                    {deleteConfirmId === item.id ? (
                      <div className="flex items-center gap-1.5 p-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
                        <button
                          onClick={(e) => handleDeleteReport(item.id, e)}
                          className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                          className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[#17243B] dark:text-slate-300 text-[11px] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(item.id); }}
                        className="p-1.5 rounded-lg bg-[#F4F6FA] dark:bg-[#243247] hover:bg-rose-50 dark:hover:bg-rose-500/10 text-[#68758A] dark:text-[#9BAAC0] hover:text-rose-600 dark:hover:text-rose-400 border border-[#DCE3ED] dark:border-[#35445A] hover:border-rose-200 dark:hover:border-rose-500/30 transition cursor-pointer"
                        title="Delete report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => onOpenReview(item.scanResult)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2458D3] hover:bg-[#1948B8] dark:bg-[#4779E8] dark:hover:bg-[#386AD9] text-white text-xs font-medium transition cursor-pointer shadow-xs"
                      title="Open findings in viewer"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Report Modal */}
      {selectedScanForReport && (
        <ReportModal
          scan={selectedScanForReport}
          onClose={() => setSelectedScanForReport(null)}
        />
      )}
    </div>
  );
};
