// server/src/game/handlers/card-handlers.ts
import type { EventHandler } from '../EventHandler';

export function registerCardHandlers(eventHandler: EventHandler): void {
  // === Destiny Card Handlers ===

  // BOSS直聘
  eventHandler.registerHandler('card_boss_recruit', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    const dice = engine.rollDice(1)[0];
    const newExploration = Math.round(player.exploration * dice * 0.1 * 10) / 10;
    engine.modifyPlayerExploration(playerId, newExploration - player.exploration);
    engine.log(`BOSS直聘投出 ${dice}，探索值变为 ${newExploration}`, playerId);
    return null;
  });

  // 手望相助
  eventHandler.registerHandler('card_mutual_help', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '是否在各平台关注了手手？',
      [
        { label: '是（金钱 +100）', value: 'yes' },
        { label: '否（探索值 -2，金钱 -200）', value: 'no' },
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
  eventHandler.registerHandler('card_swallowing_elevator', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
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
  eventHandler.registerHandler('card_seven_year_itch', (engine, playerId) => {
    const dice1 = engine.rollDice(1)[0];
    const dice2 = engine.rollDice(1)[0];
    const total = dice1 + dice2;

    if (total === 7) {
      return engine.createPendingAction(
        playerId,
        'choose_option',
        `投出 ${dice1}+${dice2}=7！选择奖励：`,
        [
          { label: '探索值 +7', value: 'exploration' },
          { label: 'GPA +0.7', value: 'gpa' },
          { label: '金钱 +700', value: 'money' },
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

  // 四校联动
  eventHandler.registerHandler('card_four_schools', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
    engine.log(`四校联动投出 ${dice}`, playerId);
    // This would need complex player choice handling in a real game
    return null;
  });

  // === Chance Card Handlers ===

  // 盗亦有道
  eventHandler.registerHandler('card_steal_rich', (engine, playerId) => {
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
  eventHandler.registerHandler('card_score_conversion', (engine, playerId) => {
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
  eventHandler.registerHandler('card_reorganize_dorm', (engine, playerId) => {
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

  // 经费均摊
  eventHandler.registerHandler('card_budget_sharing', (engine, playerId) => {
    const players = engine.getAllPlayers();
    players.forEach(p => {
      const diff = 800 - p.money;
      engine.modifyPlayerMoney(p.id, diff);
    });
    engine.log('经费均摊：所有玩家金钱变为800', playerId);
    return null;
  });

  // 劫富济贫
  eventHandler.registerHandler('card_robin_hood', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择一位玩家，你们的金钱重置为平均值',
      undefined,
      []
    );
  });

  // 结对编程
  eventHandler.registerHandler('card_pair_programming', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择一位玩家进行结对编程',
      undefined,
      []
    );
  });

  // 知识竞赛
  eventHandler.registerHandler('card_knowledge_competition', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择一位玩家进行知识竞赛',
      undefined,
      []
    );
  });

  // 分组展示
  eventHandler.registerHandler('card_group_presentation', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择一位玩家进行分组展示（投骰子比较奇偶）',
      undefined,
      []
    );
  });

  // 旅游搭子
  eventHandler.registerHandler('card_travel_buddy', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择一位玩家作为旅游搭子',
      undefined,
      []
    );
  });

  // 拼单活动
  eventHandler.registerHandler('card_group_buy', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择一位玩家进行拼单活动',
      undefined,
      []
    );
  });

  // 翻转课堂
  eventHandler.registerHandler('card_flipped_classroom', (engine, playerId) => {
    const players = engine.getAllPlayers();
    if (players.length < 2) return null;

    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const winner = shuffled[0];
    const loser = shuffled[1];

    engine.modifyPlayerGpa(winner.id, 0.2);
    engine.modifyPlayerGpa(loser.id, -0.1);
    engine.log(`翻转课堂：${winner.name} GPA +0.2，${loser.name} GPA -0.1`, playerId);
    return null;
  });

  // 团学面试
  eventHandler.registerHandler('card_interview', (engine, playerId) => {
    const players = engine.getAllPlayers();
    if (players.length < 2) return null;

    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const winner = shuffled[0];
    const loser = shuffled[1];

    engine.modifyPlayerExploration(winner.id, 2);
    engine.modifyPlayerExploration(loser.id, -1);
    engine.log(`团学面试：${winner.name} 探索值 +2，${loser.name} 探索值 -1`, playerId);
    return null;
  });

  // 集赞抽奖
  eventHandler.registerHandler('card_like_collection', (engine, playerId) => {
    const players = engine.getAllPlayers();
    if (players.length < 2) return null;

    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const winner = shuffled[0];
    const loser = shuffled[1];

    engine.modifyPlayerMoney(winner.id, 200);
    engine.modifyPlayerMoney(loser.id, -100);
    engine.log(`集赞抽奖：${winner.name} 金钱 +200，${loser.name} 金钱 -100`, playerId);
    return null;
  });

  // Movement cards - direct movement
  eventHandler.registerHandler('card_move_pukou', (engine, playerId) => {
    engine.log('北京大学：直接移动到浦口线', playerId);
    engine.enterLine(playerId, 'pukou', false);
    return null;
  });

  eventHandler.registerHandler('card_move_study', (engine, playerId) => {
    engine.log('嚼得菜根：直接移动到学习线', playerId);
    engine.enterLine(playerId, 'study', false);
    return null;
  });

  eventHandler.registerHandler('card_move_money', (engine, playerId) => {
    engine.log('多多益善：直接移动到赚钱线', playerId);
    engine.enterLine(playerId, 'money', false);
    return null;
  });

  eventHandler.registerHandler('card_move_suzhou', (engine, playerId) => {
    engine.log('另起炉灶：直接移动到苏州线', playerId);
    engine.enterLine(playerId, 'suzhou', false);
    return null;
  });

  eventHandler.registerHandler('card_move_xianlin', (engine, playerId) => {
    engine.log('仙林站：直接移动到仙林线', playerId);
    engine.enterLine(playerId, 'xianlin', false);
    return null;
  });

  eventHandler.registerHandler('card_move_gulou', (engine, playerId) => {
    engine.log('南北相望：直接移动到鼓楼线', playerId);
    engine.enterLine(playerId, 'gulou', false);
    return null;
  });

  eventHandler.registerHandler('card_move_food', (engine, playerId) => {
    engine.log('见多食广：直接移动到食堂线', playerId);
    engine.enterLine(playerId, 'food', false);
    return null;
  });

  eventHandler.registerHandler('card_move_explore', (engine, playerId) => {
    engine.log('社恐分子：直接移动到探索线', playerId);
    engine.enterLine(playerId, 'explore', false);
    return null;
  });

  eventHandler.registerHandler('card_move_ding', (engine, playerId) => {
    engine.log('校园传说：直接移动到鼎', playerId);
    engine.movePlayerTo(playerId, { type: 'main', index: 14 });
    return null;
  });

  // 民航超速
  eventHandler.registerHandler('card_civil_aviation', (engine, playerId) => {
    engine.log('民航超速：可以移动到前面12格内任意位置', playerId);
    return null;
  });

  // 二源广场
  eventHandler.registerHandler('card_eryuan_square', (engine, playerId) => {
    engine.movePlayerForward(playerId, 2);
    engine.log('二源广场：向前移动两格', playerId);
    return null;
  });

  // 风水轮转
  eventHandler.registerHandler('card_fengshui_rotation', (engine, playerId) => {
    engine.log('风水轮转：下回合行动顺序反转', playerId);
    // This would modify the game state's turnOrderReversed flag
    return null;
  });

  // 滑板天才
  eventHandler.registerHandler('card_skateboard', (engine, playerId) => {
    engine.log('滑板天才：下次行动投掷两次骰子', playerId);
    // This would add a temporary effect to the player
    return null;
  });

  // 闭馆音乐
  eventHandler.registerHandler('card_closing_music', (engine, playerId) => {
    engine.log('闭馆音乐：下次行动效果触发两次', playerId);
    // This would add a temporary effect to the player
    return null;
  });

  // 系统故障
  eventHandler.registerHandler('card_system_failure', (engine, playerId) => {
    engine.log('系统故障：下回合金钱始终为0', playerId);
    // This would add a special effect
    return null;
  });

  // 延迟满足
  eventHandler.registerHandler('card_delayed_gratification', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '是否执行延迟满足？（下回合金钱变为0，之后恢复并获得500）',
      [
        { label: '执行延迟满足', value: 'yes' },
        { label: '不执行', value: 'no' },
      ]
    );
  });

  console.log('[CardHandlers] Registered card handlers');
}
