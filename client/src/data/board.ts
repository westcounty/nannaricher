// client/src/data/board.ts
// 棋盘数据 - 从服务器端复制
import { BoardData, BoardLine } from '@nannaricher/shared';

// 浦口线
const pukouLine: BoardLine = {
  id: 'pukou',
  name: '浦口线 - 浦口校区',
  entryFee: 0,
  forceEntry: true,
  cells: [
    { index: 0, id: 'pk_1', name: '图书馆空调没有开放', description: 'GPA减少0.2', handlerId: 'pukou_library_ac' },
    { index: 1, id: 'pk_2', name: '三地奔波', description: '为了满足跨专业选课而在仙鼓浦之间通勤', handlerId: 'pukou_commute' },
    { index: 2, id: 'pk_3', name: '地广人稀', description: '社团活动严重不足', handlerId: 'pukou_sparse' },
    { index: 3, id: 'pk_4', name: '潜心学习嚼菜根', description: '地理位置荒僻，更适合潜心学习', handlerId: 'pukou_study' },
    { index: 4, id: 'pk_5', name: '交通不便', description: '实习困难', handlerId: 'pukou_transport' },
    { index: 5, id: 'pk_6', name: '手手速报', description: '摇骰子判定', handlerId: 'pukou_shoushou' },
    { index: 6, id: 'pk_7', name: '必要设施缺失', description: '各种店铺兴起', handlerId: 'pukou_facilities' },
    { index: 7, id: 'pk_8', name: '食堂及菜品匮乏', description: '缺少前进动力', handlerId: 'pukou_cafeteria' },
    { index: 8, id: 'pk_9', name: '金陵学院大门', description: '大门还悬挂着南哪大学金陵学院', handlerId: 'pukou_jinling_gate' },
    { index: 9, id: 'pk_10', name: '没有IT侠', description: '电脑出了故障', handlerId: 'pukou_no_it' },
    { index: 10, id: 'pk_11', name: '快递寄到车大成贤', description: '奇偶判定', handlerId: 'pukou_delivery' },
    { index: 11, id: 'pk_12', name: '被子被鸟屎污染', description: '室外晾晒被子', handlerId: 'pukou_bird' },
  ],
  experienceCard: {
    id: 'pk_exp',
    name: '跨校区调宿',
    description: '金钱增加400，可以选择移动至鼓楼/仙林/苏州线入口处',
    handlerId: 'pukou_exp_card',
  },
};

// 学在南哪 - 学习线
const studyLine: BoardLine = {
  id: 'study',
  name: '学在南哪 - GPA线',
  entryFee: 200,
  forceEntry: false,
  cells: [
    { index: 0, id: 'st_1', name: '期末考试通宵复习', description: '奇偶判定', handlerId: 'study_exam' },
    { index: 1, id: 'st_2', name: '奖学金评选', description: 'GPA判定', handlerId: 'study_scholarship' },
    { index: 2, id: 'st_3', name: '图书馆延迟闭馆', description: '发现图书馆延迟了闭馆时间', handlerId: 'study_library_late' },
    { index: 3, id: 'st_4', name: '南哪课表', description: '下载了南哪课表', handlerId: 'study_schedule_app' },
    { index: 4, id: 'st_5', name: '通宵教室', description: '发现学校增开了通宵教室', handlerId: 'study_all_night' },
    { index: 5, id: 'st_6', name: '小组作业', description: '老师又布置了小组作业', handlerId: 'study_group_work' },
    { index: 6, id: 'st_7', name: '摄像头麦克风事故', description: '线上课事故', handlerId: 'study_camera_accident' },
    { index: 7, id: 'st_8', name: '急流勇退', description: '选修外专业课程退课', handlerId: 'study_withdraw' },
    { index: 8, id: 'st_9', name: '毕业答辩', description: 'GPA判定', handlerId: 'study_defense' },
  ],
  experienceCard: {
    id: 'st_exp',
    name: '保研成功',
    description: 'GPA增加0.2',
    handlerId: 'study_exp_card',
  },
};

