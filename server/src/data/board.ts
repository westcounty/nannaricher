// server/src/data/board.ts
import { BoardData } from '@nannaricher/shared';

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
  lines: {}, // Populated in Task 5
};

export const MAIN_BOARD_SIZE = boardData.mainBoard.length;
