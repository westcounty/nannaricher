// client/src/game/GameCanvas.tsx
// Thin React wrapper that manages PixiJS Application lifecycle
// and delegates rendering to the layered GameStage architecture.

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Application, Container } from 'pixi.js';
import type { GameState, Position } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../styles/tokens';

import { GameStage } from './GameStage';
import { MetroBackgroundLayer } from './layers/MetroBackgroundLayer';
import { TrackLayer } from './layers/TrackLayer';
import { StationLayer, type CellHoverInfo } from './layers/StationLayer';
import { PlayerLayer } from './layers/PlayerLayer';
import { TweenEngine } from './animations/TweenEngine';
import { ViewportController } from './interaction/ViewportController';
import { showFloatingText } from './animations/FloatingText';
import { playSound } from '../audio/AudioManager';
import {
  METRO_BOARD_WIDTH,
  METRO_BOARD_HEIGHT,
  getMainStationPosition,
  getLineStationPosition,
} from './layout/MetroLayout';

/**
 * Convert a game Position to mainContainer-local world coordinates.
 * This computes the TARGET position from game state (not the piece's current visual position).
 */
function positionToWorldCoords(position: Position): { x: number; y: number } {
  if (position.type === 'main') {
    const p = getMainStationPosition(position.index);
    return { x: p.x + METRO_BOARD_WIDTH / 2, y: p.y + METRO_BOARD_HEIGHT / 2 };
  }
  const p = getLineStationPosition(position.lineId, position.index);
  return { x: p.x + METRO_BOARD_WIDTH / 2, y: p.y + METRO_BOARD_HEIGHT / 2 };
}

interface GameCanvasProps {
  gameState: GameState;
  currentPlayerId: string | null;
  localPlayerId: string | null;
  onCellClick?: (cellId: string, position: Position) => void;
  onCellHover?: (info: CellHoverInfo | null) => void;
}

