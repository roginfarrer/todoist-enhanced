import { describe, expect, it } from 'vitest';
import { hireMailto, HIRE_EMAIL, seesHireNote } from './hireNote';

describe('seesHireNote', () => {
  it('accepts the author’s own address, and no other address at his domain', () => {
    expect(seesHireNote('jules.bertolino@alias-digital.fr')).toBe(true);
    expect(seesHireNote('someone@alias-digital.fr')).toBe(false);
  });

  it('accepts both company domains, in any case', () => {
    expect(seesHireNote('someone@todoist.com')).toBe(true);
    expect(seesHireNote('Someone@Doist.com')).toBe(true);
    expect(seesHireNote('  a.b@TODOIST.COM ')).toBe(true);
  });

  it('refuses lookalikes and other domains', () => {
    expect(seesHireNote('x@notdoist.com')).toBe(false);
    expect(seesHireNote('x@todoist.com.evil.io')).toBe(false);
    expect(seesHireNote('x@mail.todoist.com')).toBe(false);
    expect(seesHireNote('x@todoist.net')).toBe(false);
    expect(seesHireNote('doist.com@gmail.com')).toBe(false);
  });

  it('refuses what is not an address', () => {
    expect(seesHireNote(undefined)).toBe(false);
    expect(seesHireNote(null)).toBe(false);
    expect(seesHireNote('')).toBe(false);
    expect(seesHireNote('@todoist.com')).toBe(false);
    expect(seesHireNote('todoist.com')).toBe(false);
  });
});

describe('hireMailto', () => {
  it('encodes the subject', () => {
    expect(hireMailto('Hi & hello')).toBe(`mailto:${HIRE_EMAIL}?subject=Hi%20%26%20hello`);
  });
});
