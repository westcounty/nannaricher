// server/src/game/handlers/corner-handlers.ts
import type { EventHandler } from '../EventHandler.js';
import { SALARY_PASS, SALARY_STOP, HOSPITAL_FEE, HOSPITAL_DICE_TARGET, WAITING_ROOM_FEE, MAIN_BOARD_CELLS } from '@nannaricher/shared';

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

    return engine.createPendingAction(
      playerId,
      'choose_option',
      '选择出院方式：投骰子到3或支付250医药费',
      [
        { label: '投骰子 (目标: 3)', value: 'corner_hospital_roll' },
        { label: `支付医药费 (${HOSPITAL_FEE})`, value: 'corner_hospital_pay', effectPreview: { money: -HOSPITAL_FEE } },
      ]
    );
  });

  eventHandler.registerHandler('corner_hospital_roll', (engine, playerId, choice) => {
    const diceResult = engine.rollDiceAndBroadcast(playerId, 1)[0];
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    if (diceResult >= HOSPITAL_DICE_TARGET) {
      engine.setPlayerHospitalStatus(playerId, false);
      engine.log(`投出 ${diceResult}，成功出院！`, playerId);
      // Return a roll_dice action so the player gets to move after discharge
      return {
        id: `roll_dice_${Date.now()}`,
        playerId,
        type: 'roll_dice' as const,
        prompt: '已出院，请投骰子移动',
        timeoutMs: 60000,
      };
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

  // Ding (鼎) corner - Skip turn (highest dice roller is exempt)
  eventHandler.registerHandler('corner_ding', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    // Check if player's dice was the highest this round — exempt if so
    const playerTotal = (player.lastDiceValues || []).reduce((a, b) => a + b, 0);
    const allPlayers = engine.getAllPlayers().filter(p => !p.isBankrupt);
    const maxDice = Math.max(
      ...allPlayers.map(p => (p.lastDiceValues || []).reduce((a, b) => a + b, 0))
    );

    if (playerTotal > 0 && playerTotal >= maxDice) {
      engine.log(`在鼎，但本回合骰子最大(${playerTotal})，免除暂停`, playerId);
      return null;
    }

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
        { label: `支付 ${WAITING_ROOM_FEE} 移动`, value: 'corner_waiting_room_pay', effectPreview: { money: -WAITING_ROOM_FEE } },
        { label: '不支付，停留', value: 'corner_waiting_room_stay' },
      ]
    );
  });

  eventHandler.registerHandler('corner_waiting_room_pay', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -WAITING_ROOM_FEE);

    // Return a pending action for choosing destination with callbackHandler
    const destinations = [
      { label: '起点', index: 0 },
      { label: '校医院', index: 7 },
      { label: '鼎', index: 14 },
      { label: '浦口线入口', index: 4 },
      { label: '学在南哪入口', index: 6 },
      { label: '赚在南哪入口', index: 8 },
      { label: '苏州线入口', index: 11 },
      { label: '乐在南哪入口', index: 15 },
      { label: '仙林线入口', index: 18 },
      { label: '鼓楼线入口', index: 22 },
      { label: '食堂线入口', index: 25 },
    ];

    const options = destinations.map(d => {
      const cell = MAIN_BOARD_CELLS.find(c => c.index === d.index);
      return {
        label: d.label,
        value: `main_${d.index}`,
        description: cell?.description || '',
      };
    });

    const action = engine.createPendingAction(
      playerId,
      'choose_option',
      '选择移动目的地：',
      options
    );
    if (action) action.callbackHandler = 'corner_waiting_room_move';
    return action;
  });

  eventHandler.registerHandler('corner_waiting_room_move', (engine, playerId, destination) => {
    if (destination && destination.startsWith('main_')) {
      const index = parseInt(destination.replace('main_', ''), 10);
      if (!isNaN(index)) {
        engine.movePlayerTo(playerId, { type: 'main', index });

        // Trigger destination cell event (description: "传送到任意大格子并执行事件")
        const cell = MAIN_BOARD_CELLS.find(c => c.index === index);
        if (cell) {
          if (cell.type === 'corner') {
            const cornerHandlerMap: Record<string, string> = {
              start: 'corner_start_stop',
              hospital: 'corner_hospital_enter',
              ding: 'corner_ding',
              waiting_room: 'corner_waiting_room',
            };
            const handlerId = cornerHandlerMap[cell.cornerType || ''];
            if (handlerId) {
              return engine.getEventHandler().execute(handlerId, playerId);
            }
          } else if (cell.type === 'event') {
            return engine.getEventHandler().execute(`event_${cell.id}`, playerId);
          } else if (cell.type === 'line_entry' && cell.lineId) {
            // For line entries, create the entry choice
            const isForced = cell.forceEntry || false;
            const fee = cell.entryFee || 0;
            if (isForced) {
              engine.enterLine(playerId, cell.lineId, false);
              engine.log(`进入 ${cell.name}`, playerId);
            } else {
              return engine.createPendingAction(
                playerId,
                'choose_option',
                fee > 0 ? `是否支付 ${fee} 金钱进入 ${cell.name}？` : `是否进入 ${cell.name}？`,
                [
                  { label: fee > 0 ? `支付 ${fee} 进入` : '进入', value: `enter_${cell.lineId}` },
                  { label: '不进入', value: 'skip' },
                ]
              );
            }
          } else if (cell.type === 'chance') {
            engine.drawAndProcessCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
          }
        }
      }
    }
    return null;
  });

  eventHandler.registerHandler('corner_waiting_room_stay', (engine, playerId) => {
    engine.log(`选择在候车厅停留`, playerId);
    return null;
  });

  console.log('[CornerHandlers] Registered corner handlers');
}
