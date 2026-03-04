// client/src/canvas/BoardRenderer.ts
// 棋盘渲染核心逻辑 - 南京大学大富翁"菜根人生"

import { BoardCell, BoardLine, BoardData, Player, Position } from '@nannaricher/shared';
import { CellRenderInfo, LineRenderInfo, BoardRenderConfig, defaultRenderConfig } from './types';

// 格子颜色配置
const CELL_COLORS = {
  // 角落格
  start: '#22c55e',      // 绿色 - 起点
  hospital: '#ef4444',   // 红色 - 校医院
  ding: '#eab308',       // 黄色 - 鼎
  waiting_room: '#3b82f6', // 蓝色 - 候车厅

  // 普通格
  event: '#f97316',      // 橙色 - 事件
  chance: '#a855f7',     // 紫色 - 机会
  line_entry: '#06b6d4', // 青色 - 线路入口

  // 默认
  default: '#6b7280',    // 灰色
};

// 玩家颜色（备用）
const PLAYER_COLORS = [
  '#ef4444', // 红
  '#3b82f6', // 蓝
  '#22c55e', // 绿
  '#eab308', // 黄
  '#a855f7', // 紫
  '#f97316', // 橙
];

// 线路入口在主棋盘上的位置映射（索引 -> 线路ID）
const LINE_ENTRY_MAP: Record<number, string> = {
  4: 'pukou',      // 浦口线
  9: 'study',      // 学习线
  12: 'money',     // 金钱线
  15: 'suzhou',    // 苏州线
  17: 'explore',   // 探索线
  20: 'gulou',     // 鼓楼线
  23: 'xianlin',   // 仙林线
  25: 'food',      // 食堂线
};

// 线路方向配置 - 每条线路从入口向哪个方向延伸
const LINE_DIRECTIONS: Record<string, { angle: number; side: 'top' | 'right' | 'bottom' | 'left' }> = {
  pukou: { angle: -90, side: 'top' },      // 上边，向左
  study: { angle: -90, side: 'top' },      // 上边，向左（内）
  money: { angle: -90, side: 'top' },      // 上边
  suzhou: { angle: 180, side: 'right' },   // 右边，向下
  explore: { angle: 90, side: 'bottom' },  // 下边，向右
  gulou: { angle: 90, side: 'bottom' },    // 下边
  xianlin: { angle: 90, side: 'bottom' },  // 下边
  food: { angle: 0, side: 'left' },        // 左边，向上
};

