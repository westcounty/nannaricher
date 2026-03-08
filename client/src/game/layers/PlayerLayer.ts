// client/src/game/layers/PlayerLayer.ts
// Renders player pieces on the board.
// KEY FIX: Uses differential updates instead of removeChildren() + full redraw.
// Maintains a Map of player pieces; only updates when position/highlight changes.

import { Container, Graphics, Text, TextStyle, Ticker } from 'pixi.js';
import type { GameState, Player, Position } from '@nannaricher/shared';
import { LINE_CONFIGS, LINE_EXIT_MAP } from '@nannaricher/shared';
import type { RenderLayer } from '../GameStage';
import {
  METRO_BOARD_WIDTH,
  METRO_BOARD_HEIGHT,
  getMainStationPosition,
  getLineStationPosition,
  getMainRingPath,
} from '../layout/MetroLayout';
import type { Point } from '../layout/MetroLayout';

const PLAYER_COLORS_HEX = [0xE53935, 0x1E88E5, 0x43A047, 0xFB8C00, 0x8E24AA, 0x00897B];
import type { TweenEngine } from '../animations/TweenEngine';
import { animatePieceMove } from '../animations/PieceMoveAnim';
import { playLandingEffect } from '../animations/LandingEffects';
import { MAIN_BOARD_CELLS, CORNER_INDICES } from '@nannaricher/shared';

// Internal representation of a rendered player piece
interface PlayerPiece {
  container: Container;  // group: piece graphic + name label
  lastPosition: Position;
  lastIsCurrent: boolean;
  pulseGlow?: Graphics;  // breathing glow ring for current player
}

/**
 * Calculate circular stack offset for players sharing the same cell.
 * N=1: centered. N=2: side by side. N=3+: arranged in a circle.
 */