// 赚在南哪 - 金钱线
const moneyLine: BoardLine = {
  id: 'money',
  name: '赚在南哪 - 金钱线',
  entryFee: 200,
  forceEntry: false,
  cells: [
    { index: 0, id: 'mn_1', name: '违反校规开办考研辅导', description: '处罚', handlerId: 'money_tutoring_violation' },
    { index: 1, id: 'mn_2', name: '无中介费家教', description: '通过朋友接到了家教', handlerId: 'money_tutoring_free' },
    { index: 2, id: 'mn_3', name: '创办南哪闲闲', description: '指定玩家交换金钱', handlerId: 'money_xianxian' },
    { index: 3, id: 'mn_4', name: '校园卡摊点', description: '奇偶判定', handlerId: 'money_campus_card' },
    { index: 4, id: 'mn_5', name: '白嫖网费', description: '填写问卷', handlerId: 'money_free_internet' },
    { index: 5, id: 'mn_6', name: '校园卡丢失', description: '奇偶判定', handlerId: 'money_card_lost' },
    { index: 6, id: 'mn_7', name: '充值叠加优惠', description: '发现优惠', handlerId: 'money_recharge_bonus' },
    { index: 7, id: 'mn_8', name: '众创空间', description: '创业风险', handlerId: 'money_startup' },
    { index: 8, id: 'mn_9', name: '录取通知盒流水线', description: '暑假留校工作', handlerId: 'money_admission_box' },
    { index: 9, id: 'mn_10', name: '校友内推', description: '成功获得内推', handlerId: 'money_alumni_referral' },
  ],
  experienceCard: {
    id: 'mn_exp',
    name: '校友企业',
    description: '金钱增加500',
    handlerId: 'money_exp_card',
  },
};

// 苏州线
const suzhouLine: BoardLine = {
  id: 'suzhou',
  name: '苏州线 - 苏州校区',
  entryFee: 200,
  forceEntry: false,
  cells: [
    { index: 0, id: 'sz_1', name: '明明说好嚼菜根', description: '你却开了荤', handlerId: 'suzhou_meaty' },
    { index: 1, id: 'sz_2', name: '课没修够两地奔波', description: '跨校区选课', handlerId: 'suzhou_commute' },
    { index: 2, id: 'sz_3', name: '专业名高大上', description: '苏州专业名', handlerId: 'suzhou_fancy_major' },
    { index: 3, id: 'sz_4', name: '半壁江山竟仍是工地', description: '建设中', handlerId: 'suzhou_construction' },
    { index: 4, id: 'sz_5', name: '首批小白鼠', description: '作为首批学生', handlerId: 'suzhou_guinea_pig' },
    { index: 5, id: 'sz_6', name: '培养计划套娃盲盒', description: '奇偶判定', handlerId: 'suzhou_curriculum_box' },
    { index: 6, id: 'sz_7', name: '另起炉灶', description: '学生组织空白', handlerId: 'suzhou_blank_slate' },
    { index: 7, id: 'sz_8', name: '机场之谜', description: '苏州的机场', handlerId: 'suzhou_airport' },
    { index: 8, id: 'sz_9', name: '室内雪世界的饼', description: '规划中', handlerId: 'suzhou_ski_dream' },
    { index: 9, id: 'sz_10', name: '探索者', description: '奇偶判定', handlerId: 'suzhou_explorer' },
  ],
  experienceCard: {
    id: 'sz_exp',
    name: '未来科技',
    description: '控制其他玩家移动',
    handlerId: 'suzhou_exp_card',
  },
};

// 乐在南哪 - 探索线
const exploreLine: BoardLine = {
  id: 'explore',
  name: '乐在南哪 - 探索线',
  entryFee: 200,
  forceEntry: false,
  cells: [
    { index: 0, id: 'ex_1', name: '十大歌星', description: '骰子判定', handlerId: 'explore_singer' },
    { index: 1, id: 'ex_2', name: '社牛属性爆发', description: '社牛爆发', handlerId: 'explore_social_butterfly' },
    { index: 2, id: 'ex_3', name: '百团大战', description: '加入社团', handlerId: 'explore_club' },
    { index: 3, id: 'ex_4', name: '热心志愿', description: '热心志愿', handlerId: 'explore_volunteer' },
    { index: 4, id: 'ex_5', name: '学生组织留任', description: '奇偶判定', handlerId: 'explore_student_org' },
    { index: 5, id: 'ex_6', name: '著名人物到访', description: '著名人物', handlerId: 'explore_vip_visit' },
    { index: 6, id: 'ex_7', name: '筹备学生活动', description: '活动筹备', handlerId: 'explore_event_prep' },
    { index: 7, id: 'ex_8', name: '认识搭子', description: 'MBTI相合', handlerId: 'explore_partner' },
    { index: 8, id: 'ex_9', name: '120周年校庆', description: '校庆活动', handlerId: 'explore_anniversary' },
  ],
  experienceCard: {
    id: 'ex_exp',
    name: '任职导员',
    description: '探索值增加',
    handlerId: 'explore_exp_card',
  },
};