export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: BoardRenderConfig;
  private boardData: BoardData;
  private cellRenderInfos: Map<string, CellRenderInfo> = new Map();
  private lineRenderInfos: Map<string, LineRenderInfo> = new Map();
  private hoveredCellId: string | null = null;
  private currentPlayerId: string | null = null;

  constructor(
    ctx: CanvasRenderingContext2D,
    boardData: BoardData,
    config: Partial<BoardRenderConfig> = {}
  ) {
    this.ctx = ctx;
    this.boardData = boardData;
    this.config = { ...defaultRenderConfig, ...config };
    this.precomputeLayout();
  }

  // 预计算布局信息
  private precomputeLayout(): void {
    // 计算主棋盘格子位置
    this.computeMainBoardLayout();
    // 计算支线格子位置
    this.computeLinesLayout();
  }

  // 计算主棋盘布局（28格环形）
  private computeMainBoardLayout(): void {
    const { centerX, centerY, mainBoardRadius, cellSize, cornerSize } = this.config;
    const mainBoard = this.boardData.mainBoard;

    // 角落位置（四个角）
    const corners = [
      { index: 0, angle: -135 },   // 起点 - 左上
      { index: 8, angle: -45 },    // 校医院 - 右上
      { index: 16, angle: 45 },    // 鼎 - 右下
      { index: 24, angle: 135 },   // 候车厅 - 左下
    ];

    // 先放置角落格子
    corners.forEach(corner => {
      const cell = mainBoard[corner.index];
      const rad = corner.angle * Math.PI / 180;
      const x = centerX + mainBoardRadius * Math.cos(rad);
      const y = centerY + mainBoardRadius * Math.sin(rad);

      const info: CellRenderInfo = {
        id: cell.id,
        name: cell.name,
        type: cell.type,
        position: { x, y },
        size: cornerSize,
        color: this.getCellColor(cell),
        cornerType: cell.cornerType,
        lineId: cell.lineId,
      };
      this.cellRenderInfos.set(cell.id, info);
    });

    // 计算每边的格子位置
    // 边1: 索引1-7 (起点到校医院，上边)
    this.placeSideCells(1, 7, -135, -45, mainBoardRadius, cellSize);
    // 边2: 索引9-15 (校医院到鼎，右边)
    this.placeSideCells(9, 15, -45, 45, mainBoardRadius, cellSize);
    // 边3: 索引17-23 (鼎到候车厅，下边)
    this.placeSideCells(17, 23, 45, 135, mainBoardRadius, cellSize);
    // 边4: 索引25-27 (候车厅到起点，左边)
    this.placeSideCells(25, 27, 135, 225, mainBoardRadius, cellSize);
  }

  // 放置一边的格子
  private placeSideCells(
    startIndex: number,
    endIndex: number,
    startAngle: number,
    endAngle: number,
    radius: number,
    cellSize: number
  ): void {
    const mainBoard = this.boardData.mainBoard;
    const count = endIndex - startIndex;
    const angleStep = (endAngle - startAngle) / count;

    for (let i = 0; i <= count; i++) {
      const cellIndex = startIndex + i;
      if (cellIndex >= mainBoard.length) continue;

      const cell = mainBoard[cellIndex];
      // 跳过角落格
      if (cell.type === 'corner') continue;

      const angle = startAngle + angleStep * i;
      const rad = angle * Math.PI / 180;
      const x = this.config.centerX + radius * Math.cos(rad);
      const y = this.config.centerY + radius * Math.sin(rad);

      const info: CellRenderInfo = {
        id: cell.id,
        name: cell.name,
        type: cell.type,
        position: { x, y },
        size: cellSize,
        color: this.getCellColor(cell),
        lineId: cell.lineId,
      };
      this.cellRenderInfos.set(cell.id, info);
    }
  }

  // 计算支线布局
  private computeLinesLayout(): void {
    const lines = this.boardData.lines;

    Object.entries(lines).forEach(([lineId, line]) => {
      const entryCell = this.findLineEntryCell(lineId);
      if (!entryCell) return;

      const entryInfo = this.cellRenderInfos.get(entryCell.id);
      if (!entryInfo) return;

      const dir = LINE_DIRECTIONS[lineId] || { angle: 0, side: 'left' };
      const cells: CellRenderInfo[] = [];
      const { lineCellSize, lineSpacing } = this.config;

      // 从入口位置向线路方向延伸
      const angleRad = dir.angle * Math.PI / 180;
      const entryPoint = entryInfo.position;

      line.cells.forEach((lineCell, idx) => {
        // 格子沿方向排列
        const distance = (idx + 1) * lineSpacing;
        const x = entryPoint.x + distance * Math.cos(angleRad);
        const y = entryPoint.y + distance * Math.sin(angleRad);

        const info: CellRenderInfo = {
          id: `${lineId}_${lineCell.index}`,
          name: lineCell.name,
          type: 'event',
          position: { x, y },
          size: lineCellSize,
          color: '#6366f1', // 支线格子用靛蓝色
        };
        cells.push(info);
        this.cellRenderInfos.set(info.id, info);
      });

      this.lineRenderInfos.set(lineId, {
        id: lineId,
        name: line.name,
        cells,
        entryPoint,
        direction: 'inward',
      });
    });
  }

  // 找到线路入口格子
  private findLineEntryCell(lineId: string): BoardCell | null {
    return this.boardData.mainBoard.find(cell => cell.lineId === lineId) || null;
  }

  // 获取格子颜色
  private getCellColor(cell: BoardCell): string {
    if (cell.type === 'corner' && cell.cornerType) {
      return CELL_COLORS[cell.cornerType] || CELL_COLORS.default;
    }
    return CELL_COLORS[cell.type as keyof typeof CELL_COLORS] || CELL_COLORS.default;
  }

  // === 公共方法 ===

  // 更新画布尺寸
  public updateConfig(config: Partial<BoardRenderConfig>): void {
    this.config = { ...this.config, ...config };
    this.cellRenderInfos.clear();
    this.lineRenderInfos.clear();
    this.precomputeLayout();
  }

  // 设置悬停格子
  public setHoveredCell(cellId: string | null): void {
    this.hoveredCellId = cellId;
  }

  // 设置当前玩家
  public setCurrentPlayer(playerId: string | null): void {
    this.currentPlayerId = playerId;
  }

  // 获取格子渲染信息
  public getCellRenderInfo(cellId: string): CellRenderInfo | undefined {
    return this.cellRenderInfos.get(cellId);
  }

  // 根据格子索引获取主棋盘格子渲染信息
  public getMainCellRenderInfo(index: number): CellRenderInfo | undefined {
    const mainBoard = this.boardData.mainBoard;
    if (index < 0 || index >= mainBoard.length) return undefined;
    return this.cellRenderInfos.get(mainBoard[index].id);
  }

  // 获取支线格子渲染信息
  public getLineCellRenderInfo(lineId: string, index: number): CellRenderInfo | undefined {
    return this.cellRenderInfos.get(`${lineId}_${index}`);
  }

  // 获取所有格子渲染信息（用于碰撞检测）
  public getAllCellRenderInfos(): CellRenderInfo[] {
    return Array.from(this.cellRenderInfos.values());
  }

  // === 渲染方法 ===

  // 主渲染方法
  public render(viewport: { x: number; y: number; scale: number }, players: Player[]): void {
    const { ctx, config } = this;
    const { canvasWidth, canvasHeight } = config;

    // 清空画布
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 保存状态
    ctx.save();

    // 应用视口变换
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(viewport.scale, viewport.scale);
    ctx.translate(-viewport.x, -viewport.y);

    // 绘制背景
    this.drawBackground();

    // 绘制连接线
    this.drawConnections();

    // 绘制支线
    this.drawLines();

    // 绘制主棋盘格子
    this.drawMainBoard();

    // 绘制玩家棋子
    this.drawPlayers(players);

    // 恢复状态
    ctx.restore();
  }

  // 绘制背景
  private drawBackground(): void {
    const { ctx, config } = this;
    const { centerX, centerY, mainBoardRadius } = config;

    // 中心区域背景
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, mainBoardRadius
    );
    gradient.addColorStop(0, 'rgba(30, 41, 59, 0.3)');
    gradient.addColorStop(1, 'rgba(15, 23, 42, 0.5)');

    ctx.beginPath();
    ctx.arc(centerX, centerY, mainBoardRadius - 80, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 绘制中心标识
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('菜根人生', centerX, centerY - 15);
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('南京大学', centerX, centerY + 15);
  }

  // 绘制格子间的连接线
  private drawConnections(): void {
    const { ctx } = this;
    const mainBoard = this.boardData.mainBoard;

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 2;

    // 绘制主棋盘连接线
    ctx.beginPath();
    for (let i = 0; i < mainBoard.length; i++) {
      const cellInfo = this.cellRenderInfos.get(mainBoard[i].id);
      if (!cellInfo) continue;

      if (i === 0) {
        ctx.moveTo(cellInfo.position.x, cellInfo.position.y);
      } else {
        ctx.lineTo(cellInfo.position.x, cellInfo.position.y);
      }
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 绘制支线
  private drawLines(): void {
    const { ctx } = this;

    this.lineRenderInfos.forEach((line, lineId) => {
      const entryInfo = this.findLineEntryCell(lineId);
      if (!entryInfo) return;

      const entryRenderInfo = this.cellRenderInfos.get(entryInfo.id);
      if (!entryRenderInfo) return;

      // 绘制入口到支线的连接线
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(entryRenderInfo.position.x, entryRenderInfo.position.y);

      line.cells.forEach(cellInfo => {
        ctx.lineTo(cellInfo.position.x, cellInfo.position.y);
      });
      ctx.stroke();

      // 绘制支线格子
      line.cells.forEach((cellInfo, idx) => {
        this.drawCell(cellInfo, false, `${lineId}_${idx}` === this.hoveredCellId);
      });
    });
  }

  // 绘制主棋盘
  private drawMainBoard(): void {
    const { boardData } = this;
    const mainBoard = boardData.mainBoard;

    mainBoard.forEach((cell, index) => {
      const cellInfo = this.cellRenderInfos.get(cell.id);
      if (!cellInfo) return;

      const isHovered = cell.id === this.hoveredCellId;
      this.drawCell(cellInfo, cell.type === 'corner', isHovered, index);
    });
  }

  // 绘制单个格子
  private drawCell(
    cellInfo: CellRenderInfo,
    isCorner: boolean = false,
    isHovered: boolean = false,
    index?: number
  ): void {
    const { ctx } = this;
    const { position, size, color, name } = cellInfo;
    const halfSize = size / 2;

    // 悬停效果
    if (isHovered) {
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 15;
    }

    // 绘制格子背景
    ctx.fillStyle = color;
    if (isCorner) {
      // 角落格用圆角矩形
      this.drawRoundRect(
        position.x - halfSize,
        position.y - halfSize,
        size,
        size,
        10
      );
      ctx.fill();
    } else {
      // 普通格用圆形
      ctx.beginPath();
      ctx.arc(position.x, position.y, halfSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // 清除阴影
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 绘制边框
    ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = isHovered ? 3 : 1;

    if (isCorner) {
      this.drawRoundRect(
        position.x - halfSize,
        position.y - halfSize,
        size,
        size,
        10
      );
    } else {
      ctx.beginPath();
      ctx.arc(position.x, position.y, halfSize, 0, Math.PI * 2);
    }
    ctx.stroke();

    // 绘制格子名称
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (isCorner) {
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      // 角落格可能需要换行显示
      const words = name.split('/');
      if (words.length > 1) {
        ctx.fillText(words[0], position.x, position.y - 8);
        ctx.fillText(words[1], position.x, position.y + 8);
      } else {
        ctx.fillText(name, position.x, position.y);
      }
    } else {
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      // 普通格只显示简短名称
      const shortName = name.length > 6 ? name.substring(0, 5) + '..' : name;
      ctx.fillText(shortName, position.x, position.y);
    }

    // 显示格子索引（调试用）
    if (index !== undefined && process.env.NODE_ENV === 'development') {
      ctx.font = '8px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(`#${index}`, position.x, position.y + halfSize + 8);
    }
  }

  // 绘制圆角矩形
  private drawRoundRect(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // 绘制玩家棋子
  private drawPlayers(players: Player[]): void {
    const { ctx } = this;

    // 按位置分组玩家
    const positionGroups = new Map<string, Player[]>();

    players.forEach(player => {
      if (player.isBankrupt) return;

      const posKey = this.getPositionKey(player.position);
      const group = positionGroups.get(posKey) || [];
      group.push(player);
      positionGroups.set(posKey, group);
    });

    // 绘制每个位置的玩家棋子
    positionGroups.forEach((groupPlayers, posKey) => {
      const cellInfo = this.getCellInfoFromPosition(posKey);
      if (!cellInfo) return;

      const { position, size } = cellInfo;
      const playerCount = groupPlayers.length;
      const pieceRadius = 10;

      groupPlayers.forEach((player, idx) => {
        // 计算棋子位置（多个玩家时错开）
        const offset = playerCount > 1
          ? ((idx - (playerCount - 1) / 2) * (pieceRadius * 2 + 4))
          : 0;

        const pieceX = position.x + offset;
        const pieceY = position.y - size / 2 - pieceRadius - 5;

        // 当前玩家高亮
        const isCurrentPlayer = player.id === this.currentPlayerId;
        if (isCurrentPlayer) {
          ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
          ctx.shadowBlur = 12;
        }

        // 绘制棋子
        ctx.beginPath();
        ctx.arc(pieceX, pieceY, pieceRadius, 0, Math.PI * 2);
        ctx.fillStyle = player.color || PLAYER_COLORS[idx % PLAYER_COLORS.length];
        ctx.fill();
        ctx.strokeStyle = isCurrentPlayer ? '#ffffff' : 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = isCurrentPlayer ? 3 : 1;
        ctx.stroke();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // 绘制玩家名字首字母
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player.name.charAt(0).toUpperCase(), pieceX, pieceY);
      });
    });
  }

  // 获取位置键
  private getPositionKey(position: Position): string {
    if (position.type === 'main') {
      const mainBoard = this.boardData.mainBoard;
      const cell = mainBoard[position.index];
      return cell ? cell.id : `main_${position.index}`;
    } else {
      return `${position.lineId}_${position.index}`;
    }
  }

  // 从位置键获取格子信息
  private getCellInfoFromPosition(posKey: string): CellRenderInfo | undefined {
    // 先尝试直接查找
    const directInfo = this.cellRenderInfos.get(posKey);
    if (directInfo) return directInfo;

    // 可能是主棋盘索引
    if (posKey.startsWith('main_')) {
      const index = parseInt(posKey.split('_')[1]);
      return this.getMainCellRenderInfo(index);
    }

    return undefined;
  }

  // 检测点击位置对应的格子
  public hitTest(boardX: number, boardY: number): CellRenderInfo | null {
    const cells = this.getAllCellRenderInfos();

    for (const cell of cells) {
      const dx = boardX - cell.position.x;
      const dy = boardY - cell.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = cell.size / 2 + 5; // 稍微扩大点击区域

      if (distance <= hitRadius) {
        return cell;
      }
    }

    return null;
  }

  // 获取主棋盘格子数据
  public getMainBoardCell(index: number): BoardCell | undefined {
    return this.boardData.mainBoard[index];
  }

  // 获取支线数据
  public getLine(lineId: string): BoardLine | undefined {
    return this.boardData.lines[lineId];
  }
}

export { CELL_COLORS, PLAYER_COLORS, LINE_ENTRY_MAP };
