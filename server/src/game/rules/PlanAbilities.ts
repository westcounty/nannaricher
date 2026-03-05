// server/src/game/rules/PlanAbilities.ts
// Refactored to delegate to plan-registry instead of a monolithic switch/case
import { Player, GameState, getPlayerPlanIds } from '@nannaricher/shared';
import {
  getPlanAbility,
  PlanAbilityContext as RegistryContext,
  PlanAbilityResult as RegistryResult,
  AbilityTrigger,
} from '../handlers/plan-registry.js';

export interface PlanAbilityContext {
  player: Player;
  state: GameState;
  event?: string;
  cellId?: string;
}

export interface PlanAbilityResult {
  modified: boolean;
  message?: string;
  effects?: {
    money?: number;
    gpa?: number;
    exploration?: number;
    skipEvent?: boolean;
    moveToLine?: string;
    moveToCell?: string;
    skipEntryFee?: boolean;
    customEffect?: string;
  };
}

export class PlanAbilityHandler {
  /**
   * Check all confirmed plan abilities for the given trigger point.
   * Returns the first activated result, or null if nothing fired.
   */
  checkAbilities(
    player: Player,
    state: GameState,
    trigger: AbilityTrigger,
    extra?: Partial<RegistryContext>,
  ): RegistryResult | null {
    for (const planId of getPlayerPlanIds(player)) {
      const ability = getPlanAbility(planId);
      if (!ability || ability.trigger !== trigger) continue;
      const ctx: RegistryContext = { player, state, trigger, ...extra };
      const result = ability.apply(ctx);
      if (result?.activated) return result;
    }
    return null;
  }

  /**
   * Check a specific plan's ability for the given trigger.
   * Unlike checkAbilities(), this only evaluates the specified plan.
   */
  checkAbilityForPlan(
    planId: string,
    player: Player,
    state: GameState,
    trigger: AbilityTrigger,
    extra?: Partial<RegistryContext>,
  ): RegistryResult | null {
    const ability = getPlanAbility(planId);
    if (!ability || ability.trigger !== trigger) return null;
    const ctx: RegistryContext = { player, state, trigger, ...extra };
    const result = ability.apply(ctx);
    return result?.activated ? result : null;
  }

  /**
   * Legacy interface -- backward compatible with GameEngine callers.
   * Maps the old event/cellId context into registry trigger types.
   */
  applyPassiveAbility(context: PlanAbilityContext): PlanAbilityResult {
    const { player, state, event, cellId } = context;

    // Map the old event string to one or more registry triggers
    const triggers: AbilityTrigger[] = ['passive'];
    if (event === 'on_plan_confirm') triggers.push('on_confirm');
    if (event === 'money_loss') triggers.push('on_money_loss');
    if (event === 'before_roll') triggers.push('on_dice_roll');
    if (event === 'after_roll' || event === 'on_turn_start') triggers.push('on_turn_start');
    if (event === 'on_demand') triggers.push('on_turn_start', 'on_card_draw');
    if (event === 'direct_move') triggers.push('on_move');
    if (event === 'pukou_endpoint') triggers.push('on_cell_enter');
    if (cellId) triggers.push('on_cell_enter', 'on_line_enter');

    for (const trigger of triggers) {
      const result = this.checkAbilities(player, state, trigger, {
        cellId,
        lineId: cellId, // Legacy code used cellId for line IDs too
      });
      if (result) {
        return {
          modified: true,
          message: result.message,
          effects: result.effects,
        };
      }
    }

    return { modified: false };
  }

  /**
   * Apply philosophy department GPA floor when GPA would decrease.
   * Returns the final GPA value (not the delta).
   */
  modifyGpa(player: Player, state: GameState, delta: number): number {
    const result = this.checkAbilities(player, state, 'on_gpa_change', { gpaDelta: delta });
    if (result?.effects?.overrideGpa !== undefined) return result.effects.overrideGpa;
    return player.gpa + delta;
  }

  /**
   * Check whether the player should go bankrupt.
   * Software engineering plan extends the bankruptcy threshold to -1000.
   */
  canGoBankrupt(player: Player): boolean {
    if (player.majorPlan === 'plan_ruanjian' || player.minorPlans.includes('plan_ruanjian')) {
      return player.money < -1000;
    }
    return player.money < 0;
  }

  /**
   * Calculate branch-line entry fee with plan discounts applied.
   */
  calculateEntryFee(player: Player, state: GameState, lineId: string, baseFee: number): number {
    const result = this.checkAbilities(player, state, 'on_line_enter', { lineId });
    if (result?.effects?.skipEntryFee) return 0;
    // 政府管理学院：校区线入场费固定150
    if (result?.effects?.customEffect === 'zhengguan_discount') return Math.min(baseFee, 150);
    if (result?.effects?.money) return Math.max(0, baseFee - Math.abs(result.effects.money));
    return baseFee;
  }
}
