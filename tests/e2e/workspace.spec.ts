import { test, expect, type Page } from '@playwright/test';

const workspaceReadyTimeout = 15_000;

async function login(page: Page, alias = 'admin') {
  await page.goto('/');
  await page.getByLabel('Email address').fill(`${alias}@velozity.test`);
  await page.getByLabel('Password', { exact: true }).fill(process.env.SEED_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('heading', { name: /Welcome back,/ })).toBeVisible({
    timeout: workspaceReadyTimeout,
  });
}
test('admin dashboard, project detail, URL filters, notifications, and logout', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await expect(page.getByRole('heading', { name: 'Your projects' })).toBeVisible();
  await expect(page.getByText('Workspace is live', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.local/screenshots/dashboard-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await page.locator('.project-card').first().click();
  await expect(page.getByText('PROJECT SUMMARY', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upcoming tasks', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent activity', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tasks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Project tasks' })).toBeVisible();
  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  await page.getByLabel('Filter by priority').selectOption('HIGH');
  await expect(page).toHaveURL(/priority=HIGH/);
  await page.reload();
  await expect(page.getByLabel('Filter by priority')).toHaveValue('HIGH');
  await page.getByRole('button', { name: /Notifications,/ }).click();
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('developer can update assigned task and another browser sees the live event', async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const devContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const developer = await devContext.newPage();
  try {
    await login(admin);
    await login(developer, 'arjun');
    await admin.getByRole('link', { name: 'Activity', exact: true }).click();
    await developer.getByRole('link', { name: 'My tasks', exact: true }).click();
    await expect(developer.getByRole('button', { name: 'Create task' })).toHaveCount(0);
    await developer.locator('.task-title-button').first().click();
    const dialog = developer.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const select = dialog.getByLabel('Status', { exact: true });
    const previous = await select.inputValue();
    const next = previous === 'DONE' ? 'IN_PROGRESS' : 'DONE';
    await Promise.all([
      developer.waitForResponse(
        (r) =>
          r.url().includes('/status') && r.request().method() === 'PATCH' && r.status() === 200,
      ),
      select.selectOption(next),
    ]);
    await expect(admin.locator('.activity-item').first()).toContainText('Arjun Mehta');
    await expect(
      admin.locator('.activity-item').first().locator('.activity-transition'),
    ).toContainText(next === 'DONE' ? 'Done' : 'In progress');
    await expect(select).toBeEnabled({ timeout: workspaceReadyTimeout });
    await Promise.all([
      developer.waitForResponse(
        (r) =>
          r.url().includes('/status') && r.request().method() === 'PATCH' && r.status() === 200,
      ),
      select.selectOption(previous),
    ]);
  } finally {
    await adminContext.close();
    await devContext.close();
  }
});
test('mobile navigation and tasks stay within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'maya');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: '.local/screenshots/dashboard-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
test('admin can create and clean up a client and project through forms', async ({ page }) => {
  await login(page);
  const name = `Browser check ${Date.now()}`;
  await page.getByRole('link', { name: 'Clients', exact: true }).click();
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Contact name').fill(name);
  await dialog.getByLabel('Company').fill('Browser verification');
  await dialog.getByLabel('Email', { exact: true }).fill('browser@example.test');
  await dialog.getByRole('button', { name: 'Save client' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await dialog.getByLabel('Project name').fill(name);
  await dialog
    .getByLabel('Client', { exact: true })
    .selectOption({ label: `Browser verification · ${name}` });
  await dialog.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.locator('.project-card').filter({ hasText: name }).click();
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await dialog.getByLabel('Title', { exact: true }).fill('Verify the new task workflow');
  await dialog
    .getByLabel('Assigned developer', { exact: true })
    .selectOption({ label: 'Arjun Mehta' });
  await dialog.getByLabel('Due date (UTC)', { exact: true }).fill('2026-12-20');
  await dialog.getByRole('button', { name: 'Create task', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Verify the new task workflow', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Delete project', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete project', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Project deleted' })).toBeVisible();
  await page.getByRole('link', { name: 'Clients', exact: true }).click();
  await page.getByRole('button', { name: `Delete ${name}`, exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('cell', { name, exact: true })).toHaveCount(0);
});

test('two tabs can restore the same session without invalidating each other', async ({
  page,
  context,
}) => {
  await login(page);
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('heading', { name: /Welcome back,/ })).toBeVisible({
    timeout: workspaceReadyTimeout,
  });
  await Promise.all([page.reload(), second.reload()]);
  for (const tab of [page, second]) {
    await expect(tab.getByRole('heading', { name: /Welcome back,/ })).toBeVisible({
      timeout: workspaceReadyTimeout,
    });
    await tab.getByRole('link', { name: 'Tasks', exact: true }).click();
    await expect(tab.locator('tbody tr').first()).toBeVisible();
  }
  await second.close();
});
