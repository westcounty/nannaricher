// server/src/game/handlers/card-handlers.ts
import { getPlayerPlanIds, Player } from '@nannaricher/shared';
import type { EventHandler } from '../EventHandler.js';
import type { GameEngine } from '../EventHandler.js';
import { boardData, MAIN_BOARD_SIZE } from '../../data/board.js';

export function registerCardHandlers(eventHandler: EventHandler): void {
  // === Destiny Card Handlers ===
  // 卡牌 ID 格式：destiny_xxx，加上 card_ 前缀变成 card_destiny_xxx

  // BOSS直聘
  eventHandler.registerHandler('card_destiny_boss_recruit', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    const newExploration = Math.round(player.exploration * dice * 0.1 * 10) / 10;
    engine.modifyPlayerExploration(playerId, newExploration - player.exploration);
    engine.log(`BOSS直聘投出 ${dice}，探索值变为 ${newExploration}`, playerId);
    return null;
  });

  // 手望相助
  eventHandler.registerHandler('card_destiny_mutual_help', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '是否在各平台关注了手手？',
      [
        { label: '是（金钱 +100）', value: 'card_mutual_help_yes', effectPreview: { money: 100 } },
        { label: '否（探索值 -2，金钱 -200）', value: 'card_mutual_help_no', effectPreview: { exploration: -2, money: -200 } },
      ]
    );
  });

  eventHandler.registerHandler('card_mutual_help_yes', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 100);
    engine.log('关注手手，金钱 +100', playerId);
    return null;
  });

  eventHandler.registerHandler('card_mutual_help_no', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, -2);
    engine.modifyPlayerMoney(playerId, -200);
    engine.log('没关注手手，探索值 -2，金钱 -200', playerId);
    return null;
  });

  // 吞噬电梯
  eventHandler.registerHandler('card_destiny_swallowing_elevator', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice !== 6) {
      engine.skipPlayerTurn(playerId, 1);
      engine.modifyPlayerGpa(playerId, -0.1);
      engine.log(`电梯投出 ${dice}，故障！停留一回合，GPA -0.1`, playerId);
    } else {
      engine.log(`电梯投出 ${dice}，安全到达`, playerId);
    }
    return null;
  });

  // 七年之痒
  eventHandler.registerHandler('card_destiny_seven_year_itch', (engine, playerId) => {
    const dice1 = engine.rollDiceAndBroadcast(playerId, 1)[0];
    const dice2 = engine.rollDiceAndBroadcast(playerId, 1)[0];
    const total = dice1 + dice2;

    if (total === 7) {
      return engine.createPendingAction(
        playerId,
        'choose_option',
        `投出 ${dice1}+${dice2}=7！选择奖励：`,
        [
          { label: '探索值 +7', value: 'card_seven_year_itch_exploration', effectPreview: { exploration: 7 } },
          { label: 'GPA +0.7', value: 'card_seven_year_itch_gpa', effectPreview: { gpa: 0.7 } },
          { label: '金钱 +700', value: 'card_seven_year_itch_money', effectPreview: { money: 700 } },
        ]
      );
    } else {
      engine.log(`七年之痒投出 ${dice1}+${dice2}=${total}，无事发生`, playerId);
      return null;
    }
  });

  eventHandler.registerHandler('card_seven_year_itch_exploration', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 7);
    engine.log('七年之痒：探索值 +7', playerId);
    return null;
  });

  eventHandler.registerHandler('card_seven_year_itch_gpa', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, 0.7);
    engine.log('七年之痒：GPA +0.7', playerId);
    return null;
  });

  eventHandler.registerHandler('card_seven_year_itch_money', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 700);
    engine.log('七年之痒：金钱 +700', playerId);
    return null;
  });

  // 四校联动 — 所有玩家选择校区，投骰子决定奖励
  eventHandler.registerHandler('card_destiny_four_schools', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    return {
      id: `vote_four_schools_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '四校联动：选择一个校区',
      options: [
        { label: '仙林', value: 'xianlin' },
        { label: '鼓楼', value: 'gulou' },
        { label: '浦口', value: 'pukou' },
        { label: '苏州', value: 'suzhou' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'destiny_four_schools',
      timeoutMs: 30000,
    };
  });

  // 北京大学 - 移动到浦口线
  eventHandler.registerHandler('card_destiny_beijing_university', (engine, playerId) => {
    engine.log('北京大学：直接移动到浦口线', playerId);
    engine.enterLine(playerId, 'pukou', false);
    return null;
  });

  // 嚼得菜根 - 移动到学习线
  eventHandler.registerHandler('card_destiny_chew_vegetable_root', (engine, playerId) => {
    engine.log('嚼得菜根：直接移动到学习线', playerId);
    engine.enterLine(playerId, 'study', false);
    return null;
  });

  // 多多益善 - 移动到金钱线
  eventHandler.registerHandler('card_destiny_more_the_better', (engine, playerId) => {
    engine.log('多多益善：直接移动到金钱线', playerId);
    engine.enterLine(playerId, 'money', false);
    return null;
  });

  // 另起炉灶 - 移动到苏州线
  eventHandler.registerHandler('card_destiny_start_new_stove', (engine, playerId) => {
    engine.log('另起炉灶：直接移动到苏州线', playerId);
    engine.enterLine(playerId, 'suzhou', false);
    return null;
  });

  // 仙林站 - 移动到仙林线
  eventHandler.registerHandler('card_destiny_next_station_xianlin', (engine, playerId) => {
    engine.log('仙林站：直接移动到仙林线', playerId);
    engine.enterLine(playerId, 'xianlin', false);
    return null;
  });

  // 南北相望 - 移动到鼓楼线
  eventHandler.registerHandler('card_destiny_north_south_gaze', (engine, playerId) => {
    engine.log('南北相望：直接移动到鼓楼线', playerId);
    engine.enterLine(playerId, 'gulou', false);
    return null;
  });

  // 见多食广 - 移动到食堂线
  eventHandler.registerHandler('card_destiny_see_more_eat_more', (engine, playerId) => {
    engine.log('见多食广：直接移动到食堂线', playerId);
    engine.enterLine(playerId, 'food', false);
    return null;
  });

  // 社恐分子 - 移动到探索线
  eventHandler.registerHandler('card_destiny_social_phobia', (engine, playerId) => {
    engine.log('社恐分子：直接移动到探索线', playerId);
    engine.enterLine(playerId, 'explore', false);
    return null;
  });

  // 校园传说（移动）- 移动到鼎
  eventHandler.registerHandler('card_destiny_campus_legend_move', (engine, playerId) => {
    engine.log('校园传说：直接移动到鼎', playerId);
    engine.movePlayerTo(playerId, { type: 'main', index: 14 });
    return null;
  });

  // 民航超速 — 移动到前面12格内任意位置
  eventHandler.registerHandler('card_destiny_civil_aviation_overspeed', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    const currentIndex = player?.position.type === 'main' ? player.position.index : 0;
    const options = [];
    for (let i = 1; i <= 12; i++) {
      const destIndex = (currentIndex + i) % MAIN_BOARD_SIZE;
      const destName = boardData.mainBoard[destIndex]?.name || `格${destIndex}`;
      options.push({ label: `前进 ${i} 格`, value: `civil_aviation_${i}`, description: `→ ${destName}` });
    }
    const action = engine.createPendingAction(
      playerId,
      'choose_option',
      '民航超速：选择移动到前面12格内的任意位置',
      options,
    );
    action.callbackHandler = 'card_civil_aviation_move';
    return action;
  });

  eventHandler.registerHandler('card_civil_aviation_move', (engine, playerId, choice) => {
    const steps = parseInt((choice || '').replace('civil_aviation_', ''), 10);
    if (steps >= 1 && steps <= 12) {
      engine.movePlayerForward(playerId, steps);
      engine.log(`民航超速：前进 ${steps} 格`, playerId);
    }
    return null;
  });

  // 二源广场
  eventHandler.registerHandler('card_destiny_eryuan_square', (engine, playerId) => {
    engine.movePlayerForward(playerId, 2);
    engine.log('二源广场：向前移动两格', playerId);
    return null;
  });

  // 风水轮转 — 下回合行动顺序反转
  eventHandler.registerHandler('card_destiny_fengshui_rotation', (engine, playerId) => {
    const state = engine.getState();
    engine.getDelayedEffects().add({
      playerId,
      type: 'reverse_order',
      triggerTurn: state.turnNumber + 1,
      triggerCondition: 'next_turn',
      data: {},
    });
    engine.log('风水轮转：下回合行动顺序反转！', playerId);
    return null;
  });

  // 滑板天才 — 下次行动投掷两次骰子
  eventHandler.registerHandler('card_destiny_skateboard_genius', (engine, playerId) => {
    const state = engine.getState();
    engine.getDelayedEffects().add({
      playerId,
      type: 'double_dice',
      triggerTurn: state.turnNumber + 1,
      triggerCondition: 'next_dice',
      data: {},
    });
    engine.log('滑板天才：下次行动投掷两次骰子！', playerId);
    return null;
  });

  // 闭馆音乐 — 下次行动效果触发两次
  eventHandler.registerHandler('card_destiny_closing_music', (engine, playerId) => {
    const state = engine.getState();
    engine.getDelayedEffects().add({
      playerId,
      type: 'double_event',
      triggerTurn: state.turnNumber + 1,
      triggerCondition: 'next_event',
      data: {},
    });
    engine.log('闭馆音乐：下次行动效果触发两次！', playerId);
    return null;
  });

  // 系统故障 — 下回合金钱始终为0
  eventHandler.registerHandler('card_destiny_system_failure', (engine, playerId) => {
    const state = engine.getState();
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    engine.getDelayedEffects().add({
      playerId,
      type: 'money_freeze',
      triggerTurn: state.turnNumber + 1,
      triggerCondition: 'next_turn',
      data: { savedMoney: player.money },
    });
    engine.log('系统故障：下回合金钱始终为0！', playerId);
    return null;
  });

  // 延迟满足
  eventHandler.registerHandler('card_destiny_delayed_gratification', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '是否执行延迟满足？（金钱立即变为0，下回合恢复并额外获得500）',
      [
        { label: '执行延迟满足', value: 'card_delayed_gratification_yes', effectPreview: { money: 500 } },
        { label: '不执行', value: 'skip' },
      ]
    );
  });

  eventHandler.registerHandler('card_delayed_gratification_yes', (engine, playerId) => {
    const state = engine.getState();
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    const savedMoney = player.money;
    engine.getDelayedEffects().add({
      playerId,
      type: 'delayed_gratification',
      triggerTurn: state.turnNumber + 1,
      triggerCondition: 'next_turn',
      data: { savedMoney },
    });
    // Set money to 0 immediately
    engine.modifyPlayerMoney(playerId, -savedMoney);
    engine.log(`延迟满足：金钱立即归零(保存${savedMoney})，下回合恢复+500`, playerId);
    return null;
  });

  // 可持续性
  eventHandler.registerHandler('card_destiny_sustainability', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 300);
    engine.log('可持续性：创办账号成功恰饭，金钱 +300', playerId);
    return null;
  });

  // 存活下去
  eventHandler.registerHandler('card_destiny_survival', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -300);
    engine.log('存活下去：入不敷出，金钱 -300', playerId);
    return null;
  });

  // --- 通用「抽取并加入培养计划」流程 ---

  /**
   * Draw a training plan, let player choose to add it, then give bonus via callback.
   */
  function drawAndAddPlanFlow(
    engine: GameEngine,
    playerId: string,
    cardName: string,
    bonusFn: () => void,
    bonusCallbackId: string,
  ) {
    const plan = engine.drawTrainingPlan(playerId);
    if (!plan) {
      engine.log(`${cardName}：培养计划牌堆已空，仅获得奖励`, playerId);
      bonusFn();
      return null;
    }

    const player = engine.getPlayer(playerId);
    if (!player) return null;

    const currentCount = getPlayerPlanIds(player).length;
    const options = [
      {
        label: `加入: ${plan.name}`,
        value: `add_${plan.id}`,
        description: `胜利条件: ${plan.winCondition}`,
      },
      { label: '不加入（仅领取奖励）', value: 'skip' },
    ];

    const action = engine.createPendingAction(
      playerId, 'choose_option',
      `${cardName}：抽到 ${plan.name}，是否加入培养计划？(${currentCount}/${player.planSlotLimit})`,
      options,
    );
    action.callbackHandler = bonusCallbackId;
    return action;
  }

  /** Add a plan to player's major/minor slot (temporary, may exceed limit) */
  function addPlanToPlayerSlot(player: Player, planId: string) {
    if (!player.majorPlan) {
      player.majorPlan = planId;
    } else if (!player.minorPlans.includes(planId) && player.majorPlan !== planId) {
      player.minorPlans.push(planId);
    }
  }

  /**
   * After adding a plan via card, check if overflow and handle the full chain:
   * 1. If overflow: choose which plans to keep
   * 2. If >1 plan kept: choose major direction
   * 3. Finally: apply bonus
   * Returns a PendingAction if interaction needed, null if bonus was applied directly.
   */
  function handleCardPlanOverflow(
    engine: GameEngine,
    player: Player,
    bonusFn: () => void,
    cardName: string,
  ): ReturnType<typeof engine.createPendingAction> | null {
    const planIds = getPlayerPlanIds(player);
    if (planIds.length <= player.planSlotLimit) {
      // No overflow — apply bonus directly
      bonusFn();
      return null;
    }

    // Overflow: need to choose which plans to keep
    const overflowId = `card_plan_overflow_${Date.now()}`;
    const options = planIds.map(id => {
      const plan = player.trainingPlans.find(p => p.id === id);
      return {
        label: plan?.name || id,
        value: id,
        description: plan ? `胜利条件: ${plan.winCondition}` : undefined,
      };
    });

    const action = engine.createPendingAction(
      player.id, 'choose_option',
      `${cardName}：培养计划超出上限(${planIds.length}/${player.planSlotLimit})，选择要保留的：`,
      options,
    );
    action.maxSelections = player.planSlotLimit;
    action.minSelections = 1;
    action.callbackHandler = overflowId;

    eventHandler.registerHandler(overflowId, (_eng, pid, overflowChoice) => {
      const p = engine.getPlayer(pid);
      if (!p || !overflowChoice) { bonusFn(); return null; }

      const keepIds = overflowChoice.split(',');
      // Remove plans not in keepIds
      const removedIds = getPlayerPlanIds(p).filter(id => !keepIds.includes(id));
      for (const rid of removedIds) {
        if (p.majorPlan === rid) p.majorPlan = null;
        p.minorPlans = p.minorPlans.filter(id => id !== rid);
        // Return removed plan to deck
        const idx = p.trainingPlans.findIndex(tp => tp.id === rid);
        if (idx >= 0) {
          const [removed] = p.trainingPlans.splice(idx, 1);
          engine.getState().cardDecks.training.push(removed);
        }
      }

      // Now set major: if only 1 plan kept, auto-set as major
      if (keepIds.length === 1) {
        p.majorPlan = keepIds[0];
        p.minorPlans = [];
        bonusFn();
        return null;
      }

      // Multiple plans: choose major
      const majorId = `card_plan_major_${Date.now()}`;
      const majorOptions = keepIds.map(id => {
        const plan = p.trainingPlans.find(tp => tp.id === id);
        return { label: plan?.name || id, value: id };
      });
      const majorAction = engine.createPendingAction(
        pid, 'choose_option',
        `${cardName}：选择你的主修方向`,
        majorOptions,
      );
      majorAction.callbackHandler = majorId;

      eventHandler.registerHandler(majorId, (_e, pid2, majorChoice) => {
        const p2 = engine.getPlayer(pid2);
        if (p2 && majorChoice) {
          const oldMajor = p2.majorPlan;
          p2.majorPlan = majorChoice;
          p2.minorPlans = keepIds.filter(id => id !== majorChoice);
          if (majorChoice !== oldMajor) {
            engine.log(`${cardName}：主修方向变更为 ${p2.trainingPlans.find(tp => tp.id === majorChoice)?.name || majorChoice}`, pid2);
          }
        }
        bonusFn();
        return null;
      });

      return majorAction;
    });

    return action;
  }

  /** Swap one minor plan between two players */
  function swapMinorPlans(engine: GameEngine, playerA: Player, planIdA: string, playerB: Player, planIdB: string) {
    playerA.minorPlans = playerA.minorPlans.filter(id => id !== planIdA);
    playerB.minorPlans = playerB.minorPlans.filter(id => id !== planIdB);

    const planA = playerA.trainingPlans.find(p => p.id === planIdA);
    const planB = playerB.trainingPlans.find(p => p.id === planIdB);

    if (planA && planB) {
      playerA.trainingPlans = playerA.trainingPlans.filter(p => p.id !== planIdA);
      playerB.trainingPlans = playerB.trainingPlans.filter(p => p.id !== planIdB);
      playerA.trainingPlans.push(planB);
      playerB.trainingPlans.push(planA);
      playerA.minorPlans.push(planIdB);
      playerB.minorPlans.push(planIdA);
      engine.log(`联合培养：${playerA.name}的${planA.name}与${playerB.name}的${planB.name}交换`, playerA.id);
    }
  }

  // 强基计划
  eventHandler.registerHandler('card_destiny_strong_base_plan', (engine, playerId) => {
    return drawAndAddPlanFlow(engine, playerId, '强基计划', () => {
      engine.modifyPlayerGpa(playerId, 0.2);
      engine.log('强基计划：GPA +0.2', playerId);
    }, 'card_strong_base_plan_callback');
  });

  eventHandler.registerHandler('card_strong_base_plan_callback', (engine, playerId, choice) => {
    const player = engine.getPlayer(playerId);
    if (player && choice && choice.startsWith('add_')) {
      const planId = choice.replace('add_', '');
      addPlanToPlayerSlot(player, planId);
      const plan = player.trainingPlans.find(p => p.id === planId);
      engine.log(`强基计划：加入培养计划 ${plan?.name || planId}`, playerId);

      // Check overflow — may return pending action for plan selection
      const overflowAction = handleCardPlanOverflow(engine, player, () => {
        engine.modifyPlayerGpa(playerId, 0.2);
        engine.log('强基计划：GPA +0.2', playerId);
      }, '强基计划');
      if (overflowAction) return overflowAction;
      return null;  // bonus already applied by handleCardPlanOverflow
    }
    engine.modifyPlayerGpa(playerId, 0.2);
    engine.log('强基计划：GPA +0.2', playerId);
    return null;
  });

  // 国家专项
  eventHandler.registerHandler('card_destiny_national_special', (engine, playerId) => {
    return drawAndAddPlanFlow(engine, playerId, '国家专项', () => {
      engine.modifyPlayerMoney(playerId, 200);
      engine.log('国家专项：金钱 +200', playerId);
    }, 'card_national_special_callback');
  });

  eventHandler.registerHandler('card_national_special_callback', (engine, playerId, choice) => {
    const player = engine.getPlayer(playerId);
    if (player && choice && choice.startsWith('add_')) {
      const planId = choice.replace('add_', '');
      addPlanToPlayerSlot(player, planId);
      const plan = player.trainingPlans.find(p => p.id === planId);
      engine.log(`国家专项：加入培养计划 ${plan?.name || planId}`, playerId);

      const overflowAction = handleCardPlanOverflow(engine, player, () => {
        engine.modifyPlayerMoney(playerId, 200);
        engine.log('国家专项：金钱 +200', playerId);
      }, '国家专项');
      if (overflowAction) return overflowAction;
      return null;
    }
    engine.modifyPlayerMoney(playerId, 200);
    engine.log('国家专项：金钱 +200', playerId);
    return null;
  });

  // 二次选拔
  eventHandler.registerHandler('card_destiny_secondary_selection', (engine, playerId) => {
    return drawAndAddPlanFlow(engine, playerId, '二次选拔', () => {
      engine.modifyPlayerExploration(playerId, 2);
      engine.log('二次选拔：探索值 +2', playerId);
    }, 'card_secondary_selection_callback');
  });

  eventHandler.registerHandler('card_secondary_selection_callback', (engine, playerId, choice) => {
    const player = engine.getPlayer(playerId);
    if (player && choice && choice.startsWith('add_')) {
      const planId = choice.replace('add_', '');
      addPlanToPlayerSlot(player, planId);
      const plan = player.trainingPlans.find(p => p.id === planId);
      engine.log(`二次选拔：加入培养计划 ${plan?.name || planId}`, playerId);

      const overflowAction = handleCardPlanOverflow(engine, player, () => {
        engine.modifyPlayerExploration(playerId, 2);
        engine.log('二次选拔：探索值 +2', playerId);
      }, '二次选拔');
      if (overflowAction) return overflowAction;
      return null;
    }
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('二次选拔：探索值 +2', playerId);
    return null;
  });

  // 中外合办
  eventHandler.registerHandler('card_destiny_sino_foreign', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -400);
    engine.modifyPlayerExploration(playerId, 3);
    engine.log('中外合办：金钱 -400，探索值 +3，再抽培养方案', playerId);
    engine.drawTrainingPlan(playerId);
    return null;
  });

  // 校庆餐券
  eventHandler.registerHandler('card_destiny_anniversary_coupon', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 100);
    engine.log('校庆餐券：金钱 +100', playerId);
    return null;
  });

  // 问卷调查
  eventHandler.registerHandler('card_destiny_questionnaire', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '选择一项执行',
      [
        { label: '获得50金钱', value: 'card_questionnaire_50', effectPreview: { money: 50 } },
        { label: '暂停一回合获得200金钱', value: 'card_questionnaire_200', effectPreview: { money: 200 } },
      ]
    );
  });

  eventHandler.registerHandler('card_questionnaire_50', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 50);
    engine.log('问卷调查：金钱 +50', playerId);
    return null;
  });

  eventHandler.registerHandler('card_questionnaire_200', (engine, playerId) => {
    engine.skipPlayerTurn(playerId, 1);
    engine.modifyPlayerMoney(playerId, 200);
    engine.log('问卷调查：暂停一回合，金钱 +200', playerId);
    return null;
  });

  // 轻装报到
  eventHandler.registerHandler('card_destiny_light_reporting', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -480);
    engine.log('轻装报到：购买学校生活用品套餐，金钱 -480', playerId);
    return null;
  });

  // 黄粱美梦
  eventHandler.registerHandler('card_destiny_yellow_millet_dream', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -30);
    engine.log('黄粱美梦：睡过四六级考试，金钱 -30', playerId);
    return null;
  });

  // 精密器械
  eventHandler.registerHandler('card_destiny_precision_instrument', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, 0.2);
    engine.log('精密器械：抢课大胜利，GPA +0.2', playerId);
    return null;
  });

  // 新年快乐
  eventHandler.registerHandler('card_destiny_happy_new_year', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 3);
    engine.log('新年快乐：帮助创作红包封面，探索值 +3', playerId);
    return null;
  });

  // 和光同行
  eventHandler.registerHandler('card_destiny_with_light', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 1);
    engine.log('和光同行：网速太快触发彩蛋，探索值 +1', playerId);
    return null;
  });

  // 谢谢惠顾
  eventHandler.registerHandler('card_destiny_thank_you', (engine, playerId) => {
    engine.log('谢谢惠顾：再抽一张命运卡', playerId);
    engine.drawAndProcessCard(playerId, 'destiny');
    return null;
  });

  // 限量供应
  eventHandler.registerHandler('card_destiny_limited_supply', (engine, playerId) => {
    const dice1 = engine.rollDiceAndBroadcast(playerId, 1)[0];
    const dice2 = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice2 > dice1) {
      engine.modifyPlayerExploration(playerId, 2);
      engine.log(`限量供应：${dice1} -> ${dice2}，探索值 +2`, playerId);
    } else {
      engine.skipPlayerTurn(playerId, 1);
      engine.log(`限量供应：${dice1} -> ${dice2}，暂停一回合`, playerId);
    }
    return null;
  });

  // 零碎生活
  eventHandler.registerHandler('card_destiny_fragmented_life', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, -0.2);
    engine.log('零碎生活：毫无学习动力，GPA -0.2', playerId);
    return null;
  });

  // 一见钟情
  eventHandler.registerHandler('card_destiny_love_at_first_sight', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, 0.3);
    engine.log('一见钟情：成为图书馆常客，GPA +0.3', playerId);
    return null;
  });

  // 三闲而已
  eventHandler.registerHandler('card_destiny_three_idles', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 5);
    engine.log('三闲而已：探索值 +5', playerId);
    return null;
  });

  // 五湖四海
  eventHandler.registerHandler('card_destiny_five_lakes', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 1);
    engine.log('五湖四海：学习方言，探索值 +1', playerId);
    return null;
  });

  // 六朝古都
  eventHandler.registerHandler('card_destiny_six_dynasties', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('六朝古都：博物馆志愿，探索值 +2', playerId);
    return null;
  });

  // 八方来财
  eventHandler.registerHandler('card_destiny_eight_directions_wealth', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 200);
    engine.log('八方来财：金钱 +200', playerId);
    return null;
  });

  // 九乡河畔
  eventHandler.registerHandler('card_destiny_jiuxiang_river', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 1);
    engine.log('九乡河畔：探索值 +1', playerId);
    return null;
  });

  // 十全米线
  eventHandler.registerHandler('card_destiny_ten_rice_noodles', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 3);
    engine.log('十全米线：被爱情打动，探索值 +3', playerId);
    return null;
  });

  // 百发百中
  eventHandler.registerHandler('card_destiny_hundred_shots', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 1);
    engine.log('百发百中：命中靶心，探索值 +1', playerId);
    return null;
  });

  // 千秋万载
  eventHandler.registerHandler('card_destiny_thousand_years', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -500);
    engine.log('千秋万载：为南哪捐款，金钱 -500', playerId);
    return null;
  });

  // 听离南常 — 二选一
  eventHandler.registerHandler('card_destiny_listen_leave_south', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '听离南常：选择一个效果执行',
      [
        { label: '记得常回来看看（探索值+2）', value: 'card_listen_leave_explore', effectPreview: { exploration: 2 } },
        { label: '在南哪倒也正常（下次后退）', value: 'card_listen_leave_reverse' },
      ]
    );
  });

  eventHandler.registerHandler('card_listen_leave_explore', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('听离南常：听说你已离开南哪很久了，探索值+2', playerId);
    return null;
  });

  eventHandler.registerHandler('card_listen_leave_reverse', (engine, playerId) => {
    const state = engine.getState();
    engine.getDelayedEffects().add({
      playerId,
      type: 'reverse_move',
      triggerTurn: state.turnNumber + 1,
      triggerCondition: 'next_dice',
      data: {},
    });
    engine.log('听离南常：听起来有点离谱，下次投骰子改为后退', playerId);
    return null;
  });

  // === Chance Card Handlers ===
  // 卡牌 ID 格式：chance_xxx，加上 card_ 前缀变成 card_chance_xxx

  // 盗亦有道
  eventHandler.registerHandler('card_chance_steal_rich_help_poor', (engine, playerId) => {
    const players = engine.getAllPlayers();
    if (players.length < 2) return null;

    const sorted = [...players].sort((a, b) => b.money - a.money);
    const richest = sorted[0];
    const poorest = sorted[sorted.length - 1];

    engine.modifyPlayerMoney(richest.id, -200);
    engine.modifyPlayerMoney(poorest.id, 200);
    engine.log(`盗亦有道：${richest.name} 金钱 -200，${poorest.name} 金钱 +200`, playerId);
    return null;
  });

  // 分制转换
  eventHandler.registerHandler('card_chance_score_conversion', (engine, playerId) => {
    const players = engine.getAllPlayers();
    if (players.length < 2) return null;

    const sorted = [...players].sort((a, b) => b.gpa - a.gpa);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];

    engine.modifyPlayerGpa(highest.id, -0.2);
    engine.modifyPlayerGpa(lowest.id, 0.2);
    engine.log(`分制转换：${highest.name} GPA -0.2，${lowest.name} GPA +0.2`, playerId);
    return null;
  });

  // 重组宿舍
  eventHandler.registerHandler('card_chance_reorganize_dorm', (engine, playerId) => {
    const players = engine.getAllPlayers();
    if (players.length < 2) return null;

    const sorted = [...players].sort((a, b) => b.exploration - a.exploration);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];

    engine.modifyPlayerExploration(highest.id, -2);
    engine.modifyPlayerExploration(lowest.id, 2);
    engine.log(`重组宿舍：${highest.name} 探索值 -2，${lowest.name} 探索值 +2`, playerId);
    return null;
  });

  // 劫富济贫 — 选择一位玩家，双方金钱取平均
  eventHandler.registerHandler('card_chance_robin_hood', (engine, playerId) => {
    const others = engine.getAllPlayers().filter(p => p.id !== playerId && !p.isBankrupt);
    const action = engine.createPendingAction(
      playerId,
      'choose_player',
      '劫富济贫：选择一位玩家，你们的金钱重置为平均值',
      others.map(p => ({ label: `${p.name} (金钱:${p.money})`, value: p.id })),
      others.map(p => p.id),
    );
    action.callbackHandler = 'card_robin_hood_target';
    return action;
  });

  eventHandler.registerHandler('card_robin_hood_target', (engine, playerId, choice) => {
    const targetId = choice || '';
    const player = engine.getPlayer(playerId);
    const target = engine.getPlayer(targetId);
    if (!player || !target) return null;

    const avg = Math.floor((player.money + target.money) / 2);
    engine.modifyPlayerMoney(playerId, avg - player.money);
    engine.modifyPlayerMoney(targetId, avg - target.money);
    engine.log(`劫富济贫：${player.name}和${target.name}金钱重置为${avg}`, playerId);
    return null;
  });

  // 经费均摊
  eventHandler.registerHandler('card_chance_budget_sharing', (engine, playerId) => {
    const players = engine.getAllPlayers();
    players.forEach(p => {
      const diff = 2000 - p.money;
      engine.modifyPlayerMoney(p.id, diff);
    });
    engine.log('经费均摊：所有玩家金钱变为2000', playerId);
    return null;
  });

  // 结对编程 — GPA高的+0.1，低的+0.2，相同各+0.3
  eventHandler.registerHandler('card_chance_pair_programming', (engine, playerId) => {
    const others = engine.getAllPlayers().filter(p => p.id !== playerId && !p.isBankrupt);
    const action = engine.createPendingAction(
      playerId,
      'choose_player',
      '结对编程：选择一位玩家，GPA高者+0.1，低者+0.2，相同各+0.3',
      others.map(p => ({ label: `${p.name} (GPA:${p.gpa.toFixed(1)})`, value: p.id })),
      others.map(p => p.id),
    );
    action.callbackHandler = 'card_pair_programming_target';
    return action;
  });

  eventHandler.registerHandler('card_pair_programming_target', (engine, playerId, choice) => {
    const targetId = choice || '';
    const player = engine.getPlayer(playerId);
    const target = engine.getPlayer(targetId);
    if (!player || !target) return null;

    if (player.gpa > target.gpa) {
      engine.modifyPlayerGpa(playerId, 0.1);
      engine.modifyPlayerGpa(targetId, 0.2);
      engine.log(`结对编程：${player.name} GPA+0.1，${target.name} GPA+0.2`, playerId);
    } else if (player.gpa < target.gpa) {
      engine.modifyPlayerGpa(playerId, 0.2);
      engine.modifyPlayerGpa(targetId, 0.1);
      engine.log(`结对编程：${player.name} GPA+0.2，${target.name} GPA+0.1`, playerId);
    } else {
      engine.modifyPlayerGpa(playerId, 0.3);
      engine.modifyPlayerGpa(targetId, 0.3);
      engine.log(`结对编程：GPA相同，${player.name}和${target.name}各GPA+0.3`, playerId);
    }
    return null;
  });

  // 知识竞赛 — GPA总和>=5.0各得200金，否则各得1探索+0.1GPA
  eventHandler.registerHandler('card_chance_knowledge_competition', (engine, playerId) => {
    const others = engine.getAllPlayers().filter(p => p.id !== playerId && !p.isBankrupt);
    const action = engine.createPendingAction(
      playerId,
      'choose_player',
      '知识竞赛：选择一位玩家，GPA之和>=5.0则各得200金钱',
      others.map(p => ({ label: `${p.name} (GPA:${p.gpa.toFixed(1)})`, value: p.id })),
      others.map(p => p.id),
    );
    action.callbackHandler = 'card_knowledge_competition_target';
    return action;
  });

  eventHandler.registerHandler('card_knowledge_competition_target', (engine, playerId, choice) => {
    const targetId = choice || '';
    const player = engine.getPlayer(playerId);
    const target = engine.getPlayer(targetId);
    if (!player || !target) return null;

    const totalGpa = player.gpa + target.gpa;
    if (totalGpa >= 5.0) {
      engine.modifyPlayerMoney(playerId, 200);
      engine.modifyPlayerMoney(targetId, 200);
      engine.log(`知识竞赛：GPA总和${totalGpa.toFixed(1)}>=5.0，${player.name}和${target.name}各获200金钱`, playerId);
    } else {
      engine.modifyPlayerExploration(playerId, 1);
      engine.modifyPlayerGpa(playerId, 0.1);
      engine.modifyPlayerExploration(targetId, 1);
      engine.modifyPlayerGpa(targetId, 0.1);
      engine.log(`知识竞赛：GPA总和${totalGpa.toFixed(1)}<5.0，各获1探索值+0.1GPA`, playerId);
    }
    return null;
  });

  // 分组展示 — 双方投骰子，奇偶相同各+0.2GPA，否则各+0.1GPA
  eventHandler.registerHandler('card_chance_group_presentation', (engine, playerId) => {
    const others = engine.getAllPlayers().filter(p => p.id !== playerId && !p.isBankrupt);
    const action = engine.createPendingAction(
      playerId,
      'choose_player',
      '分组展示：选择一位玩家，投骰子奇偶相同各+0.2GPA',
      others.map(p => ({ label: p.name, value: p.id })),
      others.map(p => p.id),
    );
    action.callbackHandler = 'card_group_presentation_target';
    return action;
  });

  eventHandler.registerHandler('card_group_presentation_target', (engine, playerId, choice) => {
    const targetId = choice || '';
    const player = engine.getPlayer(playerId);
    const target = engine.getPlayer(targetId);
    if (!player || !target) return null;

    const dice1 = engine.rollDiceAndBroadcast(playerId, 1)[0];
    const dice2 = engine.rollDiceAndBroadcast(playerId, 1)[0];
    const sameOddEven = (dice1 % 2) === (dice2 % 2);
    if (sameOddEven) {
      engine.modifyPlayerGpa(playerId, 0.2);
      engine.modifyPlayerGpa(targetId, 0.2);
      engine.log(`分组展示：${player.name}(${dice1})和${target.name}(${dice2})奇偶相同，各GPA+0.2`, playerId);
    } else {
      engine.modifyPlayerGpa(playerId, 0.1);
      engine.modifyPlayerGpa(targetId, 0.1);
      engine.log(`分组展示：${player.name}(${dice1})和${target.name}(${dice2})奇偶不同，各GPA+0.1`, playerId);
    }
    return null;
  });

  // 旅游搭子 — 双方投骰子，奇偶相同各+2探索，否则各+1探索
  eventHandler.registerHandler('card_chance_travel_buddy', (engine, playerId) => {
    const others = engine.getAllPlayers().filter(p => p.id !== playerId && !p.isBankrupt);
    const action = engine.createPendingAction(
      playerId,
      'choose_player',
      '旅游搭子：选择一位玩家，投骰子奇偶相同各+2探索值',
      others.map(p => ({ label: p.name, value: p.id })),
      others.map(p => p.id),
    );
    action.callbackHandler = 'card_travel_buddy_target';
    return action;
  });

  eventHandler.registerHandler('card_travel_buddy_target', (engine, playerId, choice) => {
    const targetId = choice || '';
    const player = engine.getPlayer(playerId);
    const target = engine.getPlayer(targetId);
    if (!player || !target) return null;

    const dice1 = engine.rollDiceAndBroadcast(playerId, 1)[0];
    const dice2 = engine.rollDiceAndBroadcast(playerId, 1)[0];
    const sameOddEven = (dice1 % 2) === (dice2 % 2);
    if (sameOddEven) {
      engine.modifyPlayerExploration(playerId, 2);
      engine.modifyPlayerExploration(targetId, 2);
      engine.log(`旅游搭子：${player.name}(${dice1})和${target.name}(${dice2})奇偶相同，各探索值+2`, playerId);
    } else {
      engine.modifyPlayerExploration(playerId, 1);
      engine.modifyPlayerExploration(targetId, 1);
      engine.log(`旅游搭子：${player.name}(${dice1})和${target.name}(${dice2})奇偶不同，各探索值+1`, playerId);
    }
    return null;
  });

  // 拼单活动 — 双方投骰子，奇偶相同各+200金钱，否则各+100金钱
  eventHandler.registerHandler('card_chance_group_buy', (engine, playerId) => {
    const others = engine.getAllPlayers().filter(p => p.id !== playerId && !p.isBankrupt);
    const action = engine.createPendingAction(
      playerId,
      'choose_player',
      '拼单活动：选择一位玩家，投骰子奇偶相同各+200金钱',
      others.map(p => ({ label: p.name, value: p.id })),
      others.map(p => p.id),
    );
    action.callbackHandler = 'card_group_buy_target';
    return action;
  });

  eventHandler.registerHandler('card_group_buy_target', (engine, playerId, choice) => {
    const targetId = choice || '';
    const player = engine.getPlayer(playerId);
    const target = engine.getPlayer(targetId);
    if (!player || !target) return null;

    const dice1 = engine.rollDiceAndBroadcast(playerId, 1)[0];
    const dice2 = engine.rollDiceAndBroadcast(playerId, 1)[0];
    const sameOddEven = (dice1 % 2) === (dice2 % 2);
    if (sameOddEven) {
      engine.modifyPlayerMoney(playerId, 200);
      engine.modifyPlayerMoney(targetId, 200);
      engine.log(`拼单活动：${player.name}(${dice1})和${target.name}(${dice2})奇偶相同，各金钱+200`, playerId);
    } else {
      engine.modifyPlayerMoney(playerId, 100);
      engine.modifyPlayerMoney(targetId, 100);
      engine.log(`拼单活动：${player.name}(${dice1})和${target.name}(${dice2})奇偶不同，各金钱+100`, playerId);
    }
    return null;
  });

  // 翻转课堂 — 选择两位玩家，各投骰子，大者GPA+0.2，小者GPA-0.1
  eventHandler.registerHandler('card_chance_flipped_classroom', (engine, playerId) => {
    const others = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    if (others.length < 2) return null;

    const options = others.map(p => ({ label: p.name, value: p.id }));
    const action = engine.createPendingAction(
      playerId, 'choose_option', '翻转课堂：选择第一位玩家', options
    );
    action.callbackHandler = 'card_flipped_classroom_p1';
    return action;
  });

  eventHandler.registerHandler('card_flipped_classroom_p1', (engine, playerId, choice) => {
    if (!choice) return null;
    const others = engine.getAllPlayers().filter(p => !p.isBankrupt && p.id !== choice);
    if (others.length === 0) return null;
    const options = others.map(p => ({ label: p.name, value: `${choice}:${p.id}` }));
    const action = engine.createPendingAction(
      playerId, 'choose_option', '翻转课堂：选择第二位玩家', options
    );
    action.callbackHandler = 'card_flipped_classroom_p2';
    return action;
  });

  eventHandler.registerHandler('card_flipped_classroom_p2', (engine, playerId, choice) => {
    if (!choice) return null;
    const [p1Id, p2Id] = choice.split(':');
    const p1 = engine.getPlayer(p1Id);
    const p2 = engine.getPlayer(p2Id);
    if (!p1 || !p2) return null;

    const dice1 = engine.rollDiceAndBroadcast(p1Id, 1)[0];
    const dice2 = engine.rollDiceAndBroadcast(p2Id, 1)[0];
    if (dice1 > dice2) {
      engine.modifyPlayerGpa(p1Id, 0.2);
      engine.modifyPlayerGpa(p2Id, -0.1);
      engine.log(`翻转课堂：${p1.name}(${dice1})>${p2.name}(${dice2})，${p1.name} GPA+0.2，${p2.name} GPA-0.1`, playerId);
    } else if (dice2 > dice1) {
      engine.modifyPlayerGpa(p2Id, 0.2);
      engine.modifyPlayerGpa(p1Id, -0.1);
      engine.log(`翻转课堂：${p2.name}(${dice2})>${p1.name}(${dice1})，${p2.name} GPA+0.2，${p1.name} GPA-0.1`, playerId);
    } else {
      engine.modifyPlayerGpa(p1Id, 0.1);
      engine.modifyPlayerGpa(p2Id, 0.1);
      engine.log(`翻转课堂：${p1.name}(${dice1})=${p2.name}(${dice2})，各GPA+0.1`, playerId);
    }
    return null;
  });

  // 团学面试 — 选择两位玩家，各投骰子，大者探索+2，小者探索-1
  eventHandler.registerHandler('card_chance_student_union_interview', (engine, playerId) => {
    const others = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    if (others.length < 2) return null;

    const options = others.map(p => ({ label: p.name, value: p.id }));
    const action = engine.createPendingAction(
      playerId, 'choose_option', '团学面试：选择第一位玩家', options
    );
    action.callbackHandler = 'card_student_union_p1';
    return action;
  });

  eventHandler.registerHandler('card_student_union_p1', (engine, playerId, choice) => {
    if (!choice) return null;
    const others = engine.getAllPlayers().filter(p => !p.isBankrupt && p.id !== choice);
    if (others.length === 0) return null;
    const options = others.map(p => ({ label: p.name, value: `${choice}:${p.id}` }));
    const action = engine.createPendingAction(
      playerId, 'choose_option', '团学面试：选择第二位玩家', options
    );
    action.callbackHandler = 'card_student_union_p2';
    return action;
  });

  eventHandler.registerHandler('card_student_union_p2', (engine, playerId, choice) => {
    if (!choice) return null;
    const [p1Id, p2Id] = choice.split(':');
    const p1 = engine.getPlayer(p1Id);
    const p2 = engine.getPlayer(p2Id);
    if (!p1 || !p2) return null;

    const dice1 = engine.rollDiceAndBroadcast(p1Id, 1)[0];
    const dice2 = engine.rollDiceAndBroadcast(p2Id, 1)[0];
    if (dice1 > dice2) {
      engine.modifyPlayerExploration(p1Id, 2);
      engine.modifyPlayerExploration(p2Id, -1);
      engine.log(`团学面试：${p1.name}(${dice1})>${p2.name}(${dice2})，${p1.name} 探索+2，${p2.name} 探索-1`, playerId);
    } else if (dice2 > dice1) {
      engine.modifyPlayerExploration(p2Id, 2);
      engine.modifyPlayerExploration(p1Id, -1);
      engine.log(`团学面试：${p2.name}(${dice2})>${p1.name}(${dice1})，${p2.name} 探索+2，${p1.name} 探索-1`, playerId);
    } else {
      engine.modifyPlayerExploration(p1Id, 1);
      engine.modifyPlayerExploration(p2Id, 1);
      engine.log(`团学面试：${p1.name}(${dice1})=${p2.name}(${dice2})，各探索+1`, playerId);
    }
    return null;
  });

  // 集赞抽奖 — 选择两位玩家，各投骰子，大者金钱+200，小者金钱-100
  eventHandler.registerHandler('card_chance_like_collection', (engine, playerId) => {
    const others = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    if (others.length < 2) return null;

    const options = others.map(p => ({ label: p.name, value: p.id }));
    const action = engine.createPendingAction(
      playerId, 'choose_option', '集赞抽奖：选择第一位玩家', options
    );
    action.callbackHandler = 'card_like_collection_p1';
    return action;
  });

  eventHandler.registerHandler('card_like_collection_p1', (engine, playerId, choice) => {
    if (!choice) return null;
    const others = engine.getAllPlayers().filter(p => !p.isBankrupt && p.id !== choice);
    if (others.length === 0) return null;
    const options = others.map(p => ({ label: p.name, value: `${choice}:${p.id}` }));
    const action = engine.createPendingAction(
      playerId, 'choose_option', '集赞抽奖：选择第二位玩家', options
    );
    action.callbackHandler = 'card_like_collection_p2';
    return action;
  });

  eventHandler.registerHandler('card_like_collection_p2', (engine, playerId, choice) => {
    if (!choice) return null;
    const [p1Id, p2Id] = choice.split(':');
    const p1 = engine.getPlayer(p1Id);
    const p2 = engine.getPlayer(p2Id);
    if (!p1 || !p2) return null;

    const dice1 = engine.rollDiceAndBroadcast(p1Id, 1)[0];
    const dice2 = engine.rollDiceAndBroadcast(p2Id, 1)[0];
    if (dice1 > dice2) {
      engine.modifyPlayerMoney(p1Id, 200);
      engine.modifyPlayerMoney(p2Id, -100);
      engine.log(`集赞抽奖：${p1.name}(${dice1})>${p2.name}(${dice2})，${p1.name} 金钱+200，${p2.name} 金钱-100`, playerId);
    } else if (dice2 > dice1) {
      engine.modifyPlayerMoney(p2Id, 200);
      engine.modifyPlayerMoney(p1Id, -100);
      engine.log(`集赞抽奖：${p2.name}(${dice2})>${p1.name}(${dice1})，${p2.name} 金钱+200，${p1.name} 金钱-100`, playerId);
    } else {
      engine.modifyPlayerMoney(p1Id, 100);
      engine.modifyPlayerMoney(p2Id, 100);
      engine.log(`集赞抽奖：${p1.name}(${dice1})=${p2.name}(${dice2})，各金钱+100`, playerId);
    }
    return null;
  });

  // 垃圾回收 — 所有玩家持有的机会卡和命运卡放回牌堆
  eventHandler.registerHandler('card_chance_garbage_collection', (engine, playerId) => {
    const players = engine.getAllPlayers();
    let totalCards = 0;
    for (const p of players) {
      const cardsToRemove = [...p.heldCards];
      for (const card of cardsToRemove) {
        engine.removeCardFromPlayer(p.id, card.id);
        totalCards++;
      }
    }
    engine.log(`垃圾回收：所有玩家的${totalCards}张卡牌放回牌堆`, playerId);
    return null;
  });

  // 朋辈导师 — 拿走别人一张卡，没有则给别人一张
  eventHandler.registerHandler('card_chance_peer_mentor', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    // Check if any other player has cards
    const othersWithCards = engine.getAllPlayers().filter(p => p.id !== playerId && !p.isBankrupt && p.heldCards.length > 0);
    if (othersWithCards.length > 0) {
      // Take a random card from the player with most cards
      const target = othersWithCards.sort((a, b) => b.heldCards.length - a.heldCards.length)[0];
      const randomCard = target.heldCards[Math.floor(Math.random() * target.heldCards.length)];
      engine.removeCardFromPlayer(target.id, randomCard.id);
      engine.giveCardToPlayer(playerId, { ...randomCard });
      engine.log(`朋辈导师：从${target.name}处拿走${randomCard.name}`, playerId);
    } else if (player.heldCards.length > 0) {
      // Give a random card to a random other player
      const others = engine.getAllPlayers().filter(p => p.id !== playerId && !p.isBankrupt);
      if (others.length > 0) {
        const target = others[Math.floor(Math.random() * others.length)];
        const randomCard = player.heldCards[Math.floor(Math.random() * player.heldCards.length)];
        engine.removeCardFromPlayer(playerId, randomCard.id);
        engine.giveCardToPlayer(target.id, { ...randomCard });
        engine.log(`朋辈导师：将${randomCard.name}交给${target.name}`, playerId);
      }
    } else {
      engine.log('朋辈导师：没有任何玩家持有卡牌，无事发生', playerId);
    }
    return null;
  });

  // 联合培养 — 选择一位玩家交换辅修培养计划
  eventHandler.registerHandler('card_chance_joint_training', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    if (player.minorPlans.length === 0) {
      engine.log('联合培养：你没有辅修培养计划，无法交换', playerId);
      return null;
    }

    const others = engine.getAllPlayers().filter(p =>
      p.id !== playerId && !p.isBankrupt && p.minorPlans.length > 0
    );
    if (others.length === 0) {
      engine.log('联合培养：没有其他玩家有辅修培养计划', playerId);
      return null;
    }

    const options = others.map(p => ({
      label: p.name,
      value: p.id,
      description: `辅修: ${p.minorPlans.map(id => p.trainingPlans.find(tp => tp.id === id)?.name || id).join(', ')}`,
    }));
    const action = engine.createPendingAction(
      playerId, 'choose_option', '联合培养：选择一位玩家交换辅修培养计划', options
    );
    action.callbackHandler = 'card_joint_training_choose_target';
    return action;
  });

  // 联合培养 Step 1: target chosen, now choose own minor (or auto-resolve)
  eventHandler.registerHandler('card_joint_training_choose_target', (engine, playerId, choice) => {
    const player = engine.getPlayer(playerId);
    if (!player || !choice) return null;

    const target = engine.getPlayer(choice);
    if (!target) return null;

    // If both have exactly 1 minor, swap directly
    if (player.minorPlans.length === 1 && target.minorPlans.length === 1) {
      swapMinorPlans(engine, player, player.minorPlans[0], target, target.minorPlans[0]);
      return null;
    }

    // If player has 1 minor but target has multiple, skip to choosing target's
    if (player.minorPlans.length === 1) {
      const options = target.minorPlans.map(id => {
        const plan = target.trainingPlans.find(p => p.id === id);
        return { label: plan?.name || id, value: `${choice}:${player.minorPlans[0]}:${id}` };
      });
      const action = engine.createPendingAction(
        playerId, 'choose_option', `选择${target.name}的一项辅修计划来交换`, options
      );
      action.callbackHandler = 'card_joint_training_finalize';
      return action;
    }

    // Player has multiple minors — choose own first
    const myOptions = player.minorPlans.map(id => {
      const plan = player.trainingPlans.find(p => p.id === id);
      return { label: plan?.name || id, value: `${choice}:${id}` };
    });
    const action = engine.createPendingAction(
      playerId, 'choose_option', '选择你要交换的辅修培养计划', myOptions
    );
    action.callbackHandler = 'card_joint_training_choose_mine';
    return action;
  });

  // 联合培养 Step 2: own minor chosen, now choose target's minor
  eventHandler.registerHandler('card_joint_training_choose_mine', (engine, playerId, choice) => {
    const player = engine.getPlayer(playerId);
    if (!player || !choice) return null;

    const [targetId, myPlanId] = choice.split(':');
    const target = engine.getPlayer(targetId);
    if (!target) return null;

    if (target.minorPlans.length === 1) {
      swapMinorPlans(engine, player, myPlanId, target, target.minorPlans[0]);
      return null;
    }

    const options = target.minorPlans.map(id => {
      const plan = target.trainingPlans.find(p => p.id === id);
      return { label: plan?.name || id, value: `${targetId}:${myPlanId}:${id}` };
    });
    const action = engine.createPendingAction(
      playerId, 'choose_option', `选择${target.name}的一项辅修计划来交换`, options
    );
    action.callbackHandler = 'card_joint_training_finalize';
    return action;
  });

  // 联合培养 Step 3: finalize swap
  eventHandler.registerHandler('card_joint_training_finalize', (engine, playerId, choice) => {
    const player = engine.getPlayer(playerId);
    if (!player || !choice) return null;

    const [targetId, myPlanId, theirPlanId] = choice.split(':');
    const target = engine.getPlayer(targetId);
    if (!target) return null;

    swapMinorPlans(engine, player, myPlanId, target, theirPlanId);
    return null;
  });

  // 学科评估 — 抽培养计划替换某位玩家的辅修计划
  // Option values encode the drawn plan ID as prefix: "drawnPlanId|targetPlayerId"
  eventHandler.registerHandler('card_chance_discipline_evaluation', (engine, playerId) => {
    const newPlan = engine.drawTrainingPlan(playerId);
    if (!newPlan) {
      engine.log('学科评估：培养计划牌堆已空', playerId);
      return null;
    }

    // Find other players with minor plans
    const others = engine.getAllPlayers().filter(p =>
      p.id !== playerId && !p.isBankrupt && p.minorPlans.length > 0
    );
    if (others.length === 0) {
      engine.log(`学科评估：抽到${newPlan.name}，但无人有辅修计划可替换`, playerId);
      return null;
    }

    const options = others.map(p => ({
      label: p.name,
      value: `${newPlan.id}|${p.id}`,
      description: `辅修: ${p.minorPlans.map(id => p.trainingPlans.find(tp => tp.id === id)?.name || id).join(', ')}`,
    }));
    const action = engine.createPendingAction(
      playerId, 'choose_option', `学科评估：抽到 ${newPlan.name}，选择一位玩家替换其辅修计划`, options
    );
    action.callbackHandler = 'card_discipline_evaluation_target';
    return action;
  });

  // 学科评估 Step 1: target chosen — choice format: "drawnPlanId|targetPlayerId"
  eventHandler.registerHandler('card_discipline_evaluation_target', (engine, playerId, choice) => {
    if (!choice) return null;
    const [drawnPlanId, targetId] = choice.split('|');
    const target = engine.getPlayer(targetId);
    const player = engine.getPlayer(playerId);
    if (!target || !player) return null;

    const newPlan = player.trainingPlans.find(p => p.id === drawnPlanId);
    if (!newPlan) return null;

    if (target.minorPlans.length === 1) {
      // Only one minor, replace directly
      const replacedId = target.minorPlans[0];
      const replaced = target.trainingPlans.find(p => p.id === replacedId);
      target.trainingPlans = target.trainingPlans.filter(p => p.id !== replacedId);
      target.minorPlans = [newPlan.id];
      target.trainingPlans.push(newPlan);
      player.trainingPlans = player.trainingPlans.filter(p => p.id !== newPlan.id);
      engine.log(`学科评估：将${target.name}的辅修 ${replaced?.name} 替换为 ${newPlan.name}`, playerId);
      return null;
    }

    // Multiple minors — let player choose which to replace
    // Choice format: "drawnPlanId|targetPlayerId:minorPlanId"
    const options = target.minorPlans.map(id => {
      const plan = target.trainingPlans.find(p => p.id === id);
      return { label: plan?.name || id, value: `${drawnPlanId}|${targetId}:${id}` };
    });
    const action = engine.createPendingAction(
      playerId, 'choose_option', `选择${target.name}的一项辅修计划来替换`, options
    );
    action.callbackHandler = 'card_discipline_evaluation_replace';
    return action;
  });

  // 学科评估 Step 2: finalize replacement — choice format: "drawnPlanId|targetPlayerId:replacedPlanId"
  eventHandler.registerHandler('card_discipline_evaluation_replace', (engine, playerId, choice) => {
    if (!choice) return null;
    const [drawnPlanId, rest] = choice.split('|');
    const [targetId, replacedId] = rest.split(':');
    const target = engine.getPlayer(targetId);
    const player = engine.getPlayer(playerId);
    if (!target || !player) return null;

    const newPlan = player.trainingPlans.find(p => p.id === drawnPlanId);
    if (!newPlan) return null;
    const replaced = target.trainingPlans.find(p => p.id === replacedId);
    target.trainingPlans = target.trainingPlans.filter(p => p.id !== replacedId);
    target.minorPlans = target.minorPlans.filter(id => id !== replacedId).concat(newPlan.id);
    target.trainingPlans.push(newPlan);
    player.trainingPlans = player.trainingPlans.filter(p => p.id !== newPlan.id);
    engine.log(`学科评估：将${target.name}的辅修 ${replaced?.name} 替换为 ${newPlan.name}`, playerId);
    return null;
  });

  // 网格管理 — 选择两位玩家，下回合内他们的增减同步
  eventHandler.registerHandler('card_chance_grid_management', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    if (players.length < 2) {
      engine.log('网格管理：玩家不足，无法执行', playerId);
      return null;
    }

    const options = players.map(p => ({ label: p.name, value: p.id }));
    const action = engine.createPendingAction(
      playerId, 'choose_option', '网格管理：选择第一位玩家', options
    );
    action.callbackHandler = 'card_grid_management_p1';
    return action;
  });

  eventHandler.registerHandler('card_grid_management_p1', (engine, playerId, choice) => {
    if (!choice) return null;
    const others = engine.getAllPlayers().filter(p => !p.isBankrupt && p.id !== choice);
    if (others.length === 0) return null;
    const options = others.map(p => ({ label: p.name, value: `${choice}:${p.id}` }));
    const action = engine.createPendingAction(
      playerId, 'choose_option', '网格管理：选择第二位玩家', options
    );
    action.callbackHandler = 'card_grid_management_p2';
    return action;
  });

  eventHandler.registerHandler('card_grid_management_p2', (engine, playerId, choice) => {
    if (!choice) return null;
    const [p1Id, p2Id] = choice.split(':');
    const p1 = engine.getPlayer(p1Id);
    const p2 = engine.getPlayer(p2Id);
    if (!p1 || !p2) return null;

    // Add gridLink effect to both players, linking them for 1 round
    engine.addEffectToPlayer(p1Id, {
      id: `gridLink_${Date.now()}_1`,
      type: 'custom' as const,
      turnsRemaining: 2,
      data: { gridLinkTarget: p2Id },
    });
    engine.addEffectToPlayer(p2Id, {
      id: `gridLink_${Date.now()}_2`,
      type: 'custom' as const,
      turnsRemaining: 2,
      data: { gridLinkTarget: p1Id },
    });
    engine.log(`网格管理：${p1.name}和${p2.name}被绑定，下回合内增减同步`, playerId);
    return null;
  });

  // 泳馆常客 — 全体投票+骰子
  eventHandler.registerHandler('card_chance_swimming_pool_regular', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    return {
      id: `vote_swimming_pool_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '泳馆常客：选择按次缴费还是年卡用户？',
      options: [
        { label: '按次缴费', value: 'per_use' },
        { label: '年卡用户', value: 'annual' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'chance_swimming_pool_regular',
      timeoutMs: 30000,
    };
  });

  // 相逢是缘 — 全体投票+骰子
  eventHandler.registerHandler('card_chance_meeting_is_fate', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    return {
      id: `vote_meeting_fate_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '相逢是缘：选择图书馆还是运动场？',
      options: [
        { label: '图书馆', value: 'library' },
        { label: '运动场', value: 'sports' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'chance_meeting_is_fate',
      timeoutMs: 30000,
    };
  });

  // 初雪留痕 — 全体投票
  eventHandler.registerHandler('card_chance_first_snow', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    return {
      id: `vote_first_snow_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '初雪留痕：选择初雪告白还是大雪无声？',
      options: [
        { label: '初雪告白', value: 'confession' },
        { label: '大雪无声', value: 'silence' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'chance_first_snow',
      timeoutMs: 30000,
    };
  });

  // 怪奇物谈 — 全体投票+骰子
  eventHandler.registerHandler('card_chance_strange_tales', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    return {
      id: `vote_strange_tales_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '怪奇物谈：选择鼎里还是天文山？',
      options: [
        { label: '鼎里', value: 'ding' },
        { label: '天文山', value: 'tianwenshan' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'chance_strange_tales',
      timeoutMs: 30000,
    };
  });

  // 外卖贼盗 — 全体投票+骰子
  eventHandler.registerHandler('card_chance_delivery_theft', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && p.id !== playerId);
    return {
      id: `vote_delivery_theft_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '外卖贼盗：选择监控报警还是默不作声？',
      options: [
        { label: '监控报警', value: 'report' },
        { label: '默不作声', value: 'silent' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'chance_delivery_theft',
      timeoutMs: 30000,
    };
  });

  // 寻根时刻 — 全体投票+骰子
  eventHandler.registerHandler('card_chance_root_finding_moment', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    return {
      id: `vote_root_finding_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '寻根时刻：选择装潢一新还是历史古迹？',
      options: [
        { label: '装潢一新', value: 'renovate' },
        { label: '历史古迹', value: 'historic' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'chance_root_finding_moment',
      timeoutMs: 30000,
    };
  });

  // 休憩时刻 — 全体投票
  eventHandler.registerHandler('card_chance_rest_moment', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    return {
      id: `vote_rest_moment_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '休憩时刻：选择大气山还是羊山湖？',
      options: [
        { label: '大气山', value: 'daqishan' },
        { label: '羊山湖', value: 'yangshanhu' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'chance_rest_moment',
      timeoutMs: 30000,
    };
  });

  // 光影变幻 — 多数票决定效果
  eventHandler.registerHandler('card_chance_light_shadow', (engine, _playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    return {
      id: `vote_light_shadow_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '光影变幻：选择藜照湖或菜根谭',
      options: [
        { label: '藜照湖', value: 'lizhaohu' },
        { label: '菜根谭', value: 'caigentan' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'chance_light_shadow',
      timeoutMs: 30000,
    };
  });

  // 课程建群 — 多数票决定效果
  eventHandler.registerHandler('card_chance_course_group', (engine, _playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    return {
      id: `vote_course_group_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '课程建群：你课程群最新消息来自哪个平台？',
      options: [
        { label: 'QQ', value: 'qq' },
        { label: '微信', value: 'wechat' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'chance_course_group',
      timeoutMs: 30000,
    };
  });

  // 换乘时刻 — 投票+骰子决定效果
  eventHandler.registerHandler('card_chance_transfer_moment', (engine, _playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    return {
      id: `vote_transfer_moment_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '换乘时刻：选择新街口或金马路',
      options: [
        { label: '新街口', value: 'xinjiekou' },
        { label: '金马路', value: 'jinmalu' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'chance_transfer_moment',
      timeoutMs: 30000,
    };
  });

  // 妙语连珠 — 投票+骰子决定效果
  eventHandler.registerHandler('card_chance_wit_words', (engine, _playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    return {
      id: `vote_wit_words_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '妙语连珠：选择南哪辩论赛或南哪演说家',
      options: [
        { label: '南哪辩论赛', value: 'debate' },
        { label: '南哪演说家', value: 'speaker' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'chance_wit_words',
      timeoutMs: 30000,
    };
  });

  // 校运动会 — 投票+骰子决定效果
  eventHandler.registerHandler('card_chance_school_sports_meet', (engine, _playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    return {
      id: `vote_school_sports_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '校运动会：选择入场式或广播操',
      options: [
        { label: '入场式', value: 'entrance' },
        { label: '广播操', value: 'exercise' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'chance_school_sports_meet',
      timeoutMs: 30000,
    };
  });

  // 出行方式 — 投票+惩罚选择
  eventHandler.registerHandler('card_chance_travel_method', (engine, _playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt && !p.isDisconnected);
    return {
      id: `vote_travel_method_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '出行方式：选择你的出行方式',
      options: [
        { label: '共享出行', value: 'shared', description: '人多则受罚（-100金 or 暂停1回合），人少则获利（GPA+0.2）' },
        { label: '丈量校园', value: 'walk', description: '人多则受罚（-1探索 or 暂停1回合），人少则获利（探索+2）' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'chance_travel_method',
      timeoutMs: 30000,
    };
  });

  // 出行方式 — 惩罚选择回调（链式处理多个玩家）
  // Registered once at init; chain continuation re-uses the same static handler ID.
  eventHandler.registerHandler('travel_penalty_callback', (engine, playerId, choice) => {
    const player = engine.getPlayer(playerId);
    if (player && choice) {
      if (choice === 'money_loss') {
        engine.modifyPlayerMoney(playerId, -100);
        engine.log(`${player.name} 选择：金钱 -100`, playerId);
      } else if (choice === 'exp_loss') {
        engine.modifyPlayerExploration(playerId, -1);
        engine.log(`${player.name} 选择：探索值 -1`, playerId);
      } else if (choice === 'skip_turn') {
        engine.skipPlayerTurn(playerId, 1);
        engine.log(`${player.name} 选择：暂停一回合`, playerId);
      }
    }

    // Check for queued penalty players
    if (player) {
      const queueIdx = player.effects.findIndex(
        e => e.type === 'custom' && e.data?.travelPenaltyQueue
      );
      if (queueIdx >= 0) {
        const remaining = (player.effects[queueIdx].data!.travelPenaltyQueue as string[]);
        const side = (player.effects[queueIdx].data!.travelPenaltySide as 'shared' | 'walk');
        player.effects.splice(queueIdx, 1);

        if (remaining.length > 0) {
          const [nextId, ...rest] = remaining;
          const nextPlayer = engine.getPlayer(nextId);
          if (nextPlayer) {
            // Store remaining in next player's effects
            if (rest.length > 0) {
              nextPlayer.effects.push({
                id: `travel_penalty_queue_${Date.now()}`,
                type: 'custom' as const,
                turnsRemaining: 1,
                data: { travelPenaltyQueue: rest, travelPenaltySide: side },
              });
            }

            const penaltyOptions = side === 'shared'
              ? [
                  { label: '金钱 -100', value: 'money_loss', effectPreview: { money: -100 } },
                  { label: '暂停一回合', value: 'skip_turn' },
                ]
              : [
                  { label: '探索值 -1', value: 'exp_loss', effectPreview: { exploration: -1 } },
                  { label: '暂停一回合', value: 'skip_turn' },
                ];

            const action = engine.createPendingAction(
              nextId, 'choose_option',
              `出行方式：${nextPlayer.name}，选择你的惩罚`,
              penaltyOptions,
            );
            action.callbackHandler = 'travel_penalty_callback';
            return action;
          }
        }
      }
    }

    return null;
  });

  // 八卦秘闻 — 简化为抽卡者选择参与或放弃
  eventHandler.registerHandler('card_chance_gossip_secret', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '八卦秘闻：是否参与悄悄告知？参与则投骰子，点数>1获得奖励，否则受惩罚',
      [
        { label: '参与（投骰子）', value: 'card_gossip_participate' },
        { label: '放弃', value: 'card_gossip_skip' },
      ],
    );
  });

  // 八卦秘闻 — 参与
  eventHandler.registerHandler('card_gossip_participate', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice > 1) {
      engine.modifyPlayerMoney(playerId, 200);
      engine.modifyPlayerGpa(playerId, 0.2);
      engine.modifyPlayerExploration(playerId, 2);
      engine.log(`八卦秘闻投出${dice}(>1)：金钱+200, GPA+0.2, 探索值+2`, playerId);
    } else {
      engine.modifyPlayerMoney(playerId, -200);
      engine.modifyPlayerGpa(playerId, -0.2);
      engine.modifyPlayerExploration(playerId, -2);
      engine.log(`八卦秘闻投出${dice}(≤1)：金钱-200, GPA-0.2, 探索值-2`, playerId);
    }
    return null;
  });

  // 八卦秘闻 — 放弃
  eventHandler.registerHandler('card_gossip_skip', (engine, playerId) => {
    engine.log('八卦秘闻：放弃参与', playerId);
    return null;
  });

  // ===================================================================
  // Holdable Card Handlers (20 cards — used from hand via handleUseCard)
  // ===================================================================

  // --- Destiny Holdable (14) ---

  // 1. 麦门护盾 — add foodShield effect (food line negative events blocked)
  eventHandler.registerHandler('card_destiny_maimen_shield', (engine, playerId) => {
    engine.addEffectToPlayer(playerId, {
      id: `foodShield_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 999,
      data: { foodShield: true },
    });
    engine.log('麦门护盾：食堂线负面效果已屏蔽', playerId);
    return null;
  });

  // 2. 及时止损 — now handled by negate window system (reactive, not pre-hang)
  // Handler removed: card is used reactively during negate windows

  // 3. 工期紧迫 — leave hospital or ding immediately
  eventHandler.registerHandler('card_destiny_urgent_deadline', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    if (player.isInHospital) {
      engine.setPlayerHospitalStatus(playerId, false);
      engine.log('工期紧迫：直接出院', playerId);
      return {
        id: `roll_dice_${Date.now()}`,
        playerId,
        type: 'roll_dice' as const,
        prompt: '已出院，请投骰子移动',
        timeoutMs: 60000,
      };
    } else if (player.isAtDing) {
      engine.setPlayerDingStatus(playerId, false);
      engine.log('工期紧迫：直接离开鼎', playerId);
      return {
        id: `roll_dice_${Date.now()}`,
        playerId,
        type: 'roll_dice' as const,
        prompt: '已离开鼎，请投骰子移动',
        timeoutMs: 60000,
      };
    } else {
      engine.log('工期紧迫：当前不在医院或鼎，无效', playerId);
      return null;
    }
  });

  // 4. 余额为负 — negate next money expense
  eventHandler.registerHandler('card_destiny_negative_balance', (engine, playerId) => {
    engine.addEffectToPlayer(playerId, {
      id: `negateExpense_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 2,
      data: { negateExpense: true },
    });
    engine.log('余额为负：下次金钱扣除将被抵消', playerId);
    return null;
  });

  // 5. 祖传试卷 — block next GPA loss
  eventHandler.registerHandler('card_destiny_inherited_papers', (engine, playerId) => {
    engine.addEffectToPlayer(playerId, {
      id: `blockGpa_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 2,
      data: { blockGpaLoss: true },
    });
    engine.log('祖传试卷：下次GPA损失将被抵消', playerId);
    return null;
  });

  // 6. 投石问路 — block next money loss
  eventHandler.registerHandler('card_destiny_throw_stone', (engine, playerId) => {
    engine.addEffectToPlayer(playerId, {
      id: `blockMoney_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 2,
      data: { blockMoneyLoss: true },
    });
    engine.log('投石问路：下次金钱损失将被抵消', playerId);
    return null;
  });

  // 7. 校园传说 — block next exploration loss
  eventHandler.registerHandler('card_destiny_campus_legend', (engine, playerId) => {
    engine.addEffectToPlayer(playerId, {
      id: `blockExplore_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 2,
      data: { blockExplorationLoss: true },
    });
    engine.log('校园传说：下次探索值损失将被抵消', playerId);
    return null;
  });

  // 8. 另辟蹊径 — exit line immediately without experience card
  eventHandler.registerHandler('card_destiny_alternative_path', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    if (player.position.type === 'line') {
      engine.exitLine(playerId, false);
      engine.log('另辟蹊径：直接退出支线，不领经验卡', playerId);
    } else {
      engine.log('另辟蹊径：当前不在支线内，无效', playerId);
    }
    return null;
  });

  // 10. 跨院准出 — swap major and minor plan
  eventHandler.registerHandler('card_destiny_cross_college_exit', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    if (player.minorPlans.length === 0) {
      engine.log('跨院准出：没有辅修培养计划，无事发生', playerId);
      return null;
    }

    if (player.minorPlans.length === 1) {
      // Only one minor — auto-swap
      const oldMajor = player.majorPlan;
      const oldMinor = player.minorPlans[0];
      player.majorPlan = oldMinor;
      player.minorPlans = oldMajor ? [oldMajor] : [];
      const majorName = player.trainingPlans.find(p => p.id === oldMinor)?.name || oldMinor;
      engine.log(`跨院准出：主修变为 ${majorName}`, playerId);
      return null;
    }

    // Multiple minors — let player choose which to swap with major
    const options = player.minorPlans.map(planId => {
      const plan = player.trainingPlans.find(p => p.id === planId);
      return { label: plan?.name || planId, value: planId };
    });
    const action = engine.createPendingAction(
      playerId, 'choose_option', '跨院准出：选择一项辅修与主修交换', options
    );
    action.callbackHandler = 'card_cross_college_exit_callback';
    return action;
  });

  eventHandler.registerHandler('card_cross_college_exit_callback', (engine, playerId, choice) => {
    const player = engine.getPlayer(playerId);
    if (!player || !choice) return null;

    const oldMajor = player.majorPlan;
    player.majorPlan = choice;
    player.minorPlans = player.minorPlans.filter(id => id !== choice);
    if (oldMajor) player.minorPlans.push(oldMajor);
    const majorName = player.trainingPlans.find(p => p.id === choice)?.name || choice;
    engine.log(`跨院准出：主修变为 ${majorName}`, playerId);
    return null;
  });

  // 11. 专业意向 — permanently add a plan slot + bonus
  eventHandler.registerHandler('card_destiny_professional_intention', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    player.planSlotLimit += 1;
    engine.modifyPlayerGpa(playerId, 0.1);
    engine.modifyPlayerExploration(playerId, 1);
    engine.log(`专业意向：培养计划槽位上限增加到 ${player.planSlotLimit}，GPA +0.1，探索值 +1`, playerId);
    return null;
  });

  // 12. 轻车熟路 — re-enter line after exiting
  eventHandler.registerHandler('card_destiny_familiar_route', (engine, playerId) => {
    engine.addEffectToPlayer(playerId, {
      id: `reenterLine_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 999,
      data: { reenterLine: true },
    });
    engine.log('轻车熟路：下次离开支线终点后可重新进入', playerId);
    return null;
  });

  // 13. 如何解释 — now handled by negate window system (reactive, not pre-hang)
  // Handler removed: card is used reactively during negate windows

  // 14. 鼓点重奏 — next roll: roll twice, pick one
  eventHandler.registerHandler('card_destiny_drum_beat_return', (engine, playerId) => {
    engine.addEffectToPlayer(playerId, {
      id: `doubleDice_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 2,
      data: { doubleDiceChoice: true },
    });
    engine.log('鼓点重奏：下次投骰可投两次选一', playerId);
    return null;
  });

  // --- Chance Holdable (6) ---

  // 1. 消息闭塞 — now handled by negate window system (reactive, only cancels chance card effects)
  // Handler removed: card is used reactively during negate windows

  // 2. 虚晃一枪 — now handled by negate window system (reactive, only cancels destiny card effects)
  // Handler removed: card is used reactively during negate windows

  // 3. 画饼充饥 — now handled by negate window system (reactive, cancels cell/line/card effects)
  // Handler removed: card is used reactively during negate windows

  // 4. 一跃愁解 — reverse target player's next effects
  eventHandler.registerHandler('card_chance_one_jump_relief', (engine, playerId) => {
    const state = engine.getState();
    const targets = state.players
      .filter(p => p.id !== playerId && !p.isBankrupt)
      .map(p => p.id);

    if (targets.length === 0) return null;

    const action = engine.createPendingAction(
      playerId, 'choose_player', '一跃愁解：选择一名玩家，其下次事件增减效果反转',
      undefined, targets
    );
    action.callbackHandler = 'card_one_jump_callback';
    return action;
  });

  eventHandler.registerHandler('card_one_jump_callback', (engine, playerId, targetId) => {
    if (targetId) {
      engine.addEffectToPlayer(targetId, {
        id: `reverseEffects_${Date.now()}`,
        type: 'custom',
        turnsRemaining: 2,
        data: { reverseEffects: true },
      });
      const target = engine.getPlayer(targetId);
      engine.log(`一跃愁解：${target?.name || targetId} 的下次事件效果将被反转`, playerId);
    }
    return null;
  });

  // 5. 停水停电 — skip target player's next turn + no repeat event
  eventHandler.registerHandler('card_chance_water_power_outage', (engine, playerId) => {
    const state = engine.getState();
    const targets = state.players
      .filter(p => p.id !== playerId && !p.isBankrupt)
      .map(p => p.id);

    if (targets.length === 0) return null;

    const action = engine.createPendingAction(
      playerId, 'choose_player', '停水停电：选择一名玩家跳过下一回合',
      undefined, targets
    );
    action.callbackHandler = 'card_water_power_callback';
    return action;
  });

  eventHandler.registerHandler('card_water_power_callback', (engine, playerId, targetId) => {
    if (targetId) {
      engine.skipPlayerTurn(targetId, 1);
      const target = engine.getPlayer(targetId);
      engine.log(`停水停电：${target?.name || targetId} 将跳过下一回合`, playerId);
    }
    return null;
  });

  // 6. 补天计划 — special: held until someone wins, then holder gets a last chance
  // This is checked in win condition logic, not as a normal handler
  eventHandler.registerHandler('card_chance_mending_plan', (engine, playerId) => {
    engine.addEffectToPlayer(playerId, {
      id: `mendingPlan_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 999,
      data: { mendingPlan: true },
    });
    engine.log('补天计划：当任意玩家即将胜利时，你可以立即行动一次', playerId);
    return null;
  });

  // ===================================================================
  // 信息管理学院专属卡：数据整合
  // 选择至多两位有卡牌的玩家，从他们手中获取卡牌（每人至多2张，总计不超过3张）
  // ===================================================================

  // State tracker for multi-step data integration interactions
  const dataIntegrationState = new Map<string, {
    takenCards: { fromPlayerId: string; cardId: string }[];
    selectedPlayers: string[];
  }>();

  function buildDataIntegrationOptions(
    engine: GameEngine, playerId: string
  ): { label: string; value: string; description?: string }[] | null {
    const st = dataIntegrationState.get(playerId);
    if (!st) return null;

    const state = engine.getState();
    const remaining = 3 - st.takenCards.length;
    if (remaining <= 0) return null;

    const options: { label: string; value: string; description?: string }[] = [];

    for (const p of state.players) {
      if (p.id === playerId || p.isBankrupt || p.heldCards.length === 0) continue;

      // Check per-player limit (max 2 per player)
      const takenFromThis = st.takenCards.filter(t => t.fromPlayerId === p.id).length;
      if (takenFromThis >= 2) continue;

      // Check max 2 distinct players
      const isExistingTarget = st.selectedPlayers.includes(p.id);
      if (!isExistingTarget && st.selectedPlayers.length >= 2) continue;

      for (const c of p.heldCards) {
        // Skip cards already taken (by ID match within same player)
        if (st.takenCards.some(t => t.cardId === c.id && t.fromPlayerId === p.id)) continue;
        options.push({
          label: `${p.name}: ${c.name}`,
          value: JSON.stringify({ pid: p.id, cid: c.id }),
          description: c.description,
        });
      }
    }

    return options.length > 0 ? options : null;
  }

  eventHandler.registerHandler('card_xinxiguanli_data_integration', (engine, playerId) => {
    const state = engine.getState();
    const playersWithCards = state.players.filter(p =>
      p.id !== playerId && !p.isBankrupt && p.heldCards.length > 0
    );

    if (playersWithCards.length === 0) {
      engine.log('数据整合：没有其他玩家持有卡牌', playerId);
      return null;
    }

    // Initialize state
    dataIntegrationState.set(playerId, {
      takenCards: [],
      selectedPlayers: [],
    });

    const options = buildDataIntegrationOptions(engine, playerId);
    if (!options) {
      dataIntegrationState.delete(playerId);
      return null;
    }

    options.push({ label: '不获取，直接结束', value: 'done' });

    const action = engine.createPendingAction(
      playerId, 'choose_option',
      '数据整合：选择要获取的卡牌（可获取3张）',
      options
    );
    action.callbackHandler = 'data_integration_pick';
    return action;
  });

  eventHandler.registerHandler('data_integration_pick', (engine, playerId, choice) => {
    const st = dataIntegrationState.get(playerId);
    if (!st) return null;

    if (!choice || choice === 'done') {
      dataIntegrationState.delete(playerId);
      return null;
    }

    // Parse choice
    let parsed: { pid: string; cid: string };
    try {
      parsed = JSON.parse(choice);
    } catch {
      dataIntegrationState.delete(playerId);
      return null;
    }

    const target = engine.getPlayer(parsed.pid);
    const player = engine.getPlayer(playerId);
    if (!target || !player) {
      dataIntegrationState.delete(playerId);
      return null;
    }

    // Transfer card
    const cardIdx = target.heldCards.findIndex(c => c.id === parsed.cid);
    if (cardIdx >= 0) {
      const card = target.heldCards.splice(cardIdx, 1)[0];
      player.heldCards.push(card);
      st.takenCards.push({ fromPlayerId: parsed.pid, cardId: parsed.cid });

      // Track selected player
      if (!st.selectedPlayers.includes(parsed.pid)) {
        st.selectedPlayers.push(parsed.pid);
      }

      engine.log(`数据整合：从 ${target.name} 获得 ${card.name}`, playerId);
    }

    // Check if can continue
    if (st.takenCards.length >= 3) {
      dataIntegrationState.delete(playerId);
      return null;
    }

    const options = buildDataIntegrationOptions(engine, playerId);
    if (!options) {
      dataIntegrationState.delete(playerId);
      return null;
    }

    options.push({ label: '完成选择', value: 'done' });

    const remaining = 3 - st.takenCards.length;
    const action = engine.createPendingAction(
      playerId, 'choose_option',
      `数据整合：已获取${st.takenCards.length}张，还可获取${remaining}张`,
      options
    );
    action.callbackHandler = 'data_integration_pick';
    return action;
  });

  // ---------- 资金调度令（工程管理学院专属） ----------
  eventHandler.registerHandler('card_fund_dispatch', (engine, playerId) => {
    const state = engine.getState();
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    const activePlayers = state.players.filter(p => !p.isBankrupt);
    const maxMoney = Math.max(...activePlayers.map(p => p.money));
    const minMoney = Math.min(...activePlayers.map(p => p.money));

    const options = [
      { label: `变为全场最高金钱 (${maxMoney})`, value: 'max' },
      { label: `变为全场最低金钱 (${minMoney})`, value: 'min' },
      { label: '取消使用', value: 'cancel' },
    ];

    const action = engine.createPendingAction(
      playerId, 'choose_option',
      `资金调度令：选择将你的金钱(当前${player.money})变为全场最高或最低`,
      options
    );
    action.callbackHandler = 'fund_dispatch_choice';
    return action;
  });

  eventHandler.registerHandler('fund_dispatch_choice', (engine, playerId, choice) => {
    const player = engine.getPlayer(playerId);
    if (!player || !choice || choice === 'cancel') return null;

    const state = engine.getState();
    const activePlayers = state.players.filter(p => !p.isBankrupt);

    if (choice === 'max') {
      const maxMoney = Math.max(...activePlayers.map(p => p.money));
      const diff = maxMoney - player.money;
      if (diff !== 0) engine.modifyPlayerMoney(playerId, diff);
      engine.log(`资金调度令：金钱变为全场最高 ${maxMoney}`, playerId);
    } else if (choice === 'min') {
      const minMoney = Math.min(...activePlayers.map(p => p.money));
      const diff = minMoney - player.money;
      if (diff !== 0) engine.modifyPlayerMoney(playerId, diff);
      engine.log(`资金调度令：金钱变为全场最低 ${minMoney}`, playerId);
    }
    return null;
  });

  console.log('[CardHandlers] Registered card handlers');
}
