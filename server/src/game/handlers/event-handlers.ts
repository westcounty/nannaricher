// server/src/game/handlers/event-handlers.ts
import type { EventHandler } from '../EventHandler';

export function registerEventHandlers(eventHandler: EventHandler): void {
  // Tuition payment event
  eventHandler.registerHandler('event_tuition', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    const tuition = Math.round((5.0 - player.gpa) * 100);
    engine.modifyPlayerMoney(playerId, -tuition);
    engine.log(`交学费 ${(5.0 - player.gpa).toFixed(1)} * 100 = ${tuition} 金钱`, playerId);
    return null;
  });

  // Jiang Gong's face event (蒋公的面子)
  eventHandler.registerHandler('event_jiang_gong', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '蒋公的面子：选择一项执行',
      [
        { label: '支付300金钱获得3探索值', value: 'pay_gain' },
        { label: '损失2探索值获得200金钱', value: 'lose_gain' },
      ]
    );
  });

  eventHandler.registerHandler('event_jiang_gong_pay', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -300);
    engine.modifyPlayerExploration(playerId, 3);
    engine.log(`支付300金钱获得3探索值`, playerId);
    return null;
  });

  eventHandler.registerHandler('event_jiang_gong_lose', (engine, playerId) => {
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
        { label: '花费100金钱投骰子重修', value: 'retake' },
        { label: '不重修', value: 'skip' },
      ]
    );
  });

  eventHandler.registerHandler('event_retake_roll', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -100);
    const dice = engine.rollDice(1)[0];
    if (dice % 2 === 0) {
      engine.modifyPlayerGpa(playerId, 0.2);
      engine.log(`投出 ${dice}（偶数），获得0.2 GPA`, playerId);
    } else {
      engine.log(`投出 ${dice}（奇数），重修失败`, playerId);
    }
    return null;
  });

  // Club event (社团)
  eventHandler.registerHandler('event_club', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '是否参加社团活动？',
      [
        { label: '失去200金钱获得骰子*1探索值', value: 'money' },
        { label: '失去0.2 GPA获得骰子*1探索值', value: 'gpa' },
        { label: '不参加', value: 'skip' },
      ]
    );
  });

  eventHandler.registerHandler('event_club_money', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -200);
    const dice = engine.rollDice(1)[0];
    engine.modifyPlayerExploration(playerId, dice);
    engine.log(`参加社团活动，获得 ${dice} 探索值`, playerId);
    return null;
  });

  eventHandler.registerHandler('event_club_gpa', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, -0.2);
    const dice = engine.rollDice(1)[0];
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
        { label: '失去100金钱抽取培养方案', value: 'draw_plan' },
        { label: '抽取机会卡或命运卡', value: 'draw_card' },
      ]
    );
  });

  // NanDa gift shop (南哪诚品)
  eventHandler.registerHandler('event_nanda_gift', (engine, playerId) => {
    const players = engine.getAllPlayers();
    let totalPaid = 0;
    players.forEach(p => {
      if (p.id !== playerId) {
        engine.modifyPlayerMoney(p.id, -50);
        totalPaid += 50;
      }
    });
    engine.modifyPlayerMoney(playerId, totalPaid);
    engine.log(`南哪诚品，其他玩家各支付50金钱，共获得 ${totalPaid}`, playerId);
    return null;
  });

  // Innovation competition (科创赛事)
  eventHandler.registerHandler('event_innovation', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '是否参加科创赛事？（失去0.3 GPA投骰子获得0.1*点数GPA）',
      [
        { label: '参加科创赛事', value: 'join' },
        { label: '不参加', value: 'skip' },
      ]
    );
  });

  eventHandler.registerHandler('event_innovation_join', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, -0.3);
    const dice = engine.rollDice(1)[0];
    const gpaGain = dice * 0.1;
    engine.modifyPlayerGpa(playerId, gpaGain);
    engine.log(`参加科创赛事，获得 ${gpaGain.toFixed(1)} GPA`, playerId);
    return null;
  });

  // Chuang Men event (闯门)
  eventHandler.registerHandler('event_chuang_men', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '闯门：选择一项',
      [
        { label: '停留一回合获得0.2 GPA', value: 'stay' },
        { label: '失去0.1 GPA前进一格领取600低保', value: 'move' },
      ]
    );
  });

  eventHandler.registerHandler('event_chuang_men_stay', (engine, playerId) => {
    engine.skipPlayerTurn(playerId, 1);
    engine.modifyPlayerGpa(playerId, 0.2);
    engine.log(`闯门停留，获得0.2 GPA`, playerId);
    return null;
  });

  eventHandler.registerHandler('event_chuang_men_move', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, -0.1);
    engine.movePlayerForward(playerId, 1);
    engine.modifyPlayerMoney(playerId, 600);
    engine.log(`闯门前进，领取600低保`, playerId);
    return null;
  });

  // Work-study event (勤工助学)
  eventHandler.registerHandler('event_work_study', (engine, playerId) => {
    const players = engine.getAllPlayers();
    const minMoney = Math.min(...players.map(p => p.money));
    const player = engine.getPlayer(playerId);

    let bonus = 0;
    if (player && player.money === minMoney) {
      bonus = 240;
    }

    engine.modifyPlayerMoney(playerId, 240 + bonus);
    engine.skipPlayerTurn(playerId, 1);
    engine.log(`勤工助学获得240金钱${bonus > 0 ? '（额外240）' : ''}，暂停一回合`, playerId);
    return null;
  });

  console.log('[EventHandlers] Registered event handlers');
}
