// server/src/data/lines/explore.ts
// 乐在南哪 - 学生组织和活动线（探索线）
import { BoardLine } from '@nannaricher/shared';

export const exploreLine: BoardLine = {
  id: 'explore',
  name: '乐在南哪 - 探索线',
  entryFee: 200,
  forceEntry: false,
  cells: [
    { index: 0, id: 'ex_entrance', name: '未知的岔路口', description: '校园地图上没有标注的小路，长满了青苔的石板指向一个你从未注意过的方向。好奇心就像弹幕一样疯狂刷屏："去看看！"', handlerId: 'explore_entrance' },
    { index: 1, id: 'ex_1', name: '十大歌星', description: '1或3：探索值增加1；5：获得十大歌星称号，探索值增加4；偶数：暂停一回合', handlerId: 'explore_singer' },
    { index: 2, id: 'ex_2', name: '社牛属性爆发', description: '在运动会开幕式/迎新晚会上发挥社牛属性，视频被投稿南哪墙墙并被表白捞人：探索值增加2', handlerId: 'explore_social_butterfly' },
    { index: 3, id: 'ex_3', name: '百团大战', description: '加入社团，为爱发电，收获至交与成长：选择一名其他玩家，各金钱减少100，探索值增加5', handlerId: 'explore_club' },
    { index: 4, id: 'ex_4', name: '热心志愿', description: '热心志愿，积极社会实践：探索值不小于10增加4并抽卡，不足10增加2', handlerId: 'explore_volunteer' },
    { index: 5, id: 'ex_5', name: '学生组织留任', description: '奇数：完成留任目标，探索值增加3，抽一张机会卡或命运卡；偶数：摸鱼躺平，探索值减少3，抽一张机会卡或命运卡', handlerId: 'explore_student_org' },
    { index: 6, id: 'ex_6', name: '著名人物到访', description: '著名人物到访南哪，在前排亲切交流科研成果：探索值增加3，抽一张机会卡或命运卡', handlerId: 'explore_vip_visit' },
    { index: 7, id: 'ex_7', name: '筹备学生活动', description: '跨校区物资运输、人员组织，又恰逢课堂小测：探索值增加2，金钱减少100，GPA减少0.1', handlerId: 'explore_event_prep' },
    { index: 8, id: 'ex_8', name: '认识搭子', description: '与ta相识于组织/活动，MBTI相合，成为搭子：探索值增加1，GPA增加0.2，金钱减少200', handlerId: 'explore_partner' },
    { index: 9, id: 'ex_9', name: '120周年校庆', description: '获得电子餐券金钱增加20*点数；探索值不小于15暂停一回合；探索值小于15时奇数探索值增加3，偶数抽卡', handlerId: 'explore_anniversary' },
  ],
  experienceCard: {
    id: 'ex_exp',
    name: '任职导员',
    description: '探索值增加2*场上剩余玩家数，并暂停两回合',
    handlerId: 'explore_exp_card',
  },
};
