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

  it('falls back to /cc for a project-role-only user with no field role', () => {
    expect(decideDefaultLanding(null, ['client_approver'])).toBe('/cc');
    expect(decideDefaultLanding(null, ['supplier', 'subcontractor'])).toBe('/cc');
  });

  it('falls back to /cc for a signed-in user with no roles at all', () => {
    expect(decideDefaultLanding(null, [])).toBe('/cc');
  });
});
