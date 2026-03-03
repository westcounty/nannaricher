// server/src/data/lines/money.ts
// 赚在南哪 - 家教兼职创业线（金钱线）
import { BoardLine } from '@nannaricher/shared';

export const moneyLine: BoardLine = {
  id: 'money',
  name: '赚在南哪 - 金钱线',
  entryFee: 200,
  forceEntry: false,
  cells: [
    { index: 0, id: 'mn_1', name: '违反校规开办考研辅导', description: '探索值减少5，金钱减少300', handlerId: 'money_tutoring_violation' },
    { index: 1, id: 'mn_2', name: '无中介费家教', description: '通过朋友接到了没有中介费的家教：金钱增加200', handlerId: 'money_tutoring_free' },
    { index: 2, id: 'mn_3', name: '创办南哪闲闲', description: '可指定场上除自己外两名玩家交换金钱数值', handlerId: 'money_xianxian' },
    { index: 3, id: 'mn_4', name: '校园卡摊点', description: '奇数：实名办卡，金钱减少100；偶数：看过防骗指南，探索值增加2', handlerId: 'money_campus_card' },
    { index: 4, id: 'mn_5', name: '白嫖网费', description: '积极填写ITSC问卷调查和听讲座来白嫖下月网费：金钱增加200', handlerId: 'money_free_internet' },
    { index: 5, id: 'mn_6', name: '校园卡丢失', description: '奇数：找回了校园卡，探索值增加2，抽一张机会卡或命运卡；偶数：重办校园卡，金钱减少20*点数', handlerId: 'money_card_lost' },
    { index: 6, id: 'mn_7', name: '充值叠加优惠', description: '发现校园卡充值叠加优惠：金钱增加点数*100', handlerId: 'money_recharge_bonus' },
    { index: 7, id: 'mn_8', name: '众创空间', description: '1或6：金钱翻倍，探索值增加6；2-5：金钱减少至全场最低，GPA减少至3.0', handlerId: 'money_startup' },
    { index: 8, id: 'mn_9', name: '录取通知盒流水线', description: '暑假留校参加包装录取通知盒流水线工作：金钱增加200，探索值增加3，抽一张机会卡或命运卡', handlerId: 'money_admission_box' },
    { index: 9, id: 'mn_10', name: '校友内推', description: '成功获得校友内推：金钱增加200，探索值增加2', handlerId: 'money_alumni_referral' },
  ],
  experienceCard: {
    id: 'mn_exp',
    name: '校友企业',
    description: '金钱增加500；若金钱超过1500，则减少500金钱，增加5探索值（用于捐赠）',
    handlerId: 'money_exp_card',
  },
};
