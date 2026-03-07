// server/src/data/trainingPlans.ts
import { TrainingPlan } from '@nannaricher/shared';

export const trainingPlans: TrainingPlan[] = [
  {
    id: 'plan_wenxue',
    name: '文学院',
    winCondition: '当你离开赚在南哪线时，如金钱未发生变化（不考虑终点经验卡效果），你获胜',
    passiveAbility: '当你到达蒋公的面子时，改为选择一项执行：获得100金钱，或大声喊出不吃，并赢得全场掌声和2探索值',

  },
  {
    id: 'plan_lishi',
    name: '历史学院',
    winCondition: '当你按顺序经过或进入过鼓楼、浦口、仙林和苏州校区线后，你获胜',
    passiveAbility: '你移动到鼓楼线入口',

  },
  {
    id: 'plan_zhexue',
    name: '哲学系',
    winCondition: '当你完整进出某条线，且探索值和GPA没有任何变化时（不包括终点经验卡效果），你获胜',
    passiveAbility: '你的GPA至低为3.0',

  },
  {
    id: 'plan_faxue',
    name: '法学院',
    winCondition: '当场上出现破产玩家且不是你时，你获胜',
    passiveAbility: '免除下一次金钱损失',

  },
  {
    id: 'plan_shangxue',
    name: '商学院',
    winCondition: '当你金钱数达到5000时，你获胜',
    passiveAbility: '直接移动至赚在南哪，不交入场费，经过起点不领取工资',

  },
  {
    id: 'plan_waiguoyu',
    name: '外国语学院',
    winCondition: '当你抽到过两张（可以重复）包含英文字母（除了GPA）的事件/机会/命运卡后，你获胜',
    passiveAbility: '立即抽取一张机会卡或命运卡',

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
    winCondition: '当你的探索值、GPA和金钱数均不和场上除你外任何玩家一致时，你获胜',
    passiveAbility: '你进入四个校区线的入场费改为150金钱',

  },
  {
    id: 'plan_guoji',
    name: '国际关系学院',
    winCondition: '你和至少两名其他玩家互相使用过机会卡后，你获胜',
    passiveAbility: '指定一位除你外的玩家，抽取一张机会卡',

  },
  {
    id: 'plan_xinxiguanli',
    name: '信息管理学院',
    winCondition: '当你抽到过不重复的五个标题中以数字开头的机会卡/命运卡后，你获胜',
    passiveAbility: '你可以立即重新分配场上所有玩家拥有的卡片，至多三张',

  },
  {
    id: 'plan_shehuixue',
    name: '社会学院',
    winCondition: '当你的探索值比场上探索值最低玩家高20时，你获胜',
    passiveAbility: '你可以选择永久减少一个胜利条件位，将本培养计划的获胜条件修改为高15',

  },
  {
    id: 'plan_shuxue',
    name: '数学系',
    winCondition: '当你第三次到达鼓楼校区线终点后，你获胜',
    passiveAbility: '可以指定下一回合自己的骰子点数',

  },
  {
    id: 'plan_wuli',
    name: '物理学院',
    winCondition: '你在计算基础胜利条件时，可以从金钱、GPA和探索值中任选两项参与计算，其中每项分数=探索值=GPA*10=金钱数/100，两项相加达到90，你获胜',
    passiveAbility: '下一回合你选择前进双倍点数或后退双倍点数',

  },
  {
    id: 'plan_tianwen',
    name: '天文与空间科学学院',
    winCondition: '你和场上剩余每一个其他玩家同时在同一个格子停留过，你获胜',
    passiveAbility: '移动去候车厅，经过起点不领取低保',

  },
  {
    id: 'plan_huaxue',
    name: '化学化工学院',
    winCondition: '当你的探索值达到45时，你获胜',
    passiveAbility: '你可以选定一个格子和一条线，下一回合失效',

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
    passiveAbility: '设为主修时一次性选择：增加1探索值或增加100金钱',

  },
  {
    id: 'plan_ruanjian',
    name: '软件学院',
    winCondition: '当你到达交学费格子时，你可以改为支出3200金钱，若你没有破产，你获胜',
    passiveAbility: '你的金钱数可以至低为-1000',

  },
  {
    id: 'plan_dianzi',
    name: '电子科学与工程学院',
    winCondition: '若你在科创赛事投到6，你获胜',
    passiveAbility: '你在科创赛事只需要失去0.1的GPA即可执行投掷',

  },
  {
    id: 'plan_xiandai',
    name: '现代工程与应用科学学院',
    winCondition: '当你进入过除苏州校区外所有线时，你获胜',
    passiveAbility: '你可以立即抽取一张命运卡，并指定一位玩家执行该效果',

  },
  {
    id: 'plan_huanjing',
    name: '环境学院',
    winCondition: '当你经历过仙林校区线的每一个事件后，你获胜',
    passiveAbility: '你每经历一次直接移动事件，获得2探索值',

  },
  {
    id: 'plan_diqiu',
    name: '地球科学与工程学院',
    winCondition: '当你进入过每一条线后，你获胜',
    passiveAbility: '你每进入过不重复的一条线，每条线入场费减少100',

  },
  {
    id: 'plan_dili',
    name: '地理与海洋科学学院',
    winCondition: '当你执行过四个校区线的终点效果后，你获胜',
    passiveAbility: '你每进入过不重复的一个校区，每条线入场费减少100',

  },
  {
    id: 'plan_daqi',
    name: '大气科学学院',
    winCondition: '如果在20个回合内，你的金钱数额始终不为唯一最多，你获胜',
    passiveAbility: '你可以立即抽取三张机会卡或命运卡，并至多选择其中一张执行',

  },
  {
    id: 'plan_shengming',
    name: '生命科学学院',
    winCondition: '当你在食在南哪线连续三次没有触发负面效果（麦门护盾卡不计入次数，但是不算作中断连续），你获胜',
    passiveAbility: '获得场上或卡堆中的麦门护盾（单次使用，食堂线屏蔽负面效果）',

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
    winCondition: '当你第二次金钱数为0时，你获胜',
    passiveAbility: '获得场上或卡堆中的余额为负（单次使用，可以抵消一次不小于当前剩余金钱的支出）',

  },
  {
    id: 'plan_kuangyaming',
    name: '匡亚明学院',
    winCondition: '当你满足任意玩家的已固定培养计划时，你获胜',
    passiveAbility: '设为主修时一次性选择：GPA增加0.1或探索值增加1',

  },
  {
    id: 'plan_haiwai',
    name: '海外教育学院',
    winCondition: '当有玩家获胜时，若你对其使用过至少两次机会卡，你优先获胜',
    passiveAbility: '你可以自行选择是否进入食在南哪线',

  },
  {
    id: 'plan_jianzhu',
    name: '建筑与城市规划学院',
    winCondition: '当你经历过起点、校医院、鼎、候车厅和闯门后，你获胜',
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
    winCondition: '当你经历过浦口线每个事件后，你获胜',
    passiveAbility: '你在浦口线终点处可以执行双倍经验卡效果',

  },
  {
    id: 'plan_suzhou',
    name: '苏州校区',
    winCondition: '当你经历过苏州校区的每个事件后，你获胜',
    passiveAbility: '你每次进入苏州校区线不需要缴纳入场费，在其它三校区起点处可以选择失去300金钱移动到苏州校区线起点',

  },
];

export function createTrainingDeck(): TrainingPlan[] {
  return trainingPlans.map(plan => ({ ...plan }));
}
