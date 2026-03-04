// server/src/game/handlers/card-handlers.ts
import type { EventHandler } from '../EventHandler.js';

export function registerCardHandlers(eventHandler: EventHandler): void {
  // === Destiny Card Handlers ===
  // 卡牌 ID 格式：destiny_xxx，加上 card_ 前缀变成 card_destiny_xxx

  // BOSS直聘
  eventHandler.registerHandler('card_destiny_boss_recruit', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    const dice = engine.rollDice(1)[0];
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
  eventHandler.registerHandler('card_destiny_seven_year_itch', (engine, playerId) => {
    const dice1 = engine.rollDice(1)[0];
    const dice2 = engine.rollDice(1)[0];
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

  // 四校联动
  eventHandler.registerHandler('card_destiny_four_schools', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
    engine.log(`四校联动投出 ${dice}`, playerId);
    return null;
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

  // 民航超速
  eventHandler.registerHandler('card_destiny_civil_aviation_overspeed', (engine, playerId) => {
    engine.log('民航超速：可以移动到前面12格内任意位置', playerId);
    return null;
  });

  // 二源广场
  eventHandler.registerHandler('card_destiny_eryuan_square', (engine, playerId) => {
    engine.movePlayerForward(playerId, 2);
    engine.log('二源广场：向前移动两格', playerId);
    return null;
  });

  // 风水轮转
  eventHandler.registerHandler('card_destiny_fengshui_rotation', (engine, playerId) => {
    engine.log('风水轮转：下回合行动顺序反转', playerId);
    return null;
  });

  // 滑板天才
  eventHandler.registerHandler('card_destiny_skateboard_genius', (engine, playerId) => {
    engine.log('滑板天才：下次行动投掷两次骰子', playerId);
    return null;
  });

  // 闭馆音乐
  eventHandler.registerHandler('card_destiny_closing_music', (engine, playerId) => {
    engine.log('闭馆音乐：下次行动效果触发两次', playerId);
    return null;
  });

  // 系统故障
  eventHandler.registerHandler('card_destiny_system_failure', (engine, playerId) => {
    engine.log('系统故障：下回合金钱始终为0', playerId);
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
    engine.log('延迟满足：下回合金钱变为0，之后恢复并+500', playerId);
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
    const dice1 = engine.rollDice(1)[0];
    const dice2 = engine.rollDice(1)[0];
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

  // 劫富济贫
  eventHandler.registerHandler('card_chance_robin_hood', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择一位玩家，你们的金钱重置为平均值',
      undefined,
      []
    );
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

  // 结对编程
  eventHandler.registerHandler('card_chance_pair_programming', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择一位玩家进行结对编程',
      undefined,
      []
    );
  });

  // 知识竞赛
  eventHandler.registerHandler('card_chance_knowledge_competition', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择一位玩家进行知识竞赛',
      undefined,
      []
    );
  });

  // 分组展示
  eventHandler.registerHandler('card_chance_group_presentation', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择一位玩家进行分组展示（投骰子比较奇偶）',
      undefined,
      []
    );
  });

  // 旅游搭子
  eventHandler.registerHandler('card_chance_travel_buddy', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择一位玩家作为旅游搭子',
      undefined,
      []
    );
  });

  // 拼单活动
  eventHandler.registerHandler('card_chance_group_buy', (engine, playerId) => {
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择一位玩家进行拼单活动',
      undefined,
      []
    );
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

  // 垃圾回收
  eventHandler.registerHandler('card_chance_garbage_collection', (engine, playerId) => {
    engine.log('垃圾回收：所有玩家持有的卡牌放回牌堆', playerId);
    return null;
  });

  // 朋辈导师
  eventHandler.registerHandler('card_chance_peer_mentor', (engine, playerId) => {
    engine.log('朋辈导师：拿走或交换一张卡片', playerId);
    return null;
  });

  // 联合培养
  eventHandler.registerHandler('card_chance_joint_training', (engine, playerId) => {
    engine.log('联合培养：交换一张未固定的培养计划', playerId);
    return null;
  });

  // 学科评估
  eventHandler.registerHandler('card_chance_discipline_evaluation', (engine, playerId) => {
    engine.log('学科评估：抽培养计划并替换其他玩家的', playerId);
    return null;
  });

  // 升旗仪式
  eventHandler.registerHandler('card_chance_flag_raising', (engine, playerId) => {
    engine.log('升旗仪式：与衣服颜色一致的玩家探索值 +2', playerId);
    return null;
  });

  // 聚类算法
  eventHandler.registerHandler('card_chance_clustering_algorithm', (engine, playerId) => {
    engine.log('聚类算法：与姓名长度一致的玩家 GPA +0.2', playerId);
    return null;
  });

  // 实习内推
  eventHandler.registerHandler('card_chance_internship_referral', (engine, playerId) => {
    engine.log('实习内推：与专业或院系一致的玩家金钱 +200', playerId);
    return null;
  });

  // 南行玫瑰
  eventHandler.registerHandler('card_chance_southbound_rose', (engine, playerId) => {
    engine.log('南行玫瑰：轮流说出校内分享平台', playerId);
    return null;
  });

  // 网格管理
  eventHandler.registerHandler('card_chance_grid_management', (engine, playerId) => {
    engine.log('网格管理：选择两位玩家同步增减', playerId);
    return null;
  });

  // 泳馆常客
  eventHandler.registerHandler('card_chance_swimming_pool_regular', (engine, playerId) => {
    engine.log('泳馆常客：选择按次缴费或年卡用户', playerId);
    return null;
  });

  // 相逢是缘
  eventHandler.registerHandler('card_chance_meeting_is_fate', (engine, playerId) => {
    engine.log('相逢是缘：选择图书馆或运动场', playerId);
    return null;
  });

  // 初雪留痕
  eventHandler.registerHandler('card_chance_first_snow', (engine, playerId) => {
    engine.log('初雪留痕：选择初雪告白或大雪无声', playerId);
    return null;
  });

  // 怪奇物谈
  eventHandler.registerHandler('card_chance_strange_tales', (engine, playerId) => {
    engine.log('怪奇物谈：选择鼎里或天文山', playerId);
    return null;
  });

  // 外卖贼盗
  eventHandler.registerHandler('card_chance_delivery_theft', (engine, playerId) => {
    engine.log('外卖贼盗：选择监控报警或默不作声', playerId);
    return null;
  });

  // 寻根时刻
  eventHandler.registerHandler('card_chance_root_finding_moment', (engine, playerId) => {
    engine.log('寻根时刻：选择装潢一新或历史古迹', playerId);
    return null;
  });

  // 休憩时刻
  eventHandler.registerHandler('card_chance_rest_moment', (engine, playerId) => {
    engine.log('休憩时刻：选择大气山或羊山湖', playerId);
    return null;
  });

  // 光影变幻
  eventHandler.registerHandler('card_chance_light_shadow', (engine, playerId) => {
    engine.log('光影变幻：选择藜照湖或菜根谭', playerId);
    return null;
  });

  // 课程建群
  eventHandler.registerHandler('card_chance_course_group', (engine, playerId) => {
    engine.log('课程建群：查看最新消息记录的渠道来源', playerId);
    return null;
  });

  // 换乘时刻
  eventHandler.registerHandler('card_chance_transfer_moment', (engine, playerId) => {
    engine.log('换乘时刻：选择新街口或金马路', playerId);
    return null;
  });

  // 妙语连珠
  eventHandler.registerHandler('card_chance_wit_words', (engine, playerId) => {
    engine.log('妙语连珠：选择南哪辩论赛或南哪演说家', playerId);
    return null;
  });

  // 校运动会
  eventHandler.registerHandler('card_chance_school_sports_meet', (engine, playerId) => {
    engine.log('校运动会：选择入场式或广播操', playerId);
    return null;
  });

  // 出行方式
  eventHandler.registerHandler('card_chance_travel_method', (engine, playerId) => {
    engine.log('出行方式：查看共享单车/电动车/滑板车开卡情况', playerId);
    return null;
  });

  // 八卦秘闻
  eventHandler.registerHandler('card_chance_gossip_secret', (engine, playerId) => {
    engine.log('八卦秘闻：选择一位玩家悄悄告知', playerId);
    return null;
  });

  console.log('[CardHandlers] Registered card handlers');
}
