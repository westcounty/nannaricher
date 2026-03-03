// server/src/data/lines/study.ts
// 学在南哪 - 学习线（GPA线）
import { BoardLine } from '@nannaricher/shared';

export const studyLine: BoardLine = {
  id: 'study',
  name: '学在南哪 - GPA线',
  entryFee: 200,
  forceEntry: false,
  cells: [
    { index: 0, id: 'st_1', name: '期末考试通宵复习', description: '奇数：GPA增加0.2；偶数：暂停一回合，GPA减少0.1，下一回合重新投掷判定', handlerId: 'study_exam' },
    { index: 1, id: 'st_2', name: '奖学金评选', description: 'GPA不低于4.5获得300金钱和0.1GPA；不低于4.0获得200金钱和0.2GPA；低于4.0获得100金钱和0.3GPA', handlerId: 'study_scholarship' },
    { index: 2, id: 'st_3', name: '图书馆延迟闭馆', description: '发现图书馆延迟了闭馆时间：GPA增加0.2，抽一张机会卡或命运卡', handlerId: 'study_library_late' },
    { index: 3, id: 'st_4', name: '南哪课表', description: '下载了南哪课表来方便查看课程信息：探索值增加2', handlerId: 'study_schedule_app' },
    { index: 4, id: 'st_5', name: '通宵教室', description: '发现学校增开了通宵教室：GPA增加0.2，抽一张机会卡或命运卡', handlerId: 'study_all_night' },
    { index: 5, id: 'st_6', name: '小组作业', description: '老师又布置了人见人爱的小组作业：GPA减少0.2，抽一张机会卡或命运卡', handlerId: 'study_group_work' },
    { index: 6, id: 'st_7', name: '摄像头麦克风事故', description: '线上课忘了关闭摄像头，还打开了麦克风：探索值减少4', handlerId: 'study_camera_accident' },
    { index: 7, id: 'st_8', name: '急流勇退', description: '选修外专业课程，在期中火葬场之前急流勇退：GPA增加0.1，探索值增加2，抽一张机会卡或命运卡', handlerId: 'study_withdraw' },
    { index: 8, id: 'st_9', name: '毕业答辩', description: 'GPA不低于3.0：GPA增加0.3，抽两张机会卡或命运卡；GPA低于3.0：延毕，回到学习线起点并重新扣费', handlerId: 'study_defense' },
  ],
  experienceCard: {
    id: 'st_exp',
    name: '保研成功',
    description: 'GPA增加0.2，投骰子：1或2移动至浦口线并立即进入，3或4移动至鼓楼线，5或6移动至仙林线，不交入场费',
    handlerId: 'study_exp_card',
  },
};
