# 批量修复与增强 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 7 个游戏问题：退出/解散房间、等待室玩家不可见、通知过于频繁、选玩家卡牌 bug、培养计划 bug、支线风味文案、断线重连。

**Architecture:** 按独立性分组实施。先修 shared 类型定义，再修服务端逻辑，最后修客户端 UI。每个 Task 围绕一个问题，互不依赖可并行。

**Tech Stack:** TypeScript, Socket.IO, React, Zustand

---

## Task 1: 退出游戏 & 房主解散房间

**Files:**
- Modify: `shared/src/types.ts` - 添加 socket 事件类型
- Modify: `server/src/socket/RoomHandlers.ts` - 处理 leave/dissolve 事件
- Modify: `server/src/rooms/RoomManager.ts` - dissolve 方法
- Modify: `client/src/components/SettingsPanel.tsx` - 添加退出/解散按钮
- Modify: `client/src/components/WaitingRoom.tsx` - 添加离开按钮
- Modify: `client/src/context/SocketProvider.tsx` - 监听 dissolved 事件
- Modify: `client/src/stores/gameStore.ts` - resetToLobby action

### Step 1: 添加 socket 事件类型

`shared/src/types.ts` 的 ClientToServerEvents 添加:
```typescript
'room:leave': () => void;
'room:dissolve': () => void;
```

ServerToClientEvents 添加:
```typescript
'room:dissolved': (data: { message: string }) => void;
```

### Step 2: 服务端 RoomManager 添加 dissolve 方法

`server/src/rooms/RoomManager.ts`:
```typescript
dissolveRoom(roomId: string): void {
  this.rooms.delete(roomId);
  this.coordinators.delete(roomId);
}
```

### Step 3: 服务端处理 leave 和 dissolve 事件

`server/src/socket/RoomHandlers.ts` 添加:

```typescript
// 主动退出
socket.on('room:leave', () => {
  const room = roomManager.findRoomBySocket(socket.id);
  if (!room) return;

  if (room.phase === 'waiting') {
    // 等待阶段：从房间移除玩家
    room.players = room.players.filter(p => p.socketId !== socket.id);
    const coordinator = roomManager.getCoordinator(room.roomId);
    if (coordinator) {
      coordinator.getEngine().removePlayer(socket.id);
      coordinator.broadcastState();
    }
    socket.leave(room.roomId);
    // 如果房间空了，删除
    if (room.players.length === 0) {
      roomManager.removeRoom(room.roomId);
    }
  } else if (room.phase === 'playing') {
    // 游戏中：等同断线处理
    roomManager.handleDisconnect(socket.id);
    socket.leave(room.roomId);
  }
});

// 房主解散房间
socket.on('room:dissolve', () => {
  const room = roomManager.findRoomBySocket(socket.id);
  if (!room) return;
  if (room.hostSocketId !== socket.id) return; // 只有房主能解散

  io.to(room.roomId).emit('room:dissolved', { message: '房主已解散房间' });
  // 将所有 socket 离开房间
  const sockets = io.sockets.adapter.rooms.get(room.roomId);
  if (sockets) {
    for (const sid of sockets) {
      io.sockets.sockets.get(sid)?.leave(room.roomId);
    }
  }
  roomManager.dissolveRoom(room.roomId);
});
```

注意：GameEngine 可能没有 removePlayer 方法，如果没有，等待阶段 leave 只需从 room.players 移除并 broadcastState 即可（coordinator 会同步 engine 的 state.players）。

### Step 4: 客户端监听 dissolved 事件

`client/src/context/SocketProvider.tsx` 添加监听:
```typescript
const handleDissolved = ({ message }: { message: string }) => {
  store.getState().addNotification(message, 'warning');
  store.getState().resetToLobby();
  sessionStorage.removeItem('nannaricher_roomId');
  sessionStorage.removeItem('nannaricher_playerId');
};
socket.on('room:dissolved', handleDissolved);
// cleanup 中 socket.off('room:dissolved', handleDissolved);
```

确保 gameStore 有 `resetToLobby` action（已在 SettlementScreen 中使用，应该存在）。

### Step 5: SettingsPanel 添加退出/解散按钮

