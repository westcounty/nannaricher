// shared/src/constants.ts
export const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
export const ROOM_CODE_LENGTH = 6;
export const SALARY_PASS = 500;
export const SALARY_STOP = 600;
export const HOSPITAL_FEE = 250;
export const HOSPITAL_DICE_TARGET = 3;
export const WAITING_ROOM_FEE = 200;
export const PLAN_CONFIRM_INTERVAL = 6; // every 6 turns
export const MAX_TRAINING_PLANS = 2;
export const INITIAL_TRAINING_DRAW = 3;
export const ACTION_TIMEOUT_MS = 60_000;
export const RECONNECT_TIMEOUT_MS = 60_000;
export const ROOM_IDLE_TIMEOUT_MS = 600_000;
export const BASE_WIN_THRESHOLD = 60; // GPA*10 + exploration >= 60
