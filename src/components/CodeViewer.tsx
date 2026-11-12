/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { Copy, Check, AlertTriangle, ShieldAlert } from 'lucide-react';
import { VulnerabilityFinding } from '../types/security';

interface CodeViewerProps {
  code: string;
  language: string;
  fileName: string;
  findings: VulnerabilityFinding[];
  selectedFindingId: string | null;
  onSelectFinding: (id: string) => void;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  code,
  language,
  fileName,
  findings,
  selectedFindingId,
  onSelectFinding
}) => {
  const [copied, setCopied] = React.useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lines = code.split('\n');

  // Build map of line numbers to findings
  const lineFindingMap: Record<number, VulnerabilityFinding[]> = {};
  findings.forEach((f) => {
    for (let l = f.startLine; l <= f.endLine; l++) {
      if (!lineFindingMap[l]) lineFindingMap[l] = [];
      lineFindingMap[l].push(f);
    }
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-scroll to selected finding
  useEffect(() => {
    if (selectedFindingId) {
      const finding = findings.find(f => f.id === selectedFindingId);
      if (finding && containerRef.current) {
        const lineEl = containerRef.current.querySelector(`[data-line="${finding.startLine}"]`);
        if (lineEl) {
          lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [selectedFindingId, findings]);

  return (
    <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-[#DCE3ED] dark:border-[#35445A] shadow-xs overflow-hidden flex flex-col h-full">
      {/* Code Header Bar */}
      <div className="px-4 py-2.5 bg-[#F4F6FA] dark:bg-slate-900/90 border-b border-[#DCE3ED] dark:border-[#35445A] flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-[#17243B] dark:text-slate-200 font-medium">{fileName}</span>
          <span className="text-[#68758A] dark:text-slate-500">({language})</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#68758A] dark:text-slate-400 text-[11px] hidden sm:inline">
            {lines.length} lines • {findings.length} {findings.length === 1 ? 'issue' : 'issues'}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#17243B] dark:text-slate-200 border border-[#DCE3ED] dark:border-transparent transition text-xs cursor-pointer shadow-xs"
            title="Copy code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#68758A] dark:text-slate-400" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code Lines Container */}
      <div 
        ref={containerRef}
        className="overflow-x-auto overflow-y-auto flex-1 font-mono text-xs leading-6 p-2 max-h-[500px] select-text bg-[#FBFCFD] dark:bg-[#0b101b]"
      >
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((lineContent, index) => {
              const lineNum = index + 1;
              const lineFindings = lineFindingMap[lineNum] || [];
              const hasCritical = lineFindings.some(f => f.severity === 'CRITICAL');
              const hasHigh = lineFindings.some(f => f.severity === 'HIGH');
              const isSelected = selectedFindingId && lineFindings.some(f => f.id === selectedFindingId);

              let rowBg = 'hover:bg-slate-100/70 dark:hover:bg-slate-900/50';
              if (isSelected) {
                rowBg = 'bg-rose-500/15 dark:bg-rose-500/20 ring-1 ring-rose-500/40';
              } else if (hasCritical) {
                rowBg = 'bg-rose-500/10 dark:bg-rose-500/10 hover:bg-rose-500/15';
              } else if (hasHigh) {
                rowBg = 'bg-amber-500/10 dark:bg-amber-500/10 hover:bg-amber-500/15';
              } else if (lineFindings.length > 0) {
                rowBg = 'bg-yellow-500/10 dark:bg-yellow-500/10 hover:bg-yellow-500/15';
              }

              return (
                <tr 
                  key={index} 
                  data-line={lineNum}
                  className={`transition-colors group ${rowBg}`}
                >
                  {/* Line Number Gutter */}
                  <td className="w-12 text-right pr-3 select-none text-[#68758A] dark:text-slate-600 group-hover:text-[#17243B] dark:group-hover:text-slate-400 border-r border-[#DCE3ED] dark:border-slate-800/60 align-top">
                    {lineNum}
                  </td>

                  {/* Vulnerability Marker Indicator */}
                  <td className="w-8 px-1.5 text-center select-none align-top">
                    {lineFindings.length > 0 && (
                      <button
                        onClick={() => onSelectFinding(lineFindings[0].id)}
                        title={`${lineFindings[0].severity}: ${lineFindings[0].title}`}
                        className="inline-flex items-center justify-center p-0.5 rounded hover:scale-125 transition-transform cursor-pointer"
                      >
                        {hasCritical ? (
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                      </button>
                    )}
                  </td>

                  {/* Code Line Content */}
                  <td className="pl-2 pr-4 text-[#17243B] dark:text-slate-300 whitespace-pre">
                    {lineContent || ' '}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
