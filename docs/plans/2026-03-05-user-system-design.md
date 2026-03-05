# User System Design

## Decisions
- Auth: frontend calls tuchan-api (admin.nju.top) directly for register/login
- JWT passed via WebSocket auth, nannaricher server verifies signature
- Game history: nannaricher SQLite (better-sqlite3)
- Nickname: from tuchan-api, unified across apps

## Architecture
```
Browser → tuchan-api (register/login) → JWT + refreshToken → localStorage
Browser → nannaricher WebSocket (auth: {token}) → server verifies JWT → game
nannaricher server → SQLite (game_results table)
```

## Implementation Plan

### Phase 1: Backend Auth Infrastructure
1. Add better-sqlite3 + jsonwebtoken dependencies to server
2. Create database module (SQLite init, game_results table)
3. Create JWT verification middleware for Socket.IO
4. Extend Player model with userId field

### Phase 2: Game History Persistence
5. Save game results to SQLite on game end
6. Add REST API: GET /api/me, GET /api/history

### Phase 3: Frontend Auth
7. Create auth store (Zustand) with token management
8. Create LoginScreen component (register + login forms)
9. Update SocketContext to pass JWT on connection
10. Update Lobby to show user info + logout

### Phase 4: Frontend History & Polish
11. Create BattleHistory component
12. Improve reconnection logic (userId-based)
13. Handle token refresh flow
