/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Folder, 
  FileArchive, 
  FileCode, 
  Trash2, 
  Play, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Code2, 
  Lock, 
  FileText,
  Search,
  Sliders,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { StagedFile, UploadLimits, SampleCode } from '../types/security';
import { processFolderUpload, processZipUpload, processMultipleFiles, mergeStagedFileBatches, DEFAULT_LIMITS } from '../utils/archiveUtils';
import { SAMPLE_CODES } from '../data/sampleCodes';

interface NewReviewViewProps {
  code: string;
  setCode: (code: string) => void;
  fileName: string;
  setFileName: (name: string) => void;
  language: string;
  setLanguage: (lang: string) => void;
  onStartSingleReview: () => void;
  onStartProjectReview: (projectName: string, files: StagedFile[]) => void;
  isLoading: boolean;
  onSelectSample: (sample: SampleCode) => void;
}

type SubmissionMethod = 'folder' | 'zip' | 'files' | 'editor';

export const NewReviewView: React.FC<NewReviewViewProps> = ({
  code,
  setCode,
  fileName,
  setFileName,
  language,
  setLanguage,
  onStartSingleReview,
  onStartProjectReview,
  isLoading,
  onSelectSample
}) => {
  const [method, setMethod] = useState<SubmissionMethod>('folder');
  const [dragActive, setDragActive] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const stagedFilesRef = useRef<StagedFile[]>([]);
  const commitStagedFiles = (next: StagedFile[]) => {
    stagedFilesRef.current = next;
    setStagedFiles(next);
  };
  const mergeIncomingFiles = (incoming: StagedFile[], skipped: string[] = []) => {
    const merged = mergeStagedFileBatches(stagedFilesRef.current, incoming);
    commitStagedFiles(merged.stagedFiles);
    setSkippedNotice([...skipped, ...merged.skippedFiles]);
  };
  const [projectName, setProjectName] = useState('Project Review');
  const [excludeCommonDirs, setExcludeCommonDirs] = useState(true);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [skippedNotice, setSkippedNotice] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Refs for hidden HTML file inputs
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // Check browser support for directory upload
  const [supportsFolderSelect, setSupportsFolderSelect] = useState(true);
  useEffect(() => {
    const input = document.createElement('input');
    setSupportsFolderSelect('webkitdirectory' in input || 'directory' in input);
  }, []);

  // Drag & drop listeners for upload zone
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // 1. Process Folder Selection
  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setErrorMessage(null);
    try {
      const result = await processFolderUpload(fileList, { excludeCommonDirs });
      commitStagedFiles(result.stagedFiles);
      setSkippedNotice(result.skippedFiles);
      if (result.projectName) setProjectName(result.projectName);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not process the selected folder. Please check the files and try again.');
    } finally {
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  // 2. Process ZIP Archive
  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    try {
      const result = await processZipUpload(file, { excludeCommonDirs });
      setStagedFiles(result.stagedFiles);
      setSkippedNotice(result.skippedFiles);
      if (result.projectName) setProjectName(result.projectName);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not extract ZIP archive. Please ensure it is a valid .zip file under 25MB.');
    } finally {
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  };

  // 3. Process Multiple Files
  const handleMultiFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setErrorMessage(null);
    try {
      const result = await processMultipleFiles(fileList);
      mergeIncomingFiles(result.stagedFiles, result.skippedFiles);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not process the selected files.');
    } finally {
      if (multiFileInputRef.current) multiFileInputRef.current.value = '';
    }
  };

  // 4. Handle Drag & Drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    setErrorMessage(null);
    // Check if a ZIP was dropped
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      try {
        const result = await processZipUpload(files[0], { excludeCommonDirs });
        setStagedFiles(result.stagedFiles);
        setSkippedNotice(result.skippedFiles);
        if (result.projectName) setProjectName(result.projectName);
      } catch (err: any) {
        setErrorMessage(err.message || 'Could not extract ZIP archive.');
      }
    } else {
      try {
        const result = await processMultipleFiles(files);
        mergeIncomingFiles(result.stagedFiles, result.skippedFiles);
        if (result.projectName) setProjectName(result.projectName);
      } catch (err: any) {
        setErrorMessage(err.message || 'Could not process dropped files.');
      }
    }
  };

  const removeStagedFile = (id: string) => {
    commitStagedFiles(stagedFilesRef.current.filter(f => f.id !== id));
  };

  const clearStagedFiles = () => {
    commitStagedFiles([]);
    setSkippedNotice([]);
    setErrorMessage(null);
  };

  const handleStartReview = () => {
    if (stagedFiles.length > 0) {
      onStartProjectReview(projectName || 'Project Review', stagedFiles);
    } else if (code.trim().length > 0) {
      onStartSingleReview();
    }
  };

  const totalStagedSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);
  const filteredStagedFiles = stagedFiles.filter(f => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return f.relativePath.toLowerCase().includes(q) || f.language.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="pb-3 border-b border-[#DCE3ED] dark:border-[#35445A]">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17243B] dark:text-[#F1F5FC] font-heading">
          New Review
        </h1>
        <p className="text-xs sm:text-sm text-[#526078] dark:text-[#C2CDDC] mt-0.5">
          Submit project files, a ZIP archive, or paste code to check for security issues.
        </p>
      </div>

      {/* Hidden file inputs for directory, zip, and multiple files */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore - webkitdirectory is standard in Chromium / WebKit
        webkitdirectory=""
        // @ts-ignore
        directory=""
        multiple
        onChange={handleFolderSelect}
        className="hidden"
      />

      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        onChange={handleZipSelect}
        className="hidden"
      />

      <input
        ref={multiFileInputRef}
        type="file"
        multiple
        accept=".py,.js,.jsx,.ts,.tsx,.go,.java,.php,.c,.cpp,.h,.hpp,.rs,.cs,.rb,.sql,.sh,.json,.yaml,.yml,.txt,text/plain"
        onChange={handleMultiFilesSelect}
        className="hidden"
      />

      {/* Primary Card */}
      <div className="rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] overflow-hidden shadow-xs">
        {/* Navigation Selector Bar: 3 Project Submission Methods + Direct Editor */}
        <div className="p-3 sm:p-4 border-b border-[#DCE3ED] dark:border-[#35445A] bg-[#F8FAFC] dark:bg-[#243247] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#1B2638] p-1 rounded-lg border border-[#DCE3ED] dark:border-[#35445A] flex-wrap">
            {/* Method 1: Folder Upload */}
            <button
              onClick={() => {
                setMethod('folder');
                if (stagedFiles.length === 0) folderInputRef.current?.click();
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                method === 'folder'
                  ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] border border-[#2458D3]/30 dark:border-[#4779E8]/40 shadow-xs'
                  : 'text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC]'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-[#2458D3] dark:text-[#4779E8]" />
              <span>Folder Upload</span>
            </button>

            {/* Method 2: ZIP Archive */}
            <button
              onClick={() => {
                setMethod('zip');
                if (stagedFiles.length === 0) zipInputRef.current?.click();
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                method === 'zip'
                  ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] border border-[#2458D3]/30 dark:border-[#4779E8]/40 shadow-xs'
                  : 'text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC]'
              }`}
            >
              <FileArchive className="w-3.5 h-3.5 text-[#2458D3] dark:text-[#4779E8]" />
              <span>ZIP Archive</span>
            </button>

            {/* Method 3: Multiple Files Selection */}
            <button
              onClick={() => {
                setMethod('files');
                if (stagedFiles.length === 0) multiFileInputRef.current?.click();
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                method === 'files'
                  ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] border border-[#2458D3]/30 dark:border-[#4779E8]/40 shadow-xs'
                  : 'text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC]'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-[#2458D3] dark:text-[#4779E8]" />
              <span>Select Files</span>
            </button>

            {/* Method 4: Code Editor / Scratchpad */}
            <button
              onClick={() => setMethod('editor')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                method === 'editor'
                  ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] border border-[#2458D3]/30 dark:border-[#4779E8]/40 shadow-xs'
                  : 'text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC]'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Code Editor</span>
            </button>
          </div>

          {/* Quick Example Loader */}
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                const sample = SAMPLE_CODES.find(s => s.id === e.target.value);
                if (sample) {
                  onSelectSample(sample);
                  setMethod('editor');
                  clearStagedFiles();
                }
              }}
              defaultValue=""
              className="bg-white dark:bg-[#1B2638] text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC] px-2.5 py-1.5 rounded-lg border border-[#DCE3ED] dark:border-[#35445A] text-xs focus:outline-none cursor-pointer"
            >
              <option value="" disabled>Load example snippet...</option>
              {SAMPLE_CODES.map(s => (
                <option key={s.id} value={s.id} className="bg-white dark:bg-[#1B2638] text-[#17243B] dark:text-[#F1F5FC]">
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-[#FCEBED] dark:bg-[#3B1A1E] border border-[#C33442]/30 text-[#C33442] dark:text-[#F87171] text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#C33442] dark:text-[#F87171] shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-[#68758A] dark:text-[#9BAAC0] hover:text-[#17243B] dark:hover:text-[#F1F5FC] p-1 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* SECTION: If files are staged from Folder / ZIP / Files Upload */}
        {stagedFiles.length > 0 ? (
          <div className="p-4 sm:p-6 space-y-4">
            {/* Staged Project Header */}
            <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[#68758A] dark:text-[#9BAAC0] uppercase tracking-wider font-semibold">Project Name:</span>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Project Name"
                    className="bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] text-[#17243B] dark:text-[#F1F5FC] font-semibold text-xs px-2.5 py-1 rounded-md focus:outline-none focus:border-[#2458D3] w-48 sm:w-64"
                  />
                </div>
                <div className="text-xs text-[#526078] dark:text-[#C2CDDC] font-mono tabular-nums">
                  {stagedFiles.length} source {stagedFiles.length === 1 ? 'file' : 'files'} staged · {(totalStagedSize / 1024).toFixed(1)} KB total
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (method === 'folder') folderInputRef.current?.click();
                    else if (method === 'zip') zipInputRef.current?.click();
                    else multiFileInputRef.current?.click();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1B2638] hover:bg-[#F4F6FA] dark:hover:bg-[#243247] text-[#17243B] dark:text-[#F1F5FC] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
                >
                  Change Selection
                </button>
                <button
                  onClick={clearStagedFiles}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1B2638] hover:bg-[#FCEBED] dark:hover:bg-[#3B1A1E] text-[#C33442] dark:text-[#F87171] text-xs font-medium border border-[#DCE3ED] dark:border-[#35445A] transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* Expandable Scan Options */}
            <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#243247]/50 border border-[#DCE3ED] dark:border-[#35445A]">
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="w-full p-3 flex items-center justify-between text-xs text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC] transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-[#2458D3] dark:text-[#4779E8]" />
                  <span className="font-semibold">Scan Options</span>
                </div>
                {showAdvancedOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvancedOptions && (
                <div className="px-3 pb-3 pt-1 border-t border-[#DCE3ED] dark:border-[#35445A] text-xs space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC] select-none">
                    <input
                      type="checkbox"
                      checked={excludeCommonDirs}
                      onChange={(e) => setExcludeCommonDirs(e.target.checked)}
                      className="rounded border-[#DCE3ED] dark:border-[#35445A] text-[#2458D3] focus:ring-0 bg-white dark:bg-[#1B2638]"
                    />
                    <span>Exclude common build & dependency folders (<code>node_modules</code>, <code>.git</code>, <code>dist</code>, <code>build</code>, <code>vendor</code>)</span>
                  </label>
                  <div className="text-xs text-[#68758A] dark:text-[#9BAAC0]">
                    Limits: Maximum 60 files per review · Up to 2MB per file · Plain text .txt files supported
                  </div>
                </div>
              )}
            </div>

            {/* Skipped files note if any */}
            {skippedNotice.length > 0 && (
              <div className="p-3 rounded-lg bg-[#FFF7EB] dark:bg-[#2E210A] border border-[#DCE3ED] dark:border-[#35445A] text-xs">
                <span className="text-[#946000] dark:text-[#F59E0B] block font-semibold mb-1">
                  Excluded {skippedNotice.length} non-source or ignored items:
                </span>
                <div className="max-h-20 overflow-y-auto space-y-0.5 font-mono text-xs text-[#526078] dark:text-[#C2CDDC]">
                  {skippedNotice.slice(0, 5).map((s, idx) => (
                    <div key={idx} className="truncate">{s}</div>
                  ))}
                  {skippedNotice.length > 5 && (
                    <div className="text-[#68758A] dark:text-[#9BAAC0]">...and {skippedNotice.length - 5} more</div>
                  )}
                </div>
              </div>
            )}

            {/* Filter Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#68758A] dark:text-[#9BAAC0] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter files by path or language..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#17243B] dark:text-[#F1F5FC] focus:outline-none focus:border-[#2458D3]"
              />
            </div>

            {/* Staged Files List */}
            <div className="max-h-72 overflow-y-auto border border-[#DCE3ED] dark:border-[#35445A] rounded-lg divide-y divide-[#DCE3ED] dark:divide-[#35445A] bg-white dark:bg-[#1B2638]">
              {filteredStagedFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-2.5 px-3 flex items-center justify-between text-xs hover:bg-[#F8FAFC] dark:hover:bg-[#243247] transition group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileCode className="w-3.5 h-3.5 text-[#2458D3] dark:text-[#4779E8] shrink-0" />
                    <span className="font-mono text-[#17243B] dark:text-[#F1F5FC] truncate text-xs">
                      {file.relativePath}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-[#F4F6FA] dark:bg-[#111827] border border-[#DCE3ED] dark:border-[#35445A] text-[#526078] dark:text-[#C2CDDC] shrink-0 font-semibold">
                      {file.language}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-[#68758A] dark:text-[#9BAAC0] text-xs font-mono tabular-nums">
                    <span>{file.lines} lines</span>
                    <span>·</span>
                    <span>{(file.size / 1024).toFixed(1)} KB</span>
                    <button
                      onClick={() => removeStagedFile(file.id)}
                      className="p-1 rounded text-[#68758A] dark:text-[#9BAAC0] hover:text-[#C33442] dark:hover:text-[#F87171] hover:bg-[#FCEBED] dark:hover:bg-[#3B1A1E] transition cursor-pointer"
                      title="Remove file from review"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Empty Drag & Drop Zone or Scratchpad Editor */
          method !== 'editor' ? (
            <div className="p-4 sm:p-8">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => {
                  if (method === 'folder') folderInputRef.current?.click();
                  else if (method === 'zip') zipInputRef.current?.click();
                  else multiFileInputRef.current?.click();
                }}
                className={`border border-dashed rounded-xl p-6 sm:p-12 text-center cursor-pointer transition ${
                  dragActive
                    ? 'border-[#2458D3] bg-[#EAF0FF] dark:bg-[#192A45]'
                    : 'border-[#DCE3ED] dark:border-[#35445A] hover:border-[#2458D3] dark:hover:border-[#4779E8] bg-[#F8FAFC] dark:bg-[#243247]/40 hover:bg-[#F4F6FA] dark:hover:bg-[#243247]/70'
                }`}
              >
                <div className="w-12 h-12 mx-auto rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] flex items-center justify-center mb-3 shadow-xs">
                  {method === 'folder' ? (
                    <Folder className="w-5 h-5 text-[#2458D3] dark:text-[#4779E8]" />
                  ) : method === 'zip' ? (
                    <FileArchive className="w-5 h-5 text-[#2458D3] dark:text-[#4779E8]" />
                  ) : (
                    <FileCode className="w-5 h-5 text-[#2458D3] dark:text-[#4779E8]" />
                  )}
                </div>

                <h3 className="text-sm font-bold text-[#17243B] dark:text-[#F1F5FC] mb-1 font-heading">
                  {method === 'folder'
                    ? 'Upload Project Folder'
                    : method === 'zip'
                    ? 'Upload ZIP Archive'
                    : 'Select Source Files'}
                </h3>

                <p className="text-xs text-[#526078] dark:text-[#C2CDDC] max-w-sm mx-auto mb-3 leading-relaxed">
                  {method === 'folder'
                    ? 'Click to select a local directory. Preserves relative file paths and excludes build dependencies.'
                    : method === 'zip'
                    ? 'Drop your project .zip archive here (up to 25MB). Extracted safely in-memory.'
                    : 'Select multiple source code or .txt snippet files to review together.'}
                </p>

                {!supportsFolderSelect && method === 'folder' && (
                  <div className="mb-3 text-xs text-[#946000] dark:text-[#F59E0B] bg-[#FFF7EB] dark:bg-[#38290D] p-2 rounded-lg max-w-xs mx-auto border border-[#DCE3ED] dark:border-[#35445A]">
                    Folder selection is not supported on this mobile browser. Please use the ZIP Archive or Select Files option.
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-[#68758A] dark:text-[#9BAAC0]">
                  <span>Relative paths preserved</span>
                  <span>·</span>
                  <span>Max 60 files</span>
                  <span>·</span>
                  <span>Up to 2MB/file</span>
                  <span>·</span>
                  <span>No code execution</span>
                </div>
              </div>
            </div>
          ) : (
            /* Method 4: Direct Code Editor */
            <div>
              <div className="px-4 py-2 border-b border-[#DCE3ED] dark:border-[#35445A] bg-[#F8FAFC] dark:bg-[#243247] text-xs font-mono text-[#68758A] dark:text-[#9BAAC0] flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[#2458D3] dark:text-[#4779E8]" />
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="source.py"
                    className="bg-transparent border-none text-[#17243B] dark:text-[#F1F5FC] focus:outline-none w-36 font-mono text-xs font-medium"
                  />
                </div>
                <span className="tabular-nums">{code.split('\n').length} lines · {code.length} chars</span>
              </div>

              <div className="flex bg-white dark:bg-[#131927]">
                <div 
                  aria-hidden="true"
                  className="hidden sm:block select-none w-12 py-3 text-right pr-3 font-mono text-xs text-[#68758A] dark:text-[#9BAAC0] border-r border-[#DCE3ED] dark:border-[#35445A] leading-6 bg-[#F8FAFC] dark:bg-[#1B2638]"
                >
                  {code.split('\n').map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                  {code.length === 0 && <div>1</div>}
                </div>

                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="// Paste source code here to review..."
                  spellCheck={false}
                  className="w-full h-80 sm:h-96 p-3 sm:p-4 font-mono text-xs sm:text-sm bg-transparent text-[#17243B] dark:text-[#F1F5FC] placeholder-[#68758A] dark:placeholder-[#9BAAC0] focus:outline-none resize-y leading-6 selection:bg-[#2458D3]/20 dark:selection:bg-[#4779E8]/30"
                />
              </div>
            </div>
          )
        )}

        {/* Bottom Actions Bar */}
        <div className="p-4 border-t border-[#DCE3ED] dark:border-[#35445A] bg-[#F8FAFC] dark:bg-[#243247] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#526078] dark:text-[#C2CDDC]">
            <Lock className="w-3.5 h-3.5 text-[#68758A] dark:text-[#9BAAC0] shrink-0" />
            <span>
              {stagedFiles.length > 0
                ? `${stagedFiles.length} files staged for review`
                : 'Supports folders, ZIP archives, loose files, and direct code'}
            </span>
          </div>

          <button
            onClick={handleStartReview}
            disabled={isLoading || (stagedFiles.length === 0 && code.trim().length === 0)}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-lg font-semibold text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
              stagedFiles.length === 0 && code.trim().length === 0
                ? 'bg-[#E3E8F0] dark:bg-[#243247] text-[#68758A] dark:text-[#9BAAC0] cursor-not-allowed border border-[#DCE3ED] dark:border-[#35445A]'
                : isLoading
                ? 'bg-[#EAF0FF] dark:bg-[#192A45] text-[#2458D3] dark:text-[#93C5FD] border border-[#2458D3]/40 cursor-wait'
                : 'bg-[#2458D3] hover:bg-[#1948B8] dark:bg-[#4779E8] dark:hover:bg-[#5B8BF0] text-white active:scale-95'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Analyzing Project Security...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>
                  {stagedFiles.length > 0
                    ? `Review Project (${stagedFiles.length} files)`
                    : 'Start Security Check'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Safety & Privacy Guarantee Card */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] space-y-1.5 text-xs text-[#526078] dark:text-[#C2CDDC] leading-relaxed shadow-xs">
        <div className="flex items-center gap-2 text-[#17243B] dark:text-[#F1F5FC] font-semibold">
          <Lock className="w-4 h-4 text-[#2458D3] dark:text-[#4779E8]" />
          <span>Source Handling & Review Safety</span>
        </div>
        <p className="text-xs text-[#526078] dark:text-[#C2CDDC]">
          Uploaded code is analyzed as text and is never executed. Static checks run on the local PatchProof server. If cloud AI consent is enabled, source content or excerpts may be sent to the selected provider; that provider's retention and training terms apply. Build and dependency folders (such as <code>node_modules</code> and <code>.git</code>) are excluded by default.
        </p>
      </div>
    </div>
  );
};
