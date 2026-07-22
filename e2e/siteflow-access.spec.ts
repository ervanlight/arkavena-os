import { expect, test } from '@playwright/test';
import { signInAs } from './support/auth';
import { createExternalUser } from './support/factories';
import { closePool } from '../supabase/tests/db';
import { addProjectMember, cleanupOrganizations, createOrganization, createProjectWithClientAndSite } from '../supabase/tests/factories';

/**
 * FR4's (siteflow) layout and /site page, reached the way every other E2E
 * spec reaches an authenticated page: signInAs injects a session directly
 * rather than clicking a real magic link, since GoTrue's admin-issued links
 * verify through the implicit flow (a URL fragment with the tokens already
 * in it) and this app's /auth/callback only ever handles the PKCE `code`
 * flow a real signInWithOtp browser call produces -- there is no admin-API
 * equivalent of that call, so the redirect *decision* itself
 * (decideDefaultLanding) has its own Vitest unit test instead
 * (src/core/auth/default-landing.test.ts) and this spec covers what
 * signInAs *can* prove: the destination page and its auth gate are real.
 */

const createdOrgs: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

test('a signed-in mandor reaches /site and sees the SiteFlow shell', async ({ browser }) => {
  const org = await createOrganization();
  createdOrgs.push(org.id);
  const project = await createProjectWithClientAndSite(org.id);

  const mandor = await createExternalUser(org.id, 'siteflow-mandor');
  await addProjectMember(project.id, mandor.id, 'mandor');

  const context = await browser.newContext();
  await signInAs(context, mandor.email);
  const page = await context.newPage();

  await page.goto('/site');
  await expect(page).toHaveURL(/\/site(\/|$|\?)/);
  await expect(page.getByText('SiteFlow', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keluar' })).toBeVisible();

  await context.close();
});

test('an unauthenticated visitor to /site is sent to /login', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('/site');
  await expect(page).toHaveURL(/\/login/);

  await context.close();
});
