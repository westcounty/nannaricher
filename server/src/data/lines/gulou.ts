// server/src/data/lines/gulou.ts
// 鼓楼线 - 鼓楼校区
import { BoardLine } from '@nannaricher/shared';

export const gulouLine: BoardLine = {
  id: 'gulou',
  name: '鼓楼线 - 鼓楼校区',
  entryFee: 200,
  forceEntry: false,
  cells: [
    { index: 0, id: 'gl_1', name: '寻根计划', description: '探索值不足10增加2；探索值不小于10：金钱减少100，抽一张机会卡或命运卡', handlerId: 'gulou_root_plan' },
    { index: 1, id: 'gl_2', name: '名胜古迹', description: '1或2：住到历史文物宿舍，探索值增加1；3或4：发现无数电视剧取景地，探索值增加2；5或6：皇陵宝地，探索值增加4', handlerId: 'gulou_heritage' },
    { index: 2, id: 'gl_3', name: '偶遇明星拍戏', description: '奇数：径直前往图书馆学习，GPA增加0.3；偶数：驻足围观发小红书，探索值增加2，GPA减少0.1', handlerId: 'gulou_celebrity' },
    { index: 3, id: 'gl_4', name: '灯红酒绿', description: '吃喝玩乐一应俱全：金钱减少200，抽两张机会卡或命运卡', handlerId: 'gulou_entertainment' },
    { index: 4, id: 'gl_5', name: '北大楼草坪集体婚礼', description: '旁观北大楼草坪集体婚礼：探索值增加3，抽一张机会卡或命运卡', handlerId: 'gulou_wedding' },
    { index: 5, id: 'gl_6', name: '退休老教师', description: '和仍住宿舍楼的退休老教师亲切交谈：探索值增加1，GPA增加0.1', handlerId: 'gulou_retired_teacher' },
    { index: 6, id: 'gl_7', name: '百廿校庆', description: '百廿校庆，但是基本没有任何活动在鼓楼：探索值减少2，抽一张机会卡或命运卡', handlerId: 'gulou_anniversary' },
    { index: 7, id: 'gl_8', name: '鼓楼建筑图鉴', description: '通过南哪手手的鼓楼建筑图鉴来成为合格的导游：探索值增加2', handlerId: 'gulou_building_guide' },
    { index: 8, id: 'gl_9', name: '带同学游览鼓楼', description: '同学称赞鼓楼校区为南京十大必去景点：探索值增加2，抽一张机会卡或命运卡', handlerId: 'gulou_tour_guide' },
  ],
  experienceCard: {
    id: 'gl_exp',
    name: '军训时刻',
    description: '探索值增加3，暂停一回合',
    handlerId: 'gulou_exp_card',
  },
};
