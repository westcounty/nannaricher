// shared/src/types.ts

// === Position ===
export interface MainPosition { type: 'main'; index: number; }
export interface LinePosition { type: 'line'; lineId: string; index: number; }
export type Position = MainPosition | LinePosition;

// === Effects ===
export interface ActiveEffect {
  id: string;
  type: 'skip_turn' | 'reverse_move' | 'double_move' | 'double_event'
    | 'system_fault' | 'delayed_gratification' | 'custom';
  turnsRemaining: number;
  data?: Record<string, unknown>;
}

// === Cards ===
export interface CardEffect {
  stat?: 'money' | 'gpa' | 'exploration';
  delta?: number;
  multiplier?: number; // delta = multiplier * diceValue
  target?: 'self' | 'all' | 'choose_player' | 'richest' | 'poorest'
    | 'highest_gpa' | 'lowest_gpa' | 'highest_exp' | 'lowest_exp';
}

export interface Card {
  id: string;
  name: string;
  description: string;
  deckType: 'chance' | 'destiny';
  holdable: boolean;        // can be kept in hand
  singleUse: boolean;
  returnToDeck: boolean;    // return after use
  effects: CardEffect[];  // UI展示用; 有自定义handler的卡牌以handler为准
  useTiming?: 'own_turn' | 'any_turn'; // when holdable card can be used from hand
  // Complex cards use server-side handler by id
  tags?: string[];  // UI标签: ['响应卡', '防御', '移动'] 等
}

export interface TrainingPlan {
  id: string;
  name: string;           // e.g. "文学院"
  winCondition: string;   // description
  passiveAbility: string; // description
}

// === Player ===
export interface Player {
  id: string;
  socketId: string;
  userId?: string;        // authenticated user UUID (from tuchan-api)
  authVerified?: boolean; // true if JWT signature was verified (not mock/dev token)
  isBot: boolean;         // whether this is a bot player
  botStrategy?: string;   // bot strategy name (e.g. 'specialist', 'balanced')
  name: string;
  color: string;
  money: number;
  gpa: number;
  exploration: number;
  position: Position;
  diceCount: 1 | 2;
  trainingPlans: TrainingPlan[];
  majorPlan: string | null;       // 主修方向的计划ID（被动效果仅主修生效）
  minorPlans: string[];           // 辅修方向的计划ID列表
  planSlotLimit: number;          // 培养计划槽位上限（默认2，专业意向可+1）
  heldCards: Card[];
  effects: ActiveEffect[];
  skipNextTurn: boolean;
  isInHospital: boolean;
  isAtDing: boolean;
  isBankrupt: boolean;
  isDisconnected: boolean;
  linesVisited: string[];
  lineEventsTriggered: Record<string, number[]>;
  hospitalVisits: number;
  moneyZeroCount: number;
  cafeteriaNoNegativeStreak: number;
  cardsDrawnWithEnglish: number;
  cardsDrawnWithDigitStart: string[];
  chanceCardsUsedOnPlayers: Record<string, number>; // playerId -> count
  gulou_endpoint_count: number;
  modifiedWinThresholds: Record<string, number>; // 社会学院/AI学院动态阈值
  maxWinConditionSlots: number;     // 最大胜利条件位（默认3: 基础+2培养计划）
  disabledWinConditions: string[];  // 被禁用的胜利条件（'base' 或 planId）
  lawyerShield: boolean;        // 法学院：金钱保护盾
  lastDiceValues: number[];     // 上次骰子值（供能力使用）
  consecutivePositiveTurns: number;  // 化学院：连续增益回合数
  turnStartSnapshot?: { money: number; gpa: number; exploration: number }; // 回合开始快照
  gongguan_card_given?: boolean;  // 工管学院：是否已获得资金调度令
  totalTuitionPaid: number;         // 软件学院：累计交学费金额
  confiscatedIncome: number;        // 法学院：罚没收入
  consecutiveLowMoneyTurns: number; // 工管学院：连续金钱≤500回合数
  kechuangGpaGained: number;        // 电子学院：科创赛事累计GPA
  foodLineNonNegativeCount: number; // 生命科学学院：单次食堂线累计非负面效果次数
}

