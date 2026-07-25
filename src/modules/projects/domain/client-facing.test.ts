import { describe, expect, it } from 'vitest';
import { isProjectClientFacing, type ContractStatusRef } from './client-facing';

function contract(overrides: Partial<ContractStatusRef>): ContractStatusRef {
  return { projectId: 'project-1', status: 'draft', ...overrides };
}

describe('isProjectClientFacing', () => {
  it('is false with no contracts at all', () => {
    expect(isProjectClientFacing('project-1', [])).toBe(false);
  });

  it('is false when the only contract is draft', () => {
    expect(isProjectClientFacing('project-1', [contract({ status: 'draft' })])).toBe(false);
  });

  it('is false when the only contract is completed or terminated', () => {
    expect(isProjectClientFacing('project-1', [contract({ status: 'completed' })])).toBe(false);
    expect(isProjectClientFacing('project-1', [contract({ status: 'terminated' })])).toBe(false);
  });

  it('is true when a contract is active', () => {
    expect(isProjectClientFacing('project-1', [contract({ status: 'active' })])).toBe(true);
  });

  it('is true when at least one of several contracts is active', () => {
    expect(
      isProjectClientFacing('project-1', [
        contract({ status: 'draft' }),
        contract({ status: 'active' }),
        contract({ status: 'terminated' }),
      ]),
    ).toBe(true);
  });

  it('ignores an active contract belonging to a different project', () => {
    expect(isProjectClientFacing('project-1', [contract({ projectId: 'other-project', status: 'active' })])).toBe(false);
  });
});
