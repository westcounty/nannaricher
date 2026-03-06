// server/src/data/lines/food.ts
// 吃在南哪 - 食堂线
import { BoardLine } from '@nannaricher/shared';

export const foodLine: BoardLine = {
  id: 'food',
  name: '食在南哪 - 食堂线',
  entryFee: 0,
  forceEntry: true,
  cells: [
    { index: 0, id: 'fd_entrance', name: '食堂门口', description: '饭点到了！六食堂的麻辣香锅、二食堂的小炒、清真食堂的拉面……你的肚子率先发表了它的学术见解："咕噜噜～"', handlerId: 'food_entrance' },
    { index: 1, id: 'fd_1', name: '发生诺如', description: '直接前往校医院，失去200金钱，不领取本线经验卡和经过起点的低保', handlerId: 'food_norovirus' },
    { index: 2, id: 'fd_2', name: '吃出高质量蛋白质', description: '奇数：经理慰问并加入食堂建议群，探索值增加2，抽一张机会卡或命运卡；偶数：不了了之，金钱减少100，抽一张机会卡或命运卡', handlerId: 'food_protein' },
    { index: 3, id: 'fd_3', name: '尝试食堂新品', description: '尝试食堂没有标价的新品：失去点数*50的金钱，抽一张机会卡或命运卡', handlerId: 'food_new_item' },
    { index: 4, id: 'fd_4', name: '装修后的二食堂', description: '去装修后新开张的二食堂，发现形象比实际好：探索值减少1', handlerId: 'food_renovated' },
    { index: 5, id: 'fd_5', name: '九食堂招待朋友', description: '在久负盛名的九食堂招待朋友：失去点数*50的金钱，探索值增加3', handlerId: 'food_nine_canteen' },
    { index: 6, id: 'fd_6', name: '偶遇校领导', description: '在食堂偶遇校领导，并与之同桌交谈：探索值增加2', handlerId: 'food_leadership' },
    { index: 7, id: 'fd_7', name: '加入手手做月饼', description: '去食堂发现在做月饼的南哪手手团队，并趁机加入：探索值增加4，抽两张机会卡或命运卡', handlerId: 'food_mooncake' },
    { index: 8, id: 'fd_8', name: '金陵小炒包间', description: '在金陵小炒吃饭第一次发现里面还有包间：探索值增加1，抽一张机会卡或命运卡', handlerId: 'food_private_room' },
    { index: 9, id: 'fd_9', name: '不锈钢饭盆', description: '朋友来南哪找你玩，看着不锈钢饭盆欲言又止：抽一张机会卡或命运卡', handlerId: 'food_stainless_bowl' },
  ],
  experienceCard: {
    id: 'fd_exp',
    name: '宠辱不惊',
    description: '自此以后在食堂线入口可自行选择是否进入，无需强制入内',
    handlerId: 'food_exp_card',
  },
};
