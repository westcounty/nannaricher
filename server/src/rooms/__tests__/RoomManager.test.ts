// server/src/rooms/__tests__/RoomManager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../RoomManager.js';

describe('RoomManager', () => {
  let rm: RoomManager;
  beforeEach(() => { rm = new RoomManager(); });

  it('creates a room and returns a 6-char code', () => {
    const { roomId } = rm.createRoom('Alice', 'socket1', 2);
    expect(roomId).toHaveLength(6);
    expect(rm.getRoom(roomId)).toBeDefined();
  });

  it('joins an existing room', () => {
    const { roomId } = rm.createRoom('Alice', 'socket1', 2);
    rm.joinRoom(roomId, 'Bob', 'socket2', 1);
    const room = rm.getRoom(roomId)!;
    expect(room.players).toHaveLength(2);
  });

  it('rejects join if room is full (6 players)', () => {
    const { roomId } = rm.createRoom('A', 's1', 1);
    rm.joinRoom(roomId, 'B', 's2', 1);
    rm.joinRoom(roomId, 'C', 's3', 1);
    rm.joinRoom(roomId, 'D', 's4', 1);
    rm.joinRoom(roomId, 'E', 's5', 1);
    rm.joinRoom(roomId, 'F', 's6', 1);
    expect(() => rm.joinRoom(roomId, 'G', 's7', 1)).toThrow('full');
  });

  it('rejects join for nonexistent room', () => {
    expect(() => rm.joinRoom('NOPE00', 'Bob', 's2', 1)).toThrow('not found');
  });

  it('removes room', () => {
    const { roomId } = rm.createRoom('Alice', 'socket1', 2);
    rm.removeRoom(roomId);
    expect(rm.getRoom(roomId)).toBeUndefined();
  });

  it('finds room by socket id', () => {
    const { roomId } = rm.createRoom('Alice', 'socket1', 2);
    expect(rm.findRoomBySocket('socket1')?.roomId).toBe(roomId);
  });
});
