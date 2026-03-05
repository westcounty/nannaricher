import { describe, it, expect } from 'vitest';
import { PLAN_ABILITIES, getPlanAbility } from '../plan-registry.js';

describe('PlanRegistry', () => {
  it('should have all 33 plan abilities registered', () => {
    expect(PLAN_ABILITIES.size).toBe(33);
  });

  it('getPlanAbility returns undefined for unknown plan', () => {
    expect(getPlanAbility('plan_nonexistent')).toBeUndefined();
  });

  it('philosophy plan activates on GPA change below 3.0', () => {
    const ability = getPlanAbility('plan_zhexue');
    expect(ability).toBeDefined();
    expect(ability!.trigger).toBe('on_gpa_change');
    const result = ability!.apply({
      player: { gpa: 2.5, majorPlan: 'plan_zhexue', minorPlans: [] } as any,
      state: {} as any,
      trigger: 'on_gpa_change',
      gpaDelta: -1.0,
    });
    expect(result?.activated).toBe(true);
    expect(result?.effects?.overrideGpa).toBe(3.0);
  });

  it('commerce plan activates on confirm', () => {
    const ability = getPlanAbility('plan_shangxue');
    expect(ability).toBeDefined();
    expect(ability!.trigger).toBe('on_confirm');
  });

  it('journalism plan activates on explore line entry', () => {
    const ability = getPlanAbility('plan_xinwen');
    expect(ability).toBeDefined();
    const result = ability!.apply({
      player: { majorPlan: 'plan_xinwen', minorPlans: [] } as any,
      state: {} as any,
      trigger: 'on_line_enter',
      lineId: 'explore',
    });
    expect(result?.activated).toBe(true);
    expect(result?.effects?.skipEntryFee).toBe(true);
  });
});