`client/src/components/SettingsPanel.tsx` 底部添加:
```typescript
const playerId = useGameStore((s) => s.playerId);
const isHost = gameState?.players[0]?.id === playerId;
const isPlaying = gameState?.phase === 'playing' || gameState?.phase === 'setup_plans';
const [confirmAction, setConfirmAction] = useState<'leave' | 'dissolve' | null>(null);

// 在设置面板底部，audio 之后添加分割线和按钮：
<div className="settings-panel__divider" />

{confirmAction ? (
  <div className="settings-panel__confirm">
    <p>{confirmAction === 'dissolve' ? '确定解散房间？所有玩家将被踢出。' : '确定退出游戏？你的角色将由AI接管。'}</p>
    <div className="settings-panel__confirm-buttons">
      <button onClick={() => {
        if (confirmAction === 'dissolve') socket?.emit('room:dissolve');
        else socket?.emit('room:leave');
        setConfirmAction(null);
        // leave 后也要回大厅
        if (confirmAction === 'leave') {
          store.getState().resetToLobby();
          sessionStorage.removeItem('nannaricher_roomId');
          sessionStorage.removeItem('nannaricher_playerId');
        }
      }}>确定</button>
      <button onClick={() => setConfirmAction(null)}>取消</button>
    </div>
  </div>
) : (
  <>
    <button className="settings-panel__btn settings-panel__btn--danger" onClick={() => setConfirmAction('leave')}>
      退出游戏
    </button>
    {isHost && (
      <button className="settings-panel__btn settings-panel__btn--danger" onClick={() => setConfirmAction('dissolve')}>
        解散房间
      </button>
    )}
  </>
)}
```

需要添加对应 CSS 样式（danger 按钮红色，confirm 区域样式）。

### Step 6: WaitingRoom 添加离开按钮

`client/src/components/WaitingRoom.tsx` 在底部添加"离开房间"按钮:
```typescript
<button className="leave-button" onClick={() => {
  socket?.emit('room:leave');
  // 回到大厅 - 通过清除 roomId 触发 Lobby 重置
  store.getState().resetToLobby();
  sessionStorage.removeItem('nannaricher_roomId');
  sessionStorage.removeItem('nannaricher_playerId');
}}>
  离开房间
</button>
```

### Step 7: 构建测试 & 提交

```bash
cd D:/work/nannaricher && npm run build
git add -A && git commit -m "feat: add leave game and dissolve room functionality"
```

---

## Task 2: 等待室看不到已加入的玩家

**Files:**
- Modify: `shared/src/types.ts` - room:joined 事件增加 roomId
- Modify: `server/src/socket/RoomHandlers.ts` - joined 事件带 roomId
- Modify: `client/src/context/SocketProvider.tsx` - handleRoomJoined 调用 setRoomId

### Step 1: 更新事件类型

`shared/src/types.ts` 中 `room:joined` 的类型从 `{ playerId: string }` 改为 `{ playerId: string; roomId: string }`。

### Step 2: 服务端 joined 事件带 roomId

`server/src/socket/RoomHandlers.ts:88` 改为:
```typescript
socket.emit('room:joined', { playerId, roomId: data.roomId });
```

### Step 3: 客户端 handleRoomJoined 设置 roomId

`client/src/context/SocketProvider.tsx:204` 改为:
```typescript
const handleRoomJoined = ({ playerId, roomId }: { playerId: string; roomId: string }) => {
  store.getState().setRoomId(roomId);
  store.getState().setPlayerId(playerId);
  store.getState().setError(null);
  sessionStorage.setItem('nannaricher_roomId', roomId);
  sessionStorage.setItem('nannaricher_playerId', playerId);
};
```

### Step 4: 构建测试 & 提交

```bash
cd D:/work/nannaricher && npm run build
git add -A && git commit -m "fix: waiting room not showing joined players by setting roomId on join"
```

---

## Task 3: 事件通知太频繁

**Files:**
- Modify: `client/src/context/SocketProvider.tsx` - handleEventTrigger 中别人事件降级
- Modify: `client/src/components/EpicEventModal.tsx` - 只读时间缩短

### Step 1: 别人的非 epic 事件降级为 toast

`client/src/context/SocketProvider.tsx` 的 `handleEventTrigger` 中，在 severity 判断之后、设置 currentEvent 之前，增加逻辑:

