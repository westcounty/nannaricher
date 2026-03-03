// server/src/game/handlers/corner-handlers.ts
import type { EventHandler } from '../EventHandler';
import { SALARY_PASS, SALARY_STOP, HOSPITAL_FEE, HOSPITAL_DICE_TARGET, WAITING_ROOM_FEE } from '@nannaricher/shared';

export function registerCornerHandlers(eventHandler: EventHandler): void {
  // Start corner - Salary/allowance
  eventHandler.registerHandler('corner_start_pass', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, SALARY_PASS);
    engine.log(`经过起点，领取低保 ${SALARY_PASS} 金钱`, playerId);
    return null;
  });

  eventHandler.registerHandler('corner_start_stop', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, SALARY_STOP);
    engine.log(`停留在起点，领取低保 ${SALARY_STOP} 金钱`, playerId);
    return null;
  });

  // Hospital corner
  eventHandler.registerHandler('corner_hospital_enter', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    engine.setPlayerHospitalStatus(playerId, true);
    engine.log(`进入校医院`, playerId);

    return engine.createPendingAction(
      playerId,
      'choose_option',
      '选择出院方式：投骰子到3或支付250医药费',
      [
        { label: '投骰子 (目标: 3)', value: 'roll_dice' },
        { label: `支付医药费 (${HOSPITAL_FEE})`, value: 'pay_fee' },
      ]
    );
  });

  eventHandler.registerHandler('corner_hospital_roll', (engine, playerId, choice) => {
    const diceResult = engine.rollDice(1)[0];
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    if (diceResult >= HOSPITAL_DICE_TARGET) {
      engine.setPlayerHospitalStatus(playerId, false);
      engine.log(`投出 ${diceResult}，成功出院！`, playerId);
    } else {
      engine.log(`投出 ${diceResult}，未能出院，下回合继续`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('corner_hospital_pay', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -HOSPITAL_FEE);
    engine.setPlayerHospitalStatus(playerId, false);
    engine.log(`支付 ${HOSPITAL_FEE} 医药费出院`, playerId);
    return null;
  });

  // Ding (鼎) corner - Skip turn
  eventHandler.registerHandler('corner_ding', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    // Check if player's dice was the highest this round
    // For simplicity, we'll just skip one turn
    engine.setPlayerDingStatus(playerId, true);
    engine.skipPlayerTurn(playerId, 1);
    engine.log(`在鼎暂停一回合`, playerId);
    return null;
  });

  // Waiting room corner
  eventHandler.registerHandler('corner_waiting_room', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      `是否支付 ${WAITING_ROOM_FEE} 金钱移动到任意格子？`,
      [
        { label: `支付 ${WAITING_ROOM_FEE} 移动`, value: 'pay_move' },
        { label: '不支付，停留', value: 'stay' },
      ]
    );
  });

  eventHandler.registerHandler('corner_waiting_room_pay', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -WAITING_ROOM_FEE);

    // Return a pending action for choosing destination
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '选择移动目的地：',
      [
        { label: '起点', value: 'main_0' },
        { label: '校医院', value: 'main_7' },
        { label: '鼎', value: 'main_14' },
        { label: '候车厅', value: 'main_21' },
        { label: '浦口线入口', value: 'main_2' },
        { label: '学习线入口', value: 'main_5' },
        { label: '赚钱线入口', value: 'main_8' },
        { label: '苏州线入口', value: 'main_11' },
        { label: '探索线入口', value: 'main_17' },
        { label: '鼓楼线入口', value: 'main_20' },
        { label: '仙林线入口', value: 'main_23' },
        { label: '食堂线入口', value: 'main_26' },
      ]
    );
  });

  eventHandler.registerHandler('corner_waiting_room_stay', (engine, playerId) => {
    engine.log(`选择在候车厅停留`, playerId);
    return null;
  });

  console.log('[CornerHandlers] Registered corner handlers');
}