// 鼓楼线
const gulouLine: BoardLine = {
  id: 'gulou',
  name: '鼓楼线 - 鼓楼校区',
  entryFee: 200,
  forceEntry: false,
  cells: [
    { index: 0, id: 'gl_1', name: '寻根计划', description: '探索值判定', handlerId: 'gulou_root_plan' },
    { index: 1, id: 'gl_2', name: '名胜古迹', description: '骰子判定', handlerId: 'gulou_heritage' },
    { index: 2, id: 'gl_3', name: '偶遇明星拍戏', description: '奇偶判定', handlerId: 'gulou_celebrity' },
    { index: 3, id: 'gl_4', name: '灯红酒绿', description: '吃喝玩乐', handlerId: 'gulou_entertainment' },
    { index: 4, id: 'gl_5', name: '北大楼草坪集体婚礼', description: '旁观婚礼', handlerId: 'gulou_wedding' },
    { index: 5, id: 'gl_6', name: '退休老教师', description: '亲切交谈', handlerId: 'gulou_retired_teacher' },
    { index: 6, id: 'gl_7', name: '百廿校庆', description: '校庆', handlerId: 'gulou_anniversary' },
    { index: 7, id: 'gl_8', name: '鼓楼建筑图鉴', description: '建筑图鉴', handlerId: 'gulou_building_guide' },
    { index: 8, id: 'gl_9', name: '带同学游览鼓楼', description: '导游', handlerId: 'gulou_tour_guide' },
  ],
  experienceCard: {
    id: 'gl_exp',
    name: '军训时刻',
    description: '探索值增加3',
    handlerId: 'gulou_exp_card',
  },
};

// 仙林线
const xianlinLine: BoardLine = {
  id: 'xianlin',
  name: '仙林线 - 仙林校区',
  entryFee: 200,
  forceEntry: false,
  cells: [
    { index: 0, id: 'xl_1', name: '会议中心', description: '奇偶判定', handlerId: 'xianlin_conference' },
    { index: 1, id: 'xl_2', name: '野猪学长和狐獴学弟', description: '偶遇', handlerId: 'xianlin_wildlife' },
    { index: 2, id: 'xl_3', name: '逸夫楼迷路', description: '迷路', handlerId: 'xianlin_yifu_lost' },
    { index: 3, id: 'xl_4', name: '宿舍分配', description: '骰子判定', handlerId: 'xianlin_dorm' },
    { index: 4, id: 'xl_5', name: '独立卫浴改造', description: '奇偶判定', handlerId: 'xianlin_bathroom' },
    { index: 5, id: 'xl_6', name: '麦门信徒', description: '麦当劳', handlerId: 'xianlin_mcdonalds' },
    { index: 6, id: 'xl_7', name: '带高中同学游览仙林', description: '奇偶判定', handlerId: 'xianlin_tour' },
  ],
  experienceCard: {
    id: 'xl_exp',
    name: '毕业典礼',
    description: '探索值增加3',
    handlerId: 'xianlin_exp_card',
  },
};

// 食堂线
const foodLine: BoardLine = {
  id: 'food',
  name: '食在南哪 - 食堂线',
  entryFee: 0,
  forceEntry: true,
  cells: [
    { index: 0, id: 'fd_1', name: '发生诺如', description: '前往校医院', handlerId: 'food_norovirus' },
    { index: 1, id: 'fd_2', name: '吃出高质量蛋白质', description: '奇偶判定', handlerId: 'food_protein' },
    { index: 2, id: 'fd_3', name: '尝试食堂新品', description: '新品尝试', handlerId: 'food_new_item' },
    { index: 3, id: 'fd_4', name: '装修后的二食堂', description: '装修后', handlerId: 'food_renovated' },
    { index: 4, id: 'fd_5', name: '九食堂招待朋友', description: '招待朋友', handlerId: 'food_nine_canteen' },
    { index: 5, id: 'fd_6', name: '偶遇校领导', description: '食堂偶遇', handlerId: 'food_leadership' },
    { index: 6, id: 'fd_7', name: '加入手手做月饼', description: '做月饼', handlerId: 'food_mooncake' },
    { index: 7, id: 'fd_8', name: '金陵小炒包间', description: '发现包间', handlerId: 'food_private_room' },
    { index: 8, id: 'fd_9', name: '不锈钢饭盆', description: '朋友来访', handlerId: 'food_stainless_bowl' },
  ],
  experienceCard: {
    id: 'fd_exp',
    name: '宠辱不惊',
    description: '食堂线入口可选',
    handlerId: 'food_exp_card',
  },
};

