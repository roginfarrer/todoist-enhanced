/**
 * Whether to offer the Mac app, and which file.
 *
 * A browser cannot be trusted to say which Mac it runs on: Safari and Chrome
 * both put "Intel" in the user agent on Apple silicon. Only Chromium can be
 * asked (`userAgentData`); everywhere else the answer is "not sure", and the
 * card then offers both files rather than guess wrong.
 */
export type MacArch = 'arm64' | 'x64';

export interface BrowserEnv {
  /** `navigator.userAgentData.platform`, Chromium only. */
  uaPlatform?: string;
  /** `navigator.platform`, the fallback everywhere else. */
  platform?: string;
  maxTouchPoints?: number;
}

/** A Mac computer. An iPad can report itself as a Mac, but it has a touch screen and a Mac does not. */
export function isMacComputer(env: BrowserEnv): boolean {
  const mac = env.uaPlatform ? env.uaPlatform === 'macOS' : /Mac/.test(env.platform ?? '');
  return mac && (env.maxTouchPoints ?? 0) <= 1;
}

/** The file for a Chromium "architecture" hint (`arm` or `x86`), or null when it is anything else. */
export function archFromHint(architecture: string | undefined): MacArch | null {
  if (architecture === 'arm') return 'arm64';
  if (architecture === 'x86') return 'x64';
  return null;
}
