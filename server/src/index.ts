import { createServer } from 'http';
import { createApp } from './app.js';
import { createSocketServer } from './socket/SocketManager.js';
import { registerRoomHandlers } from './socket/RoomHandlers.js';
import { registerGameHandlers } from './socket/GameHandlers.js';
import { RoomManager } from './rooms/RoomManager.js';

const app = createApp();
const httpServer = createServer(app);
const io = createSocketServer(httpServer);
const roomManager = new RoomManager();

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);
  registerRoomHandlers(io, socket, roomManager);
  registerGameHandlers(io, socket, roomManager);
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    roomManager.handleDisconnect(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  roomManager.startCleanup();
});
