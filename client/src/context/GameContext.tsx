/**
 * @deprecated FULLY DEPRECATED — no longer used.
 *
 * All state is now managed by the Zustand store (stores/gameStore.ts).
 * Socket event bridging is handled by ZustandBridge (context/SocketProvider.tsx).
 *
 * This file is retained temporarily for reference during the migration period.
 * It can be safely deleted once migration is verified.
 */

// Re-export types that may still be referenced elsewhere
export type { GameEvent, DiceResult, AnnouncementData as Announcement, WinnerInfo } from '../stores/gameStore';
