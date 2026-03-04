// server/src/game/handlers/line-handlers.ts
import type { EventHandler } from '../EventHandler.js';

export function registerLineHandlers(eventHandler: EventHandler): void {
  // === Pukou Line (浦口线) ===
  eventHandler.registerHandler('pukou_library_ac', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, -0.2);
    engine.log('图书馆空调没有开放，GPA -0.2', playerId);
    return null;
  });

  eventHandler.registerHandler('pukou_commute', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -200);
    engine.modifyPlayerGpa(playerId, 0.3);
    engine.log('三地奔波通勤，金钱 -200，GPA +0.3', playerId);
    return null;
  });

  eventHandler.registerHandler('pukou_sparse', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, -2);
    engine.log('社团活动不足，超市关门早，探索值 -2', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('pukou_study', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 100);
    engine.modifyPlayerGpa(playerId, 0.2);
    engine.log('潜心学习嚼菜根，金钱 +100，GPA +0.2', playerId);
    return null;
  });

  eventHandler.registerHandler('pukou_transport', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, -1);
    engine.log('交通不便，实习困难，探索值 -1', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('pukou_shoushou', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice % 2 === 0) {
      engine.modifyPlayerExploration(playerId, 3);
      engine.log(`手手速报投出 ${dice}（偶数），探索值 +3`, playerId);
    } else {
      engine.modifyPlayerExploration(playerId, -2);
      engine.log(`手手速报投出 ${dice}（奇数），探索值 -2`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('pukou_facilities', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 200);
    engine.modifyPlayerExploration(playerId, 2);
    engine.modifyPlayerGpa(playerId, -0.2);
    engine.log('必要设施缺失但纷起于宿舍，金钱 +200，探索值 +2，GPA -0.2', playerId);
    return null;
  });

  eventHandler.registerHandler('pukou_cafeteria', (engine, playerId) => {
    engine.log('食堂及菜品匮乏，下一次移动改为倒退', playerId);
    // TODO: 实现倒退效果
    return null;
  });

  eventHandler.registerHandler('pukou_jinling_gate', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, -2);
    engine.log('金陵学院大门仍挂着南哪大学金陵学院，探索值 -2', playerId);
    return null;
  });

  eventHandler.registerHandler('pukou_no_it', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -100);
    engine.log('浦口没有IT侠营业，金钱 -100', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('pukou_delivery', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerExploration(playerId, 1);
      engine.log(`快递寄到车大成贤投出 ${dice}（奇数），探索值 +1`, playerId);
    } else {
      engine.log(`快递寄到车大成贤投出 ${dice}（偶数），抽一张机会卡或命运卡`, playerId);
      const deckType = Math.random() > 0.5 ? 'chance' : 'destiny';
      engine.drawCard(playerId, deckType);
    }
    return null;
  });

  eventHandler.registerHandler('pukou_bird', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -100);
    engine.log('被子被鸟屎污染，金钱 -100', playerId);
    return null;
  });

  eventHandler.registerHandler('pukou_exp_card', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 400);
    engine.log('跨校区调宿，金钱 +400，可选择移动至鼓楼/仙林/苏州线入口', playerId);
    return engine.createPendingAction(
      playerId,
      'choose_option',
      '选择移动到哪个线路入口（经过起点不领取低保）',
      [
        { label: '鼓楼线入口', value: 'pukou_exp_gulou' },
        { label: '仙林线入口', value: 'pukou_exp_xianlin' },
        { label: '苏州线入口', value: 'pukou_exp_suzhou' },
        { label: '不移动', value: 'skip' },
      ]
    );
  });

  eventHandler.registerHandler('pukou_exp_gulou', (engine, playerId) => {
    engine.movePlayerTo(playerId, { type: 'main', index: 22 });
    engine.log('移动到鼓楼线入口', playerId);
    return null;
  });

  eventHandler.registerHandler('pukou_exp_xianlin', (engine, playerId) => {
    engine.movePlayerTo(playerId, { type: 'main', index: 18 });
    engine.log('移动到仙林线入口', playerId);
    return null;
  });

  eventHandler.registerHandler('pukou_exp_suzhou', (engine, playerId) => {
    engine.movePlayerTo(playerId, { type: 'main', index: 11 });
    engine.log('移动到苏州线入口', playerId);
    return null;
  });

  // === Study Line (学习线) ===
  eventHandler.registerHandler('study_exam', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerGpa(playerId, 0.2);
      engine.log(`期末考试通宵复习投出 ${dice}（奇数），GPA +0.2`, playerId);
    } else {
      engine.skipPlayerTurn(playerId, 1);
      engine.modifyPlayerGpa(playerId, -0.1);
      engine.log(`期末考试投出 ${dice}（偶数），睡着了，GPA -0.1，停留一回合`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('study_scholarship', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    if (player.gpa >= 4.5) {
      engine.modifyPlayerMoney(playerId, 300);
      engine.modifyPlayerGpa(playerId, 0.1);
      engine.log('奖学金评选（GPA >= 4.5），金钱 +300，GPA +0.1', playerId);
    } else if (player.gpa >= 4.0) {
      engine.modifyPlayerMoney(playerId, 200);
      engine.modifyPlayerGpa(playerId, 0.2);
      engine.log('奖学金评选（GPA >= 4.0），金钱 +200，GPA +0.2', playerId);
    } else {
      engine.modifyPlayerMoney(playerId, 100);
      engine.modifyPlayerGpa(playerId, 0.3);
      engine.log('奖学金评选（GPA < 4.0），金钱 +100，GPA +0.3', playerId);
    }
    return null;
  });

  eventHandler.registerHandler('study_library_late', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, 0.2);
    engine.log('图书馆延迟闭馆，GPA +0.2', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('study_schedule_app', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('下载南哪课表，探索值 +2', playerId);
    return null;
  });

  eventHandler.registerHandler('study_all_night', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, 0.2);
    engine.log('通宵教室，GPA +0.2', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('study_group_work', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, -0.2);
    engine.log('小组作业，GPA -0.2', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('study_camera_accident', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, -4);
    engine.log('摄像头麦克风事故，探索值 -4', playerId);
    return null;
  });

  eventHandler.registerHandler('study_withdraw', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, 0.1);
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('急流勇退，GPA +0.1，探索值 +2', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('study_defense', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    if (player.gpa >= 3.0) {
      engine.modifyPlayerGpa(playerId, 0.3);
      engine.log('毕业答辩成功，GPA +0.3', playerId);
      engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
      engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    } else {
      engine.log('毕业答辩失败（延毕），返回学习线起点', playerId);
      engine.enterLine(playerId, 'study', true);
    }
    return null;
  });

  eventHandler.registerHandler('study_exp_card', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, 0.2);
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice <= 2) {
      engine.enterLine(playerId, 'pukou', false);
      engine.log('保研成功，GPA +0.2，移动到浦口线', playerId);
    } else if (dice <= 4) {
      engine.enterLine(playerId, 'gulou', false);
      engine.log('保研成功，GPA +0.2，移动到鼓楼线', playerId);
    } else {
      engine.enterLine(playerId, 'xianlin', false);
      engine.log('保研成功，GPA +0.2，移动到仙林线', playerId);
    }
    return null;
  });

  // === Money Line (金钱线/赚在南哪) ===
  eventHandler.registerHandler('money_tutoring_violation', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, -5);
    engine.modifyPlayerMoney(playerId, -300);
    engine.log('违反校规开办考研辅导，探索值 -5，金钱 -300', playerId);
    return null;
  });

  eventHandler.registerHandler('money_tutoring_free', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 200);
    engine.log('无中介费家教，金钱 +200', playerId);
    return null;
  });

  eventHandler.registerHandler('money_xianxian', (engine, playerId) => {
    engine.log('创办南哪闲闲，可以交换两名玩家的金钱', playerId);
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择两名玩家交换金钱数值',
      undefined,
      []
    );
  });

  eventHandler.registerHandler('money_campus_card', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerMoney(playerId, -100);
      engine.log(`校园卡摊点投出 ${dice}（奇数），实名办卡，金钱 -100`, playerId);
    } else {
      engine.modifyPlayerExploration(playerId, 2);
      engine.log(`校园卡摊点投出 ${dice}（偶数），看过防骗指南，探索值 +2`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('money_free_internet', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 200);
    engine.log('白嫖网费，金钱 +200', playerId);
    return null;
  });

  eventHandler.registerHandler('money_card_lost', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerExploration(playerId, 2);
      engine.log(`校园卡丢失投出 ${dice}（奇数），找回了，探索值 +2`, playerId);
      engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    } else {
      const fee = dice * 20;
      engine.modifyPlayerMoney(playerId, -fee);
      engine.log(`校园卡丢失投出 ${dice}（偶数），重办卡，金钱 -${fee}`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('money_recharge_bonus', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    engine.modifyPlayerMoney(playerId, dice * 100);
    engine.log(`校园卡充值优惠，金钱 +${dice * 100}`, playerId);
    return null;
  });

  eventHandler.registerHandler('money_startup', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice === 1 || dice === 6) {
      const player = engine.getPlayer(playerId);
      if (player) {
        engine.modifyPlayerMoney(playerId, player.money);
        engine.modifyPlayerExploration(playerId, 6);
        engine.log(`众创空间投出 ${dice}，产品爆火，金钱翻倍，探索值 +6`, playerId);
      }
    } else {
      const players = engine.getAllPlayers();
      const minMoney = Math.min(...players.map(p => p.money));
      engine.modifyPlayerMoney(playerId, minMoney - (engine.getPlayer(playerId)?.money || 0));
      engine.modifyPlayerGpa(playerId, 3.0 - (engine.getPlayer(playerId)?.gpa || 3.0));
      engine.log(`众创空间投出 ${dice}，失败了`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('money_admission_box', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 200);
    engine.modifyPlayerExploration(playerId, 3);
    engine.log('录取通知盒流水线，金钱 +200，探索值 +3', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('money_alumni_referral', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 200);
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('校友内推，金钱 +200，探索值 +2', playerId);
    return null;
  });

  eventHandler.registerHandler('money_exp_card', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (player && player.money > 1500) {
      engine.modifyPlayerMoney(playerId, -500);
      engine.modifyPlayerExploration(playerId, 5);
      engine.log('校友企业，金钱超过1500，捐赠500，探索值 +5', playerId);
    } else {
      engine.modifyPlayerMoney(playerId, 500);
      engine.log('校友企业，金钱 +500', playerId);
    }
    return null;
  });

  // === Suzhou Line (苏州线) ===
  eventHandler.registerHandler('suzhou_meaty', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('明明说好嚼菜根却开了荤，探索值 +2', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('suzhou_commute', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -200);
    engine.modifyPlayerGpa(playerId, 0.3);
    engine.log('课没修够两地奔波，金钱 -200，GPA +0.3', playerId);
    return null;
  });

  eventHandler.registerHandler('suzhou_fancy_major', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('专业名高大上，探索值 +2', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('suzhou_construction', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, -1);
    engine.log('半壁江山竟仍是工地，探索值 -1', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('suzhou_guinea_pig', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 1);
    engine.modifyPlayerMoney(playerId, 200);
    engine.log('首批小白鼠，探索值 +1，金钱 +200', playerId);
    return null;
  });

  eventHandler.registerHandler('suzhou_curriculum_box', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerGpa(playerId, -0.1);
      engine.log(`培养计划套娃盲盒投出 ${dice}（奇数），GPA -0.1`, playerId);
    } else {
      engine.modifyPlayerGpa(playerId, 0.3);
      engine.log(`培养计划套娃盲盒投出 ${dice}（偶数），GPA +0.3`, playerId);
    }
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('suzhou_blank_slate', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, 0.1);
    engine.log('另起炉灶，学生组织和社团活动一片空白，GPA +0.1', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('suzhou_airport', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -200);
    engine.log('机场之谜，金钱 -200', playerId);
    return null;
  });

  eventHandler.registerHandler('suzhou_ski_dream', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 1);
    engine.log('室内雪世界的饼，探索值 +1', playerId);
    return null;
  });

  eventHandler.registerHandler('suzhou_explorer', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice % 2 === 0) {
      engine.modifyPlayerExploration(playerId, 5);
      engine.log(`探索者投出 ${dice}（偶数），发布指南，探索值 +5`, playerId);
    } else {
      engine.log(`探索者投出 ${dice}（奇数），单打独斗`, playerId);
      engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    }
    return null;
  });

  eventHandler.registerHandler('suzhou_exp_card', (engine, playerId) => {
    engine.log('未来科技，选择一位玩家移动', playerId);
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择一位玩家，让其前进或后退',
      undefined,
      []
    );
  });

  // === Explore Line (探索线/乐在南哪) ===
  eventHandler.registerHandler('explore_singer', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice === 1 || dice === 3) {
      engine.modifyPlayerExploration(playerId, 1);
      engine.log(`十大歌星投出 ${dice}，过第一轮，探索值 +1`, playerId);
    } else if (dice === 5) {
      engine.modifyPlayerExploration(playerId, 4);
      engine.log(`十大歌星投出 ${dice}，获得称号，探索值 +4`, playerId);
    } else {
      engine.skipPlayerTurn(playerId, 1);
      engine.log(`十大歌星投出 ${dice}，排了很久队没好位置，停留一回合`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('explore_social_butterfly', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('社牛属性爆发被表白捞人，探索值 +2', playerId);
    return null;
  });

  eventHandler.registerHandler('explore_club', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -100);
    engine.modifyPlayerExploration(playerId, 5);
    engine.log('百团大战加入社团，金钱 -100，探索值 +5', playerId);
    return null;
  });

  eventHandler.registerHandler('explore_volunteer', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (player && player.exploration >= 10) {
      engine.modifyPlayerExploration(playerId, 4);
      engine.log('热心志愿（探索值 >= 10），探索值 +4', playerId);
      engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    } else {
      engine.modifyPlayerExploration(playerId, 2);
      engine.log('热心志愿（探索值 < 10），探索值 +2', playerId);
    }
    return null;
  });

  eventHandler.registerHandler('explore_student_org', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerExploration(playerId, 3);
      engine.log(`学生组织留任投出 ${dice}（奇数），完成目标，探索值 +3`, playerId);
    } else {
      engine.modifyPlayerExploration(playerId, -3);
      engine.log(`学生组织留任投出 ${dice}（偶数），摸鱼躺平，探索值 -3`, playerId);
    }
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('explore_vip_visit', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 3);
    engine.log('著名人物到访，探索值 +3', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('explore_event_prep', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.modifyPlayerMoney(playerId, -100);
    engine.modifyPlayerGpa(playerId, -0.1);
    engine.log('筹备学生活动，探索值 +2，金钱 -100，GPA -0.1', playerId);
    return null;
  });

  eventHandler.registerHandler('explore_partner', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 1);
    engine.modifyPlayerGpa(playerId, 0.2);
    engine.modifyPlayerMoney(playerId, -200);
    engine.log('认识搭子，探索值 +1，GPA +0.2，金钱 -200', playerId);
    return null;
  });

  eventHandler.registerHandler('explore_anniversary', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (player) {
      engine.modifyPlayerMoney(playerId, 20 * dice);
      if (player.exploration >= 15) {
        engine.skipPlayerTurn(playerId, 1);
        engine.log(`120周年校庆，金钱 +${20 * dice}，探索值 >= 15，暂停一回合`, playerId);
      } else {
        if (dice % 2 === 1) {
          engine.modifyPlayerExploration(playerId, 3);
          engine.log(`120周年校庆，金钱 +${20 * dice}，探索值 +3`, playerId);
        } else {
          engine.log(`120周年校庆，金钱 +${20 * dice}`, playerId);
          engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
        }
      }
    }
    return null;
  });

  eventHandler.registerHandler('explore_exp_card', (engine, playerId) => {
    const players = engine.getAllPlayers();
    const bonus = 2 * players.length;
    engine.modifyPlayerExploration(playerId, bonus);
    engine.skipPlayerTurn(playerId, 2);
    engine.log(`任职导员，探索值 +${bonus}，暂停两回合`, playerId);
    return null;
  });

  // === Gulou Line (鼓楼线) ===
  eventHandler.registerHandler('gulou_root_plan', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (player && player.exploration < 10) {
      engine.modifyPlayerExploration(playerId, 2);
      engine.log('寻根计划（探索值 < 10），探索值 +2', playerId);
    } else {
      engine.modifyPlayerMoney(playerId, -100);
      engine.log('寻根计划（探索值 >= 10），金钱 -100', playerId);
      engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    }
    return null;
  });

  eventHandler.registerHandler('gulou_heritage', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice <= 2) {
      engine.modifyPlayerExploration(playerId, 1);
      engine.log(`名胜古迹投出 ${dice}，历史文物宿舍，探索值 +1`, playerId);
    } else if (dice <= 4) {
      engine.modifyPlayerExploration(playerId, 2);
      engine.log(`名胜古迹投出 ${dice}，电视剧取景地，探索值 +2`, playerId);
    } else {
      engine.modifyPlayerExploration(playerId, 4);
      engine.log(`名胜古迹投出 ${dice}，皇陵宝地，探索值 +4`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('gulou_celebrity', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerGpa(playerId, 0.3);
      engine.log(`偶遇明星投出 ${dice}（奇数），去图书馆学习，GPA +0.3`, playerId);
    } else {
      engine.modifyPlayerExploration(playerId, 2);
      engine.modifyPlayerGpa(playerId, -0.1);
      engine.log(`偶遇明星投出 ${dice}（偶数），发小红书，探索值 +2，GPA -0.1`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('gulou_entertainment', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -200);
    engine.log('灯红酒绿，金钱 -200', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('gulou_wedding', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 3);
    engine.log('旁观集体婚礼，探索值 +3', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('gulou_retired_teacher', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 1);
    engine.modifyPlayerGpa(playerId, 0.1);
    engine.log('和退休老教师交谈，探索值 +1，GPA +0.1', playerId);
    return null;
  });

  eventHandler.registerHandler('gulou_anniversary', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, -2);
    engine.log('百廿校庆无鼓楼活动，探索值 -2', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('gulou_building_guide', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('鼓楼建筑图鉴，探索值 +2', playerId);
    return null;
  });

  eventHandler.registerHandler('gulou_tour_guide', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('带同学游览鼓楼，探索值 +2', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('gulou_exp_card', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 3);
    engine.skipPlayerTurn(playerId, 1);
    engine.log('军训时刻，探索值 +3，暂停一回合', playerId);
    return null;
  });

  // === Xianlin Line (仙林线) ===
  eventHandler.registerHandler('xianlin_conference', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerMoney(playerId, 100);
      engine.modifyPlayerExploration(playerId, 2);
      engine.log(`会议中心投出 ${dice}（奇数），老师请客，金钱 +100，探索值 +2`, playerId);
    } else {
      engine.modifyPlayerMoney(playerId, -200);
      engine.log(`会议中心投出 ${dice}（偶数），订酒店，金钱 -200`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('xianlin_wildlife', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('偶遇野猪学长和狐獴学弟，探索值 +2', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('xianlin_yifu_lost', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, -0.1);
    engine.log('逸夫楼迷路迟到，GPA -0.1', playerId);
    return null;
  });

  eventHandler.registerHandler('xianlin_dorm', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    switch (dice) {
      case 1:
        engine.modifyPlayerMoney(playerId, -100);
        engine.modifyPlayerExploration(playerId, 2);
        engine.log('宿舍分配：一组团，金钱 -100，探索值 +2', playerId);
        break;
      case 2:
        engine.modifyPlayerGpa(playerId, 0.2);
        engine.log('宿舍分配：离图书馆最近，GPA +0.2', playerId);
        break;
      case 3:
        engine.modifyPlayerMoney(playerId, 200);
        engine.log('宿舍分配：三组团，金钱 +200', playerId);
        break;
      case 4:
        engine.modifyPlayerExploration(playerId, 1);
        engine.log('宿舍分配：好食堂，探索值 +1', playerId);
        break;
      case 5:
      case 6:
        engine.modifyPlayerMoney(playerId, -300);
        engine.log('宿舍分配：专硕无宿舍，金钱 -300', playerId);
        engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
        break;
    }
    return null;
  });

  eventHandler.registerHandler('xianlin_bathroom', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerExploration(playerId, 2);
      engine.log(`独立卫浴改造投出 ${dice}（奇数），成功，探索值 +2`, playerId);
    } else {
      engine.modifyPlayerMoney(playerId, -100);
      engine.log(`独立卫浴改造投出 ${dice}（偶数），失败，金钱 -100`, playerId);
      engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    }
    return null;
  });

  eventHandler.registerHandler('xianlin_mcdonalds', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -100);
    engine.log('麦门信徒，金钱 -100，获得麦门护盾', playerId);
    return null;
  });

  eventHandler.registerHandler('xianlin_tour', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice % 2 === 0) {
      engine.log(`带高中同学游览仙林投出 ${dice}（偶数），被评价为恢弘`, playerId);
      engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    } else {
      engine.modifyPlayerExploration(playerId, 2);
      engine.log(`带高中同学游览仙林投出 ${dice}（奇数），同学立志考研来南哪，探索值 +2`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('xianlin_exp_card', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 3);
    engine.movePlayerTo(playerId, { type: 'main', index: 0 });
    engine.log('毕业典礼，探索值 +3，移动至起点', playerId);
    return null;
  });

  // === Food Line (食堂线/吃在南哪) ===
  eventHandler.registerHandler('food_norovirus', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -200);
    engine.setPlayerHospitalStatus(playerId, true);
    engine.log('发生诺如，前往校医院，金钱 -200', playerId);
    return null;
  });

  eventHandler.registerHandler('food_protein', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerExploration(playerId, 2);
      engine.log(`吃出蛋白质投出 ${dice}（奇数），经理慰问，探索值 +2`, playerId);
    } else {
      engine.modifyPlayerMoney(playerId, -100);
      engine.log(`吃出蛋白质投出 ${dice}（偶数），不了了之，金钱 -100`, playerId);
    }
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('food_new_item', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    engine.modifyPlayerMoney(playerId, -dice * 50);
    engine.log(`尝试食堂新品，金钱 -${dice * 50}`, playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('food_renovated', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, -1);
    engine.log('装修后的二食堂，探索值 -1', playerId);
    return null;
  });

  eventHandler.registerHandler('food_nine_canteen', (engine, playerId) => {
    const dice = engine.rollDiceAndBroadcast(playerId, 1)[0];
    engine.modifyPlayerMoney(playerId, -dice * 50);
    engine.modifyPlayerExploration(playerId, 3);
    engine.log(`九食堂招待朋友，金钱 -${dice * 50}，探索值 +3`, playerId);
    return null;
  });

  eventHandler.registerHandler('food_leadership', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('偶遇校领导，探索值 +2', playerId);
    return null;
  });

  eventHandler.registerHandler('food_mooncake', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 4);
    engine.log('加入手手做月饼，探索值 +4', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('food_private_room', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 1);
    engine.log('金陵小炒包间，探索值 +1', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('food_stainless_bowl', (engine, playerId) => {
    engine.log('不锈钢饭盆', playerId);
    engine.drawCard(playerId, Math.random() > 0.5 ? 'chance' : 'destiny');
    return null;
  });

  eventHandler.registerHandler('food_exp_card', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    // 宠辱不惊: food line becomes optional for this player
    if (!player.effects.find(e => e.type === 'custom' && e.data?.foodLineOptional)) {
      player.effects.push({
        id: `food_optional_${Date.now()}`,
        type: 'custom',
        turnsRemaining: 999, // permanent effect
        data: { foodLineOptional: true },
      });
    }
    engine.log('获得经验卡: 宠辱不惊 — 食堂线不再强制进入', playerId);
    return null;
  });

  // === Line Entry Handlers ===
  // These are called when a player chooses to enter a line

  eventHandler.registerHandler('enter_pukou', (engine, playerId) => {
    if (engine.enterLine(playerId, 'pukou', true)) {
      engine.log('进入浦口线', playerId);
    }
    return null;
  });

  eventHandler.registerHandler('enter_study', (engine, playerId) => {
    if (engine.enterLine(playerId, 'study', true)) {
      engine.log('进入学在南哪线', playerId);
    }
    return null;
  });

  eventHandler.registerHandler('enter_money', (engine, playerId) => {
    if (engine.enterLine(playerId, 'money', true)) {
      engine.log('进入赚在南哪线', playerId);
    }
    return null;
  });

  eventHandler.registerHandler('enter_suzhou', (engine, playerId) => {
    if (engine.enterLine(playerId, 'suzhou', true)) {
      engine.log('进入苏州线', playerId);
    }
    return null;
  });

  eventHandler.registerHandler('enter_explore', (engine, playerId) => {
    if (engine.enterLine(playerId, 'explore', true)) {
      engine.log('进入乐在南哪线', playerId);
    }
    return null;
  });

  eventHandler.registerHandler('enter_xianlin', (engine, playerId) => {
    if (engine.enterLine(playerId, 'xianlin', true)) {
      engine.log('进入仙林线', playerId);
    }
    return null;
  });

  eventHandler.registerHandler('enter_gulou', (engine, playerId) => {
    if (engine.enterLine(playerId, 'gulou', true)) {
      engine.log('进入鼓楼线', playerId);
    }
    return null;
  });

  eventHandler.registerHandler('enter_food', (engine, playerId) => {
    if (engine.enterLine(playerId, 'food', true)) {
      engine.log('进入食堂线', playerId);
    }
    return null;
  });

  eventHandler.registerHandler('skip', (engine, playerId) => {
    engine.log('选择不进入线路', playerId);
    return null;
  });

  console.log('[LineHandlers] Registered line handlers');
}
