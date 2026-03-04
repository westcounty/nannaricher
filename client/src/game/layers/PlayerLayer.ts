// client/src/game/layers/PlayerLayer.ts
// Renders player pieces on the board.
// KEY FIX: Uses differential updates instead of removeChildren() + full redraw.
// Maintains a Map of player pieces; only updates when position/highlight changes.

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameState, Player, Position } from '@nannaricher/shared';
import type { RenderLayer } from '../GameStage';
import {
  BOARD_SIZE,
  getCellPosition,
  getLineCellPosition,
  PLAYER_COLORS_HEX,
} from '../layout/BoardLayout';
import type { TweenEngine } from '../animations/TweenEngine';
import { animatePieceMove } from '../animations/PieceMoveAnim';

// Internal representation of a rendered player piece
interface PlayerPiece {
  container: Container;  // group: piece graphic + name label
  lastPosition: Position;
  lastIsCurrent: boolean;
}

export class PlayerLayer implements RenderLayer {
  private layerContainer: Container | null = null;
  private playerPieces: Map<string, PlayerPiece> = new Map();
  private tweenEngine: TweenEngine | null = null;
  private effectLayer: Container | null = null;

  /**
   * Inject animation dependencies. When set, piece moves will be animated
   * instead of instant destroy+recreate.
   */
  setAnimationDeps(tweenEngine: TweenEngine, effectLayer: Container): void {
    this.tweenEngine = tweenEngine;
    this.effectLayer = effectLayer;
  }

  init(stage: Container): void {
    this.layerContainer = new Container();
    this.layerContainer.x = BOARD_SIZE / 2;
    this.layerContainer.y = BOARD_SIZE / 2;
    stage.addChild(this.layerContainer);
  }

  update(state: GameState, currentPlayerId: string | null): void {
    if (!this.layerContainer) return;

    const seenPlayerIds = new Set<string>();

    state.players.forEach((player, idx) => {
      seenPlayerIds.add(player.id);
      const isCurrent = player.id === currentPlayerId;

      const existing = this.playerPieces.get(player.id);

      if (existing) {
        // Check if anything changed
        const posChanged = !positionsEqual(existing.lastPosition, player.position);
        const highlightChanged = existing.lastIsCurrent !== isCurrent;

        if (posChanged) {
          if (this.tweenEngine && this.effectLayer) {
            // Animate to new position
            const newPos = this.calculatePosition(player);
            const offset = idx * 8;
            const path = [{ x: newPos.x + offset, y: newPos.y + offset }];
            animatePieceMove(existing.container, path, this.tweenEngine, this.effectLayer);
            existing.lastPosition = { ...player.position } as Position;
          } else {
            // Fallback: instant reposition
            this.removePiece(player.id);
            this.createPiece(player, idx, isCurrent);
          }
        } else if (highlightChanged) {
          // Highlight change only — rebuild piece visuals
          this.removePiece(player.id);
          this.createPiece(player, idx, isCurrent);
        }
        // else: no change, skip
      } else {
        // New player — create piece
        this.createPiece(player, idx, isCurrent);
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
   * Get the current screen position of a player's piece.
   */
  getPlayerPosition(playerId: string): { x: number; y: number } | null {
    const piece = this.playerPieces.get(playerId);
    if (!piece) return null;
    return { x: piece.container.x, y: piece.container.y };
  }

  destroy(): void {
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
   * Calculate the board position for a player (reusable for both creation and animation).
   */
  private calculatePosition(player: Player): { x: number; y: number; inLine: boolean } {
    if (player.position.type === 'main') {
      return { ...getCellPosition(player.position.index), inLine: false };
    } else {
      return { ...getLineCellPosition(player.position.lineId, player.position.index), inLine: true };
    }
  }

  private createPiece(player: Player, playerIndex: number, isCurrent: boolean): void {
    if (!this.layerContainer) return;

    // Calculate position
    const { x: posX, y: posY, inLine } = this.calculatePosition(player);

    const color = PLAYER_COLORS_HEX[playerIndex % PLAYER_COLORS_HEX.length];
    const offset = playerIndex * 8;

    // Group container for this player's visuals
    const group = new Container();
    group.x = posX + offset;
    group.y = posY + offset;

    // Piece graphic
    const piece = new Graphics();

    // Shadow
    piece.ellipse(0, 20, 18, 8);
    piece.fill({ color: 0x333333, alpha: 0.2 });

    // Body
    piece.circle(0, 0, 16);
    piece.fill({ color });

    // Highlight
    piece.circle(-5, -5, 5);
    piece.fill({ color: 0xffffff, alpha: 0.4 });

    // Current player ring
    if (isCurrent) {
      piece.circle(0, 0, 20);
      piece.stroke({ width: 3, color: 0xC9A227 });
    }

    // In-line indicator
    if (inLine) {
      piece.circle(0, 0, 18);
      piece.stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
    }

    group.addChild(piece);

    // Name label (white for dark background)
    const nameText = new Text({
      text: player.name.slice(0, 2),
      style: new TextStyle({
        fontSize: 12,
        fill: 0xffffff,
        fontWeight: 'bold',
      }),
    });
    nameText.anchor.set(0.5);
    nameText.y = -26;
    group.addChild(nameText);

    this.layerContainer.addChild(group);

    // Store reference
    this.playerPieces.set(player.id, {
      container: group,
      lastPosition: { ...player.position } as Position,
      lastIsCurrent: isCurrent,
    });
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
