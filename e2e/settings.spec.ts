import { test, expect } from '@playwright/test';

test('the daily goal can be changed and persists after a reload', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: /Your settings/ })).toBeVisible();
  const goal = page.getByRole('group', { name: 'Daily revision goal' });
  await expect(goal).toBeVisible();

  // Pick whichever preset isn't active, so the test works on a retry too.
  const ten = goal.getByRole('button', { name: '10 per day' });
  const target = (await ten.getAttribute('aria-pressed')) === 'true' ? '15 per day' : '10 per day';
  const button = goal.getByRole('button', { name: target });

  const saved = page.waitForResponse((r) => r.url().includes('/api/settings') && r.request().method() === 'PATCH');
  await button.click();
  expect((await saved).ok()).toBeTruthy();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status').filter({ hasText: 'Daily goal:' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('group', { name: 'Daily revision goal' }).getByRole('button', { name: target })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('review intervals are validated before they can be saved', async ({ page }) => {
  await page.goto('/settings');
  const step2 = page.getByLabel('Step 2');
  await expect(step2).toBeVisible();
  const original = await step2.inputValue();

  // A step shorter than the one before it is rejected on the client.
  await step2.fill('1');
  await expect(page.locator('#ladder-hint')).toHaveText('Each interval must be longer than the one before it.');
  await expect(page.getByRole('button', { name: 'Save intervals' })).toBeDisabled();

  // Back to the saved value: nothing to save.
  await step2.fill(original);
  await expect(page.getByRole('button', { name: 'Save intervals' })).toBeDisabled();
});
