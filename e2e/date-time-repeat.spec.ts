import { test, expect } from './demo';
import type { Page } from '@playwright/test';

/* #202: Time, Duration and Repeat at the foot of the date picker. */

const chip = (page: Page) => page.locator('.composer-chips .datefield .fselect-face').first();
const picker = (page: Page) => page.locator('.datepanel .datepicker');
const row = (page: Page, name: string) => picker(page).locator('.pickerrow-open').filter({ hasText: name });

async function openComposerDate(page: Page) {
  await page.getByRole('button', { name: 'Add task', exact: true }).first().click();
  await chip(page).click();
  await expect(picker(page)).toBeVisible();
}

test('the picker ends with Time, Duration and Repeat, one line each', async ({ demo: page }) => {
  await openComposerDate(page);
  await expect(picker(page).locator('.pickerrow-open')).toHaveText([/Time/, /Duration/, /Repeat/]);
});

test('a time and a duration are typed in their own fields and kept when the day changes', async ({ demo: page }) => {
  await openComposerDate(page);
  await row(page, 'Time').click();
  const time = page.locator('#datepicker-time-field');
  await expect(time).toBeFocused();
  await expect(page.locator('.combo-list')).toHaveCount(0);
  await time.fill('20:30');
  await time.press('Enter');
  await expect(chip(page)).toContainText('20:30');

  await chip(page).click();
  await row(page, 'Duration').click();
  const duration = page.locator('#datepicker-duration');
  await duration.fill('45');
  await duration.press('Enter');
  await expect(row(page, 'Duration')).toContainText('45 min');

  await picker(page).locator('.datepicker-field input').fill('friday');
  await picker(page).locator('.datepicker-field input').press('Enter');
  await expect(chip(page)).toContainText('20:30');
});

test('a repeat preset carries the time, and removing the time rewrites the rule', async ({ demo: page }) => {
  await openComposerDate(page);
  await row(page, 'Time').click();
  await page.locator('#datepicker-time-field').fill('9:30');
  await page.locator('#datepicker-time-field').press('Enter');

  await chip(page).click();
  await row(page, 'Repeat').click();
  await picker(page).locator('.opt').filter({ hasText: 'Every day' }).click();
  await expect(chip(page)).toHaveClass(/crepeat/);
  await expect(chip(page)).toHaveAttribute('title', /^every day at 9:30/);

  await chip(page).click();
  await picker(page).locator('.pickerrow').filter({ hasText: 'Time' }).locator('.pickerrow-clear').click();
  await expect(chip(page)).toHaveAttribute('title', /^every day( starting \S+)?$/);
  await chip(page).click();
  await expect(row(page, 'Time')).not.toContainText(':');
});

test('Custom… opens over the picker, and Escape goes back one step at a time', async ({ demo: page }) => {
  await openComposerDate(page);
  await row(page, 'Repeat').click();
  await picker(page).locator('.opt').filter({ hasText: 'Custom' }).click();
  const dialog = page.getByRole('dialog', { name: 'Custom repeat' });
  await expect(dialog).toBeVisible();

  await dialog.locator('.fselect-face').click();
  await page.locator('.popover.listbox').getByText('workday', { exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.repeat-preview')).toContainText('workday');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(picker(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(picker(page).locator('.datepicker-options .opt').first()).toBeVisible();
});