// === Pending Action (waiting for player input) ===
export interface PendingAction {
  id: string;
  playerId: string;
  type: 'choose_option' | 'roll_dice' | 'choose_player' | 'choose_line'
    | 'choose_card' | 'multi_player_choice' | 'draw_training_plan'
    | 'multi_vote'           // 全体投票（如四校联动、泳馆常客）
    | 'chain_action'         // 连锁行动（如八卦秘闻、南行玫瑰）
    | 'parallel_plan_selection';
  prompt: string;
  options?: {
    label: string;
    value: string;
    description?: string;
    group?: string;            // 分组标签，客户端渲染为 tab 切换
    effectPreview?: {
      money?: number | string;
      gpa?: number | string;
      exploration?: number | string;
    };
  }[];
  maxSelections?: number;   // >1 时客户端渲染 MultiSelectDialog
  minSelections?: number;   // 最少选择数
  targetPlayerIds?: string[];     // for multi-player choices
  responses?: Record<string, string>; // collected responses
  timeoutMs: number;
  cardId?: string;            // 触发此action的卡牌ID
  chainOrder?: string[];      // 连锁行动的玩家顺序
  callbackHandler?: string;   // 回调handler ID，choice作为第三参数传入
  planSelectionData?: {
    perPlayer: Record<string, {
      drawnPlans: TrainingPlan[];
      existingPlanIds: string[];
      currentMajor: string | null;
      currentMinors: string[];
      planSlotLimit: number;
    }>;
  };
}

// === Game State ===
export type GamePhase = 'waiting' | 'playing' | 'finished'
  | 'rolling_dice'      // 掷骰子
  | 'moving'            // 移动中
  | 'event_popup'       // 事件弹窗
  | 'making_choice'     // 做选择
  | 'waiting_others'    // 等待他人
  | 'multi_interaction'; // 多人互动

// === Spectator ===
export interface SpectatorInfo {
  name: string;
  odKey?: string;        // opaque key for spectator identification
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  currentPlayerIndex: number;
  turnNumber: number;
  roundNumber: number;  // 每6回合一个大轮
  players: Player[];
  spectators: SpectatorInfo[];  // 观战者列表
  cardDecks: {
    chance: Card[];
    destiny: Card[];
    training: TrainingPlan[];
  };
  discardPiles: {
    chance: Card[];
    destiny: Card[];
  };
  pendingAction: PendingAction | null;
  turnOrder: number[];          // player indices
  turnOrderReversed: boolean;
  winner: string | null;        // player id
  log: GameLogEntry[];
  disabledCells?: string[];     // 化学化工学院禁用的格子（持续生效直到主修变更或新学年重选）
}

export interface GameLogEntry {
  turn: number;
  playerId: string;
  message: string;
  timestamp: number;
}

// === Socket Events ===
export interface ClientToServerEvents {
  'room:create': (data: { playerName: string; diceOption: 1 | 2 }) => void;
  'room:join': (data: { roomId: string; playerName: string; diceOption: 1 | 2 }) => void;
  'room:add-bot': () => void;                          // host adds a bot player
  'room:remove-player': (data: { playerId: string }) => void;  // host removes player (real or bot)
  'room:join-as-spectator': (data: { roomId: string; playerName: string }) => void;  // join room as spectator
  'room:spectator-ready': () => void;                  // spectator readies up for next game
  'room:spectator-cancel-ready': () => void;           // spectator cancels ready
  'game:start': () => void;
  'game:roll-dice': () => void;
  'game:choose-action': (data: { actionId: string; choice: string }) => void;
  'game:use-card': (data: { cardId: string; targetPlayerId?: string }) => void;
  'game:chat': (data: { message: string }) => void;
  'room:reconnect': (data: { roomId: string; playerId: string }) => void;
  'room:leave': () => void;
  'room:dissolve': () => void;
  'admin:force-next-turn': () => void;
  'admin:modify-resources': (data: { changes: { playerId: string; money: number; gpa: number; exploration: number }[] }) => void;
  'game:restart': () => void;
  'game:ready-up': () => void;
  'game:ready-cancel': () => void;
  'game:restart-with-ready': () => void;
}

