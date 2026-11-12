/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusCircle, 
  LayoutDashboard, 
  Clock, 
  FileText, 
  Settings, 
  Menu, 
  X,
  FileCode2,
  Sliders,
  WifiOff,
  ChevronRight,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { PatchProofLogo } from './PatchProofLogo';
import { SystemStatus } from '../types/security';

export type NavigationTab = 'dashboard' | 'new-review' | 'results' | 'history' | 'reports' | 'settings' | 'dev-tools';

export interface SidebarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  hasActiveResults: boolean;
  systemStatus?: SystemStatus | null;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export interface HeaderProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  systemStatus?: SystemStatus | null;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileMenu: () => void;
}

const TAB_METADATA: Record<NavigationTab, { title: string; subtitle: string }> = {
  'dashboard': { title: 'Overview', subtitle: 'Security health and recent activity' },
  'new-review': { title: 'New Review', subtitle: 'Analyze code files or repositories' },
  'results': { title: 'Issues Found', subtitle: 'Identified issues and recommended fixes' },
  'history': { title: 'Review History', subtitle: 'Past security reviews and records' },
  'reports': { title: 'Reports', subtitle: 'Executive security summaries and exports' },
  'settings': { title: 'Settings', subtitle: 'Review preferences and data management' },
  'dev-tools': { title: 'Advanced Settings', subtitle: 'AI model configuration and offline mode' },
};

