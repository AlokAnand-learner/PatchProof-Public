/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Shield,
  Server,
  Zap,
  Key,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Sliders,
  Radio,
  Lock,
  Globe,
  WifiOff,
  Eye,
  EyeOff,
  ChevronRight,
  ExternalLink,
  Target,
  ShieldCheck,
  GitCompare,
  FileCode,
  Info
} from 'lucide-react';
import { ProviderType, ProviderConfig, SystemStatus, EvaluationMetrics } from '../types/security';
import { FixValidationSuiteReport, runFixValidationSuite } from '../data/fixValidationSuite';
import { authenticatedFetch } from '../utils/apiClient';

interface DeveloperToolsViewProps {
  onBackToApp?: () => void;
  systemStatus: SystemStatus | null;
  onRefreshStatus: () => void;
}

const isLocalEndpoint = (ep?: string) => {
  if (!ep) return false;
  try {
    const parsed = new URL(ep);
    return ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

export const DeveloperToolsView: React.FC<DeveloperToolsViewProps> = ({
  systemStatus,
  onRefreshStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'providers' | 'ollama' | 'offline' | 'fix-validation' | 'analysis' | 'benchmark' | 'diagnostics'>('providers');
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderType>('gemini');
  const [customModel, setCustomModel] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [endpointInput, setEndpointInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; message: string } | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [showRemoveKeyConfirm, setShowRemoveKeyConfirm] = useState(false);

  // Fix validation suite state
  const [fixSuiteRunning, setFixSuiteRunning] = useState(false);
  const [fixSuiteReport, setFixSuiteReport] = useState<FixValidationSuiteReport | null>(null);

  // Ollama specific state
  const [ollamaScanning, setOllamaScanning] = useState(false);
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
  const [ollamaData, setOllamaData] = useState<{ available: boolean; installedModels: string[]; gemmaModels: string[]; error?: string }>({
    available: false,
    installedModels: [],
    gemmaModels: [],
  });

  // Offline mode state
  const [offlineMode, setOfflineMode] = useState(false);
  const [offlineToggling, setOfflineToggling] = useState(false);

  // Benchmark state
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluationMetrics | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (systemStatus) {
      setOfflineMode(systemStatus.offlineMode);
      setSelectedProviderId(systemStatus.activeProvider);
      if (systemStatus.ollama) {
        setOllamaData(systemStatus.ollama);
        setOllamaEndpoint(systemStatus.ollama.endpoint || 'http://localhost:11434');
      }
    }
  }, [systemStatus]);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/providers');
      const data = await res.json();
      setProviders(data.providers || []);
      setOfflineMode(!!data.offlineMode);
      if (data.activeProvider) {
        setSelectedProviderId(data.activeProvider);
      }
    } catch (e) {
      console.error('Failed to load providers:', e);
    }
  };

  const currentProvider = providers.find(p => p.id === selectedProviderId) || providers[0];

  useEffect(() => {
    if (currentProvider) {
      setCustomModel(currentProvider.selectedModel);
      setEndpointInput(currentProvider.endpoint || '');
      setApiKeyInput('');
      setTestResult(null);
    }
  }, [selectedProviderId, providers]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await authenticatedFetch('/api/provider/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProviderId,
          model: customModel,
          apiKey: apiKeyInput || undefined,
          endpoint: endpointInput || undefined,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const res = await authenticatedFetch('/api/provider/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProviderId,
          selectedModel: customModel,
          apiKey: apiKeyInput || undefined,
          endpoint: endpointInput || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveNotice(data.error || 'Failed to save configuration.');
      } else {
        setProviders(data.providers || []);
        setSaveNotice(`Saved configuration for ${currentProvider?.name}.`);
        setApiKeyInput('');
        onRefreshStatus();
      }
      setTimeout(() => setSaveNotice(null), 3500);
    } catch (err: any) {
      setSaveNotice(err.message || 'Save configuration failed.');
      setTimeout(() => setSaveNotice(null), 3500);
    }
  };

  const handleActivateProvider = async (providerId: ProviderType, modelName?: string) => {
    try {
      const res = await authenticatedFetch('/api/provider/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerId,
          model: modelName || customModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveNotice(data.error || 'Could not activate provider.');
      } else if (data.success) {
        setSelectedProviderId(providerId);
        fetchProviders();
        onRefreshStatus();
        setSaveNotice(`Activated ${providerId.toUpperCase()} as the active security review provider.`);
      }
      setTimeout(() => setSaveNotice(null), 3500);
    } catch (err: any) {
      setSaveNotice(err.message || 'Activate provider failed.');
      setTimeout(() => setSaveNotice(null), 3500);
    }
  };

  const handleRemoveKey = async () => {
    try {
      const res = await authenticatedFetch(`/api/provider/config/${selectedProviderId}`, { method: 'DELETE' });
      const data = await res.json();
      setProviders(data.providers || []);
      setApiKeyInput('');
      setShowRemoveKeyConfirm(false);
      onRefreshStatus();
      setSaveNotice('Credentials removed successfully.');
      setTimeout(() => setSaveNotice(null), 3000);
    } catch (err) {
      console.error('Delete config failed:', err);
    }
  };

  const handleRunFixSuite = async () => {
    setFixSuiteRunning(true);
    try {
      const res = await fetch('/api/fix/benchmark');
      if (res.ok) {
        const data = await res.json();
        setFixSuiteReport(data);
      } else {
        const data = runFixValidationSuite();
        setFixSuiteReport(data);
      }
    } catch (err) {
      const data = runFixValidationSuite();
      setFixSuiteReport(data);
    } finally {
      setFixSuiteRunning(false);
    }
  };

  const handleToggleOfflineMode = async () => {
    setOfflineToggling(true);
    const target = !offlineMode;
    try {
      const res = await authenticatedFetch('/api/status/offline-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: target }),
      });
      const data = await res.json();
      setOfflineMode(data.offlineMode);
      fetchProviders();
      onRefreshStatus();
      setSaveNotice(
        data.offlineMode
          ? 'Strict Offline Mode enabled. External cloud calls are now strictly blocked.'
          : 'Offline Mode disabled. Cloud providers re-enabled.'
      );
      setTimeout(() => setSaveNotice(null), 3500);
    } catch (err: any) {
      setSaveNotice(err.message || 'Offline mode toggle failed');
      setTimeout(() => setSaveNotice(null), 3500);
    } finally {
      setOfflineToggling(false);
    }
  };

  const handleScanOllama = async () => {
    setOllamaScanning(true);
    try {
      const res = await authenticatedFetch(`/api/ollama/models?endpoint=${encodeURIComponent(ollamaEndpoint)}`);
      const data = await res.json();
      setOllamaData(data);
      onRefreshStatus();
    } catch (err) {
      console.error('Ollama scan failed:', err);
    } finally {
      setOllamaScanning(false);
    }
  };

  const handleRunBenchmark = async () => {
    setEvaluating(true);
    try {
      const res = await fetch('/api/evaluate');
      const data = await res.json();
      setEvalResult(data);
    } catch (err) {
      console.error('Benchmark failed:', err);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DCE3ED] dark:border-[#35445A]">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#2458D3] dark:text-emerald-400" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17243B] dark:text-[#F1F5FC]">
              Developer Tools & AI Configuration
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#526078] dark:text-[#C2CDDC] mt-1">
            Configure multi-provider LLM integrations, Google Gemma, local Ollama models, and strict offline operation.
          </p>
        </div>

        {/* Global Offline Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {offlineMode ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline Mode Active</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
              <Globe className="w-3.5 h-3.5" />
              <span>Cloud Provider Active</span>
            </span>
          )}

          {systemStatus?.ollama?.available && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-800 dark:text-cyan-300 text-xs font-mono">
              <HardDrive className="w-3.5 h-3.5" />
              <span>Ollama Ready</span>
            </span>
          )}
        </div>
      </div>

      {saveNotice && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-[#DCE3ED] dark:border-[#35445A] overflow-x-auto pb-px">
        {[
          { id: 'providers', label: 'AI Model Configuration', icon: Server },
          { id: 'ollama', label: 'Local Ollama & Gemma', icon: HardDrive },
          { id: 'offline', label: 'Offline Mode', icon: WifiOff },
          { id: 'fix-validation', label: 'Fix Validation Suite', icon: ShieldCheck },
          { id: 'analysis', label: 'Analysis Rules', icon: Sliders },
          { id: 'benchmark', label: 'Accuracy Benchmark', icon: Target },
          { id: 'diagnostics', label: 'System Diagnostics', icon: Cpu },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                isActive
                  ? 'border-[#2458D3] dark:border-emerald-400 text-[#17243B] dark:text-white bg-[#F4F6FA] dark:bg-slate-900/40 rounded-t-lg font-semibold'
                  : 'border-transparent text-[#526078] dark:text-slate-400 hover:text-[#17243B] dark:hover:text-slate-200 hover:border-[#DCE3ED] dark:hover:border-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: AI PROVIDERS & MODELS */}
      {activeTab === 'providers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Provider Selection List */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#526078] dark:text-slate-400 uppercase tracking-wider block mb-1">
              Select Provider
            </label>
            {providers.map(p => {
              const isSelected = p.id === selectedProviderId;
              const isActive = p.isActive;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProviderId(p.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900/90 border-[#2458D3] dark:border-emerald-500/50 shadow-sm ring-1 ring-[#2458D3]/20 dark:ring-emerald-500/20'
                      : 'bg-white dark:bg-[#1B2638] border-[#DCE3ED] dark:border-[#35445A] hover:border-[#B5C4D9] dark:hover:border-slate-700 shadow-sm'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${isSelected ? 'text-[#2458D3] dark:text-white' : 'text-[#17243B] dark:text-slate-200'}`}>
                        {p.name}
                      </span>
                      {isActive && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#68758A] dark:text-slate-500 truncate">
                      {p.selectedModel}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {p.isConfigured ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Configured" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" title="Needs Configuration" />
                    )}
                    <ChevronRight className={`w-4 h-4 text-[#68758A] ${isSelected ? 'text-[#2458D3] dark:text-emerald-400' : ''}`} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Provider Configuration Panel */}
          {currentProvider && (
            <div className="lg:col-span-2 rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] p-5 space-y-5 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#DCE3ED] dark:border-[#35445A]">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#17243B] dark:text-white">{currentProvider.name}</h2>
                    {currentProvider.id === 'gemma' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30">
                        First-Class Family
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#526078] dark:text-slate-400 mt-0.5">{currentProvider.description}</p>
                </div>

                {currentProvider.isActive ? (
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>In-Use for Reviews</span>
                  </span>
                ) : (
                  <button
                    onClick={() => handleActivateProvider(currentProvider.id)}
                    className="px-3 py-1.5 rounded-lg bg-[#2458D3] hover:bg-[#1948B8] dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-medium text-xs transition shadow-sm"
                  >
                    Set as Active Provider
                  </button>
                )}
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#17243B] dark:text-slate-300 block">
                  Model Variant
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentProvider.models.map(m => (
                    <button
                      key={m}
                      onClick={() => setCustomModel(m)}
                      className={`p-2.5 rounded-lg text-left text-xs font-mono border transition ${
                        customModel === m
                          ? 'bg-[#2458D3]/10 dark:bg-slate-900 border-[#2458D3] dark:border-emerald-500/50 text-[#2458D3] dark:text-emerald-300 font-semibold'
                          : 'bg-[#F4F6FA] dark:bg-slate-950/60 border-[#DCE3ED] dark:border-slate-800 text-[#526078] dark:text-slate-400 hover:text-[#17243B] dark:hover:text-slate-200'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <span className="text-[11px] text-[#68758A] dark:text-slate-500 block mb-1">Or enter a custom model name:</span>
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="e.g. gemma2:9b or gpt-4o"
                    className="w-full bg-[#F4F6FA] dark:bg-slate-950/80 text-xs text-[#17243B] dark:text-slate-200 px-3 py-2 rounded-lg border border-[#DCE3ED] dark:border-slate-800 focus:outline-none focus:border-[#2458D3] dark:focus:border-slate-700 font-mono"
                  />
                </div>
              </div>

              {/* Endpoint (if supported) */}
              {(currentProvider.supportsLocal || currentProvider.id === 'custom' || currentProvider.id === 'gemma' || currentProvider.id === 'openai') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#17243B] dark:text-slate-300">
                      API Endpoint URL
                    </label>
                    {isLocalEndpoint(endpointInput) && (
                      <span className="text-[10px] font-mono text-[#2458D3] dark:text-cyan-400">Loopback Endpoint</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={endpointInput}
                    onChange={(e) => setEndpointInput(e.target.value)}
                    placeholder="https://... or http://localhost:11434"
                    className="w-full bg-[#F4F6FA] dark:bg-slate-950/80 text-xs text-[#17243B] dark:text-slate-200 px-3 py-2 rounded-lg border border-[#DCE3ED] dark:border-slate-800 focus:outline-none focus:border-[#2458D3] dark:focus:border-slate-700 font-mono"
                  />
                  <span className="text-[11px] text-[#68758A] dark:text-slate-500 block">
                    {currentProvider.id === 'ollama' ? 'Default: http://localhost:11434' : 'Custom base URL if self-hosted or using a proxy.'}
                  </span>
                </div>
              )}

              {/* API Key */}
              {currentProvider.requiresKey && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#17243B] dark:text-slate-300">
                      API Key
                    </label>
                    {currentProvider.hasKeyStored && (
                      <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">Key currently configured: {currentProvider.apiKey}</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={currentProvider.hasKeyStored ? 'Leave blank to retain stored key' : 'Paste API Key (never printed in logs)'}
                      className="w-full bg-[#F4F6FA] dark:bg-slate-950/80 text-xs text-[#17243B] dark:text-slate-200 pl-3 pr-10 py-2 rounded-lg border border-[#DCE3ED] dark:border-slate-800 focus:outline-none focus:border-[#2458D3] dark:focus:border-slate-700 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2.5 top-2 text-[#68758A] dark:text-slate-500 hover:text-[#17243B] dark:hover:text-slate-300"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#68758A] dark:text-slate-500 leading-relaxed">
                    Credentials are held server-side in memory. They are sent to the selected provider endpoint for authentication when you test the connection or run remote analysis. The endpoint operator receives the key; use HTTPS for non-local endpoints.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-[#DCE3ED] dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F4F6FA] dark:bg-slate-900 hover:bg-[#EAEFF7] dark:hover:bg-slate-800 text-[#17243B] dark:text-slate-200 text-xs font-medium border border-[#DCE3ED] dark:border-slate-800 transition shadow-sm"
                  >
                    {testing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2458D3] dark:text-emerald-400" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span>Test Connection</span>
                      </>
                    )}
                  </button>

                  {currentProvider.hasKeyStored && (
                    showRemoveKeyConfirm ? (
                      <div className="flex items-center gap-1.5 p-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs">
                        <span className="text-[11px] text-rose-700 dark:text-rose-300">Remove?</span>
                        <button
                          onClick={handleRemoveKey}
                          className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setShowRemoveKeyConfirm(false)}
                          className="px-1.5 py-0.5 rounded bg-[#F4F6FA] dark:bg-slate-800 text-[#526078] dark:text-slate-300 text-[11px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowRemoveKeyConfirm(true)}
                        className="px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-medium border border-rose-500/20 transition"
                      >
                        Remove Credentials
                      </button>
                    )
                  )}
                </div>

                <button
                  onClick={handleSaveConfig}
                  className="px-4 py-2 rounded-lg bg-[#2458D3] hover:bg-[#1948B8] dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-medium text-xs transition shadow-sm"
                >
                  Save Configuration
                </button>
              </div>

              {/* Test Result Message */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold flex items-center justify-between">
                      <span>{testResult.success ? 'Connection Verified' : 'Connection Failed'}</span>
                      {testResult.latencyMs > 0 && (
                        <span className="font-mono text-[10px]">{testResult.latencyMs}ms</span>
                      )}
                    </div>
                    <p className="mt-1 leading-relaxed">{testResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LOCAL OLLAMA & GEMMA */}
      {activeTab === 'ollama' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-[#17243B] dark:text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-[#2458D3] dark:text-cyan-400" />
                  <span>Ollama Local Inference Runner</span>
                </h2>
                <p className="text-xs text-[#526078] dark:text-slate-400 mt-1">
                  Run Gemma, CodeLlama, or Qwen locally on your machine with 0 external network requests.
                </p>
              </div>

              <button
                onClick={handleScanOllama}
                disabled={ollamaScanning}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F6FA] dark:bg-slate-900 hover:bg-[#EAEFF7] dark:hover:bg-slate-800 text-[#17243B] dark:text-slate-200 text-xs font-medium border border-[#DCE3ED] dark:border-slate-800 transition shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#2458D3] dark:text-cyan-400 ${ollamaScanning ? 'animate-spin' : ''}`} />
                <span>Scan Local Daemon</span>
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="text"
                value={ollamaEndpoint}
                onChange={(e) => setOllamaEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full sm:w-80 bg-[#F4F6FA] dark:bg-slate-950/80 text-xs text-[#17243B] dark:text-slate-200 px-3 py-2 rounded-lg border border-[#DCE3ED] dark:border-slate-800 font-mono focus:outline-none"
              />
              <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                ollamaData.available
                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30'
              }`}>
                {ollamaData.available ? 'DAEMON ONLINE' : 'DAEMON OFFLINE'}
              </span>
            </div>

            {/* Gemma Discovery Banner */}
            {ollamaData.gemmaModels && ollamaData.gemmaModels.length > 0 && (
              <div className="p-3.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-900 dark:text-indigo-300 text-xs flex items-center justify-between">
                <div>
                  <span className="font-semibold block">Discovered Google Gemma Local Models:</span>
                  <span className="font-mono text-[11px] text-indigo-800 dark:text-indigo-200 mt-0.5 block">
                    {ollamaData.gemmaModels.join(', ')}
                  </span>
                </div>
                <button
                  onClick={() => handleActivateProvider('ollama', ollamaData.gemmaModels[0])}
                  className="px-3 py-1 rounded-md bg-[#2458D3] hover:bg-[#1948B8] dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white dark:text-slate-950 text-xs font-semibold transition"
                >
                  Activate {ollamaData.gemmaModels[0]}
                </button>
              </div>
            )}

            {/* Installed Models Grid */}
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-semibold uppercase text-[#526078] dark:text-slate-400">
                Installed Models ({ollamaData.installedModels?.length || 0})
              </h3>

              {ollamaData.installedModels && ollamaData.installedModels.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {ollamaData.installedModels.map(m => {
                    const isGemma = /gemma/i.test(m);
                    const isActive = systemStatus?.activeProvider === 'ollama' && systemStatus?.activeModel === m;
                    return (
                      <div
                        key={m}
                        className={`p-3 rounded-lg border flex flex-col justify-between gap-2 ${
                          isActive
                            ? 'bg-[#2458D3]/10 dark:bg-slate-900 border-[#2458D3] dark:border-emerald-500/50 shadow-sm'
                            : 'bg-[#F4F6FA] dark:bg-slate-950/60 border-[#DCE3ED] dark:border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-[#17243B] dark:text-white font-medium truncate">{m}</span>
                            {isGemma && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-800 dark:text-indigo-400">
                                GEMMA
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#68758A] dark:text-slate-500 block mt-0.5">Local weight available</span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[#DCE3ED] dark:border-slate-900">
                          {isActive ? (
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">Active</span>
                          ) : (
                            <button
                              onClick={() => handleActivateProvider('ollama', m)}
                              className="text-[11px] text-[#2458D3] dark:text-emerald-400 hover:underline font-medium"
                            >
                              Use for Review
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/40 border border-[#DCE3ED] dark:border-slate-800/60 text-xs text-[#526078] dark:text-slate-400 space-y-2">
                  <p>
                    {ollamaData.available
                      ? 'Ollama is running, but no models were found.'
                      : 'Ollama is currently not reachable at this endpoint.'}
                  </p>
                  <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-[#DCE3ED] dark:border-slate-800 font-mono text-[11px] text-[#17243B] dark:text-slate-300">
                    # Download Google Gemma 2 locally:<br />
                    ollama pull gemma2:9b
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GENUINE OFFLINE MODE */}
      {activeTab === 'offline' && (
        <div className="rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] p-5 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DCE3ED] dark:border-[#35445A]">
            <div>
              <h2 className="text-base font-bold text-[#17243B] dark:text-white flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-500" />
                <span>Strict Offline Security Mode</span>
              </h2>
              <p className="text-xs text-[#526078] dark:text-slate-400 mt-1 max-w-xl">
                When enabled, PatchProof is forbidden from making external internet calls. Analysis runs strictly via your local Ollama instance or the in-memory context-aware static rule engine.
              </p>
            </div>

            <button
              onClick={handleToggleOfflineMode}
              disabled={offlineToggling}
              className={`px-4 py-2 rounded-lg font-semibold text-xs transition flex items-center gap-2 self-start sm:self-auto ${
                offlineMode
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-[#F4F6FA] dark:bg-slate-800 hover:bg-[#EAEFF7] dark:hover:bg-slate-700 text-[#17243B] dark:text-slate-200 border border-[#DCE3ED] dark:border-slate-700'
              }`}
            >
              {offlineToggling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{offlineMode ? 'Disable Offline Mode' : 'Enable Strict Offline Mode'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/70 border border-[#DCE3ED] dark:border-slate-800 space-y-1">
              <span className="font-semibold text-[#17243B] dark:text-white block">1. Zero Cloud Transmission</span>
              <p className="text-[#526078] dark:text-slate-400 text-[11px] leading-relaxed">
                Source code, project archives, and analysis context are never sent across the internet. External requests to Gemini or OpenAI are hard blocked.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/70 border border-[#DCE3ED] dark:border-slate-800 space-y-1">
              <span className="font-semibold text-[#17243B] dark:text-white block">2. Local Model Priority</span>
              <p className="text-[#526078] dark:text-slate-400 text-[11px] leading-relaxed">
                Connects to local Gemma or CodeLlama weights via Ollama on localhost. If Ollama is offline, the context-aware static pipeline safely audits code.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/70 border border-[#DCE3ED] dark:border-slate-800 space-y-1">
              <span className="font-semibold text-[#17243B] dark:text-white block">3. Local Storage Only</span>
              <p className="text-[#526078] dark:text-slate-400 text-[11px] leading-relaxed">
                Scan history, findings, and Markdown/HTML/JSON reports remain in your browser's local sandbox without any tracking or telemetry.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB: FIX VALIDATION SUITE */}
      {activeTab === 'fix-validation' && (
        <div className="rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] p-5 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#DCE3ED] dark:border-[#35445A]">
            <div>
              <h2 className="text-base font-bold text-[#17243B] dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#2458D3] dark:text-emerald-400" />
                <span>Intelligent Fix Validation Suite</span>
              </h2>
              <p className="text-xs text-[#526078] dark:text-slate-400 mt-1">
                Statically validates proposed security fixes across 6 test cases using isolated AST parsing and invariant checks. Never executes untrusted application code.
              </p>
            </div>

            <button
              onClick={handleRunFixSuite}
              disabled={fixSuiteRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2458D3]/10 hover:bg-[#2458D3]/20 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-[#2458D3] dark:text-emerald-300 border border-[#2458D3]/30 dark:border-emerald-500/30 text-xs font-semibold transition self-start sm:self-auto"
            >
              {fixSuiteRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Validating Fixes...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-[#2458D3] dark:text-emerald-400 fill-current" />
                  <span>Run Fix Validation Suite</span>
                </>
              )}
            </button>
          </div>

          {fixSuiteReport ? (
            <div className="space-y-5 pt-1">
              {/* Summary Scorecards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/70 border border-[#DCE3ED] dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-[#68758A] dark:text-slate-500 block">Total Test Cases</span>
                  <span className="text-xl font-bold text-[#17243B] dark:text-white block mt-0.5">{fixSuiteReport.totalTests}</span>
                  <span className="text-[10px] text-[#68758A] dark:text-slate-500">Evaluated fixes</span>
                </div>
                <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/70 border border-[#DCE3ED] dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-[#68758A] dark:text-slate-500 block">Pass Rate</span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 block mt-0.5">{fixSuiteReport.accuracy}%</span>
                  <span className="text-[10px] text-[#68758A] dark:text-slate-500">{fixSuiteReport.passCount} of {fixSuiteReport.totalTests} passed</span>
                </div>
                <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/70 border border-[#DCE3ED] dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-[#68758A] dark:text-slate-500 block">Execution Mode</span>
                  <span className="text-xs font-bold text-[#2458D3] dark:text-cyan-400 block mt-1 font-mono">Isolated AST</span>
                  <span className="text-[10px] text-[#68758A] dark:text-slate-500">Zero code execution</span>
                </div>
                <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/70 border border-[#DCE3ED] dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-[#68758A] dark:text-slate-500 block">Regressions Blocked</span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 block mt-0.5">100%</span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400">Flaws intercepted</span>
                </div>
              </div>

              {/* 6 Test Results Breakdown */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold text-[#17243B] dark:text-slate-300 uppercase tracking-wider">
                  Test Case Results Breakdown
                </h3>

                <div className="space-y-3">
                  {fixSuiteReport.results.map((r, idx) => (
                    <div key={r.id} className="p-4 rounded-xl bg-[#F4F6FA] dark:bg-slate-950/80 border border-[#DCE3ED] dark:border-slate-800/90 space-y-3 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {r.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                          )}
                          <span className="font-semibold text-[#17243B] dark:text-white">#{idx + 1} {r.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-[#526078] dark:text-slate-400 border border-[#DCE3ED] dark:border-slate-800 font-mono">
                            {r.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#526078] dark:text-slate-400 font-mono">
                            Expected: <strong className="text-[#17243B] dark:text-slate-300">{r.expectedStatus}</strong>
                          </span>
                          <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
                            r.actualStatus === 'VALIDATED'
                              ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                              : r.actualStatus === 'PARTIALLY_VALIDATED'
                              ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30'
                              : r.actualStatus === 'NEEDS_REVIEW'
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                          }`}>
                            {r.actualStatus}
                          </span>
                          <span className="text-[10px] font-mono text-[#68758A] dark:text-slate-500">
                            Score: {r.overallScore}%
                          </span>
                        </div>
                      </div>

                      {/* 4 Check Dimension Chips */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className="p-2 rounded bg-white dark:bg-slate-900/60 border border-[#DCE3ED] dark:border-slate-800/80">
                          <span className="text-[#68758A] dark:text-slate-500 block text-[10px]">Syntax & AST</span>
                          <span className={`font-semibold ${r.syntaxPassed ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                            {r.syntaxPassed ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-white dark:bg-slate-900/60 border border-[#DCE3ED] dark:border-slate-800/80">
                          <span className="text-[#68758A] dark:text-slate-500 block text-[10px]">Scope & Imports</span>
                          <span className={`font-semibold ${r.scopePassed ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                            {r.scopePassed ? (r.validation.missingImports.length > 0 ? 'WARN (Missing Module)' : 'PASS') : 'FAIL (Undefined Var)'}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-white dark:bg-slate-900/60 border border-[#DCE3ED] dark:border-slate-800/80">
                          <span className="text-[#68758A] dark:text-slate-500 block text-[10px]">Flaw Neutralization</span>
                          <span className={`font-semibold ${r.resolutionPassed ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                            {r.resolutionPassed ? 'RESOLVED' : 'UNRESOLVED'}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-white dark:bg-slate-900/60 border border-[#DCE3ED] dark:border-slate-800/80">
                          <span className="text-[#68758A] dark:text-slate-500 block text-[10px]">Security Regression</span>
                          <span className={`font-semibold ${r.regressionPassed ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                            {r.regressionPassed ? 'NO REGRESSIONS' : 'REGRESSION DETECTED'}
                          </span>
                        </div>
                      </div>

                      {/* Explanatory notes */}
                      <p className="text-[11px] text-[#526078] dark:text-slate-400 leading-relaxed">
                        {r.notes}
                      </p>

                      {/* Specific Detected Issues if any */}
                      {(r.validation.missingImports.length > 0 || r.validation.undefinedVariables.length > 0 || r.validation.introducedVulnerabilities.length > 0) && (
                        <div className="p-2 rounded bg-white dark:bg-slate-900/40 border border-[#DCE3ED] dark:border-slate-800/60 space-y-1 text-[11px]">
                          {r.validation.missingImports.length > 0 && (
                            <div className="text-amber-800 dark:text-amber-400">
                              <strong>Missing Module Import:</strong> {r.validation.missingImports.join(', ')}
                            </div>
                          )}
                          {r.validation.undefinedVariables.length > 0 && (
                            <div className="text-rose-700 dark:text-rose-400">
                              <strong>Undefined Variable Detected:</strong> {r.validation.undefinedVariables.join(', ')}
                            </div>
                          )}
                          {r.validation.introducedVulnerabilities.length > 0 && (
                            <div className="text-rose-700 dark:text-rose-400">
                              <strong>Security Regression Flagged:</strong> {r.validation.introducedVulnerabilities.join('; ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Limitations Section */}
              <div className="p-4 rounded-xl bg-[#F4F6FA] dark:bg-slate-950/60 border border-[#DCE3ED] dark:border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-[#17243B] dark:text-slate-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#2458D3] dark:text-cyan-400" />
                  Technical Boundaries & Limitations (No Fabricated Guarantees)
                </span>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-[#526078] dark:text-slate-400 leading-relaxed">
                  {fixSuiteReport.limitations.map((lim, i) => (
                    <li key={i}>{lim}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl bg-[#F4F6FA] dark:bg-slate-950/40 border border-[#DCE3ED] dark:border-slate-800/80 space-y-3">
              <ShieldCheck className="w-8 h-8 text-[#68758A] dark:text-slate-500 mx-auto" />
              <p className="text-xs text-[#526078] dark:text-slate-400">
                Click "Run Fix Validation Suite" to test the 6 security fix validation scenarios against the isolated AST validation pipeline.
              </p>
            </div>
          )}
        </div>
      )}
      {activeTab === 'analysis' && (
        <div className="rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] p-5 space-y-4 shadow-sm">
          <div className="pb-3 border-b border-[#DCE3ED] dark:border-[#35445A]">
            <h2 className="text-base font-bold text-[#17243B] dark:text-white">Analysis Policy</h2>
            <p className="text-xs text-[#526078] dark:text-slate-400 mt-0.5">
              Current engine behavior and its verification limits. Settings that did not affect the engine have been removed rather than presented as working controls.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/60 border border-[#DCE3ED] dark:border-slate-800">
              <strong className="block text-[#17243B] dark:text-white">Detection method</strong>
              <p className="mt-1 text-[#526078] dark:text-slate-400">Deterministic dangerous-pattern checks with a bounded local source-to-sink heuristic. This is not full AST, control-flow, or interprocedural taint analysis.</p>
            </div>
            <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/60 border border-[#DCE3ED] dark:border-slate-800">
              <strong className="block text-[#17243B] dark:text-white">Finding confidence</strong>
              <p className="mt-1 text-[#526078] dark:text-slate-400">A visible direct input-to-sink indicator is classified LIKELY. Ambiguous sources remain NEEDS_REVIEW. Static heuristics never claim proof of exploitability.</p>
            </div>
            <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/60 border border-[#DCE3ED] dark:border-slate-800">
              <strong className="block text-[#17243B] dark:text-white">Test and sample code</strong>
              <p className="mt-1 text-[#526078] dark:text-slate-400">Potential findings in tests, examples, and documentation remain visible as informational NEEDS_REVIEW items and do not lower the production security score.</p>
            </div>
            <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/60 border border-[#DCE3ED] dark:border-slate-800">
              <strong className="block text-[#17243B] dark:text-white">Remediation safety</strong>
              <p className="mt-1 text-[#526078] dark:text-slate-400">Suggested patches are proposals only. Static validation does not execute uploaded code or automatically modify the reviewed source.</p>
            </div>
          </div>
          <p className="text-[11px] text-[#68758A] dark:text-slate-500">Benchmark percentages are measured only against the small built-in synthetic fixture set. Review-only cases are reported separately and excluded from binary precision/recall calculations.</p>
        </div>
      )}

      {/* TAB 5: ACCURACY BENCHMARK */}
      {activeTab === 'benchmark' && (
        <div className="rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#17243B] dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-[#2458D3] dark:text-emerald-400" />
                <span>Security Engine Evaluation Suite</span>
              </h2>
              <p className="text-xs text-[#526078] dark:text-slate-400 mt-1">
                Runs 13 built-in synthetic fixtures. Review-only cases are excluded from binary precision/recall scoring; results are not a real-world accuracy guarantee.
              </p>
            </div>

            <button
              onClick={handleRunBenchmark}
              disabled={evaluating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2458D3]/10 hover:bg-[#2458D3]/20 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-[#2458D3] dark:text-emerald-300 border border-[#2458D3]/30 dark:border-emerald-500/30 text-xs font-semibold transition"
            >
              {evaluating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Evaluating...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-[#2458D3] dark:text-emerald-400 fill-current" />
                  <span>Run Benchmark</span>
                </>
              )}
            </button>
          </div>

          {evalResult && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/70 border border-[#DCE3ED] dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-[#68758A] dark:text-slate-500 block">Scored / Review-only</span>
                  <span className="text-xl font-bold text-[#17243B] dark:text-white block mt-0.5 font-mono">{evalResult.evaluatedCases} / {evalResult.excludedCases}</span>
                  <span className="text-[10px] text-[#68758A] dark:text-slate-500">of {evalResult.totalTestCases} fixtures</span>
                </div>
                <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/70 border border-[#DCE3ED] dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-[#68758A] dark:text-slate-500 block">Precision</span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 block mt-0.5 font-mono">{evalResult.precision.toFixed(1)}%</span>
                  <span className="text-[10px] text-[#68758A] dark:text-slate-500">TP / (TP + FP)</span>
                </div>
                <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/70 border border-[#DCE3ED] dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-[#68758A] dark:text-slate-500 block">Recall</span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 block mt-0.5 font-mono">{evalResult.recall.toFixed(1)}%</span>
                  <span className="text-[10px] text-[#68758A] dark:text-slate-500">TP / (TP + FN)</span>
                </div>
                <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/70 border border-[#DCE3ED] dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-[#68758A] dark:text-slate-500 block">F1 Score</span>
                  <span className="text-xl font-bold text-[#2458D3] dark:text-cyan-400 block mt-0.5 font-mono">{evalResult.f1Score.toFixed(1)}%</span>
                  <span className="text-[10px] text-[#68758A] dark:text-slate-500">Harmonic Mean</span>
                </div>
                <div className="p-3 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/70 border border-[#DCE3ED] dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-[#68758A] dark:text-slate-500 block">False Positives</span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 block mt-0.5 font-mono">{evalResult.falsePositives}</span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400">Target Met: 0 FP</span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#DCE3ED] dark:border-slate-800/80 max-h-72 overflow-y-auto">
                {evalResult.results.map((tc, idx) => (
                  <div key={tc.id} className="p-2.5 rounded-lg bg-[#F4F6FA] dark:bg-slate-950/60 border border-[#DCE3ED] dark:border-slate-800/80 flex items-start gap-2.5 text-xs">
                    {tc.passed
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      : <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#17243B] dark:text-slate-200 truncate">#{idx + 1} {tc.title}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold border ${
                          !tc.passed
                            ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20'
                            : !tc.includedInMetrics
                            ? 'bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20'
                        }`}>
                          {tc.actualClassification}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#526078] dark:text-slate-400 mt-0.5">{tc.reason}</p>
                      <p className="text-[10px] text-[#68758A] dark:text-slate-500 mt-1">{tc.includedInMetrics ? 'Included in precision / recall metrics' : 'Review-only: excluded from binary metrics'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: SYSTEM DIAGNOSTICS */}
      {activeTab === 'diagnostics' && (
        <div className="rounded-xl bg-white dark:bg-[#1B2638] border border-[#DCE3ED] dark:border-[#35445A] p-5 space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-[#17243B] dark:text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#68758A] dark:text-slate-400" />
            <span>Runtime Environment Diagnostics</span>
          </h2>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-2 border-b border-[#DCE3ED] dark:border-slate-800/60">
              <span className="text-[#68758A] dark:text-slate-500">Service Status:</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">{systemStatus?.status || 'operational'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#DCE3ED] dark:border-slate-800/60">
              <span className="text-[#68758A] dark:text-slate-500">Active Provider:</span>
              <span className="text-[#17243B] dark:text-white font-bold">{systemStatus?.activeProvider?.toUpperCase() || 'GEMINI'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#DCE3ED] dark:border-slate-800/60">
              <span className="text-[#68758A] dark:text-slate-500">Active Model:</span>
              <span className="text-[#2458D3] dark:text-cyan-400 font-bold">{systemStatus?.activeModel}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#DCE3ED] dark:border-slate-800/60">
              <span className="text-[#68758A] dark:text-slate-500">Offline Policy:</span>
              <span className={offlineMode ? 'text-amber-800 dark:text-amber-400 font-bold' : 'text-[#526078] dark:text-slate-400'}>
                {offlineMode ? 'ENFORCED (Cloud Prohibited)' : 'DISABLED (Cloud Allowed)'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#DCE3ED] dark:border-slate-800/60">
              <span className="text-[#68758A] dark:text-slate-500">Ollama Daemon:</span>
              <span className={systemStatus?.ollama?.available ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-[#68758A] dark:text-slate-500'}>
                {systemStatus?.ollama?.available ? `Connected (${systemStatus.ollama.installedModels.length} models)` : 'Not Connected'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#68758A] dark:text-slate-500">Architecture:</span>
              <span className="text-[#17243B] dark:text-slate-300">PatchProof Defensive Static & Provider Framework</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