export interface ServerToClientEvents {
  'room:created': (data: { roomId: string; playerId: string }) => void;
  'room:joined': (data: { playerId: string; roomId: string; reconnected?: boolean }) => void;
  'room:player-joined': (data: { playerName: string }) => void;
  'room:error': (data: { message: string }) => void;
  'game:state-update': (state: GameState) => void;
  'game:dice-result': (data: { playerId: string; values: number[]; total: number }) => void;
  'game:event-trigger': (data: { title: string; description: string; pendingAction?: PendingAction; playerId?: string; effects?: { money?: number; gpa?: number; exploration?: number }; severity?: 'minor' | 'normal' | 'epic' }) => void;
  'game:card-drawn': (data: { card: Card; deckType: string; playerId: string; addedToHand: boolean }) => void;
  'game:announcement': (data: { message: string; type: 'info' | 'warning' | 'success' }) => void;
  'game:player-won': (data: { playerId: string; playerName: string; condition: string }) => void;
  'game:resource-change': (data: { playerId: string; playerName: string; stat: 'money' | 'gpa' | 'exploration'; delta: number; current: number }) => void;
  'game:chat': (data: { playerName: string; message: string }) => void;
  'game:plan-ability-trigger': (data: {
    playerId: string;
    planId: string;
    planName: string;
    trigger: string;
    message: string;
    effects?: Record<string, unknown>;
    turn: number;
    round: number;
  }) => void;
  'game:line-exit-summary': (data: {
    playerId: string;
    lineId: string;
    lineName: string;
    entryTurn: number;
    exitTurn: number;
    deltas: { money: number; gpa: number; exploration: number };
    turn: number;
    round: number;
  }) => void;
  'game:vote-result': (data: {
    cardId: string;
    results: Record<string, string[]>;
    winnerOption: string;
    isTie?: boolean;
    optionLabels?: Record<string, string>;
    turn: number;
    round: number;
  }) => void;
  'game:chain-result': (data: {
    cardId: string;
    chainLength: number;
    participants: string[];
    turn: number;
    round: number;
  }) => void;
  'game:card-use-error': (data: { message: string }) => void;
  'room:dissolved': (data: { message: string }) => void;
  'game:ready-state': (data: { readyPlayerIds: string[] }) => void;
  'game:restarting': () => void;
  'room:spectator-update': (data: { spectators: SpectatorInfo[] }) => void;
}

// === Player History Tracking ===
export interface PositionRecord {
  turn: number;
  position: Position;
  timestamp: number;
}

export interface CardDrawRecord {
  cardId: string;
  cardName: string;
  deckType: 'chance' | 'destiny';
  hasEnglish: boolean;        // 外国语学院
  startsWithDigit: boolean;   // 信息管理学院
  turn: number;
}

export interface LineExitRecord {
  lineId: string;
  entryTurn: number;
  exitTurn: number;
  gpaBefore: number;
  gpaAfter: number;
  explorationBefore: number;
  explorationAfter: number;
  moneyBefore: number;
  moneyAfter: number;
}

export interface PlayerHistory {
  positions: PositionRecord[];
  linesVisited: string[];
  lineEventsTriggered: Record<string, number[]>;
  sharedCellsWith: Record<string, number[]>;  // playerId -> turn numbers
  cardsDrawn: CardDrawRecord[];
  moneyHistory: number[];                     // 每回合金钱值（大气学院）
  chanceCardsUsedOnPlayers: Record<string, number>;
  lineExits: LineExitRecord[];
  hospitalVisits: number;
  moneyZeroCount: number;
  gulouEndpointReached: number;
  campusLineOrder: string[];                  // 历史学院：校区经过顺序
  foodLineNegativeFreeStreak: number;         // 食堂线连续无负面次数
  plansConfirmedTurn: number[];               // 确认培养计划的回合
  mainCellVisited: string[];                  // 建筑学院：主要格子访问记录
}
