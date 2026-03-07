// server/src/game/handlers/event-handlers.ts
import type { EventHandler } from '../EventHandler.js';
import { SALARY_STOP } from '@nannaricher/shared';

export function registerEventHandlers(eventHandler: EventHandler): void {
  // Tuition payment event — ALL non-bankrupt players pay tuition
  eventHandler.registerHandler('event_tuition', (engine, playerId) => {
    const state = engine.getState();
    const player = engine.getPlayer(playerId);

    // Check if current player has software school ability
    if (player && (player.majorPlan === 'plan_ruanjian' || player.minorPlans.includes('plan_ruanjian'))) {
      return engine.createPendingAction(
        playerId, 'choose_option',
        '软件学院能力：是否支付3200金钱？不破产即获胜！（其余玩家照常交学费）',
        [
          { label: `支付3200金钱 (当前: ${player.money})`, value: 'tuition_ruanjian_3200_all' },
          { label: '正常交学费', value: 'tuition_normal_all' },
        ]
      );
    }

    // All players pay tuition
    for (const p of state.players) {
      if (p.isBankrupt) continue;
      const tuition = Math.round((5.0 - p.gpa) * 100);
      engine.modifyPlayerMoney(p.id, -tuition);
      engine.log(`${p.name} 交学费 ${(5.0 - p.gpa).toFixed(1)} × 100 = ${tuition} 金钱`, p.id);
    }
    return null;
  });

  // 软件学院：交学费3200选项回调
  eventHandler.registerHandler('tuition_ruanjian_3200', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -3200);
    engine.log('软件学院：支付3200金钱交学费', playerId);
    const player = engine.getPlayer(playerId);
    if (player && !player.isBankrupt) {
      const disabled = player.disabledWinConditions ?? [];
      if (!disabled.includes('plan_ruanjian')) {
        engine.declareWinner(playerId, '软件学院：交学费3200金钱后未破产');
      }
    }
    return null;
  });

  // 正常交学费（软件学院选择不使用能力时的回调）
  eventHandler.registerHandler('tuition_normal', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    const tuition = Math.round((5.0 - player.gpa) * 100);
    engine.modifyPlayerMoney(playerId, -tuition);
    engine.log(`交学费 ${(5.0 - player.gpa).toFixed(1)} * 100 = ${tuition} 金钱`, playerId);
    return null;
  });

  // 软件学院选择支付3200（全员版本）
  eventHandler.registerHandler('tuition_ruanjian_3200_all', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -3200);
    engine.log('软件学院：支付3200金钱交学费', playerId);
    const player = engine.getPlayer(playerId);
    if (player && !player.isBankrupt) {
      const disabled = player.disabledWinConditions ?? [];
      if (!disabled.includes('plan_ruanjian')) {
        engine.declareWinner(playerId, '软件学院：交学费3200金钱后未破产');
      }
    }
    // Other players pay normal tuition
    const state = engine.getState();
    for (const p of state.players) {
      if (p.id === playerId || p.isBankrupt) continue;
      const tuition = Math.round((5.0 - p.gpa) * 100);
      engine.modifyPlayerMoney(p.id, -tuition);
      engine.log(`${p.name} 交学费 ${(5.0 - p.gpa).toFixed(1)} × 100 = ${tuition} 金钱`, p.id);
    }
    return null;
  });

  // 软件学院选择不使用能力（全员版本）
  eventHandler.registerHandler('tuition_normal_all', (engine, playerId) => {
    const state = engine.getState();
    for (const p of state.players) {
      if (p.isBankrupt) continue;
      const tuition = Math.round((5.0 - p.gpa) * 100);
      engine.modifyPlayerMoney(p.id, -tuition);
      engine.log(`${p.name} 交学费 ${(5.0 - p.gpa).toFixed(1)} × 100 = ${tuition} 金钱`, p.id);
    }
    return null;
  });

  // Jiang Gong's face event (蒋公的面子)
  eventHandler.registerHandler('event_jiang_gong', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '蒋公的面子：选择一项执行',
      [
        { label: '支付300金钱获得3探索值', value: 'pay_gain', effectPreview: { money: -300, exploration: 3 } },
        { label: '损失2探索值获得200金钱', value: 'lose_gain', effectPreview: { money: 200, exploration: -2 } },
      ]
    );
  });

  eventHandler.registerHandler('pay_gain', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -300);
    engine.modifyPlayerExploration(playerId, 3);
    engine.log(`支付300金钱获得3探索值`, playerId);
    return null;
  });

  eventHandler.registerHandler('lose_gain', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, -2);
    engine.modifyPlayerMoney(playerId, 200);
    engine.log(`损失2探索值获得200金钱`, playerId);
    return null;
  });

  // Retake event (重修)
  eventHandler.registerHandler('event_retake', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player || player.gpa >= 3.5) {
      engine.log(`GPA >= 3.5，无需重修`, playerId);
      return null;
    }

    return engine.createPendingAction(
      playerId,
      'choose_option',
      'GPA低于3.5，是否花费100金钱重修？',
      [
        { label: '花费100金钱投骰子重修', value: 'retake', effectPreview: { money: -100, gpa: '0~0.2' } },
        { label: '不重修', value: 'skip' },
      ]
    );
  });

  eventHandler.registerHandler('retake', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -100);
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice % 2 === 0) {
      engine.modifyPlayerGpa(playerId, 0.2);
      engine.log(`投出 ${dice}（偶数），获得0.2 GPA`, playerId);
    } else {
      engine.log(`投出 ${dice}（奇数），重修失败`, playerId);
    }
    return null;
  });

  // Club event (社团) - also registered as event_society for compatibility
  eventHandler.registerHandler('event_society', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '是否参加社团活动？',
      [
        { label: '失去200金钱获得骰子*1探索值', value: 'society_money', effectPreview: { money: -200, exploration: '1~6' } },
        { label: '失去0.2 GPA获得骰子*1探索值', value: 'society_gpa', effectPreview: { gpa: -0.2, exploration: '1~6' } },
        { label: '不参加', value: 'skip' },
      ]
    );
  });

  eventHandler.registerHandler('society_money', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -200);
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    engine.modifyPlayerExploration(playerId, dice);
    engine.log(`参加社团活动，获得 ${dice} 探索值`, playerId);
    return null;
  });

  eventHandler.registerHandler('society_gpa', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, -0.2);
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    engine.modifyPlayerExploration(playerId, dice);
    engine.log(`参加社团活动，获得 ${dice} 探索值`, playerId);
    return null;
  });

  // Zijing station event (紫荆站)
  eventHandler.registerHandler('event_zijing', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '紫荆站：选择一项',
      [
        { label: '失去100金钱抽取培养方案', value: 'draw_plan', effectPreview: { money: -100 } },
        { label: '抽取机会卡或命运卡', value: 'draw_card' },
      ]
    );
  });

  eventHandler.registerHandler('draw_plan', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -100);
    engine.drawTrainingPlan(playerId);
    return null;
  });

  eventHandler.registerHandler('draw_card', (engine, playerId) => {
    const deckType = Math.random() > 0.5 ? 'chance' : 'destiny';
    engine.drawAndProcessCard(playerId, deckType);
    return null;
  });

  // NanDa gift shop (南哪诚品) - 交给场上其它玩家每人50金钱
  eventHandler.registerHandler('event_nanna_cp', (engine, playerId) => {
    const players = engine.getAllPlayers();
    const others = players.filter(p => p.id !== playerId && !p.isBankrupt);
    const totalCost = others.length * 50;
    engine.modifyPlayerMoney(playerId, -totalCost);
    others.forEach(p => {
      engine.modifyPlayerMoney(p.id, 50);
    });
    engine.log(`南哪诚品，给其他每位玩家50金钱，共支出 ${totalCost}`, playerId);
    return null;
  });

  // Alias
  eventHandler.registerHandler('event_nanda_cp', (engine, playerId) => {
    const players = engine.getAllPlayers();
    const others = players.filter(p => p.id !== playerId && !p.isBankrupt);
    const totalCost = others.length * 50;
    engine.modifyPlayerMoney(playerId, -totalCost);
    others.forEach(p => {
      engine.modifyPlayerMoney(p.id, 50);
    });
    engine.log(`南哪诚品，给其他每位玩家50金钱，共支出 ${totalCost}`, playerId);
    return null;
  });

  // Innovation competition (科创赛事) - also registered as event_kechuang
  eventHandler.registerHandler('event_kechuang', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '是否参加科创赛事？（失去0.3 GPA投骰子获得0.1*点数GPA）',
      [
        { label: '参加科创赛事', value: 'kechuang_join', effectPreview: { gpa: '-0.3+0.1~0.6' } },
        { label: '不参加', value: 'skip' },
      ]
    );
  });

  eventHandler.registerHandler('kechuang_join', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, -0.3);
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    const gpaGain = dice * 0.1;
    engine.modifyPlayerGpa(playerId, gpaGain);
    engine.log(`参加科创赛事，投出 ${dice}，获得 ${gpaGain.toFixed(1)} GPA`, playerId);

    // 电子科学与工程学院：投到6即获胜
    const player = engine.getPlayer(playerId);
    if (dice === 6 && player && (player.majorPlan === 'plan_dianzi' || player.minorPlans.includes('plan_dianzi'))) {
      const disabled = player.disabledWinConditions ?? [];
      if (!disabled.includes('plan_dianzi')) {
        engine.declareWinner(playerId, '电子科学与工程学院：科创赛事投到6');
      }
    }
    return null;
  });

  // Chuang Men event (闯门) — board cell id is "chuangmen"
  eventHandler.registerHandler('event_chuangmen', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '闯门：选择一项',
      [
        { label: '停留一回合获得0.4 GPA', value: 'event_chuang_men_stay', effectPreview: { gpa: 0.4 } },
        { label: '失去0.1 GPA前进到起点，获得起点停留低保', value: 'event_chuang_men_move', effectPreview: { gpa: -0.1, money: SALARY_STOP } },
      ]
    );
  });

  eventHandler.registerHandler('event_chuang_men_stay', (engine, playerId) => {
    engine.skipPlayerTurn(playerId, 1);
    engine.modifyPlayerGpa(playerId, 0.4);
    engine.log(`闯门停留，获得0.4 GPA`, playerId);
    return null;
  });

  eventHandler.registerHandler('event_chuang_men_move', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, -0.1);
    engine.movePlayerForward(playerId, 1);
    // 触发起点停留效果（而非直接给钱），corner_start_stop 会给 SALARY_STOP 金钱
    engine.log(`闯门前进到起点`, playerId);
    return engine.getEventHandler().execute('corner_start_stop', playerId);
  });

  // Work-study event (勤工助学) - registered with both names for compatibility
  eventHandler.registerHandler('event_qingong', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);

    // 先确定最穷玩家（修改金钱前）
    const minMoney = Math.min(...players.map(p => p.money));
    const poorestPlayers = players.filter(p => p.money === minMoney);

    // 再给触发者+240并暂停
    engine.modifyPlayerMoney(playerId, 240);
    engine.skipPlayerTurn(playerId, 1);
    engine.log(`勤工助学获得240金钱，暂停一回合`, playerId);

    // 给最穷玩家额外+240
    for (const p of poorestPlayers) {
      engine.modifyPlayerMoney(p.id, 240);
      engine.log(`${p.name} 是最穷的玩家，额外获得240金钱`, p.id);
    }
    return null;
  });

  // Alias for qingong
  eventHandler.registerHandler('event_work_study', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);

    // 先确定最穷玩家（修改金钱前）
    const minMoney = Math.min(...players.map(p => p.money));
    const poorestPlayers = players.filter(p => p.money === minMoney);

    // 再给触发者+240并暂停
    engine.modifyPlayerMoney(playerId, 240);
    engine.skipPlayerTurn(playerId, 1);
    engine.log(`勤工助学获得240金钱，暂停一回合`, playerId);

    // 给最穷玩家额外+240
    for (const p of poorestPlayers) {
      engine.modifyPlayerMoney(p.id, 240);
      engine.log(`${p.name} 是最穷的玩家，额外获得240金钱`, p.id);
    }
    return null;
  });

  // Generic skip handler - does nothing (used by retake, society, kechuang, line entry, etc.)
  eventHandler.registerHandler('skip', (_engine, _playerId) => {
    return null;
  });

  console.log('[EventHandlers] Registered event handlers');
}
