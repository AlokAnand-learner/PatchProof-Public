/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { PatchProofLogo } from './PatchProofLogo';

interface ScanProgressProps {
  fileName: string;
  language: string;
  isProject?: boolean;
  fileCount?: number;
}

export const ScanProgress: React.FC<ScanProgressProps> = ({ 
  fileName, 
  language,
  isProject,
  fileCount 
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = isProject
    ? [
        {
          title: `Parsing project structure (${fileCount || 'multiple'} files)`,
          desc: 'Validating relative file paths and syntax trees across project directories...'
        },
        {
          title: 'Identifying cross-file security issues',
          desc: 'Auditing routes, database queries, and input data paths for vulnerabilities...'
        },
        {
          title: 'Formulating recommended code changes',
          desc: 'Synthesizing safe patches and computing overall project security score...'
        }
      ]
    : [
        {
          title: 'Parsing file structure',
          desc: `Analyzing ${language.toUpperCase()} syntax and logic flows...`
        },
        {
          title: 'Identifying security issues',
          desc: 'Checking against standard vulnerability patterns and untrusted input paths...'
        },
        {
          title: 'Generating recommended fixes',
          desc: 'Synthesizing verified code changes and computing security score...'
        }
      ];

  useEffect(() => {
    const t1 = setTimeout(() => setCurrentStep(1), 1000);
    const t2 = setTimeout(() => setCurrentStep(2), 2200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="bg-white dark:bg-[#1B2638] rounded-2xl border border-[#DCE3ED] dark:border-[#35445A] p-6 sm:p-8 max-w-lg mx-auto shadow-sm">
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-[#EFF4FE] dark:bg-[#243247] border border-[#D5E2FC] dark:border-[#35445A] flex items-center justify-center shadow-xs">
          <PatchProofLogo variant="icon" size="md" />
        </div>
        <h2 className="text-base font-semibold text-[#17243B] dark:text-[#F1F5FC]">
          Reviewing {fileName}
        </h2>
        <p className="text-xs text-[#68758A] dark:text-[#9BAAC0] mt-0.5">
          {isProject ? `Analyzing ${fileCount || 0} files in project` : 'Performing automated security analysis'}
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => {
          const isDone = currentStep > idx;
          const isCurrent = currentStep === idx;

          return (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border transition flex items-start gap-3 ${
                isCurrent
                  ? 'bg-[#EFF4FE] dark:bg-[#243247] border-[#2458D3]/40 dark:border-[#4779E8]/40 shadow-xs'
                  : isDone
                  ? 'bg-slate-50 dark:bg-[#1B2638]/70 border-[#DCE3ED] dark:border-[#35445A]'
                  : 'bg-white dark:bg-[#1B2638]/30 border-[#DCE3ED]/60 dark:border-[#35445A]/40 opacity-50'
              }`}
            >
              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                {isDone ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : isCurrent ? (
                  <div className="w-4 h-4 border-2 border-[#2458D3] dark:border-[#4779E8] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className={`text-xs font-medium ${isCurrent ? 'text-[#17243B] dark:text-[#F1F5FC] font-semibold' : isDone ? 'text-[#17243B] dark:text-[#C2CDDC]' : 'text-[#68758A] dark:text-[#9BAAC0]'}`}>
                    {step.title}
                  </h4>
                  {isCurrent && (
                    <span className="text-[10px] text-[#2458D3] dark:text-[#4779E8] font-mono font-medium">In progress...</span>
                  )}
                  {isDone && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Done</span>
                  )}
                </div>
                <p className="text-[11px] text-[#526078] dark:text-[#9BAAC0] mt-0.5 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
