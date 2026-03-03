// server/src/data/lines/suzhou.ts
// 苏州线 - 苏州校区
import { BoardLine } from '@nannaricher/shared';

export const suzhouLine: BoardLine = {
  id: 'suzhou',
  name: '苏州线 - 苏州校区',
  entryFee: 200,
  forceEntry: false,
  cells: [
    { index: 0, id: 'sz_1', name: '明明说好嚼菜根', description: '你却开了荤：探索值增加2，抽一张机会卡或命运卡', handlerId: 'suzhou_meaty' },
    { index: 1, id: 'sz_2', name: '课没修够两地奔波', description: '金钱减少200，GPA增加0.3', handlerId: 'suzhou_commute' },
    { index: 2, id: 'sz_3', name: '专业名高大上', description: '苏州专业名高大上：探索值增加2，抽一张机会卡或命运卡', handlerId: 'suzhou_fancy_major' },
    { index: 3, id: 'sz_4', name: '半壁江山竟仍是工地', description: '探索值减少1，抽一张机会卡或命运卡', handlerId: 'suzhou_construction' },
    { index: 4, id: 'sz_5', name: '首批小白鼠', description: '作为首批小白鼠得到了充足的慰问：探索值增加1，金钱增加200', handlerId: 'suzhou_guinea_pig' },
    { index: 5, id: 'sz_6', name: '培养计划套娃盲盒', description: '奇数：GPA减少0.1，抽一张机会卡或命运卡；偶数：GPA增加0.3，抽一张机会卡或命运卡', handlerId: 'suzhou_curriculum_box' },
    { index: 6, id: 'sz_7', name: '另起炉灶', description: '学生组织和社团活动一片空白：抽两张机会卡或命运卡，GPA增加0.1', handlerId: 'suzhou_blank_slate' },
    { index: 7, id: 'sz_8', name: '机场之谜', description: '苏州的机场究竟是虹桥还是浦东：金钱减少200', handlerId: 'suzhou_airport' },
    { index: 8, id: 'sz_9', name: '室内雪世界的饼', description: '室内雪世界的饼已经画好了：探索值增加1', handlerId: 'suzhou_ski_dream' },
    { index: 9, id: 'sz_10', name: '探索者', description: '偶数：整理成《苏州校区生存指南》并投稿，探索值增加5；奇数：单打独斗身心俱疲，抽一张机会卡或命运卡', handlerId: 'suzhou_explorer' },
  ],
  experienceCard: {
    id: 'sz_exp',
    name: '未来科技',
    description: '掷一次骰子，让除自己外某位玩家，前进或后退相应的点数',
    handlerId: 'suzhou_exp_card',
  },
};
