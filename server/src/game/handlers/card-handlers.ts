// server/src/game/handlers/card-handlers.ts
import type { EventHandler } from '../EventHandler.js';

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
        { label: '是（金钱 +100）', value: 'card_mutual_help_yes' },
        { label: '否（探索值 -2，金钱 -200）', value: 'card_mutual_help_no' },
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
          { label: '探索值 +7', value: 'card_seven_year_itch_exploration' },
          { label: 'GPA +0.7', value: 'card_seven_year_itch_gpa' },
          { label: '金钱 +700', value: 'card_seven_year_itch_money' },
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
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
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
    const options = [];
    for (let i = 1; i <= 12; i++) {
      options.push({ label: `前进 ${i} 格`, value: `civil_aviation_${i}` });
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
      '是否执行延迟满足？（下回合金钱变为0，之后恢复并获得500）',
      [
        { label: '执行延迟满足', value: 'card_delayed_gratification_yes' },
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
      triggerTurn: state.turnNumber + 2,
      triggerCondition: 'next_turn',
      data: { savedMoney },
    });
    // Set money to 0 for next turn
    engine.modifyPlayerMoney(playerId, -savedMoney);
    engine.log(`延迟满足：金钱暂时归零(保存${savedMoney})，下回合后恢复+500`, playerId);
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

  // 强基计划
  eventHandler.registerHandler('card_destiny_strong_base_plan', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, 0.2);
    engine.log('强基计划：GPA +0.2，再抽培养方案', playerId);
    return null;
  });

  // 国家专项
  eventHandler.registerHandler('card_destiny_national_special', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 200);
    engine.log('国家专项：金钱 +200，再抽培养方案', playerId);
    return null;
  });

  // 二次选拔
  eventHandler.registerHandler('card_destiny_secondary_selection', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('二次选拔：探索值 +2，再抽培养方案', playerId);
    return null;
  });

  // 中外合办
  eventHandler.registerHandler('card_destiny_sino_foreign', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -400);
    engine.modifyPlayerExploration(playerId, 3);
    engine.log('中外合办：金钱 -400，探索值 +3，再抽培养方案', playerId);
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
        { label: '获得50金钱', value: 'card_questionnaire_50' },
        { label: '暂停一回合获得200金钱', value: 'card_questionnaire_200' },
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
    engine.drawCard(playerId, 'destiny');
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
        { label: '记得常回来看看（探索值+2）', value: 'card_listen_leave_explore' },
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
      const diff = 800 - p.money;
      engine.modifyPlayerMoney(p.id, diff);
    });
    engine.log('经费均摊：所有玩家金钱变为800', playerId);
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

  // 翻转课堂
  eventHandler.registerHandler('card_chance_flipped_classroom', (engine, playerId) => {
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
  eventHandler.registerHandler('card_chance_student_union_interview', (engine, playerId) => {
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
  eventHandler.registerHandler('card_chance_like_collection', (engine, playerId) => {
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

  // 联合培养 — 选择一位玩家交换培养计划
  eventHandler.registerHandler('card_chance_joint_training', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    const myUnconfirmed = player.trainingPlans.filter(p => !p.confirmed);
    if (myUnconfirmed.length === 0) {
      engine.log('联合培养：你没有未固定的培养计划，无法交换', playerId);
      return null;
    }

    const others = engine.getAllPlayers().filter(p =>
      p.id !== playerId && !p.isBankrupt &&
      p.trainingPlans.some(tp => !tp.confirmed)
    );
    if (others.length === 0) {
      engine.log('联合培养：没有其他玩家有未固定的培养计划', playerId);
      return null;
    }

    // Randomly swap one unconfirmed plan with a random other player
    const target = others[Math.floor(Math.random() * others.length)];
    const targetUnconfirmed = target.trainingPlans.filter(p => !p.confirmed);
    const myPlan = myUnconfirmed[Math.floor(Math.random() * myUnconfirmed.length)];
    const theirPlan = targetUnconfirmed[Math.floor(Math.random() * targetUnconfirmed.length)];

    // Swap
    const myIdx = player.trainingPlans.findIndex(p => p.id === myPlan.id);
    const theirIdx = target.trainingPlans.findIndex(p => p.id === theirPlan.id);
    if (myIdx !== -1 && theirIdx !== -1) {
      player.trainingPlans[myIdx] = theirPlan;
      target.trainingPlans[theirIdx] = myPlan;
      engine.log(`联合培养：${player.name}的${myPlan.name}与${target.name}的${theirPlan.name}交换`, playerId);
    }
    return null;
  });

  // 学科评估 — 抽培养计划替换某位玩家的未固定计划
  eventHandler.registerHandler('card_chance_discipline_evaluation', (engine, playerId) => {
    const newPlan = engine.drawTrainingPlan(playerId);
    if (!newPlan) {
      engine.log('学科评估：培养计划牌堆已空', playerId);
      return null;
    }

    // Find a random other player with unconfirmed plan
    const others = engine.getAllPlayers().filter(p =>
      p.id !== playerId && !p.isBankrupt &&
      p.trainingPlans.some(tp => !tp.confirmed)
    );
    if (others.length === 0) {
      engine.log(`学科评估：抽到${newPlan.name}，但无人可替换，计划废弃`, playerId);
      return null;
    }

    const target = others[Math.floor(Math.random() * others.length)];
    const unconfirmed = target.trainingPlans.filter(tp => !tp.confirmed);
    const replaced = unconfirmed[Math.floor(Math.random() * unconfirmed.length)];
    const idx = target.trainingPlans.findIndex(p => p.id === replaced.id);
    if (idx !== -1) {
      target.trainingPlans[idx] = newPlan;
      engine.log(`学科评估：将${target.name}的${replaced.name}替换为${newPlan.name}`, playerId);
    }
    return null;
  });

  // 升旗仪式 — 数字版简化：抽卡者和一个随机玩家探索值+2
  eventHandler.registerHandler('card_chance_flag_raising', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    const others = engine.getAllPlayers().filter(p => p.id !== playerId && !p.isBankrupt);
    if (others.length > 0) {
      const lucky = others[Math.floor(Math.random() * others.length)];
      engine.modifyPlayerExploration(lucky.id, 2);
      engine.log(`升旗仪式：${engine.getPlayer(playerId)?.name}和${lucky.name}探索值+2`, playerId);
    } else {
      engine.log('升旗仪式：探索值+2', playerId);
    }
    return null;
  });

  // 聚类算法 — 与抽卡者姓名全名长度一致的玩家GPA+0.2
  eventHandler.registerHandler('card_chance_clustering_algorithm', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    const myNameLen = player.name.length;
    const matched = engine.getAllPlayers().filter(p => !p.isBankrupt && p.name.length === myNameLen);
    for (const p of matched) {
      engine.modifyPlayerGpa(p.id, 0.2);
    }
    const names = matched.map(p => p.name).join('、');
    engine.log(`聚类算法：姓名长度为${myNameLen}的玩家(${names})GPA+0.2`, playerId);
    return null;
  });

  // 实习内推 — 数字版简化：所有玩家金钱+200
  eventHandler.registerHandler('card_chance_internship_referral', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
    for (const p of players) {
      engine.modifyPlayerMoney(p.id, 200);
    }
    engine.log('实习内推：所有玩家金钱+200', playerId);
    return null;
  });

  // 南行玫瑰 — 数字版简化：所有玩家投骰子，>=4者探索值+1，否则-1
  eventHandler.registerHandler('card_chance_southbound_rose', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
    for (const p of players) {
      const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
      if (dice >= 4) {
        engine.modifyPlayerExploration(p.id, 1);
        engine.log(`南行玫瑰：${p.name}投出${dice}，探索值+1`, playerId);
      } else {
        engine.modifyPlayerExploration(p.id, -1);
        engine.log(`南行玫瑰：${p.name}投出${dice}，探索值-1`, playerId);
      }
    }
    return null;
  });

  // 网格管理 — 数字版简化：抽卡者选两位玩家，他们各获得2探索值
  eventHandler.registerHandler('card_chance_grid_management', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
    if (players.length >= 2) {
      // Pick two random players
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      const p1 = shuffled[0];
      const p2 = shuffled[1];
      engine.modifyPlayerExploration(p1.id, 2);
      engine.modifyPlayerExploration(p2.id, 2);
      engine.log(`网格管理：${p1.name}和${p2.name}被绑定，各探索值+2`, playerId);
    } else {
      engine.log('网格管理：玩家不足，无法执行', playerId);
    }
    return null;
  });

  // 泳馆常客 — 全体投票+骰子
  eventHandler.registerHandler('card_chance_swimming_pool_regular', (engine, playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
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
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
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
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
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
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
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
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
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
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
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
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
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
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
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
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
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
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
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
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
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

  // 出行方式 — 简化为多数票
  eventHandler.registerHandler('card_chance_travel_method', (engine, _playerId) => {
    const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
    return {
      id: `vote_travel_method_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote' as const,
      prompt: '出行方式：你的出行方式是？',
      options: [
        { label: '共享出行', value: 'shared' },
        { label: '丈量校园', value: 'walk' },
      ],
      targetPlayerIds: players.map(p => p.id),
      cardId: 'chance_travel_method',
      timeoutMs: 30000,
    };
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

  console.log('[CardHandlers] Registered card handlers');
}
