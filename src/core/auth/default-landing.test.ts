import { describe, expect, it } from 'vitest';
import { decideDefaultLanding } from './default-landing';

describe('decideDefaultLanding', () => {
  it('sends any staff org_role to /cc, regardless of project roles', () => {
    expect(decideDefaultLanding('owner', [])).toBe('/cc');
    expect(decideDefaultLanding('finance', ['mandor'])).toBe('/cc');
  });

  it('sends a project-role-only mandor to /site', () => {
    expect(decideDefaultLanding(null, ['mandor'])).toBe('/site');
  });

  it('sends a project-role-only site_coordinator to /site', () => {
    expect(decideDefaultLanding(null, ['site_coordinator'])).toBe('/site');
  });

  it('sends a project-role-only user holding a field role on any one of several projects to /site', () => {
    expect(decideDefaultLanding(null, ['client_approver', 'mandor'])).toBe('/site');
  });

  it('sends a project-role-only client_approver/client_viewer to /portal', () => {
    expect(decideDefaultLanding(null, ['client_approver'])).toBe('/portal');
    expect(decideDefaultLanding(null, ['client_viewer'])).toBe('/portal');
  });

  it('sends a project-role-only supplier/subcontractor to /partner', () => {
    expect(decideDefaultLanding(null, ['supplier'])).toBe('/partner');
    expect(decideDefaultLanding(null, ['subcontractor'])).toBe('/partner');
  });

  it('falls back to /cc for a signed-in user with no roles at all', () => {
    expect(decideDefaultLanding(null, [])).toBe('/cc');
  });
});
