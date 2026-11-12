/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface PatchProofLogoProps {
  /**
   * 'icon': Shield mark only
   * 'full': Shield mark + PatchProof wordmark + optional subtitle
   * 'square': Shield mark centered inside a rounded app-icon squircle
   */
  variant?: 'icon' | 'full' | 'square';
  /** Size presets for both icon and typography */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Custom additional CSS classes on outer container */
  className?: string;
  /** Whether to render subtitle in 'full' variant */
  showSubtitle?: boolean;
  /** Custom subtitle text (default: "Code Security") */
  subtitleText?: string;
  /** Explicit color mode override, defaults to 'auto' (reacts to .dark class) */
  theme?: 'light' | 'dark' | 'auto';
}

/**
 * Geometric Shield Symbol with Center Verification Checkmark
 * Vector flat design with deep navy left facet, royal blue right facet, and crisp white checkmark.
 */
export const PatchProofShieldSvg: React.FC<{
  sizePx?: number;
  className?: string;
  theme?: 'light' | 'dark' | 'auto';
}> = ({ sizePx = 28, className = '', theme = 'auto' }) => {
  // Deep navy colors
  const navyClass = theme === 'dark' 
    ? 'fill-[#122347]' 
    : theme === 'light' 
      ? 'fill-[#0F1D38]' 
      : 'fill-[#0F1D38] dark:fill-[#122347]';

  // Royal blue colors
  const blueClass = theme === 'dark' 
    ? 'fill-[#3978F6]' 
    : theme === 'light' 
      ? 'fill-[#2458D3]' 
      : 'fill-[#2458D3] dark:fill-[#3978F6]';

  return (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-colors duration-150 ${className}`}
      aria-hidden="true"
    >
      {/* Left Facet: Deep Navy */}
      <path
        d="M16 3.2L6 6.8V16.8C6 23.2 10.4 27.5 16 29.2V3.2Z"
        className={navyClass}
      />
      {/* Right Facet: Royal Blue */}
      <path
        d="M16 3.2L26 6.8V16.8C26 23.2 21.6 27.5 16 29.2V3.2Z"
        className={blueClass}
      />
      {/* Verification Checkmark: Clean Geometric White */}
      <path
        d="M11 16.2L14.7 20.1L21.5 12.8"
        stroke="#FFFFFF"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const PatchProofLogo: React.FC<PatchProofLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  showSubtitle = true,
  subtitleText = 'Code Security',
  theme = 'auto'
}) => {
  // Dimensions map
  const sizeConfig = {
    xs: { iconPx: 16, boxPx: 22, text: 'text-xs', sub: 'text-[9px]', gap: 'gap-1.5' },
    sm: { iconPx: 20, boxPx: 28, text: 'text-sm', sub: 'text-[10px]', gap: 'gap-2' },
    md: { iconPx: 24, boxPx: 34, text: 'text-sm font-semibold', sub: 'text-[11px]', gap: 'gap-2.5' },
    lg: { iconPx: 32, boxPx: 44, text: 'text-base font-bold', sub: 'text-xs', gap: 'gap-3' },
    xl: { iconPx: 40, boxPx: 56, text: 'text-xl font-bold', sub: 'text-xs', gap: 'gap-3.5' }
  }[size];

  // 1. Icon only variant
  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        <PatchProofShieldSvg sizePx={sizeConfig.iconPx} theme={theme} />
      </div>
    );
  }

  // 2. Square app-icon container variant (Ideal for app launcher, cards, or standalone badge)
  if (variant === 'square') {
    const bgClass = theme === 'dark'
      ? 'bg-[#141B2A] border-[#222D42]'
      : theme === 'light'
        ? 'bg-[#EFF4FE] border-[#D5E2FC]'
        : 'bg-[#EFF4FE] dark:bg-[#141B2A] border-[#D5E2FC] dark:border-[#222D42]';

    return (
      <div
        style={{ width: sizeConfig.boxPx, height: sizeConfig.boxPx }}
        className={`inline-flex items-center justify-center rounded-xl border shadow-xs transition-colors shrink-0 ${bgClass} ${className}`}
        title="PatchProof"
      >
        <PatchProofShieldSvg sizePx={sizeConfig.iconPx} theme={theme} />
      </div>
    );
  }

  // 3. Full Brand Lockup: Symbol + Wordmark ("Patch" in dark slate + "Proof" in royal blue)
  return (
    <div className={`inline-flex items-center ${sizeConfig.gap} ${className}`}>
      {/* Square Icon Holder */}
      <div
        style={{ width: sizeConfig.boxPx, height: sizeConfig.boxPx }}
        className="inline-flex items-center justify-center rounded-lg bg-[#EFF4FE] dark:bg-[#172238] border border-[#D5E2FC] dark:border-[#263756] shadow-xs shrink-0 transition-colors duration-150"
      >
        <PatchProofShieldSvg sizePx={sizeConfig.iconPx} theme={theme} />
      </div>

      {/* Typography Wordmark */}
      <div className="flex flex-col text-left leading-none justify-center">
        <div className={`tracking-tight ${sizeConfig.text} font-bold flex items-center`}>
          <span className="text-[#17243B] dark:text-[#F1F4FA] font-bold">Patch</span>
          <span className="text-[#2458D3] dark:text-[#3978F6] font-extrabold">Proof</span>
        </div>
        {showSubtitle && (
          <p className={`${sizeConfig.sub} text-[#66748B] dark:text-[#77849A] font-medium mt-0.5 tracking-normal leading-tight`}>
            {subtitleText}
          </p>
        )}
      </div>
    </div>
  );
};
