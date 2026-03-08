// server/src/data/trainingPlans.ts
import { TrainingPlan } from '@nannaricher/shared';

export const trainingPlans: TrainingPlan[] = [
  {
    id: 'plan_wenxue',
    name: '文学院',
    winCondition: '当你离开赚在南哪线时没有赚钱（不算经验卡和入场费，只计算支线内的事件导致的变化），你获胜',
    passiveAbility: '当你到达蒋公的面子时，改为选择一项执行：获得100金钱，或大声喊出不吃，并赢得全场掌声和2探索值。你在赚在南哪线中每次金钱正向变动减少50%（向零取整），负向变动不变',

  },
  {
    id: 'plan_lishi',
    name: '历史学院',
    winCondition: '在浦口线、鼓楼线、仙林线、苏州线累计到达过12个格子后，你获胜',
    passiveAbility: '被设置为主修方向后，可以选择移动到鼓楼线入口或仙林线入口',

  },
  {
    id: 'plan_zhexue',
    name: '哲学系',
    winCondition: '当你完整进出某条线，且探索值和GPA没有任何变化、金钱没有减少时（不包括终点经验卡效果），你获胜',
    passiveAbility: '你的GPA至低为3.0',

  },
  {
    id: 'plan_faxue',
    name: '法学院',
    winCondition: '出现其他破产玩家或罚没收入达到1000时，你获胜',
    passiveAbility: '免除下一次金钱损失，且每当有其他玩家失去金钱时，其需要额外支付其损失的10%给你作为罚没收入（单次上限为100）',

  },
  {
    id: 'plan_shangxue',
    name: '商学院',
    winCondition: '当你金钱数达到5555时，你获胜',
    passiveAbility: '直接移动至赚在南哪，不交入场费，经过起点不领取工资',

  },
  {
    id: 'plan_waiguoyu',
    name: '外国语学院',
    winCondition: '当你抽到过两张（可以重复）包含英文字母（除了GPA）的事件/机会/命运卡后，你获胜',
    passiveAbility: '立即抽取一张机会卡或命运卡。持续被动：每次抽到含英文字母的卡时，额外获得2探索值',

  },
  {
    id: 'plan_xinwen',
    name: '新闻传播学院',
    winCondition: '当你完整经过乐在南哪线，且全程没有探索值和GPA扣减，你获胜',
    passiveAbility: '你进入乐在南哪线不需要入场费',

  },
  {
    id: 'plan_zhengguan',
    name: '政府管理学院',
    winCondition: '当你的探索值达到20，且场上金钱最高和最低玩家的金钱差不超过666时，你获胜',
    passiveAbility: '你进入四个校区线的入场费改为150金钱',

  },
  {
    id: 'plan_guoji',
    name: '国际关系学院',
    winCondition: '你累计给他人使用3次机会卡，或被他人累计使用3次机会卡，则获胜',
    passiveAbility: '指定一位除你外的玩家，抽取一张机会卡',

  },
  {
    id: 'plan_xinxiguanli',
    name: '信息管理学院',
    winCondition: '当你抽到过不重复的四个标题中以数字开头的机会卡/命运卡后，你获胜',
    passiveAbility: '获得专属卡牌「数据整合」：在你的回合使用，选择至多两位有卡牌的玩家，从他们手中获取卡牌（每人至多2张，总计不超过3张）',

  },
  {
    id: 'plan_shehuixue',
    name: '社会学院',
    winCondition: '当你的探索值不低于15，且比场上探索值最低玩家高20时，你获胜',
    passiveAbility: '你可以选择永久减少一个胜利条件位，将本培养计划的获胜条件修改为高15',

  },
  {
    id: 'plan_shuxue',
    name: '数学系',
    winCondition: '当你第二次到达鼓楼校区线终点后，你获胜',
    passiveAbility: '可以指定下一回合自己的骰子点数',

  },
  {
    id: 'plan_wuli',
    name: '物理学院',
    winCondition: '你在计算基础胜利条件时，可以从金钱、GPA和探索值中任选两项参与计算，其中每项分数=探索值=GPA*10=金钱数/100，两项相加达到85，你获胜',
    passiveAbility: '下一回合你选择前进双倍点数或后退双倍点数',

  },
  {
    id: 'plan_tianwen',
    name: '天文与空间科学学院',
    winCondition: '你和每位其他玩家停留在同一格子的次数均大于等于2次后，你获胜',
    passiveAbility: '移动去候车厅，经过起点不领取低保',

  },
  {
    id: 'plan_huaxue',
    name: '化学化工学院',
    winCondition: '当你连续6个回合均触发了增益效果（金钱、GPA或探索值任一增加）后，你获胜',
    passiveAbility: '设为主修时选择禁用一个格子或线路，持续生效直到主修变更或新学年重新选择',

  },
  {
    id: 'plan_rengong',
    name: '人工智能学院',
    winCondition: '当你的GPA比场上GPA最低的玩家高2.0时，你获胜',
    passiveAbility: '你可以选择永久减少一个胜利条件位，将本培养计划的获胜条件修改为高1.5',

  },
  {
    id: 'plan_jisuanji',
    name: '计算机科学与技术系',
    winCondition: '当你的探索值和金钱数字中均只包含0或1时，你获胜',
    passiveAbility: '每回合可以选择获得+1探索值或获得101金钱或失去1探索值或失去100金钱',

  },
  {
    id: 'plan_ruanjian',
    name: '软件学院',
    winCondition: '如果累计交学费超过4200且没有破产，你获胜',
    passiveAbility: '众创空间的获胜条件与失败条件互换（投到2-5即成功）',

  },
  {
    id: 'plan_dianzi',
    name: '电子科学与工程学院',
    winCondition: '每次确认为主修后可以选择是否移动到科创赛事，科创赛事累计获得0.6及以上GPA时获胜',
    passiveAbility: '你在科创赛事只需要失去0.1的GPA即可执行投掷',

  },
  {
    id: 'plan_xiandai',
    name: '现代工程与应用科学学院',
    winCondition: 'GPA>=4且金钱>=4000，或探索值+GPA*10+金钱/1000>=60时，你获胜',
    passiveAbility: '你可以立即抽取一张命运卡，并指定一位玩家执行该效果',

  },
  {
    id: 'plan_huanjing',
    name: '环境学院',
    winCondition: '当你经历过仙林校区线至少5个不同事件后，你获胜',
    passiveAbility: '每次进入线路时，获得1探索值',

  },
  {
    id: 'plan_diqiu',
    name: '地球科学与工程学院',
    winCondition: '进入过浦口线、仙林线、苏州线、鼓楼线后，你获胜',
    passiveAbility: '你每进入过不重复的一条线，每条线入场费减少100',

  },
  {
    id: 'plan_dili',
    name: '地理与海洋科学学院',
    winCondition: '进入过赚钱、学习、探索和食堂线后，你获胜',
    passiveAbility: '在赚钱、学习、探索和食堂线的入场费改为+100（赚100）',

  },
  {
    id: 'plan_daqi',
    name: '大气科学学院',
    winCondition: '如果连续15个回合内，你的金钱数额始终不为唯一最多，你获胜',
    passiveAbility: '你可以立即抽取三张机会卡或命运卡，并至多选择其中一张执行',

  },
  {
    id: 'plan_shengming',
    name: '生命科学学院',
    winCondition: '单次食在南哪线中累计触发3次非负面效果（麦门护盾卡屏蔽的效果算作非负面），你获胜',
    passiveAbility: '获得麦门护盾卡，在食在南哪线中，每次触发非负面效果时额外获得1探索值',

  },
  {
    id: 'plan_yixue',
    name: '医学院',
    winCondition: '当你进入过三次医院后，你获胜',
    passiveAbility: '当你进入医院后，不需要付款即可出院',

  },
  {
    id: 'plan_gongguan',
    name: '工程管理学院',
    winCondition: '连续6回合金钱在500及以内时，你获胜',
    passiveAbility: '第一次成为主修时获得专属卡牌「资金调度令」：在自己回合使用，可选择将自己的金钱变为等同于全场最高或全场最低',

  },
  {
    id: 'plan_kuangyaming',
    name: '匡亚明学院',
    winCondition: '当你满足至少2个不同玩家的已固定培养计划条件时，你获胜',
    passiveAbility: '设为主修时一次性选择：GPA增加0.1或探索值增加1',

  },
  {
    id: 'plan_haiwai',
    name: '海外教育学院',
    winCondition: '当有玩家获胜时，若你对其使用过至少两次机会卡，你优先获胜',
    passiveAbility: '每回合开始时，你可以选择以下操作之一：获得400金钱，或花费1200金钱抽取一张机会卡',

  },
  {
    id: 'plan_jianzhu',
    name: '建筑与城市规划学院',
    winCondition: '当你经历过起点、校医院、鼎、候车厅和闯门中的任意四个后，你获胜',
    passiveAbility: '你进入鼓楼校区线，不需要支付入场费',

  },
  {
    id: 'plan_makesi',
    name: '马克思主义学院',
    winCondition: '当你GPA达到4.5时，你获胜',
    passiveAbility: '当你走到社团格子时，改为直接获得2探索值',

  },
  {
    id: 'plan_yishu',
    name: '艺术学院',
    winCondition: '当你经历过浦口线至少9个不同事件后，你获胜',
    passiveAbility: '你在浦口线终点处可以执行双倍经验卡效果',

  },
  {
    id: 'plan_suzhou',
    name: '苏州校区',
    winCondition: '当你经历过苏州校区至少8个不同事件后，你获胜',
    passiveAbility: '你每次进入苏州校区线不需要缴纳入场费，在其它三校区起点处可以选择失去300金钱移动到苏州校区线起点',

  },
];

export function createTrainingDeck(): TrainingPlan[] {
  return trainingPlans.map(plan => ({ ...plan }));
}
