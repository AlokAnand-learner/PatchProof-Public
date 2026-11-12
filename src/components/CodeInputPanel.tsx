import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Code2, 
  FileText, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  FileCheck,
  ChevronDown,
  Layers,
  Wand2,
  Play
} from 'lucide-react';
import { SAMPLE_CODES } from '../data/sampleCodes';
import { SampleCode } from '../types/security';
import { detectLanguageFromContent } from '../utils/archiveUtils';

interface CodeInputPanelProps {
  code: string;
  setCode: (code: string) => void;
  fileName: string;
  setFileName: (name: string) => void;
  language: string;
  setLanguage: (lang: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  onSelectSample: (sample: SampleCode) => void;
}

const SUPPORTED_LANGUAGES = [
  { id: 'auto', label: 'Auto Detect' },
  { id: 'python', label: 'Python (.py)' },
  { id: 'javascript', label: 'JavaScript (.js, .mjs)' },
  { id: 'typescript', label: 'TypeScript (.ts, .tsx)' },
  { id: 'go', label: 'Go (.go)' },
  { id: 'java', label: 'Java (.java)' },
  { id: 'php', label: 'PHP (.php)' },
  { id: 'cpp', label: 'C / C++ (.c, .cpp)' },
  { id: 'rust', label: 'Rust (.rs)' },
  { id: 'csharp', label: 'C# (.cs)' },
  { id: 'ruby', label: 'Ruby (.rb)' },
  { id: 'sql', label: 'SQL (.sql)' },
  { id: 'shell', label: 'Shell / Bash (.sh)' }
];

export const CodeInputPanel: React.FC<CodeInputPanelProps> = ({
  code,
  setCode,
  fileName,
  setFileName,
  language,
  setLanguage,
  onAnalyze,
  isLoading,
  onSelectSample
}) => {
  const [activeInputMode, setActiveInputMode] = useState<'editor' | 'upload' | 'samples'>('editor');
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lines = code.split('\n');
  const lineCount = code.trim().length > 0 ? lines.length : 0;
  const charCount = code.length;

  // Auto-detect language from filename
  const detectLanguageFromExtension = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'py': return 'python';
      case 'js':
      case 'mjs':
      case 'cjs':
      case 'jsx': return 'javascript';
      case 'ts':
      case 'tsx': return 'typescript';
      case 'go': return 'go';
      case 'java': return 'java';
      case 'php': return 'php';
      case 'c':
      case 'h':
      case 'cpp':
      case 'hpp': return 'cpp';
      case 'rs': return 'rust';
      case 'cs': return 'csharp';
      case 'rb': return 'ruby';
      case 'sql': return 'sql';
      case 'sh':
      case 'bash': return 'shell';
      case 'txt':
      case 'text': return 'plaintext';
      default: return 'plaintext';
    }
  };

  const handleFileUpload = (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);

    // Empty file check
    if (file.size === 0) {
      setUploadError(`The file "${file.name}" is empty (0 bytes). Please upload a file containing source code.`);
      return;
    }

    // Size limit check (max 2MB)
    const MAX_SIZE_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is 2MB.`);
      return;
    }

    // Prohibit dangerous executable binaries
    const disallowedExtensions = ['exe', 'dll', 'bin', 'so', 'dylib', 'zip', 'tar', 'gz', 'pdf', 'png', 'jpg', 'iso'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (disallowedExtensions.includes(ext)) {
      setUploadError(`File type ".${ext}" is not a supported text source code file. Please upload .py, .js, .ts, .go, .java, .php, .txt, etc.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content || content.trim().length === 0) {
        setUploadError(`The file "${file.name}" is empty. Please upload a file containing source code.`);
        return;
      }

      // Check for binary characters (null bytes, control characters)
      const isBinary = /[\x00-\x08\x0E-\x1F]/.test(content.slice(0, 1024));
      if (isBinary) {
        setUploadError(`The file "${file.name}" contains binary data and cannot be parsed as text source code.`);
        return;
      }

      setCode(content);
      setFileName(file.name);
      let detected = detectLanguageFromExtension(file.name);
      if (detected === 'plaintext' || file.name.toLowerCase().endsWith('.txt')) {
        const fromContent = detectLanguageFromContent(content);
        if (fromContent !== 'plaintext') {
          detected = fromContent;
        }
      }
      setLanguage(detected);
      setUploadSuccess(`Loaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB) successfully!`);
      setActiveInputMode('editor');
    };

    reader.onerror = () => {
      setUploadError(`An error occurred while reading "${file.name}". Please ensure it is a valid UTF-8 plain text file.`);
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSampleClick = (sample: SampleCode) => {
    onSelectSample(sample);
    setActiveInputMode('editor');
    setUploadSuccess(`Loaded sample: "${sample.title}"`);
  };

  const handleClear = () => {
    setCode('');
    setFileName('untitled.py');
    setUploadError(null);
    setUploadSuccess(null);
  };

  return (
    <div className="bg-[#0e1422] rounded-2xl border border-slate-800/90 shadow-xl overflow-hidden">
      {/* Top Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Input Mode Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => setActiveInputMode('editor')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeInputMode === 'editor'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Code Editor</span>
          </button>

          <button
            onClick={() => setActiveInputMode('upload')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeInputMode === 'upload'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>

          <button
            onClick={() => setActiveInputMode('samples')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeInputMode === 'samples'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Vulnerable Samples</span>
          </button>
        </div>

        {/* File and Language Meta */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Target filename input */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-300">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="filename.ext"
              className="bg-transparent border-none text-slate-200 focus:outline-none w-32 sm:w-40 font-mono text-xs"
            />
          </div>

          {/* Language Selector */}
          <div className="relative">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="appearance-none bg-slate-950/60 text-slate-300 px-3 py-1.5 pr-8 rounded-lg border border-slate-800 text-xs font-medium focus:outline-none focus:border-emerald-500/50 cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id} className="bg-slate-900 text-slate-200">
                  {lang.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {code.length > 0 && (
            <button
              onClick={handleClear}
              title="Clear editor"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {uploadError && (
        <div className="mx-4 sm:mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{uploadError}</span>
        </div>
      )}

      {uploadSuccess && (
        <div className="mx-4 sm:mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {/* Mode 1: Editor View */}
      {activeInputMode === 'editor' && (
        <div className="relative">
          <div className="flex border-b border-slate-800/60 bg-slate-950/40 px-4 py-2 text-[11px] text-slate-400 font-mono justify-between items-center">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              {fileName || 'scratchpad.code'} ({language})
            </span>
            <span>
              {lineCount} lines • {charCount} chars
            </span>
          </div>

          <div className="relative flex">
            {/* Gutter / Line Numbers */}
            <div 
              aria-hidden="true"
              className="hidden sm:block select-none w-12 py-4 text-right pr-3 font-mono text-xs text-slate-600 bg-slate-950/60 border-r border-slate-800/60 leading-6"
            >
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
              {lines.length === 0 && <div>1</div>}
            </div>

            {/* Code Textarea */}
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={`// Paste your source code here or select a vulnerable sample...\n// PatchProof will audit for SQL Injection, XSS, SSRF, Deserialization, Hardcoded Secrets, and more.\n\nfunction processUserData(input) {\n  // Code to review\n}`}
              spellCheck={false}
              className="w-full h-80 sm:h-96 p-4 font-mono text-xs sm:text-sm bg-transparent text-slate-200 placeholder-slate-600 focus:outline-none resize-y leading-6 selection:bg-emerald-500/20"
            />
          </div>
        </div>
      )}

      {/* Mode 2: File Upload View */}
      {activeInputMode === 'upload' && (
        <div className="p-6 sm:p-8">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-emerald-400 bg-emerald-500/10 scale-[0.99]'
                : 'border-slate-800 hover:border-slate-700 bg-slate-950/30 hover:bg-slate-950/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="hidden"
              accept=".py,.js,.jsx,.ts,.tsx,.go,.java,.php,.c,.cpp,.h,.hpp,.rs,.cs,.rb,.sql,.sh,.json,.yaml,.yml,.txt,text/plain"
            />

            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-emerald-400" />
            </div>

            <h3 className="text-base font-semibold text-slate-200 mb-1">
              Upload Source Code File
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
              Drag and drop your file here, or click to browse. Max size: 2MB. Supports Python, JavaScript, TypeScript, Go, Java, PHP, C/C++, Rust, SQL, and plain-text code snippets (.txt).
            </p>

            <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] text-slate-500">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">.py</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">.js / .ts</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">.go</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">.java</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">.php</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">.cpp / .c</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">.txt</span>
            </div>
          </div>
        </div>
      )}

      {/* Mode 3: Vulnerable Benchmark Samples */}
      {activeInputMode === 'samples' && (
        <div className="p-4 sm:p-6 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Pre-configured Security Test Cases
              </h3>
              <p className="text-xs text-slate-400">
                Select a benchmark file to observe how PatchProof analyzes vulnerabilities and synthesizes secure patches.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SAMPLE_CODES.map((sample) => (
              <button
                key={sample.id}
                onClick={() => handleSampleClick(sample)}
                className="text-left p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-emerald-500/40 hover:bg-slate-900/60 transition group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-300 transition">
                      {sample.title}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {sample.language}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">
                    {sample.description}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-800/60">
                  {sample.expectedVulnerabilities.map((v, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    >
                      {v.split(':')[0]}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Action Footer */}
      <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400 text-center sm:text-left">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            Scans for OWASP Top 10, CWE weaknesses, taint flow, and synthesizes verified patches.
          </span>
        </div>

        <button
          onClick={onAnalyze}
          disabled={isLoading || code.trim().length === 0}
          className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-lg ${
            code.trim().length === 0
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40'
              : isLoading
              ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 cursor-wait'
              : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20 hover:shadow-emerald-500/30 active:scale-95'
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Auditing Security Posture...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Launch Security Review</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
