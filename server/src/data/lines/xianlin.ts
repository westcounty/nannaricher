// server/src/data/lines/xianlin.ts
// 仙林线 - 仙林校区
import { BoardLine } from '@nannaricher/shared';

export const xianlinLine: BoardLine = {
  id: 'xianlin',
  name: '仙林线 - 仙林校区',
  entryFee: 200,
  forceEntry: false,
  cells: [
    { index: 0, id: 'xl_entrance', name: '仙林大道', description: '梧桐树荫下的大道延伸向远方，骑着小蓝车的同学们擦肩而过。这条路你走了无数遍，但今天似乎有什么不一样的事情要发生。', handlerId: 'xianlin_entrance' },
    { index: 1, id: 'xl_1', name: '会议中心', description: '奇数：老师请客自助，探索值增加2；偶数：订酒店，金钱减少200，GPA增加0.4', handlerId: 'xianlin_conference' },
    { index: 2, id: 'xl_2', name: '野猪学长和狐獴学弟', description: '偶遇野猪学长和狐獴学弟并拍照发布小红书：探索值增加2，抽一张机会卡或命运卡', handlerId: 'xianlin_wildlife' },
    { index: 3, id: 'xl_3', name: '逸夫楼迷路', description: '在逸夫楼迷路迟到：GPA减少0.1，探索值增加2', handlerId: 'xianlin_yifu_lost' },
    { index: 4, id: 'xl_4', name: '宿舍分配', description: '1：一组团，金钱减少100，探索值增加3；2：离图书馆最近，GPA增加0.2；3：三组团，金钱增加200；4：好食堂，探索值增加1，可选终止当前线路去食堂线；5或6：专硕无宿舍，金钱减少300，探索值增加1，GPA增加0.1，抽卡', handlerId: 'xianlin_dorm' },
    { index: 5, id: 'xl_5', name: '独立卫浴改造', description: '奇数：改装成功，探索值增加2；偶数：改装失败去游泳馆洗澡，金钱减少100，抽一张机会卡或命运卡', handlerId: 'xianlin_bathroom' },
    { index: 6, id: 'xl_6', name: '麦门信徒', description: '仙林最优秀的食堂麦麦的忠实客户：金钱减少100，获得麦门护盾命运卡', handlerId: 'xianlin_mcdonalds' },
    { index: 7, id: 'xl_7', name: '带高中同学游览仙林', description: '偶数：被评价为恢弘，GPA增加0.2，抽一张机会卡或命运卡；奇数：同学立志考研来南哪，探索值增加2', handlerId: 'xianlin_tour' },
  ],
  experienceCard: {
    id: 'xl_exp',
    name: '毕业典礼',
    description: '探索值增加3，移动至起点处，不领取低保',
    handlerId: 'xianlin_exp_card',
  },
};