// 所有线路
const allLines: Record<string, BoardLine> = {
  pukou: pukouLine,
  study: studyLine,
  money: moneyLine,
  suzhou: suzhouLine,
  explore: exploreLine,
  gulou: gulouLine,
  xianlin: xianlinLine,
  food: foodLine,
};

// 棋盘数据
export const boardData: BoardData = {
  mainBoard: [
    // Corner 1: 起点/低保日
    { index: 0, id: 'start', name: '起点/低保日', type: 'corner', cornerType: 'start' },
    // Side 1: Start → Hospital
    { index: 1, id: 'tuition', name: '所有人交学费', type: 'event' },
    { index: 2, id: 'chance_1', name: '机会/命运', type: 'chance' },
    { index: 3, id: 'jiang_gong', name: '蒋公的面子', type: 'event' },
    { index: 4, id: 'line_pukou', name: '浦口线入口', type: 'line_entry', lineId: 'pukou', forceEntry: true, entryFee: 0 },
    { index: 5, id: 'retake', name: '重修', type: 'event' },
    { index: 6, id: 'chance_2', name: '机会/命运', type: 'chance' },
    { index: 7, id: 'society', name: '社团', type: 'event' },
    // Corner 2: 校医院
    { index: 8, id: 'hospital', name: '校医院', type: 'corner', cornerType: 'hospital' },
    // Side 2: Hospital → Ding
    { index: 9, id: 'line_study', name: '学在南哪入口', type: 'line_entry', lineId: 'study', forceEntry: false, entryFee: 200 },
    { index: 10, id: 'zijing', name: '紫荆站', type: 'event' },
    { index: 11, id: 'chance_3', name: '机会/命运', type: 'chance' },
    { index: 12, id: 'line_money', name: '赚在南哪入口', type: 'line_entry', lineId: 'money', forceEntry: false, entryFee: 200 },
    { index: 13, id: 'nanna_cp', name: '南哪诚品', type: 'event' },
    { index: 14, id: 'chance_4', name: '机会/命运', type: 'chance' },
    { index: 15, id: 'line_suzhou', name: '苏州线入口', type: 'line_entry', lineId: 'suzhou', forceEntry: false, entryFee: 200 },
    // Corner 3: 鼎
    { index: 16, id: 'ding', name: '鼎', type: 'corner', cornerType: 'ding' },
    // Side 3: Ding → Waiting Room
    { index: 17, id: 'line_explore', name: '乐在南哪入口', type: 'line_entry', lineId: 'explore', forceEntry: false, entryFee: 200 },
    { index: 18, id: 'kechuang', name: '科创赛事', type: 'event' },
    { index: 19, id: 'chance_5', name: '机会/命运', type: 'chance' },
    { index: 20, id: 'line_gulou', name: '鼓楼线入口', type: 'line_entry', lineId: 'gulou', forceEntry: false, entryFee: 200 },
    { index: 21, id: 'chuangmen', name: '闯门', type: 'event' },
    { index: 22, id: 'chance_6', name: '机会/命运', type: 'chance' },
    { index: 23, id: 'line_xianlin', name: '仙林线入口', type: 'line_entry', lineId: 'xianlin', forceEntry: false, entryFee: 200 },
    // Corner 4: 候车厅
    { index: 24, id: 'waiting_room', name: '候车厅', type: 'corner', cornerType: 'waiting_room' },
    // Side 4: Waiting Room → Start
    { index: 25, id: 'line_food', name: '食堂线入口', type: 'line_entry', lineId: 'food', forceEntry: true, entryFee: 0 },
    { index: 26, id: 'qingong', name: '勤工助学', type: 'event' },
    { index: 27, id: 'chance_7', name: '机会/命运', type: 'chance' },
  ],
  lines: allLines,
};

export const MAIN_BOARD_SIZE = boardData.mainBoard.length;

export default boardData;
