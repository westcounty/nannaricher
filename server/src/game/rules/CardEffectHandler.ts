// server/src/game/rules/CardEffectHandler.ts
import { Card, Player, GameState, PendingAction } from '@nannaricher/shared';
import { VotingSystem } from '../interaction/VotingSystem.js';
import { ChainActionSystem } from '../interaction/ChainActionSystem.js';
import { getCardHandler } from '../handlers/card-registry.js';

export interface CardEffectContext {
  card: Card;
  player: Player;
  state: GameState;
  diceValue?: number;
  targetPlayerId?: string;
}

export interface CardEffectResult {
  success: boolean;
  message: string;
  pendingAction?: PendingAction;
  effects?: {
    money?: number;
    gpa?: number;
    exploration?: number;
    skipTurn?: boolean;
    moveTo?: string;
    moveToLine?: string;
    drawCard?: 'chance' | 'destiny' | 'any';
    drawCardCount?: number;
    custom?: string;
    targetPlayerId?: string;
    targetEffects?: { money?: number; gpa?: number; exploration?: number };
  };
}

export class CardEffectHandler {
  private votingSystem: VotingSystem;
  private chainSystem: ChainActionSystem;

  constructor() {
    this.votingSystem = new VotingSystem();
    this.chainSystem = new ChainActionSystem();
  }

  /**
   * Handle a card effect.
   * Looks up the card-registry first; falls back to generic simple-effects
   * processing for cards that only have a `card.effects[]` array.
   */
  handleCardEffect(context: CardEffectContext): CardEffectResult {
    // 1. Registry lookup (covers all cards with dedicated handlers)
    const registryHandler = getCardHandler(context.card.id);
    if (registryHandler) {
      return registryHandler(context);
    }

    // 2. Fallback: process the generic card.effects[] array
    if (context.card.effects && context.card.effects.length > 0) {
      return this.applySimpleEffects(context);
    }

    // 3. Unknown card — return a generic result
    return {
      success: true,
      message: context.card.description,
      effects: { custom: context.card.id },
    };
  }

  /**
   * Apply simple numeric effects declared in card.effects[].
   */
  private applySimpleEffects(context: CardEffectContext): CardEffectResult {
    const { card } = context;
    const effects: CardEffectResult['effects'] = {};
    const messages: string[] = [];

    for (const effect of card.effects!) {
      if (effect.stat && effect.delta !== undefined) {
        switch (effect.stat) {
          case 'money':
            effects.money = (effects.money || 0) + effect.delta;
            messages.push(`金钱${effect.delta >= 0 ? '+' : ''}${effect.delta}`);
            break;
          case 'gpa':
            effects.gpa = (effects.gpa || 0) + effect.delta;
            messages.push(`GPA${effect.delta >= 0 ? '+' : ''}${effect.delta}`);
            break;
          case 'exploration':
            effects.exploration = (effects.exploration || 0) + effect.delta;
            messages.push(`探索${effect.delta >= 0 ? '+' : ''}${effect.delta}`);
            break;
        }
      }
    }

    return {
      success: true,
      message: `${card.name}：${messages.join('，')}`,
      effects,
    };
  }

  /** Expose VotingSystem for GameEngine */
  getVotingSystem(): VotingSystem {
    return this.votingSystem;
  }

  /** Expose ChainActionSystem for GameEngine */
  getChainSystem(): ChainActionSystem {
    return this.chainSystem;
  }
}