export interface GameCanvasHandle {
  /** Focus viewport on a specific player by ID */
  focusOnPlayer(playerId: string): void;
  /** Reset viewport to default zoom centered on local player */
  focusOnSelf(): void;
  /** Enable or disable canvas interactions (for modal overlay) */
  setInteractionEnabled(enabled: boolean): void;
}

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(({
  gameState,
  currentPlayerId,
  localPlayerId,
  onCellClick,
  onCellHover,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const stageRef = useRef<GameStage | null>(null);
  const playerLayerRef = useRef<PlayerLayer | null>(null);
  const tweenRef = useRef<TweenEngine | null>(null);
  const worldEffectLayerRef = useRef<Container | null>(null);
  const screenEffectLayerRef = useRef<Container | null>(null);
  const viewportRef = useRef<ViewportController | null>(null);
  const stationLayerRef = useRef<StationLayer | null>(null);
  const prevStateRef = useRef<GameState | null>(null);
  const initialFocusDoneRef = useRef(false);

  // Expose imperative methods to parent
  useImperativeHandle(ref, () => ({
    focusOnPlayer(playerId: string) {
      if (!playerLayerRef.current || !viewportRef.current) return;
      const pos = playerLayerRef.current.getPlayerPosition(playerId);
      if (pos) viewportRef.current.focusOnPlayer(pos.x, pos.y);
    },
    focusOnSelf() {
      if (!playerLayerRef.current || !viewportRef.current || !localPlayerId) return;
      const pos = playerLayerRef.current.getPlayerPosition(localPlayerId);
      if (pos) viewportRef.current.focusOnSelf(pos.x, pos.y);
    },
    setInteractionEnabled(enabled: boolean) {
      viewportRef.current?.setInteractionEnabled(enabled);
      // Also clear hover when disabling
      if (!enabled) onCellHover?.(null);
    },
  }), [localPlayerId, onCellHover]);

  // Initialize PixiJS Application + layered stage
  useEffect(() => {
    const container = containerRef.current;
    if (!container || appRef.current) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const app = new Application();

    app.init({
      width: rect.width,
      height: rect.height,
      backgroundColor: 0x0F0A1A,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      container.appendChild(app.canvas);
      appRef.current = app;

      // Re-read dimensions after async init (CSS layout may have settled)
      const finalRect = container.getBoundingClientRect();
      const w = finalRect.width > 0 ? finalRect.width : rect.width;
      const h = finalRect.height > 0 ? finalRect.height : rect.height;
      app.renderer.resize(w, h);

      // Create TweenEngine (driven by PixiJS ticker)
      const tweenEngine = new TweenEngine(app.ticker);
      tweenRef.current = tweenEngine;

      // Build the layered stage
      const stage = new GameStage();
      stage.addLayer(new MetroBackgroundLayer());
      stage.addLayer(new TrackLayer());
      const stationLayer = new StationLayer({ onCellClick, onCellHover });
      stage.addLayer(stationLayer);
      stationLayerRef.current = stationLayer;
      stationLayer.setTweenEngine(tweenEngine);

      // Create PlayerLayer with animation support
      const playerLayer = new PlayerLayer();
      stage.addLayer(playerLayer);
      playerLayerRef.current = playerLayer;

      stage.init(app, w, h);

      // Create world-space effect layer inside mainContainer (for floating text, ripples)
      const worldEffectLayer = new Container();
      worldEffectLayer.x = METRO_BOARD_WIDTH / 2;
      worldEffectLayer.y = METRO_BOARD_HEIGHT / 2;
      stage.getMainContainer().addChild(worldEffectLayer);
      worldEffectLayerRef.current = worldEffectLayer;

      // Create screen-space effect layer on app.stage (for dice animation)
      const screenEffectLayer = new Container();
      app.stage.addChild(screenEffectLayer);
      screenEffectLayerRef.current = screenEffectLayer;

      // Inject animation dependencies into PlayerLayer
      playerLayer.setAnimationDeps(tweenEngine, worldEffectLayer, app.ticker);

      stageRef.current = stage;

      // Create ViewportController for zoom/pan
      const mainContainer = stage.getMainContainer();
      const vc = new ViewportController(mainContainer, app.canvas as HTMLCanvasElement);
      vc.onFocusRequest = () => {
        // Focus on local player (self) when Home key / reset is pressed
        if (playerLayerRef.current && localPlayerId) {
          const pos = playerLayerRef.current.getPlayerPosition(localPlayerId);
          if (pos) vc.focusOnSelf(pos.x, pos.y);
        }
      };
      viewportRef.current = vc;

      // Push initial state and do initial focus
      stage.updateState(gameState, currentPlayerId);
      playerLayer.update(gameState, currentPlayerId);

      // Deferred init: wait for CSS layout to settle, then resize + focus.
      // Use a single RAF to avoid the second RAF overriding the first's animation.
      requestAnimationFrame(() => {
        // Step 1: Check if resize is needed (CSS layout may have shifted)
        const settledRect = container.getBoundingClientRect();
        if (settledRect.width > 0 && settledRect.height > 0 &&
            (Math.abs(settledRect.width - w) > 1 || Math.abs(settledRect.height - h) > 1)) {
          app.renderer.resize(settledRect.width, settledRect.height);
          stage.resize(settledRect.width, settledRect.height);
          viewportRef.current?.updateBaseTransform();
        }

        // Step 2: Focus on local player (after resize is done)
        // Use positionToWorldCoords for accurate target position from game state.
        if (localPlayerId && viewportRef.current) {
          const localPlayer = gameState.players.find(p => p.id === localPlayerId);
          if (localPlayer) {
            const worldPos = positionToWorldCoords(localPlayer.position);
            viewportRef.current.focusOnSelf(worldPos.x, worldPos.y);
            initialFocusDoneRef.current = true;
          }
        }
      });

      console.log('[GameCanvas] PixiJS initialized with animations + viewport');
    }).catch(err => {
      console.error('[GameCanvas] Init error:', err);
    });

    return () => {
      // Destroy ViewportController
      viewportRef.current?.destroy();
      viewportRef.current = null;

      // Destroy TweenEngine
      tweenRef.current?.destroy();
      tweenRef.current = null;

      // Destroy effect layers
      if (worldEffectLayerRef.current) {
        if (worldEffectLayerRef.current.parent) {
          worldEffectLayerRef.current.parent.removeChild(worldEffectLayerRef.current);
        }
        worldEffectLayerRef.current.destroy({ children: true });
        worldEffectLayerRef.current = null;
      }
      if (screenEffectLayerRef.current) {
        if (screenEffectLayerRef.current.parent) {
          screenEffectLayerRef.current.parent.removeChild(screenEffectLayerRef.current);
        }
        screenEffectLayerRef.current.destroy({ children: true });
        screenEffectLayerRef.current = null;
      }

      playerLayerRef.current = null;

      stageRef.current?.destroy();
      stageRef.current = null;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, []);

  // Push state updates to the stage, with floating text for stat changes
  useEffect(() => {
    // Detect stat changes and show floating text
    if (prevStateRef.current && worldEffectLayerRef.current && playerLayerRef.current) {
      const prevPlayers = prevStateRef.current.players;
      for (const player of gameState.players) {
        const prevPlayer = prevPlayers.find(p => p.id === player.id);
        if (!prevPlayer) continue;

        const pos = playerLayerRef.current.getPlayerPositionCenterRelative(player.id);
        if (!pos) continue;

        // Money change
        if (player.money !== prevPlayer.money) {
          const delta = player.money - prevPlayer.money;
          const text = delta > 0 ? `+$${delta}` : `-$${Math.abs(delta)}`;
          const color = delta > 0 ? '#4ade80' : '#ef4444';
          showFloatingText(worldEffectLayerRef.current!, pos.x, pos.y - 30, text, color, tweenRef.current ?? undefined);
          if (player.id === currentPlayerId) {
            playSound(delta > 0 ? 'coin_gain' : 'coin_loss');
          }
        }

        // GPA change
        if (player.gpa !== prevPlayer.gpa) {
          const delta = player.gpa - prevPlayer.gpa;
          const text = `GPA ${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
          const color = '#60a5fa';
          showFloatingText(worldEffectLayerRef.current!, pos.x, pos.y - 50, text, color, tweenRef.current ?? undefined);
          if (player.id === currentPlayerId) {
            playSound(delta > 0 ? 'gpa_up' : 'gpa_down');
          }
        }

        // Exploration change
        if (player.exploration !== prevPlayer.exploration) {
          const delta = player.exploration - prevPlayer.exploration;
          const text = `探索 ${delta > 0 ? '+' : ''}${delta}`;
          const color = '#fbbf24';
          showFloatingText(worldEffectLayerRef.current!, pos.x, pos.y - 70, text, color, tweenRef.current ?? undefined);
          if (player.id === currentPlayerId) {
            playSound('explore_up');
          }
        }
      }
    }

    // Auto-focus logic: use positionToWorldCoords (from gameState) instead of
    // getPlayerPosition (piece visual position) so we focus on the DESTINATION,
    // not where the piece currently is before animation.
    if (prevStateRef.current && viewportRef.current) {
      const prevState = prevStateRef.current;
      const turnChanged = prevState.currentPlayerIndex !== gameState.currentPlayerIndex;
      const newCurrentPlayer = gameState.players[gameState.currentPlayerIndex];

      if (turnChanged && newCurrentPlayer) {
        const worldPos = positionToWorldCoords(newCurrentPlayer.position);
        if (localPlayerId && newCurrentPlayer.id === localPlayerId) {
          // It's now my turn — focusOnSelf with zoom reset
          viewportRef.current.focusOnSelf(worldPos.x, worldPos.y);
        } else {
          // Someone else's turn — just pan to them without changing zoom
          viewportRef.current.focusOnPlayer(worldPos.x, worldPos.y);
        }
      } else if (!turnChanged && newCurrentPlayer) {
        // Same turn — check if the current player's position changed (they moved)
        const prevPlayer = prevState.players.find(p => p.id === newCurrentPlayer.id);
        if (prevPlayer) {
          const posChanged =
            prevPlayer.position.type !== newCurrentPlayer.position.type ||
            prevPlayer.position.index !== newCurrentPlayer.position.index ||
            (prevPlayer.position.type === 'line' && newCurrentPlayer.position.type === 'line' &&
              prevPlayer.position.lineId !== newCurrentPlayer.position.lineId);
          if (posChanged) {
            // Follow the current player's piece to their new destination
            const worldPos = positionToWorldCoords(newCurrentPlayer.position);
            viewportRef.current.focusOnPlayer(worldPos.x, worldPos.y);
          }
        }
      }
    }

    prevStateRef.current = gameState;

    // Clear destination highlights when state updates (player has moved)
    stationLayerRef.current?.clearHighlights();

    stageRef.current?.updateState(gameState, currentPlayerId);
  }, [gameState, currentPlayerId]);

  // Handle viewport resize using ResizeObserver for accurate container tracking
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      const app = appRef.current;
      if (!app || !container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      app.renderer.resize(rect.width, rect.height);
      stageRef.current?.resize(rect.width, rect.height);
      // Update viewport base transform after resize changes mainContainer
      viewportRef.current?.updateBaseTransform();
    };

    // Use ResizeObserver with debounce to detect container size changes
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 100);
    });
    ro.observe(container);

    // Also handle window resize as fallback
    window.addEventListener('resize', handleResize);
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0F0A1A',
        borderRadius: DESIGN_TOKENS.radius.lg,
        overflow: 'hidden',
      }}
    />
  );
});

GameCanvas.displayName = 'GameCanvas';

export default GameCanvas;