/**
 * Dedicated Desktop Sidebar and Mobile Navigation Shell.
 * Always renders in-flow on desktop (md+) as a dedicated flex column.
 * Never overlaps or underlaps the main content.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  hasActiveResults,
  systemStatus,
  theme = 'light',
  onToggleTheme,
  collapsed,
  onToggleCollapse,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const isOffline = systemStatus?.offlineMode;
  const activeProvider = systemStatus?.activeProvider || 'gemini';
  const activeModel = systemStatus?.activeModel || 'gemini-3.8-flash';

  const handleNav = (tab: NavigationTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Treat the mobile drawer as a modal: move focus inside, trap Tab, close on
  // Escape, and restore focus to the control that opened it.
  useEffect(() => {
    if (!mobileMenuOpen) return;

    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = mobileDialogRef.current;
    const getFocusable = () => Array.from(
      dialog?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    );
    const firstFocusable = getFocusable()[0];
    (firstFocusable ?? dialog)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const previousFocus = returnFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [mobileMenuOpen, setMobileMenuOpen]);

  return (
    <>
      {/* 1. DESKTOP DEDICATED IN-FLOW SIDEBAR (Visible on md+ screens: 768px and up) */}
      <aside 
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen bg-white dark:bg-[#1B2638] border-r border-[#DCE3ED] dark:border-[#35445A] z-30 select-none transition-all duration-200 ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
        aria-label="Main Navigation"
      >
        {/* Brand Lockup Header */}
        <div className={`h-16 flex items-center border-b border-[#DCE3ED] dark:border-[#35445A] ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
          <button 
            onClick={() => handleNav('dashboard')}
            className="flex items-center text-left group transition focus-visible:outline-2 focus-visible:outline-[#2458D3] cursor-pointer"
            aria-label="PatchProof Home"
            title="PatchProof Home"
          >
            {collapsed ? (
              <PatchProofLogo variant="square" size="sm" />
            ) : (
              <PatchProofLogo variant="full" size="md" showSubtitle={true} subtitleText="Code Security" />
            )}
          </button>

          {!collapsed && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-[#68758A] dark:text-[#9BAAC0] hover:text-[#17243B] dark:hover:text-[#F1F5FC] hover:bg-[#F4F6FA] dark:hover:bg-[#243247] transition cursor-pointer"
              title="Collapse sidebar to icon bar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Primary Navigation Links */}
        <div className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto min-h-0">
          {/* Overview */}
          <button
            onClick={() => handleNav('dashboard')}
            title={collapsed ? 'Overview' : undefined}
            aria-label="Overview"
            className={`w-full flex items-center rounded-lg text-xs font-medium transition cursor-pointer ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
            } ${
              activeTab === 'dashboard'
                ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] border border-[#2458D3]/30 dark:border-[#4779E8]/40 shadow-xs font-semibold'
                : 'text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC] hover:bg-[#F8FAFC] dark:hover:bg-[#243247]/70'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' ? 'text-[#2458D3] dark:text-[#4779E8]' : 'text-[#68758A] dark:text-[#9BAAC0]'}`} />
            {!collapsed && <span>Overview</span>}
          </button>

          {/* New Review */}
          <button
            onClick={() => handleNav('new-review')}
            title={collapsed ? 'New Review' : undefined}
            aria-label="New Review"
            className={`w-full flex items-center rounded-lg text-xs font-medium transition cursor-pointer ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
            } ${
              activeTab === 'new-review'
                ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] border border-[#2458D3]/30 dark:border-[#4779E8]/40 shadow-xs font-semibold'
                : 'text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC] hover:bg-[#F8FAFC] dark:hover:bg-[#243247]/70'
            }`}
          >
            <PlusCircle className={`w-4 h-4 shrink-0 ${activeTab === 'new-review' ? 'text-[#2458D3] dark:text-[#4779E8]' : 'text-[#68758A] dark:text-[#9BAAC0]'}`} />
            {!collapsed && <span>New Review</span>}
          </button>

          {/* Issues Found (Active Results) */}
          {hasActiveResults && (
            <button
              onClick={() => handleNav('results')}
              title={collapsed ? 'Issues Found (Active)' : undefined}
              aria-label="Issues Found"
              className={`w-full flex items-center rounded-lg text-xs font-medium transition cursor-pointer relative ${
                collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
              } ${
                activeTab === 'results'
                  ? 'bg-[#EAF0FF] dark:bg-[#192A45] text-[#2458D3] dark:text-[#93C5FD] border border-[#2458D3]/30 dark:border-[#4779E8]/40 shadow-xs font-semibold'
                  : 'text-[#2458D3] dark:text-[#93C5FD] hover:bg-[#F8FAFC] dark:hover:bg-[#243247]/70'
              }`}
            >
              <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
                <FileCode2 className="w-4 h-4 text-[#2458D3] dark:text-[#4779E8] shrink-0" />
                {!collapsed && <span>Issues Found</span>}
              </div>
              {collapsed ? (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2458D3] dark:bg-[#4779E8]" />
              ) : (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#2458D3]/10 dark:bg-[#4779E8]/20 text-[#2458D3] dark:text-[#93C5FD]">
                  Active
                </span>
              )}
            </button>
          )}

          {/* Review History */}
          <button
            onClick={() => handleNav('history')}
            title={collapsed ? 'Review History' : undefined}
            aria-label="Review History"
            className={`w-full flex items-center rounded-lg text-xs font-medium transition cursor-pointer ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
            } ${
              activeTab === 'history'
                ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] border border-[#2458D3]/30 dark:border-[#4779E8]/40 shadow-xs font-semibold'
                : 'text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC] hover:bg-[#F8FAFC] dark:hover:bg-[#243247]/70'
            }`}
          >
            <Clock className={`w-4 h-4 shrink-0 ${activeTab === 'history' ? 'text-[#2458D3] dark:text-[#4779E8]' : 'text-[#68758A] dark:text-[#9BAAC0]'}`} />
            {!collapsed && <span>Review History</span>}
          </button>

          {/* Reports */}
          <button
            onClick={() => handleNav('reports')}
            title={collapsed ? 'Reports' : undefined}
            aria-label="Reports"
            className={`w-full flex items-center rounded-lg text-xs font-medium transition cursor-pointer ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
            } ${
              activeTab === 'reports'
                ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] border border-[#2458D3]/30 dark:border-[#4779E8]/40 shadow-xs font-semibold'
                : 'text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC] hover:bg-[#F8FAFC] dark:hover:bg-[#243247]/70'
            }`}
          >
            <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'reports' ? 'text-[#2458D3] dark:text-[#4779E8]' : 'text-[#68758A] dark:text-[#9BAAC0]'}`} />
            {!collapsed && <span>Reports</span>}
          </button>

          {/* Divider */}
          <div className="pt-2 pb-1">
            <div className="border-t border-[#DCE3ED] dark:border-[#35445A]" />
          </div>

          {/* Settings */}
          <button
            onClick={() => handleNav('settings')}
            title={collapsed ? 'Settings' : undefined}
            aria-label="Settings"
            className={`w-full flex items-center rounded-lg text-xs font-medium transition cursor-pointer ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
            } ${
              activeTab === 'settings'
                ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] border border-[#2458D3]/30 dark:border-[#4779E8]/40 shadow-xs font-semibold'
                : 'text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC] hover:bg-[#F8FAFC] dark:hover:bg-[#243247]/70'
            }`}
          >
            <Settings className={`w-4 h-4 shrink-0 ${activeTab === 'settings' ? 'text-[#2458D3] dark:text-[#4779E8]' : 'text-[#68758A] dark:text-[#9BAAC0]'}`} />
            {!collapsed && <span>Settings</span>}
          </button>

          {/* Advanced Settings */}
          <button
            onClick={() => handleNav('dev-tools')}
            title={collapsed ? 'Advanced Settings' : undefined}
            aria-label="Advanced Settings"
            className={`w-full flex items-center rounded-lg text-xs font-medium transition cursor-pointer ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
            } ${
              activeTab === 'dev-tools'
                ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] border border-[#2458D3]/30 dark:border-[#4779E8]/40 shadow-xs font-semibold'
                : 'text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC] hover:bg-[#F8FAFC] dark:hover:bg-[#243247]/70'
            }`}
          >
            <Sliders className={`w-4 h-4 shrink-0 ${activeTab === 'dev-tools' ? 'text-[#2458D3] dark:text-[#4779E8]' : 'text-[#68758A] dark:text-[#9BAAC0]'}`} />
            {!collapsed && <span>Advanced Settings</span>}
          </button>
        </div>

        {/* Sidebar Footer */}
        <div className="p-2.5 border-t border-[#DCE3ED] dark:border-[#35445A] space-y-2">
          {/* Security Engine Card or Icon Button */}
          {collapsed ? (
            <button
              onClick={() => handleNav('dev-tools')}
              className="w-full flex items-center justify-center p-2 rounded-lg bg-[#F8FAFC] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] hover:border-[#2458D3] transition cursor-pointer"
              title={`Engine: ${isOffline ? 'Offline Mode' : activeProvider.toUpperCase()}`}
              aria-label="Security Engine Configuration"
            >
              {isOffline ? (
                <WifiOff className="w-4 h-4 text-[#946000] dark:text-[#F59E0B]" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-[#147A52] dark:bg-[#22C55E]" />
              )}
            </button>
          ) : (
            <button
              onClick={() => handleNav('dev-tools')}
              className="w-full p-2.5 rounded-lg bg-[#F8FAFC] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] hover:border-[#C4D0E0] dark:hover:border-[#425570] text-left transition group cursor-pointer"
              title="Configure security engine in Advanced Settings"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#68758A] dark:text-[#9BAAC0]">
                  Security Engine
                </span>
                <ChevronRight className="w-3 h-3 text-[#68758A] dark:text-[#9BAAC0] group-hover:text-[#17243B] dark:group-hover:text-[#F1F5FC] transition" />
              </div>
              <div className="mt-1 flex items-center gap-2">
                {isOffline ? (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-[#946000] dark:text-[#F59E0B]" />
                    <span className="text-xs font-semibold text-[#946000] dark:text-[#F59E0B]">Offline Mode</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-[#147A52] dark:bg-[#22C55E]" />
                    <span className="text-xs font-semibold text-[#17243B] dark:text-[#F1F5FC] truncate">
                      {activeProvider.toUpperCase()}
                    </span>
                  </>
                )}
              </div>
              <p className="text-[10px] text-[#68758A] dark:text-[#9BAAC0] mt-0.5 truncate">
                {isOffline ? 'Local pattern analysis' : activeModel}
              </p>
            </button>
          )}

          {/* Theme Toggle Button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={`w-full flex items-center rounded-lg text-xs font-medium text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC] hover:bg-[#F4F6FA] dark:hover:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer ${
                collapsed ? 'justify-center p-2' : 'justify-between px-3 py-1.5'
              }`}
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle visual theme"
            >
              <div className="flex items-center gap-2">
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-[#F59E0B]" /> : <Moon className="w-3.5 h-3.5 text-[#2458D3]" />}
                {!collapsed && <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>}
              </div>
              {!collapsed && (
                <span className="text-[10px] uppercase font-mono px-1 rounded bg-[#DCE3ED] dark:bg-[#243247] text-[#526078] dark:text-[#C2CDDC] font-semibold">
                  {theme}
                </span>
              )}
            </button>
          )}

          {/* Expand button when collapsed */}
          {collapsed && (
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center p-2 rounded-lg text-[#68758A] dark:text-[#9BAAC0] hover:text-[#17243B] dark:hover:text-[#F1F5FC] hover:bg-[#F4F6FA] dark:hover:bg-[#243247] transition cursor-pointer"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* 2. MOBILE SLIDE-OVER DRAWER MENU (Phone / Small screens) */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            ref={mobileDialogRef}
            tabIndex={-1}
            className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-[#1B2638] border-r border-[#DCE3ED] dark:border-[#35445A] p-5 flex flex-col justify-between shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#DCE3ED] dark:border-[#35445A]">
                <PatchProofLogo variant="full" size="md" showSubtitle={true} subtitleText="Code Security" />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC] cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation items */}
              <nav className="space-y-1">
                <button
                  onClick={() => handleNav('dashboard')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                    activeTab === 'dashboard' ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] font-semibold' : 'text-[#526078] dark:text-[#C2CDDC] hover:bg-[#F8FAFC] dark:hover:bg-[#243247]'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-[#2458D3] dark:text-[#4779E8]" />
                  <span>Overview</span>
                </button>

                <button
                  onClick={() => handleNav('new-review')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                    activeTab === 'new-review' ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] font-semibold' : 'text-[#526078] dark:text-[#C2CDDC] hover:bg-[#F8FAFC] dark:hover:bg-[#243247]'
                  }`}
                >
                  <PlusCircle className="w-4 h-4 text-[#2458D3] dark:text-[#4779E8]" />
                  <span>New Review</span>
                </button>

                {hasActiveResults && (
                  <button
                    onClick={() => handleNav('results')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                      activeTab === 'results' ? 'bg-[#EAF0FF] dark:bg-[#192A45] text-[#2458D3] dark:text-[#93C5FD] font-semibold' : 'text-[#2458D3] dark:text-[#93C5FD] hover:bg-[#F8FAFC] dark:hover:bg-[#243247]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileCode2 className="w-4 h-4 text-[#2458D3] dark:text-[#4779E8]" />
                      <span>Issues Found</span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#2458D3]/10 dark:bg-[#4779E8]/20 text-[#2458D3] dark:text-[#93C5FD]">
                      Active
                    </span>
                  </button>
                )}

                <button
                  onClick={() => handleNav('history')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                    activeTab === 'history' ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] font-semibold' : 'text-[#526078] dark:text-[#C2CDDC] hover:bg-[#F8FAFC] dark:hover:bg-[#243247]'
                  }`}
                >
                  <Clock className="w-4 h-4 text-[#2458D3] dark:text-[#4779E8]" />
                  <span>Review History</span>
                </button>

                <button
                  onClick={() => handleNav('reports')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                    activeTab === 'reports' ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] font-semibold' : 'text-[#526078] dark:text-[#C2CDDC] hover:bg-[#F8FAFC] dark:hover:bg-[#243247]'
                  }`}
                >
                  <FileText className="w-4 h-4 text-[#2458D3] dark:text-[#4779E8]" />
                  <span>Reports</span>
                </button>

                <div className="pt-2 pb-1 border-t border-[#DCE3ED] dark:border-[#35445A]" />

                <button
                  onClick={() => handleNav('settings')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                    activeTab === 'settings' ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] font-semibold' : 'text-[#526078] dark:text-[#C2CDDC] hover:bg-[#F8FAFC] dark:hover:bg-[#243247]'
                  }`}
                >
                  <Settings className="w-4 h-4 text-[#68758A] dark:text-[#9BAAC0]" />
                  <span>Settings</span>
                </button>

                <button
                  onClick={() => handleNav('dev-tools')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                    activeTab === 'dev-tools' ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] font-semibold' : 'text-[#526078] dark:text-[#C2CDDC] hover:bg-[#F8FAFC] dark:hover:bg-[#243247]'
                  }`}
                >
                  <Sliders className="w-4 h-4 text-[#68758A] dark:text-[#9BAAC0]" />
                  <span>Advanced Settings</span>
                </button>
              </nav>
            </div>

            {/* Mobile Footer Engine & Theme Toggle */}
            <div className="pt-4 border-t border-[#DCE3ED] dark:border-[#35445A] space-y-2">
              {onToggleTheme && (
                <button
                  onClick={onToggleTheme}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#F8FAFC] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] text-xs font-semibold text-[#17243B] dark:text-[#F1F5FC] cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {theme === 'dark' ? <Sun className="w-4 h-4 text-[#F59E0B]" /> : <Moon className="w-4 h-4 text-[#2458D3]" />}
                    <span>Theme: {theme === 'dark' ? 'Dark' : 'Light'}</span>
                  </div>
                  <span className="text-xs text-[#2458D3] dark:text-[#4779E8]">Switch</span>
                </button>
              )}

              <div className="p-2.5 rounded-lg bg-[#F8FAFC] dark:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] text-xs">
                <span className="text-[10px] text-[#68758A] dark:text-[#9BAAC0] uppercase tracking-wider block font-semibold">Security Engine</span>
                <span className="font-semibold text-[#17243B] dark:text-[#F1F5FC] block mt-0.5 truncate">
                  {isOffline ? 'Offline Mode (Local SAST)' : `${activeProvider.toUpperCase()} (${activeModel})`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MOBILE BOTTOM QUICK NAVIGATION BAR */}
      <nav 
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#1B2638]/95 backdrop-blur-md border-t border-[#DCE3ED] dark:border-[#35445A] flex items-center justify-around py-1.5 px-1 text-[11px] pb-safe transition-colors duration-150"
        aria-label="Mobile Bottom Navigation"
      >
        <button
          onClick={() => handleNav('dashboard')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-md cursor-pointer ${
            activeTab === 'dashboard' ? 'text-[#2458D3] dark:text-[#4779E8] font-bold' : 'text-[#526078] dark:text-[#C2CDDC]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => handleNav('new-review')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-md cursor-pointer ${
            activeTab === 'new-review' ? 'text-[#2458D3] dark:text-[#4779E8] font-bold' : 'text-[#526078] dark:text-[#C2CDDC]'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>New</span>
        </button>

        {hasActiveResults && (
          <button
            onClick={() => handleNav('results')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-md cursor-pointer ${
              activeTab === 'results' ? 'text-[#2458D3] dark:text-[#4779E8] font-bold' : 'text-[#2458D3] dark:text-[#93C5FD]'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            <span>Issues</span>
          </button>
        )}

        <button
          onClick={() => handleNav('history')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-md cursor-pointer ${
            activeTab === 'history' ? 'text-[#2458D3] dark:text-[#4779E8] font-bold' : 'text-[#526078] dark:text-[#C2CDDC]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>History</span>
        </button>

        <button
          onClick={() => handleNav('reports')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-md cursor-pointer ${
            activeTab === 'reports' ? 'text-[#2458D3] dark:text-[#4779E8] font-bold' : 'text-[#526078] dark:text-[#C2CDDC]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Reports</span>
        </button>
      </nav>
    </>
  );
};

/**
 * Top Navigation Header bar.
 * Positioned inside the main content column.
 * Always adapts to the remaining width beside the desktop sidebar.
 */
export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  systemStatus,
  theme = 'light',
  onToggleTheme,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileMenu,
}) => {
  const isOffline = systemStatus?.offlineMode;
  const activeProvider = systemStatus?.activeProvider || 'gemini';

  return (
    <header className="sticky top-0 z-20 w-full bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-[#DCE3ED] dark:border-[#35445A] transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4">
        {/* Mobile: Hamburger + Brand logo */}
        <div className="flex items-center gap-2.5 md:hidden">
          <button
            onClick={onOpenMobileMenu}
            className="p-2 rounded-lg text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC] hover:bg-[#F4F6FA] dark:hover:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] focus-visible:outline-2 focus-visible:outline-[#2458D3] cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center text-left cursor-pointer"
            aria-label="PatchProof Home"
          >
            <PatchProofLogo variant="full" size="sm" showSubtitle={false} />
          </button>
        </div>

        {/* Desktop: Sidebar collapse toggle + Breadcrumb Title */}
        <div className="hidden md:flex items-center gap-3 text-xs">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-[#68758A] dark:text-[#9BAAC0] hover:text-[#17243B] dark:hover:text-[#F1F5FC] hover:bg-[#F4F6FA] dark:hover:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[#68758A] dark:text-[#9BAAC0]">Workspace</span>
            <span className="text-[#68758A] dark:text-[#9BAAC0]">/</span>
            <span className="text-[#17243B] dark:text-[#F1F5FC] font-semibold">{TAB_METADATA[activeTab]?.title}</span>
          </div>
        </div>

        {/* Right Action Group */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Quick Theme Switch Icon */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg text-[#526078] dark:text-[#C2CDDC] hover:text-[#17243B] dark:hover:text-[#F1F5FC] hover:bg-[#F4F6FA] dark:hover:bg-[#243247] border border-[#DCE3ED] dark:border-[#35445A] transition cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle visual theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-[#F59E0B]" /> : <Moon className="w-4 h-4 text-[#2458D3]" />}
            </button>
          )}

          {/* Active Engine Indicator (Clickable to Advanced Settings) */}
          <button
            onClick={() => setActiveTab('dev-tools')}
            className={`hidden sm:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
              activeTab === 'dev-tools'
                ? 'bg-[#EAF0FF] dark:bg-[#243247] text-[#2458D3] dark:text-[#F1F5FC] border-[#2458D3]/30 dark:border-[#4779E8]/50'
                : 'bg-[#F8FAFC] dark:bg-[#1B2638] text-[#526078] dark:text-[#C2CDDC] border-[#DCE3ED] dark:border-[#35445A] hover:border-[#C4D0E0] dark:hover:border-[#425570]'
            }`}
            title="Click to manage model and provider settings"
          >
            {isOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-[#946000] dark:text-[#F59E0B]" />
                <span className="text-[#946000] dark:text-[#F59E0B] font-semibold">Offline</span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-[#147A52] dark:bg-[#22C55E]" />
                <span className="font-semibold">{activeProvider.toUpperCase()}</span>
              </>
            )}
          </button>

          {/* Prominent Primary Action: New Review */}
          {activeTab !== 'new-review' && (
            <button
              onClick={() => setActiveTab('new-review')}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg bg-[#2458D3] hover:bg-[#1948B8] dark:bg-[#4779E8] dark:hover:bg-[#5B8BF0] text-white text-xs font-semibold shadow-xs transition active:scale-95 shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline">New Review</span>
              <span className="xs:hidden">Review</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

/**
 * Combined Navbar export for standard layouts.
 */
export interface NavbarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  hasActiveResults: boolean;
  systemStatus?: SystemStatus | null;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = (props) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isCollapsed = props.sidebarCollapsed !== undefined ? props.sidebarCollapsed : internalCollapsed;
  const toggleCollapse = props.onToggleSidebar || (() => setInternalCollapsed(prev => !prev));

  return (
    <>
      <Sidebar
        {...props}
        collapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />
      <Header
        activeTab={props.activeTab}
        setActiveTab={props.setActiveTab}
        systemStatus={props.systemStatus}
        theme={props.theme}
        onToggleTheme={props.onToggleTheme}
        sidebarCollapsed={isCollapsed}
        onToggleSidebar={toggleCollapse}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
      />
    </>
  );
};
