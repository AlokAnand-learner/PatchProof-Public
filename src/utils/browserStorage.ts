/**
 * Safe access to non-sensitive browser preferences.
 * Storage can be unavailable or throw (for example, in restricted browser modes).
 * UI state must remain usable even when preference persistence is unavailable.
 */
export function readBrowserPreference(key: string): string | null {
  if (typeof key !== 'string' || key.length === 0 || key.length > 200) return null;
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeBrowserPreference(key: string, value: string): boolean {
  if (typeof key !== 'string' || key.length === 0 || key.length > 200 ||
      typeof value !== 'string' || value.length > 1000) return false;
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
