import React from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  AlertTriangle, 
  Lock, 
  Key, 
  FileCheck2, 
  Terminal, 
  CheckCircle,
  HelpCircle,
  Scale
} from 'lucide-react';

export const MethodologyView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-[#0e1422] p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">
              Security Methodology & Transparency Notice
            </h2>
            <p className="text-xs text-slate-400">
              Understanding PatchProof&apos;s auditing architecture, AI reasoning, and data handling guarantees
            </p>
          </div>
        </div>
      </div>

      {/* Distinction Section: AI Hypotheses vs Verified Vulnerabilities */}
      <div className="bg-[#0e1422] p-6 rounded-2xl border border-cyan-800/40 space-y-4">
        <div className="flex items-center gap-2.5 text-cyan-400 font-bold text-sm">
          <Sparkles className="w-5 h-5" />
          <h3>Clear Distinction: AI-Generated Hypotheses vs Verified Vulnerabilities</h3>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          PatchProof explicitly distinguishes between <strong className="text-white">Deterministic Static Matches</strong> and <strong className="text-cyan-400">AI-Generated Hypotheses</strong>:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-4 h-4" />
              STATIC_RULE_MATCH
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              Deterministic pattern matches for known code shapes (such as raw string concatenation inside SQL queries or hardcoded API tokens). A match confirms the pattern was found, not that it is exploitable in every context.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-800/40 space-y-2">
            <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 font-mono">
              <Sparkles className="w-4 h-4" />
              AI_HYPOTHESIS
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              Probabilistic semantic suggestions from the currently selected AI provider and model. These may help identify business-logic concerns and complex code relationships, but can be incomplete or incorrect and always require human review.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/30 text-xs text-cyan-200">
          <strong>Engineering Notice:</strong> No automated scanner can replace comprehensive peer review and dynamic application security testing (DAST). Findings should be evaluated in your operational context before pushing breaking changes to production.
        </div>
      </div>

      {/* Input Validation & Secure Handling */}
      <div className="bg-[#0e1422] p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
          <Lock className="w-5 h-5" />
          <h3>Input Validation & Secure File Handling</h3>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          PatchProof is built defense-in-depth to protect developer environments:
        </p>

        <div className="space-y-2.5 text-xs text-slate-300">
          <div className="flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Strict File Size & Extension Whitelisting:</strong> Uploaded source code files are restricted to a maximum of 2MB to prevent memory exhaustion and denial-of-service. Binary executables (<code className="text-slate-400">.exe, .dll, .bin, .so</code>) are rejected immediately.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Binary Byte Inspection:</strong> The client and server inspect the first 1KB of file streams for non-printable control characters and null bytes (<code className="text-slate-400">\x00-\x1F</code>) before passing data to the parser.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Local-First Storage:</strong> Project audit history is saved in this browser&apos;s <code className="text-slate-400">localStorage</code>, which is not encrypted storage. Privacy mode is enabled by default and limits retained source material. If you explicitly approve a remote AI provider, the code context needed for analysis is transmitted to that provider; local Ollama analysis stays on your machine.
            </div>
          </div>
        </div>
      </div>

      {/* API Key & Architecture Transparency */}
      <div className="bg-[#0e1422] p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5 text-white font-bold text-sm">
          <Key className="w-5 h-5 text-yellow-400" />
          <h3>AI Models, API Keys & Availability</h3>
        </div>

        <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
          <p>
            PatchProof supports a selectable local or remote AI provider. The active provider and model are configurable in Developer Tools; model output is treated as untrusted input and findings remain hypotheses until reviewed.
          </p>

          <p>
            For local Gemini use, configure <code className="text-emerald-400">GEMINI_API_KEY</code> in your local environment. Other providers can be configured in Developer Tools. Remote provider transmission is blocked until you grant the in-app consent.
          </p>

          <p>
            If an AI provider is unavailable, the built-in static/context analysis can still run where supported. AI-assisted explanations and suggestions may be unavailable, and no fallback can guarantee complete vulnerability detection or safe patches.
          </p>
        </div>
      </div>
    </div>
  );
};