function getStackOffset(stackIndex: number, stackTotal: number): { x: number; y: number } {
  if (stackTotal <= 1) return { x: 0, y: 0 };
  if (stackTotal === 2) {
    const dx = stackIndex === 0 ? -14 : 14;
    return { x: dx, y: 0 };
  }
  // 3+ players: circular arrangement
  const radius = stackTotal <= 4 ? 30 : 36;
  const angle = (2 * Math.PI * stackIndex) / stackTotal - Math.PI / 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

/**
 * Build a unique key for a position, used for cell occupancy counting.
 */
function positionKey(pos: Position): string {
  if (pos.type === 'main') return `main:${pos.index}`;
  return `line:${pos.lineId}:${pos.index}`;
}

export class PlayerLayer implements RenderLayer {
  private layerContainer: Container | null = null;
  private playerPieces: Map<string, PlayerPiece> = new Map();
  private animatingPieces: Set<string> = new Set(); // pieces currently in move animation
  private tweenEngine: TweenEngine | null = null;
  private effectLayer: Container | null = null;
  private ticker: Ticker | null = null;
  private pulseTickerFn: (() => void) | null = null;

  /**
   * Inject animation dependencies. When set, piece moves will be animated
   * instead of instant destroy+recreate.
   */
  setAnimationDeps(tweenEngine: TweenEngine, effectLayer: Container, ticker?: Ticker): void {
    this.tweenEngine = tweenEngine;
    this.effectLayer = effectLayer;
    if (ticker) {
      this.ticker = ticker;
      // Pulse glow animation driven by ticker
      this.pulseTickerFn = () => {
        const time = performance.now();
        for (const piece of this.playerPieces.values()) {
          if (piece.pulseGlow) {
            piece.pulseGlow.alpha = 0.3 + 0.5 * Math.sin(time / 400);
          }
        }
      };
      ticker.add(this.pulseTickerFn);
    }
  }

  init(stage: Container): void {
    this.layerContainer = new Container();
    this.layerContainer.x = METRO_BOARD_WIDTH / 2;
    this.layerContainer.y = METRO_BOARD_HEIGHT / 2;
    stage.addChild(this.layerContainer);
  }

  update(state: GameState, currentPlayerId: string | null): void {
    if (!this.layerContainer) return;

    const seenPlayerIds = new Set<string>();

    // Step 1: Build cell occupancy map to know how many players are at each cell
    const cellOccupancy = new Map<string, string[]>(); // posKey -> [playerId, ...]
    state.players.forEach((player) => {
      if (player.isBankrupt) return; // bankrupt players don't occupy cells
      const key = positionKey(player.position);
      if (!cellOccupancy.has(key)) cellOccupancy.set(key, []);
      cellOccupancy.get(key)!.push(player.id);
    });

    // Step 2: Process each player
    state.players.forEach((player, idx) => {
      seenPlayerIds.add(player.id);
      const isCurrent = player.id === currentPlayerId;

      // Hide bankrupt players — remove their piece from the board
      if (player.isBankrupt) {
        if (this.playerPieces.has(player.id)) {
          this.removePiece(player.id);
        }
        return; // skip creating/updating piece for bankrupt players
      }

      // Compute stack index/total for this player's current cell
      const key = positionKey(player.position);
      const cellPlayers = cellOccupancy.get(key) || [player.id];
      const stackIndex = cellPlayers.indexOf(player.id);
      const stackTotal = cellPlayers.length;

      const existing = this.playerPieces.get(player.id);

      if (existing) {
        // Check if anything changed
        const posChanged = !positionsEqual(existing.lastPosition, player.position);
        const highlightChanged = existing.lastIsCurrent !== isCurrent;

        if (posChanged) {
          const oldPosition = { ...existing.lastPosition } as Position;
          const targetCenter = this.calculatePosition(player);
          const offset = getStackOffset(stackIndex, stackTotal);
          const targetX = targetCenter.x + offset.x;
          const targetY = targetCenter.y + offset.y + (targetCenter.inLine ? 8 : 0);

          // Update tracked state immediately (prevents re-triggering on next update)
          existing.lastPosition = { ...player.position } as Position;
          existing.lastIsCurrent = isCurrent;

          // Cancel any in-flight animation on this piece
          if (this.tweenEngine) {
            this.tweenEngine.cancelTarget(existing.container as unknown as Record<string, unknown>);
            this.tweenEngine.cancelTarget(existing.container.scale as unknown as Record<string, unknown>);
          }
          this.animatingPieces.delete(player.id);

          // Attempt animated path move
          if (this.tweenEngine && this.effectLayer) {
            const rawPath = this.buildMovePath(oldPosition, player.position);
            if (rawPath.length > 0) {
              // Add stack offset to the final waypoint only
              const animPath = rawPath.map((p, i) =>
                i === rawPath.length - 1
                  ? { x: p.x + offset.x, y: p.y + offset.y + (targetCenter.inLine ? 8 : 0) }
                  : { x: p.x, y: p.y }
              );

              const pieceRef = existing;
              const playerId = player.id;
              const pos = player.position;
              this.animatingPieces.add(playerId);

              animatePieceMove(existing.container, animPath, this.tweenEngine, this.effectLayer)
                .finally(() => {
                  this.animatingPieces.delete(playerId);
                  // Guarantee final position if this piece wasn't replaced
                  const current = this.playerPieces.get(playerId);
                  if (current === pieceRef) {
                    pieceRef.container.x = targetX;
                    pieceRef.container.y = targetY;
                  }
                });

              // Play landing effect after animation (at destination)
              this.tryPlayLandingEffect(pos, targetCenter, this.effectLayer, this.tweenEngine);
            } else {
              // Empty path fallback — snap
              existing.container.x = targetX;
              existing.container.y = targetY;
            }
          } else {
            // No animation deps — instant snap
            existing.container.x = targetX;
            existing.container.y = targetY;
          }
        } else if (highlightChanged) {
          // Cancel animation before rebuild
          if (this.tweenEngine) {
            this.tweenEngine.cancelTarget(existing.container as unknown as Record<string, unknown>);
            this.tweenEngine.cancelTarget(existing.container.scale as unknown as Record<string, unknown>);
          }
          this.animatingPieces.delete(player.id);
          // Highlight change only — rebuild piece visuals
          this.removePiece(player.id);
          this.createPiece(player, idx, isCurrent, stackIndex, stackTotal);
        } else {
          // No position or highlight change — update stack offset unless animating
          if (!this.animatingPieces.has(player.id)) {
            const center = this.calculatePosition(player);
            const offset = getStackOffset(stackIndex, stackTotal);
            existing.container.x = center.x + offset.x;
            existing.container.y = center.y + offset.y;
          }
        }
      } else {
        // New player — create piece
        this.createPiece(player, idx, isCurrent, stackIndex, stackTotal);
      }
    });

    // Remove pieces for players no longer in the game
    for (const [playerId] of this.playerPieces) {
      if (!seenPlayerIds.has(playerId)) {
        this.removePiece(playerId);
      }
    }
  }

  /**
   * Get the position of a player's piece in mainContainer-local coordinates.
   * (Adds the board-center offset so callers like ViewportController get correct world coords.)
   */
  getPlayerPosition(playerId: string): { x: number; y: number } | null {
    const piece = this.playerPieces.get(playerId);
    if (!piece) return null;
    return {
      x: piece.container.x + METRO_BOARD_WIDTH / 2,
      y: piece.container.y + METRO_BOARD_HEIGHT / 2,
    };
  }

  /**
   * Get the position of a player's piece in center-relative coordinates.
   * (For use with worldEffectLayer which is already offset to board center.)
   */
  getPlayerPositionCenterRelative(playerId: string): { x: number; y: number } | null {
    const piece = this.playerPieces.get(playerId);
    if (!piece) return null;
    return { x: piece.container.x, y: piece.container.y };
  }

  destroy(): void {
    if (this.ticker && this.pulseTickerFn) {
      this.ticker.remove(this.pulseTickerFn);
      this.pulseTickerFn = null;
    }
    this.playerPieces.clear();
    if (this.layerContainer) {
      if (this.layerContainer.parent) {
        this.layerContainer.parent.removeChild(this.layerContainer);
      }
      this.layerContainer.destroy({ children: true });
      this.layerContainer = null;
    }
  }

  // ------ Private ------

  /**
   * Calculate the board position for a player (station center, no stack offset).
   */
  private calculatePosition(player: Player): { x: number; y: number; inLine: boolean } {
    if (player.position.type === 'main') {
      return { ...getMainStationPosition(player.position.index), inLine: false };
    } else {
      return { ...getLineStationPosition(player.position.lineId, player.position.index), inLine: true };
    }
  }

  /**
   * Build a step-by-step movement path between two positions.
   * Returns an array of station center points (no stack offset) for the animation.
   */
  private buildMovePath(from: Position, to: Position): Point[] {
    // Case 1: main → main (walk clockwise around the ring)
    if (from.type === 'main' && to.type === 'main') {
      return getMainRingPath(from.index, to.index);
    }

    // Case 2: main → line (walk on main ring to entry, then into the line)
    if (from.type === 'main' && to.type === 'line') {
      const line = LINE_CONFIGS.find(l => l.id === to.lineId);
      if (!line) return [this.getPositionPoint(to)];

      const path: Point[] = [];
      // Walk main ring from current position to line entry
      if (from.index !== line.entryIndex) {
        path.push(...getMainRingPath(from.index, line.entryIndex));
      }
      // Walk into the line from station 0 to target station
      for (let i = 0; i <= to.index; i++) {
        path.push(getLineStationPosition(to.lineId, i));
      }
      return path;
    }

    // Case 3: line → main (walk back through line to entry, then on main ring)
    if (from.type === 'line' && to.type === 'main') {
      const line = LINE_CONFIGS.find(l => l.id === from.lineId);
      if (!line) return [this.getPositionPoint(to)];

      const path: Point[] = [];
      // Walk backwards through the line to station 0
      for (let i = from.index - 1; i >= 0; i--) {
        path.push(getLineStationPosition(from.lineId, i));
      }
      // Entry point on the main ring
      path.push(getMainStationPosition(line.entryIndex));

      // Check if we exit via the line's exit station
      const exitIndex = LINE_EXIT_MAP[from.lineId];
      if (exitIndex !== undefined && to.index !== line.entryIndex) {
        // Walk main ring from entry to target
        path.push(...getMainRingPath(line.entryIndex, to.index));
      }
      return path;
    }

    // Case 4: line → line (different lines, rare but handle gracefully)
    if (from.type === 'line' && to.type === 'line') {
      if (from.lineId === to.lineId) {
        // Same line: walk directly between stations
        const path: Point[] = [];
        if (from.index < to.index) {
          for (let i = from.index + 1; i <= to.index; i++) {
            path.push(getLineStationPosition(to.lineId, i));
          }
        } else {
          for (let i = from.index - 1; i >= to.index; i--) {
            path.push(getLineStationPosition(to.lineId, i));
          }
        }
        return path;
      }
      // Different lines: go back to main ring, then into the other line
      // Just jump for simplicity (this case is very rare)
      return [this.getPositionPoint(to)];
    }

    // Fallback: direct jump
    return [this.getPositionPoint(to)];
  }

  /**
   * Get the station center point for any position.
   */
  private getPositionPoint(pos: Position): Point {
    if (pos.type === 'main') {
      return getMainStationPosition(pos.index);
    }
    return getLineStationPosition(pos.lineId, pos.index);
  }

  private createPiece(
    player: Player,
    playerIndex: number,
    isCurrent: boolean,
    stackIndex: number,
    stackTotal: number,
  ): void {
    if (!this.layerContainer) return;

    // Calculate position (station center)
    const { x: posX, y: posY, inLine } = this.calculatePosition(player);

    const color = PLAYER_COLORS_HEX[playerIndex % PLAYER_COLORS_HEX.length];
    const offset = getStackOffset(stackIndex, stackTotal);

    // Group container for this player's visuals
    const group = new Container();
    group.x = posX + offset.x;
    group.y = posY + offset.y;

    const pieceRadius = inLine ? 14 : 20;
    const shadowOffY = inLine ? 16 : 24;
    if (inLine) {
      group.y += 8; // shift down to avoid overlapping station label
    }

    // Piece graphic
    const piece = new Graphics();

    // Drop shadow
    piece.ellipse(0, shadowOffY, pieceRadius + 3, pieceRadius * 0.35);
    piece.fill({ color: 0x000000, alpha: 0.3 });

    // Main body
    piece.circle(0, 0, pieceRadius);
    piece.fill({ color });

    // Single white stroke border (clean contrast against any background)
    piece.circle(0, 0, pieceRadius);
    piece.stroke({ width: 2.5, color: 0xffffff, alpha: 0.85 });

    // Inner lighter circle for depth
    piece.circle(0, -2, pieceRadius * 0.6);
    piece.fill({ color: 0xffffff, alpha: 0.18 });

    // Specular highlight
    const hlOff = inLine ? 4 : 5;
    piece.circle(-hlOff, -hlOff, hlOff * 0.7);
    piece.fill({ color: 0xffffff, alpha: 0.45 });

    // Current player golden ring
    if (isCurrent) {
      piece.circle(0, 0, pieceRadius + 5);
      piece.stroke({ width: 3, color: 0xFFD700 });
    }

    group.addChild(piece);

    // Pulse glow ring for current player (breathing animation driven by ticker)
    let pulseGlow: Graphics | undefined;
    if (isCurrent) {
      pulseGlow = new Graphics();
      // Large outer glow
      pulseGlow.circle(0, 0, pieceRadius + 22);
      pulseGlow.fill({ color: 0xFFD700, alpha: 0.12 });
      // Bright inner ring
      pulseGlow.circle(0, 0, pieceRadius + 14);
      pulseGlow.stroke({ width: 4, color: 0xFFD700, alpha: 0.9 });
      pulseGlow.alpha = 0.5;
      // Insert behind the piece for glow effect
      group.addChildAt(pulseGlow, 0);
    }

    // Name label with dark background pill for readability
    const maxChars = inLine ? 4 : 6;
    const labelText = player.name.length > maxChars ? player.name.slice(0, maxChars - 1) + '…' : player.name;
    const nameText = new Text({
      text: labelText,
      style: new TextStyle({
        fontSize: 13,
        fill: 0xffffff,
        fontWeight: 'bold',
        letterSpacing: 0.5,
      }),
    });
    nameText.anchor.set(0.5);

    // Background pill behind name
    const labelY = -(pieceRadius + 14);
    const pillPadX = 6;
    const pillPadY = 2;
    const pillW = nameText.width + pillPadX * 2;
    const pillH = nameText.height + pillPadY * 2;
    const labelBg = new Graphics();
    labelBg.roundRect(-pillW / 2, labelY - pillH / 2, pillW, pillH, 6);
    labelBg.fill({ color: 0x000000, alpha: 0.7 });
    labelBg.roundRect(-pillW / 2, labelY - pillH / 2, pillW, pillH, 6);
    labelBg.stroke({ width: 1, color, alpha: 0.8 });
    group.addChild(labelBg);

    nameText.y = labelY;
    group.addChild(nameText);

    this.layerContainer.addChild(group);

    // Store reference
    this.playerPieces.set(player.id, {
      container: group,
      lastPosition: { ...player.position } as Position,
      lastIsCurrent: isCurrent,
      pulseGlow,
    });
  }

  /** Play a celebratory landing effect for special station types. */
  private tryPlayLandingEffect(
    pos: Position,
    center: { x: number; y: number },
    effectLayer: Container,
    tweenEngine: TweenEngine,
  ): void {
    if (pos.type === 'main') {
      const cell = MAIN_BOARD_CELLS[pos.index];
      if (!cell) return;
      if (CORNER_INDICES.includes(pos.index)) {
        playLandingEffect(effectLayer, center.x, center.y, 'corner', tweenEngine);
      } else if (cell.type === 'line_entry') {
        playLandingEffect(effectLayer, center.x, center.y, 'line_entry', tweenEngine);
      }
    } else {
      // Branch line: check if this is the experience card (last station)
      const line = LINE_CONFIGS.find(l => l.id === pos.lineId);
      if (line && pos.index === line.cellCount - 1) {
        playLandingEffect(effectLayer, center.x, center.y, 'experience', tweenEngine);
      }
    }
  }

  private removePiece(playerId: string): void {
    const piece = this.playerPieces.get(playerId);
    if (piece) {
      if (piece.container.parent) {
        piece.container.parent.removeChild(piece.container);
      }
      piece.container.destroy({ children: true });
      this.playerPieces.delete(playerId);
    }
  }
}

// ============================================
// Helpers
// ============================================

function positionsEqual(a: Position, b: Position): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'main' && b.type === 'main') {
    return a.index === b.index;
  }
  if (a.type === 'line' && b.type === 'line') {
    return a.lineId === b.lineId && a.index === b.index;
  }
  return false;
}
