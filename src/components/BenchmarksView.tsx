import React from 'react';
import { SAMPLE_CODES } from '../data/sampleCodes';
import { SampleCode } from '../types/security';
import { Play, ShieldAlert, ArrowRight, BookOpen, Bug } from 'lucide-react';

interface BenchmarksViewProps {
  onSelectSample: (sample: SampleCode) => void;
}

export const BenchmarksView: React.FC<BenchmarksViewProps> = ({ onSelectSample }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0e1422] p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Bug className="w-5 h-5 text-rose-400" />
            <span>Vulnerability Threat Benchmarks</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-world security anti-patterns across standard backend frameworks. Click to audit and inspect AI-synthesized patches.
          </p>
        </div>
      </div>

      {/* Grid of Benchmarks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SAMPLE_CODES.map((sample) => (
          <div
            key={sample.id}
            className="bg-[#0e1422] rounded-2xl border border-slate-800 p-5 flex flex-col justify-between hover:border-emerald-500/40 transition group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 font-bold">
                  {sample.language} • {sample.fileName}
                </span>
                <span className="text-[11px] font-mono text-emerald-400">
                  {sample.category}
                </span>
              </div>

              <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition mb-1.5">
                {sample.title}
              </h3>

              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                {sample.description}
              </p>

              {/* Expected vulnerabilities */}
              <div className="space-y-1.5 mb-4">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                  Simulated Threat Vectors:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {sample.expectedVulnerabilities.map((v, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch button */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                {sample.code.split('\n').length} lines of code
              </span>

              <button
                onClick={() => onSelectSample(sample)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Load in Scanner</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
