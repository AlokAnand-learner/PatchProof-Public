/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('===========================================================');
console.log('   PATCHPROOF RESPONSIVE LAYOUT & SIDEBAR AUDIT SUITE      ');
console.log('===========================================================');

let testsPassed = 0;
let testsFailed = 0;

function pass(name: string) {
  testsPassed++;
  console.log(`[✓ PASS] ${name}`);
}

function fail(name: string, reason: string) {
  testsFailed++;
  console.error(`[✗ FAIL] ${name} - ${reason}`);
}

// 1. App.tsx layout inspection
const appSource = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');

// Ensure root is flex-row on desktop (md:flex-row)
if (appSource.includes('md:flex-row') && appSource.includes('flex flex-col')) {
  pass('App.tsx uses responsive flex-row shell (flex flex-col md:flex-row)');
} else {
  fail('App.tsx flex shell', 'Missing flex flex-col md:flex-row on root container');
}

// Ensure main content column has min-w-0 and flex-1 to prevent flex children blowout
if (appSource.includes('flex-1 flex flex-col min-w-0 w-full')) {
  pass('Main content column has min-w-0 and flex-1 for automatic width reclamation');
} else {
  fail('Main content column', 'Missing min-w-0 or flex-1 on main column container');
}

// Ensure fragile md:pl-64 is completely eliminated
if (!appSource.includes('md:pl-64')) {
  pass('Fragile md:pl-64 offset eliminated from App.tsx (main, footer, errorBanner)');
} else {
  fail('md:pl-64 check', 'App.tsx still contains hardcoded md:pl-64 offset');
}

// 2. Navbar.tsx layout inspection
const navbarSource = fs.readFileSync(path.join(process.cwd(), 'src/components/Navbar.tsx'), 'utf-8');

// Ensure Sidebar is in document flow on desktop (not fixed inset-y-0 left-0)
if (navbarSource.includes('shrink-0 sticky top-0 h-screen') && !navbarSource.includes('fixed inset-y-0 left-0 w-64')) {
  pass('Desktop sidebar renders in-flow (shrink-0 sticky top-0 h-screen) preventing content overlap');
} else {
  fail('Sidebar in-flow layout', 'Sidebar still has fixed inset-y-0 left-0 on desktop');
}

// Ensure Sidebar supports collapsed state with w-[72px]
if (navbarSource.includes("collapsed ? 'w-[72px]' : 'w-64'")) {
  pass('Sidebar supports dynamic collapse from w-64 to compact w-[72px] icon bar');
} else {
  fail('Sidebar collapse support', 'Missing dynamic w-[72px] collapse width');
}

// Ensure header adapts to remaining width without md:pl-64
if (navbarSource.includes('sticky top-0 z-20 w-full') && !navbarSource.includes('md:pl-64')) {
  pass('Header spans remaining content area width cleanly without md:pl-64 hack');
} else {
  fail('Header width layout', 'Header still relies on md:pl-64');
}

// Ensure mobile drawer exists with accessible dialog role
if (navbarSource.includes('role="dialog"') && navbarSource.includes('aria-modal="true"')) {
  pass('Mobile drawer uses accessible dialog semantics (role="dialog", aria-modal="true")');
} else {
  fail('Mobile drawer accessibility', 'Missing role="dialog" or aria-modal="true"');
}

if (navbarSource.includes('mobileDialogRef') && navbarSource.includes('querySelectorAll<HTMLElement>')) {
  pass('Mobile navigation moves focus into its modal dialog');
} else {
  fail('Mobile drawer focus entry', 'Missing dialog focus target or focusable-element query');
}
if (navbarSource.includes('event.shiftKey') && navbarSource.includes('last.focus()') && navbarSource.includes('first.focus()')) {
  pass('Mobile navigation traps forward and reverse Tab focus inside the dialog');
} else {
  fail('Mobile drawer focus trap', 'Missing forward/reverse Tab focus wrapping');
}
if (navbarSource.includes('previousFocus.focus()') && navbarSource.includes('event.key === \'Escape\'')) {
  pass('Mobile navigation closes on Escape and restores the previous focus');
} else {
  fail('Mobile drawer focus restoration', 'Missing Escape handling or focus restoration');
}

// Ensure mobile bottom nav has pb-safe for notched mobile devices
if (navbarSource.includes('pb-safe') && navbarSource.includes('md:hidden fixed bottom-0')) {
  pass('Mobile bottom navigation bar includes safe-area padding (pb-safe)');
} else {
  fail('Mobile bottom nav', 'Missing pb-safe or mobile bottom fixed layout');
}

if (navbarSource.includes('min-h-11 min-w-11')) {
  pass('Mobile bottom navigation controls meet minimum 44px touch target dimensions');
} else {
  fail('Mobile bottom nav touch targets', 'Missing minimum 44px touch target sizing');
}

// 3. Viewport Breakpoints & Fluid CSS in index.css
const indexCss = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');

if (indexCss.includes('clamp(') && indexCss.includes('pb-safe') && indexCss.includes('--bg-primary')) {
  pass('index.css includes fluid clamp typography, safe-area utilities, and theme tokens');
} else {
  fail('index.css tokens', 'Missing clamp or safe area definitions');
}

// Respect system accessibility preferences for reduced motion.
if (indexCss.includes('@media (prefers-reduced-motion: reduce)') &&
    indexCss.includes('animation-duration: 0.01ms !important') &&
    indexCss.includes('transition-duration: 0.01ms !important')) {
  pass('Global reduced-motion preference limits non-essential animation and transitions');
} else {
  fail('Reduced motion support', 'Missing prefers-reduced-motion override');
}

console.log('===========================================================');
console.log(`Results: ${testsPassed} passed, ${testsFailed} failed.`);
if (testsFailed === 0) {
  console.log('✓ ALL RESPONSIVE LAYOUT & SIDEBAR OVERLAP CHECKS PASSED.');
  process.exit(0);
} else {
  console.error('✗ SOME LAYOUT CHECKS FAILED.');
  process.exit(1);
}