```typescript
// 判断是否是别人的事件
const localPlayerId = store.getState().playerId;
const isOtherPlayerEvent = data.pendingAction
  && data.pendingAction.playerId !== localPlayerId
  && data.pendingAction.playerId !== 'all';

if (isOtherPlayerEvent && effectiveSeverity !== 'epic') {
  // 别人的 minor/normal 事件降级为 toast
  store.getState().addNotification(
    `${data.title}: ${data.description}`,
    'info',
  );
  playSound('event_trigger');
  return;
}
```

这段应该放在现有的 minor 无 pendingAction 降级逻辑附近（约274行），在设置 currentEvent 之前。

### Step 2: Epic 只读弹窗缩短到 4 秒

`client/src/components/EpicEventModal.tsx` 约第30行，将只读模式的自动关闭时间从 6000 改为 4000:
```typescript
const AUTO_CLOSE_MS = 4000; // 从 6000 改为 4000
```

### Step 3: 对手 toast 金钱阈值调高

`client/src/context/SocketProvider.tsx` 约第117-139行，将金钱变化通知阈值从 500 改为 1000。

### Step 4: 构建测试 & 提交

```bash
cd D:/work/nannaricher && npm run build
git add -A && git commit -m "fix: reduce notification frequency for other players' events"
```

---

## Task 4: 选玩家卡牌无法操作

**Files:**
- Modify: `client/src/components/ChoiceDialog.tsx` - pendingActionToChoices 区分 choose_player
- Modify: `client/src/components/GameScreen.tsx` - 检查 choose_player 渲染路径
- Check: `server/src/game/handlers/card-handlers.ts` - 确认服务端选项生成正确

### Step 1: 排查服务端 choose_player 生成

检查 `card-handlers.ts` 中所有 `choose_player` 相关代码。确认 `options` 数组和 `targetPlayerIds` 是否正确填充。如果服务端生成正确，问题在客户端渲染。

### Step 2: 修复 pendingActionToChoices

`client/src/components/ChoiceDialog.tsx` 的 `pendingActionToChoices` 函数，增加类型区分:
```typescript
export function pendingActionToChoices(pendingAction: PendingAction) {
  let title = '选择行动';
  if (pendingAction.type === 'choose_player') title = '选择玩家';
  else if (pendingAction.type === 'choose_line') title = '选择路线';

  return {
    title,
    prompt: pendingAction.prompt,
    options: (pendingAction.options || []).map(opt => ({
      label: opt.label,
      value: opt.value,
      description: opt.description,
    })),
  };
}
```

### Step 3: 检查 GameScreen 的渲染路径

`client/src/components/GameScreen.tsx` 约第495-514行，确认 `choose_player` 类型的 PendingAction 是否能正常走到 `ChoiceDialog` 组件。检查条件判断链中有没有遗漏 `choose_player`。

可能问题：`choose_player` 可能被 EventModal 拦截（因为服务端同时 emit 了 `game:event-trigger`），而 EventModal 中选项渲染可能有 bug。需要检查 EventModal 中 `pendingAction.type === 'choose_player'` 的选项渲染逻辑。

### Step 4: 构建测试 & 提交

```bash
cd D:/work/nannaricher && npm run build
git add -A && git commit -m "fix: choose_player cards now render player options correctly"
```

---

## Task 5: 大二培养计划第二个人被跳过

**Files:**
- Modify: `server/src/game/GameCoordinator.ts` - 培养计划链式流程

### Step 1: 添加调试日志

在以下位置添加 console.log:
- `startPlanSelectionForPlayer` 开头: 打印 playerIdx、玩家名、eligiblePlayers.length
- `finalizePlanSelection` 末尾: 打印是否有 postAction、下一个 playerIdx
- adjust handler 的 keep/adjust 分支: 打印选择和下一步

### Step 2: 排查根因

根据代码分析，可能的 bug 点:
1. `finalizePlanSelection` 第1651行: `if (majorId !== oldMajor)` 条件 — 如果新主修和旧主修相同（比如大一已有的主修在大二被重新选择），postAction 不触发但也不调用 `startPlanSelectionForPlayer`。但1669行在 if 块外面，应该能兜底。
2. `continuePostConfirmChain` 中 `pendingConfirmContext` 可能为空 — 检查这个方法。

读取 `continuePostConfirmChain`:

### Step 3: 修复

