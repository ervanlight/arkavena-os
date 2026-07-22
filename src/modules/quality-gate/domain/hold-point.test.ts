import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@/core/errors/result';
import { canProceed } from './hold-point';
import type { CashGateStatus, HoldPointState, WorkPackageState } from './types';

/**
 * ARCHITECTURE.md 4.5's Definition of Done for Hold Point, verbatim:
 * "kombinasi lulus/belum/override; blocked reasons lengkap; cash gate merah
 * tetap memblokir walau semua QC lulus." Each phrase gets its own describe
 * block below, by name.
 */

const workPackage: WorkPackageState = { id: 'wp-1', name: 'Waterproofing kamar mandi' };

function holdPoint(overrides: Partial<HoldPointState> = {}): HoldPointState {
  return {
    templateId: 'hpt-1',
    templateName: 'Flood test',
    required: true,
    passed: false,
    overridden: false,
    ...overrides,
  };
}

describe('canProceed -- both gates green/clear', () => {
  it('allows when every hold point has passed and Cash Gate is green', () => {
    const result = canProceed({
      workPackage,
      holdPoints: [holdPoint({ passed: true })],
      cashGate: 'green',
    });
    expect(isOk(result)).toBe(true);
  });

  it("allows when Cash Gate is yellow -- yellow is a warning, never a block (matches Cash Gate's own evaluateGateAction)", () => {
    const result = canProceed({
      workPackage,
      holdPoints: [holdPoint({ passed: true })],
      cashGate: 'yellow',
    });
    expect(isOk(result)).toBe(true);
  });

  it('allows a work package with no hold points attached at all (work_type null -- no requirement applies)', () => {
    const result = canProceed({ workPackage, holdPoints: [], cashGate: 'green' });
    expect(isOk(result)).toBe(true);
  });
});

describe('canProceed -- kombinasi lulus/belum/override', () => {
  it('blocks a required hold point that is neither passed nor overridden', () => {
    const result = canProceed({ workPackage, holdPoints: [holdPoint()], cashGate: 'green' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.reasons).toHaveLength(1);
    }
  });

  it('allows a required hold point that has passed, without needing an override', () => {
    const result = canProceed({
      workPackage,
      holdPoints: [holdPoint({ passed: true, overridden: false })],
      cashGate: 'green',
    });
    expect(isOk(result)).toBe(true);
  });

  it('allows a required hold point that has NOT passed but has been overridden', () => {
    const result = canProceed({
      workPackage,
      holdPoints: [holdPoint({ passed: false, overridden: true })],
      cashGate: 'green',
    });
    expect(isOk(result)).toBe(true);
  });

  it('allows a hold point that is not required, even if neither passed nor overridden', () => {
    const result = canProceed({
      workPackage,
      holdPoints: [holdPoint({ required: false, passed: false, overridden: false })],
      cashGate: 'green',
    });
    expect(isOk(result)).toBe(true);
  });
});

describe('canProceed -- blocked reasons lengkap (the full list, not just the first)', () => {
  it('includes one reason per unmet required hold point, not just the first one found', () => {
    const result = canProceed({
      workPackage,
      holdPoints: [
        holdPoint({ templateId: 'hpt-1', templateName: 'Flood test' }),
        holdPoint({ templateId: 'hpt-2', templateName: 'Rebar check' }),
      ],
      cashGate: 'green',
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.reasons).toHaveLength(2);
      expect(result.error.reasons.some((r) => r.includes('Flood test'))).toBe(true);
      expect(result.error.reasons.some((r) => r.includes('Rebar check'))).toBe(true);
    }
  });

  it('uses the literal ARCHITECTURE.md 4.4 message shape: "Tidak bisa lanjut: <nama> belum disetujui."', () => {
    const result = canProceed({
      workPackage,
      holdPoints: [holdPoint({ templateName: 'Flood test' })],
      cashGate: 'green',
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.reasons[0]).toBe('Tidak bisa lanjut: Flood test belum disetujui.');
    }
  });

  it('combines a Cash Gate reason and a hold point reason in the same blocked result when both fail', () => {
    const result = canProceed({
      workPackage,
      holdPoints: [holdPoint()],
      cashGate: 'red',
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.reasons).toHaveLength(2);
    }
  });
});

describe('canProceed -- cash gate merah tetap memblokir walau semua QC lulus', () => {
  it.each<CashGateStatus>(['red', 'overdue'])(
    'blocks when Cash Gate is %s even though every hold point has passed',
    (status) => {
      const result = canProceed({
        workPackage,
        holdPoints: [holdPoint({ passed: true }), holdPoint({ templateId: 'hpt-2', overridden: true })],
        cashGate: status,
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.reasons).toHaveLength(1);
        expect(result.error.reasons[0]).toContain('Cash Gate');
      }
    },
  );

  it('blocks on a red Cash Gate even with zero hold points attached at all', () => {
    const result = canProceed({ workPackage, holdPoints: [], cashGate: 'red' });
    expect(isErr(result)).toBe(true);
  });
});
