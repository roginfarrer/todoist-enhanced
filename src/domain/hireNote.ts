/**
 * A single note for the people who make Todoist.
 *
 * It exists for one kind of account and shows once. The test is on the
 * address' domain, read in the browser from the account the app is already
 * signed in to: nothing is sent anywhere, and nobody is told that it matched.
 */
export const HIRE_EMAIL = 'jules.bertolino@alias-digital.fr';
export const HIRE_LINKEDIN_URL = 'https://www.linkedin.com/in/julesbertolino/';

/** The company renamed itself from Doist to Todoist; both addresses are in use. */
const DOMAINS = ['todoist.com', 'doist.com'];

/** The author's own address, so he can see the note on his own account: the one address at that domain, nobody else's. */
const OWN_ADDRESSES = ['jules.bertolino@alias-digital.fr'];

/** The exact domain, not a substring: "notdoist.com" and "todoist.com.evil.io" do not count. */
export function seesHireNote(email: string | null | undefined): boolean {
  if (typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  const at = clean.lastIndexOf('@');
  if (at < 1) return false;
  return DOMAINS.includes(clean.slice(at + 1)) || OWN_ADDRESSES.includes(clean);
}

export const hireMailto = (subject: string): string =>
  `mailto:${HIRE_EMAIL}?subject=${encodeURIComponent(subject)}`;