根据排查结果修复。最可能的修复点:
- 确保 `finalizePlanSelection` 在所有路径下都调用 `startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1)`
- 确保 `continuePostConfirmChain` 正确恢复 ctx 并调用下一个玩家

### Step 4: 构建测试 & 提交

```bash
cd D:/work/nannaricher && npm run build
git add -A && git commit -m "fix: second player plan selection not triggered in year 2+"
```

---

## Task 6: 支线入口风味文案格子

**Files:**
- Modify: `server/src/data/lines/study.ts` - 插入入口格
- Modify: `server/src/data/lines/pukou.ts` - 插入入口格
- Modify: `server/src/data/lines/money.ts` - 插入入口格
- Modify: `server/src/data/lines/suzhou.ts` - 插入入口格
- Modify: `server/src/data/lines/explore.ts` - 插入入口格
- Modify: `server/src/data/lines/gulou.ts` - 插入入口格
- Modify: `server/src/data/lines/xianlin.ts` - 插入入口格
- Modify: `server/src/data/lines/food.ts` - 插入入口格
- Modify: `server/src/game/handlers/line-handlers.ts` - 添加 8 个纯文案 handler

### Step 1: 添加 8 个纯文案 handler

`server/src/game/handlers/line-handlers.ts` 添加:
```typescript
// 支线入口风味文案 handler（纯展示，无效果）
handler.registerHandler('study_entrance', () => null);
handler.registerHandler('pukou_entrance', () => null);
handler.registerHandler('money_entrance', () => null);
handler.registerHandler('suzhou_entrance', () => null);
handler.registerHandler('explore_entrance', () => null);
handler.registerHandler('gulou_entrance', () => null);
handler.registerHandler('xianlin_entrance', () => null);
handler.registerHandler('food_entrance', () => null);
```

返回 null 意味着无 pendingAction，但 GameCoordinator 会自动 emit `game:event-trigger` 带格子的 name/description 作为事件弹窗。

### Step 2: 修改 8 条支线数据

每条线的 cells 数组头部插入入口格，后续格子 index +1。

示例（money.ts）:
```typescript
cells: [
  { index: 0, id: 'mn_entrance', name: '创业咖啡馆', description: '走进满是商业计划书的咖啡馆，空气里弥漫着野心的味道。你翻开菜单，发现最便宜的一杯咖啡要38块——这大概就是"创业成本"吧。', handlerId: 'money_entrance' },
  { index: 1, id: 'mn_1', name: '违反校规开办考研辅导', ... },  // 原 index 0
  { index: 2, id: 'mn_2', name: '无中介费家教', ... },          // 原 index 1
  // ... 后续全部 +1
],
```

各支线入口格:

| 线路 | id | name | description |
|------|----|------|-------------|
| study | st_entrance | 图书馆门口 | 推开图书馆厚重的玻璃门，一股空调冷气混着书页气息扑面而来。你环顾四周——每个座位都有人，这才是南大的"主战场"。 |
| pukou | pk_entrance | 浦口站台 | 踏上开往浦口的校车，窗外的梧桐渐渐换成了杨树。听说浦口校区的猫比学生还多，你已经有点期待了。 |
| money | mn_entrance | 创业咖啡馆 | 走进满是商业计划书的咖啡馆，空气里弥漫着野心的味道。你翻开菜单，发现最便宜的一杯咖啡要38块——这大概就是"创业成本"吧。 |
| suzhou | sz_entrance | 独墅湖畔 | 独墅湖的微风拂面，带着一丝甜腻的桂花香。苏州校区的节奏比南京慢半拍，但这里的学术氛围一点都不含糊。 |
| explore | ex_entrance | 未知的岔路口 | 校园地图上没有标注的小路，长满了青苔的石板指向一个你从未注意过的方向。好奇心就像弹幕一样疯狂刷屏："去看看！" |
| gulou | gl_entrance | 鼓楼广场 | 古老的鼓楼在夕阳下投下长长的影子。北大楼的常春藤爬满了墙壁，连时间在这里都走得慢一些。你深吸一口气，感觉自己文艺了三分。 |
| xianlin | xl_entrance | 仙林大道 | 梧桐树荫下的大道延伸向远方，骑着小蓝车的同学们擦肩而过。这条路你走了无数遍，但今天似乎有什么不一样的事情要发生。 |
| food | fd_entrance | 食堂门口 | 饭点到了！六食堂的麻辣香锅、二食堂的小炒、清真食堂的拉面……你的肚子率先发表了它的学术见解："咕噜噜～" |

