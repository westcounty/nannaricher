// client/src/game/GameStage.ts
// Stage manager that orchestrates render layers.
// Each layer handles one visual concern (background, board cells, lines, players).

import { Container } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { GameState } from '@nannaricher/shared';
import { METRO_BOARD_WIDTH, METRO_BOARD_HEIGHT } from './layout/MetroLayout';

// ============================================
// Layer Interface
// ============================================

export interface RenderLayer {
  /** Called once to create PixiJS display objects and add them to the stage. */
  init(stage: Container): void;

  /**
   * Called whenever game state changes.
   * Layers should diff against previous state and only update what changed.
   */
  update(state: GameState, currentPlayerId: string | null): void;

  /** Cleanup PixiJS objects. */
  destroy(): void;
}

// ============================================
// GameStage
// ============================================

export class GameStage {
  private layers: RenderLayer[] = [];
  private mainContainer: Container;

  constructor() {
    this.mainContainer = new Container();
  }

  /**
   * Attach to a PixiJS Application and set up the container hierarchy.
   */
  init(app: Application, viewWidth: number, viewHeight: number): void {
    app.stage.addChild(this.mainContainer);

    // Scale the board to fit the viewport
    this.resize(viewWidth, viewHeight);

    // Initialize all registered layers
    for (const layer of this.layers) {
      layer.init(this.mainContainer);
    }
  }

  /**
   * Register a render layer. Layers are drawn in registration order (first = bottom).
   * Must be called before init().
   */
  addLayer(layer: RenderLayer): void {
    this.layers.push(layer);
  }

  /**
   * Push new game state to all layers.
   */
  updateState(state: GameState, currentPlayerId: string | null): void {
    for (const layer of this.layers) {
      layer.update(state, currentPlayerId);
    }
  }

  /**
   * Recalculate scale and position when the viewport changes.
   */
  resize(viewWidth: number, viewHeight: number): void {
    const maxCanvasW = Math.min(viewWidth, 1900);
    const maxCanvasH = Math.min(viewHeight, 1600);
    const scaleX = maxCanvasW / (METRO_BOARD_WIDTH + 100);
    const scaleY = maxCanvasH / (METRO_BOARD_HEIGHT + 100);
    const scale = Math.max(0.1, Math.min(scaleX, scaleY));
    this.mainContainer.x = viewWidth / 2 - (METRO_BOARD_WIDTH / 2) * scale;
    this.mainContainer.y = viewHeight / 2 - (METRO_BOARD_HEIGHT / 2) * scale;
    this.mainContainer.scale.set(scale);
  }

  /**
   * Expose the main container for external consumers (e.g. ViewportController).
   */
  getMainContainer(): Container {
    return this.mainContainer;
  }

  /**
   * Destroy all layers and PixiJS objects.
   */
  destroy(): void {
    for (const layer of this.layers) {
      layer.destroy();
    }
    this.layers = [];

    if (this.mainContainer.parent) {
      this.mainContainer.parent.removeChild(this.mainContainer);
    }
    this.mainContainer.destroy({ children: true });
  }
}
