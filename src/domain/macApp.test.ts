import { describe, expect, it } from 'vitest';
import { archFromHint, isMacComputer } from './macApp';

describe('isMacComputer', () => {
  it('knows a Mac from its platform, in Chromium or elsewhere', () => {
    expect(isMacComputer({ uaPlatform: 'macOS', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(true);
    expect(isMacComputer({ platform: 'MacIntel', maxTouchPoints: 0 })).toBe(true);
  });

  it('is not fooled by an iPad that says it is a Mac', () => {
    expect(isMacComputer({ platform: 'MacIntel', maxTouchPoints: 5 })).toBe(false);
  });

  it('says no on Windows, Linux and phones', () => {
    expect(isMacComputer({ uaPlatform: 'Windows', platform: 'Win32', maxTouchPoints: 0 })).toBe(false);
    expect(isMacComputer({ platform: 'Linux x86_64' })).toBe(false);
    expect(isMacComputer({ platform: 'iPhone', maxTouchPoints: 5 })).toBe(false);
  });
});

describe('archFromHint', () => {
  it('maps the two architectures a Mac has', () => {
    expect(archFromHint('arm')).toBe('arm64');
    expect(archFromHint('x86')).toBe('x64');
  });

  it('stays unsure about anything else', () => {
    expect(archFromHint(undefined)).toBeNull();
    expect(archFromHint('')).toBeNull();
    expect(archFromHint('mips')).toBeNull();
  });
});