### Step 3: 构建测试 & 提交

```bash
cd D:/work/nannaricher && npm run build
git add -A && git commit -m "feat: add flavor text entrance cells to all 8 branch lines"
```

---

## Task 7: 断线后通过加入房间重连

**Files:**
- Modify: `server/src/socket/RoomHandlers.ts` - room:join 增加重连检测
- Modify: `shared/src/types.ts` - room:joined 增加 reconnected 标记
- Modify: `client/src/context/SocketProvider.tsx` - join 成功后检查是否是重连

### Step 1: 服务端 room:join 支持重连

`server/src/socket/RoomHandlers.ts` 的 `room:join` handler 修改:

```typescript
socket.on('room:join', (data) => {
  try {
    const room = roomManager.getRoom(data.roomId);

    // 如果房间在 playing 阶段，尝试重连
    if (room && room.phase === 'playing') {
      // 通过 userId 或 playerName 匹配断线玩家
      const disconnectedPlayer = room.players.find(p =>
        p.isDisconnected && (
          (socket.data.userId && p.userId === socket.data.userId) ||
          p.name === data.playerName
        )
      );

      if (disconnectedPlayer) {
        // 执行重连流程
        disconnectedPlayer.socketId = socket.id;
        disconnectedPlayer.isDisconnected = false;
        socket.join(data.roomId);
        socket.data.roomId = data.roomId;
        socket.data.playerId = disconnectedPlayer.id;

        const coordinator = roomManager.getCoordinator(data.roomId);
        if (coordinator) {
          const state = coordinator.getState();
          state.log.push({
            turn: state.turnNumber,
            playerId: disconnectedPlayer.id,
            message: `${disconnectedPlayer.name} 重新连接`,
            timestamp: Date.now(),
          });
          coordinator.broadcastState();

          // 重发 pending action（复用 reconnect 逻辑）
          if (state.pendingAction &&
              state.pendingAction.type !== 'roll_dice' &&
              (state.pendingAction.playerId === disconnectedPlayer.id ||
               state.pendingAction.playerId === 'all')) {
            socket.emit('game:event-trigger', {
              title: state.pendingAction.prompt.slice(0, 20) || '事件',
              description: state.pendingAction.prompt,
              pendingAction: state.pendingAction,
            });
          }
        }

        socket.emit('room:joined', {
          playerId: disconnectedPlayer.id,
          roomId: data.roomId,
          reconnected: true,
        });
        console.log(`${data.playerName} rejoined room ${data.roomId} via join`);
        return;
      }

      // 没有匹配的断线玩家
      socket.emit('room:error', { message: '游戏已经开始，无法加入' });
      return;
    }

    // 原有的 waiting 阶段加入逻辑...
    const { playerId } = roomManager.joinRoom(/* ... */);
    // ...
  } catch (error) {
    socket.emit('room:error', { message: String(error) });
  }
});
```

### Step 2: 更新 joined 事件类型

`shared/src/types.ts` 的 `room:joined` 改为:
```typescript
'room:joined': (data: { playerId: string; roomId: string; reconnected?: boolean }) => void;
```

### Step 3: 客户端处理重连场景

`client/src/context/SocketProvider.tsx` 的 `handleRoomJoined` 中:
```typescript
const handleRoomJoined = ({ playerId, roomId, reconnected }: { playerId: string; roomId: string; reconnected?: boolean }) => {
  store.getState().setRoomId(roomId);
  store.getState().setPlayerId(playerId);
  store.getState().setError(null);
  sessionStorage.setItem('nannaricher_roomId', roomId);
  sessionStorage.setItem('nannaricher_playerId', playerId);
  if (reconnected) {
    store.getState().addNotification('已重新连接到游戏', 'success');
  }
};
```

客户端 Lobby/JoinRoom 组件也需要处理 reconnected: 如果是重连，不显示 WaitingRoom 而直接进入游戏（gameState 会通过 state-update 推送过来，自动切换到 GameScreen）。

### Step 4: 构建测试 & 提交

```bash
cd D:/work/nannaricher && npm run build
git add -A && git commit -m "feat: allow disconnected players to rejoin via room code"
```
