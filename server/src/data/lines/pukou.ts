// server/src/data/lines/pukou.ts
// 浦口线 - 浦口校区
import { BoardLine } from '@nannaricher/shared';

export const pukouLine: BoardLine = {
  id: 'pukou',
  name: '浦口线 - 浦口校区',
  entryFee: 0,
  forceEntry: true,
  cells: [
    { index: 0, id: 'pk_entrance', name: '浦口站台', description: '踏上开往浦口的校车，窗外的梧桐渐渐换成了杨树。听说浦口校区的猫比学生还多，你已经有点期待了。', handlerId: 'pukou_entrance' },
    { index: 1, id: 'pk_1', name: '图书馆空调没有开放', description: 'GPA减少0.2', handlerId: 'pukou_library_ac' },
    { index: 2, id: 'pk_2', name: '三地奔波', description: '为了满足跨专业选课而在仙鼓浦之间通勤：金钱减少200，GPA增加0.3', handlerId: 'pukou_commute' },
    { index: 3, id: 'pk_3', name: '地广人稀', description: '社团活动严重不足，超市很早关门：探索值减少2，抽一张机会卡或命运卡', handlerId: 'pukou_sparse' },
    { index: 4, id: 'pk_4', name: '潜心学习嚼菜根', description: '地理位置荒僻，更适合潜心学习：金钱增加100，GPA增加0.2', handlerId: 'pukou_study' },
    { index: 5, id: 'pk_5', name: '交通不便', description: '实习困难，毕业前景一片黑暗：探索值减少1，抽一张机会卡或命运卡', handlerId: 'pukou_transport' },
    { index: 6, id: 'pk_6', name: '手手速报', description: '摇骰子：奇数探索值减少2，偶数探索值增加3', handlerId: 'pukou_shoushou' },
    { index: 7, id: 'pk_7', name: '必要设施缺失', description: '打印店、咖啡店、奶茶店、轻食店纷起于宿舍：金钱增加200，探索值增加2，GPA减少0.2', handlerId: 'pukou_facilities' },
    { index: 8, id: 'pk_8', name: '食堂及菜品匮乏', description: '缺少前进动力：下一次由前进改为倒退', handlerId: 'pukou_cafeteria' },
    { index: 9, id: 'pk_9', name: '金陵学院大门', description: '大门还悬挂着南哪大学金陵学院：探索值减少2', handlerId: 'pukou_jinling_gate' },
    { index: 10, id: 'pk_10', name: '没有IT侠', description: '电脑出了故障，可是浦口没有IT侠营业：金钱减少100，抽一张机会卡或命运卡', handlerId: 'pukou_no_it' },
    { index: 11, id: 'pk_11', name: '快递寄到车大成贤', description: '奇数：探索值增加1；偶数：抽一张机会卡或命运卡', handlerId: 'pukou_delivery' },
    { index: 12, id: 'pk_12', name: '被子被鸟屎污染', description: '室外晾晒被子，浦口鸟比人多：金钱减少100', handlerId: 'pukou_bird' },
  ],
  experienceCard: {
    id: 'pk_exp',
    name: '跨校区调宿',
    description: '金钱增加400，可以选择移动至鼓楼/仙林/苏州线入口处，经过起点不领取低保',
    handlerId: 'pukou_exp_card',
  },
};
