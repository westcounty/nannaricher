// server/src/game/handlers/line-handlers.ts
import type { EventHandler } from '../EventHandler';

export function registerLineHandlers(eventHandler: EventHandler): void {
  // === Pukou Line (浦口线) ===
  eventHandler.registerHandler('line_pukou_ac', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, -0.2);
    engine.log('浦口图书馆空调没开，GPA -0.2', playerId);
    return null;
  });

  eventHandler.registerHandler('line_pukou_commute', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -200);
    engine.modifyPlayerGpa(playerId, 0.3);
    engine.log('三地奔波通勤，金钱 -200，GPA +0.3', playerId);
    return null;
  });

  eventHandler.registerHandler('line_pukou_quiet', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, -2);
    engine.log('浦口地广人稀，探索值 -2', playerId);
    return null;
  });

  eventHandler.registerHandler('line_pukou_study', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 100);
    engine.modifyPlayerGpa(playerId, 0.2);
    engine.log('浦口潜心学习，金钱 +100，GPA +0.2', playerId);
    return null;
  });

  eventHandler.registerHandler('line_pukou_shoushu', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
    if (dice % 2 === 0) {
      engine.modifyPlayerExploration(playerId, 3);
      engine.log(`手手速报投出 ${dice}，探索值 +3`, playerId);
    } else {
      engine.modifyPlayerExploration(playerId, -2);
      engine.log(`手手速报投出 ${dice}，探索值 -2`, playerId);
    }
    return null;
  });

  // === Study Line (学习线) ===
  eventHandler.registerHandler('line_study_exam', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerGpa(playerId, 0.2);
      engine.log(`期末考试投出 ${dice}（奇数），补天成功，GPA +0.2`, playerId);
    } else {
      engine.skipPlayerTurn(playerId, 1);
      engine.modifyPlayerGpa(playerId, -0.1);
      engine.log(`期末考试投出 ${dice}（偶数），睡着了，GPA -0.1，停留一回合`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('line_study_scholarship', (engine, playerId) => {
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

  eventHandler.registerHandler('line_study_library', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, 0.2);
    engine.log('图书馆延迟闭馆，GPA +0.2', playerId);
    return null;
  });

  eventHandler.registerHandler('line_study_schedule', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('下载南哪课表，探索值 +2', playerId);
    return null;
  });

  eventHandler.registerHandler('line_study_defense', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    if (player.gpa >= 3.0) {
      engine.modifyPlayerGpa(playerId, 0.3);
      engine.log('毕业答辩成功，GPA +0.3', playerId);
    } else {
      engine.modifyPlayerMoney(playerId, -200);
      engine.log('毕业答辩失败（延毕），返回学习线起点', playerId);
    }
    return null;
  });

  // === Money Line (金钱线/赚在南哪) ===
  eventHandler.registerHandler('line_money_tutoring', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 200);
    engine.log('接到家教，金钱 +200', playerId);
    return null;
  });

  eventHandler.registerHandler('line_money_xianxian', (engine, playerId) => {
    engine.log('创办南哪闲闲，可以交换两名玩家的金钱', playerId);
    return engine.createPendingAction(
      playerId,
      'choose_player',
      '选择两名玩家交换金钱数值',
      undefined,
      []
    );
  });

  eventHandler.registerHandler('line_money_itsc', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, 200);
    engine.log('填写ITSC问卷，金钱 +200', playerId);
    return null;
  });

  eventHandler.registerHandler('line_money_card_lost', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerExploration(playerId, 2);
      engine.log(`校园卡丢失投出 ${dice}，找回了，探索值 +2`, playerId);
    } else {
      const fee = dice * 20;
      engine.modifyPlayerMoney(playerId, -fee);
      engine.log(`校园卡丢失投出 ${dice}，重办卡，金钱 -${fee}`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('line_money_recharge', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
    engine.modifyPlayerMoney(playerId, dice * 100);
    engine.log(`校园卡充值优惠，金钱 +${dice * 100}`, playerId);
    return null;
  });

  eventHandler.registerHandler('line_money_startup', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
    if (dice === 1 || dice === 6) {
      const player = engine.getPlayer(playerId);
      if (player) {
        engine.modifyPlayerMoney(playerId, player.money);
        engine.modifyPlayerExploration(playerId, 6);
        engine.log(`创业投出 ${dice}，产品爆火，金钱翻倍，探索值 +6`, playerId);
      }
    } else {
      const players = engine.getAllPlayers();
      const minMoney = Math.min(...players.map(p => p.money));
      engine.modifyPlayerMoney(playerId, minMoney - (engine.getPlayer(playerId)?.money || 0));
      engine.modifyPlayerGpa(playerId, 3.0 - (engine.getPlayer(playerId)?.gpa || 3.0));
      engine.log(`创业投出 ${dice}，失败了`, playerId);
    }
    return null;
  });

  // === Suzhou Line (苏州线) ===
  eventHandler.registerHandler('line_suzhou_hun', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('开了荤，探索值 +2', playerId);
    return null;
  });

  eventHandler.registerHandler('line_suzhou_commute', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -200);
    engine.modifyPlayerGpa(playerId, 0.3);
    engine.log('两地奔波，金钱 -200，GPA +0.3', playerId);
    return null;
  });

  eventHandler.registerHandler('line_suzhou_first_batch', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 1);
    engine.modifyPlayerMoney(playerId, 200);
    engine.log('首批小白鼠，探索值 +1，金钱 +200', playerId);
    return null;
  });

  eventHandler.registerHandler('line_suzhou_explorer', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
    if (dice % 2 === 0) {
      engine.modifyPlayerExploration(playerId, 5);
      engine.log(`探索者投出 ${dice}，发布指南，探索值 +5`, playerId);
    } else {
      engine.modifyPlayerExploration(playerId, -1);
      engine.log(`探索者投出 ${dice}，单打独斗`, playerId);
    }
    return null;
  });

  // === Explore Line (探索线/乐在南哪) ===
  eventHandler.registerHandler('line_explore_singing', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
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

  eventHandler.registerHandler('line_explore_wall', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('被表白捞人，探索值 +2', playerId);
    return null;
  });

  eventHandler.registerHandler('line_explore_club', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -100);
    engine.modifyPlayerExploration(playerId, 5);
    engine.log('加入社团，金钱 -100，探索值 +5', playerId);
    return null;
  });

  eventHandler.registerHandler('line_explore_volunteer', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (player && player.exploration >= 10) {
      engine.modifyPlayerExploration(playerId, 4);
      engine.log('热心志愿（探索值 >= 10），探索值 +4', playerId);
    } else {
      engine.modifyPlayerExploration(playerId, 2);
      engine.log('热心志愿（探索值 < 10），探索值 +2', playerId);
    }
    return null;
  });

  // === Gulou Line (鼓楼线) ===
  eventHandler.registerHandler('line_gulou_root', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (player && player.exploration < 10) {
      engine.modifyPlayerExploration(playerId, 2);
      engine.log('寻根计划（探索值 < 10），探索值 +2', playerId);
    } else {
      engine.modifyPlayerMoney(playerId, -100);
      engine.log('寻根计划（探索值 >= 10），大翻修中，金钱 -100', playerId);
    }
    return null;
  });

  eventHandler.registerHandler('line_gulou_scenic', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
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

  eventHandler.registerHandler('line_gulou_star', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerGpa(playerId, 0.3);
      engine.log(`偶遇明星投出 ${dice}，去图书馆学习，GPA +0.3`, playerId);
    } else {
      engine.modifyPlayerExploration(playerId, 2);
      engine.modifyPlayerGpa(playerId, -0.1);
      engine.log(`偶遇明星投出 ${dice}，发小红书，探索值 +2，GPA -0.1`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('line_gulou_wedding', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 3);
    engine.log('旁观集体婚礼，探索值 +3', playerId);
    return null;
  });

  // === Xianlin Line (仙林线) ===
  eventHandler.registerHandler('line_xianlin_conference', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerMoney(playerId, 100);
      engine.modifyPlayerExploration(playerId, 2);
      engine.log(`会议中心投出 ${dice}，老师请客，金钱 +100，探索值 +2`, playerId);
    } else {
      engine.modifyPlayerMoney(playerId, -200);
      engine.log(`会议中心投出 ${dice}，订酒店，金钱 -200`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('line_xianlin_wild_boar', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('偶遇野猪学长，探索值 +2', playerId);
    return null;
  });

  eventHandler.registerHandler('line_xianlin_lost', (engine, playerId) => {
    engine.modifyPlayerGpa(playerId, -0.1);
    engine.log('逸夫楼迷路迟到，GPA -0.1', playerId);
    return null;
  });

  eventHandler.registerHandler('line_xianlin_dorm', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
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
        break;
    }
    return null;
  });

  eventHandler.registerHandler('line_xianlin_maimen', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -100);
    engine.log('麦门信徒，金钱 -100，获得麦门护盾', playerId);
    return null;
  });

  // === Food Line (食堂线/吃在南哪) ===
  eventHandler.registerHandler('line_food_norovirus', (engine, playerId) => {
    engine.modifyPlayerMoney(playerId, -200);
    engine.setPlayerHospitalStatus(playerId, true);
    engine.log('发生诺如，前往校医院，金钱 -200', playerId);
    return null;
  });

  eventHandler.registerHandler('line_food_protein', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
    if (dice % 2 === 1) {
      engine.modifyPlayerExploration(playerId, 2);
      engine.log(`吃出蛋白质投出 ${dice}，经理慰问，探索值 +2`, playerId);
    } else {
      engine.modifyPlayerMoney(playerId, -100);
      engine.log(`吃出蛋白质投出 ${dice}，不了了之，金钱 -100`, playerId);
    }
    return null;
  });

  eventHandler.registerHandler('line_food_new_item', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
    engine.modifyPlayerMoney(playerId, -dice * 50);
    engine.log(`尝新品，金钱 -${dice * 50}`, playerId);
    return null;
  });

  eventHandler.registerHandler('line_food_nine_canteen', (engine, playerId) => {
    const dice = engine.rollDice(1)[0];
    engine.modifyPlayerMoney(playerId, -dice * 50);
    engine.modifyPlayerExploration(playerId, 3);
    engine.log(`九食堂招待朋友，金钱 -${dice * 50}，探索值 +3`, playerId);
    return null;
  });

  eventHandler.registerHandler('line_food_leader', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('偶遇校领导，探索值 +2', playerId);
    return null;
  });

  eventHandler.registerHandler('line_food_shoushuo', (engine, playerId) => {
    engine.modifyPlayerExploration(playerId, 4);
    engine.log('加入手手做月饼，探索值 +4', playerId);
    return null;
  });

  console.log('[LineHandlers] Registered line handlers');
}
