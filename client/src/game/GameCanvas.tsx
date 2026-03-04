// client/src/game/GameCanvas.tsx
// Thin React wrapper (~90 lines) that manages PixiJS Application lifecycle
// and delegates rendering to the layered GameStage architecture.

import React, { useRef, useEffect } from 'react';
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
import { animateDiceResult } from './animations/DiceRollAnim';
import { showFloatingText } from './animations/FloatingText';
import { METRO_BOARD_WIDTH, METRO_BOARD_HEIGHT } from './layout/MetroLayout';
import { MAIN_BOARD_SIZE, LINE_CONFIGS } from '@nannaricher/shared';

interface GameCanvasProps {
  gameState: GameState;
  currentPlayerId: string | null;
  diceResult?: { playerId: string; values: number[]; total: number } | null;
  onCellClick?: (cellId: string, position: Position) => void;
  onCellHover?: (info: CellHoverInfo | null) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  currentPlayerId,
  diceResult,
  onCellClick,
  onCellHover,
}) => {
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
        // Focus on current player when Home key is pressed
        if (playerLayerRef.current && gameState) {
          const cp = gameState.players[gameState.currentPlayerIndex];
          if (cp) {
            const pos = playerLayerRef.current.getPlayerPosition(cp.id);
            if (pos) vc.focusOnPlayer(pos.x, pos.y);
          }
        }
      };
      viewportRef.current = vc;

      // Deferred resize: wait for next frame so CSS layout fully settles after
      // canvas element insertion. This catches race conditions where the initial
      // getBoundingClientRect() ran before flex recalculation completed.
      requestAnimationFrame(() => {
        const settledRect = container.getBoundingClientRect();
        if (settledRect.width > 0 && settledRect.height > 0 &&
            (Math.abs(settledRect.width - w) > 1 || Math.abs(settledRect.height - h) > 1)) {
          app.renderer.resize(settledRect.width, settledRect.height);
          stage.resize(settledRect.width, settledRect.height);
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

        const pos = playerLayerRef.current.getPlayerPosition(player.id);
        if (!pos) continue;

        // Money change
        if (player.money !== prevPlayer.money) {
          const delta = player.money - prevPlayer.money;
          const text = delta > 0 ? `+$${delta}` : `-$${Math.abs(delta)}`;
          const color = delta > 0 ? '#4ade80' : '#ef4444';
          showFloatingText(worldEffectLayerRef.current!, pos.x, pos.y - 30, text, color, tweenRef.current ?? undefined);
        }

        // GPA change
        if (player.gpa !== prevPlayer.gpa) {
          const delta = player.gpa - prevPlayer.gpa;
          const text = `GPA ${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
          const color = '#60a5fa';
          showFloatingText(worldEffectLayerRef.current!, pos.x, pos.y - 50, text, color, tweenRef.current ?? undefined);
        }

        // Exploration change
        if (player.exploration !== prevPlayer.exploration) {
          const delta = player.exploration - prevPlayer.exploration;
          const text = `探索 ${delta > 0 ? '+' : ''}${delta}`;
          const color = '#fbbf24';
          showFloatingText(worldEffectLayerRef.current!, pos.x, pos.y - 70, text, color, tweenRef.current ?? undefined);
        }
      }
    }
    // Auto-focus on current player when turn changes
    if (prevStateRef.current &&
        prevStateRef.current.currentPlayerIndex !== gameState.currentPlayerIndex &&
        playerLayerRef.current && viewportRef.current) {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer) {
        const pos = playerLayerRef.current.getPlayerPosition(currentPlayer.id);
        if (pos) viewportRef.current.focusOnPlayer(pos.x, pos.y);
      }
    }

    prevStateRef.current = gameState;

    // Clear destination highlights when state updates (player has moved)
    stationLayerRef.current?.clearHighlights();

    stageRef.current?.updateState(gameState, currentPlayerId);
  }, [gameState, currentPlayerId]);

  // Animate dice result on the effect layer + highlight destination
  useEffect(() => {
    if (!diceResult || !screenEffectLayerRef.current || !tweenRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    let centerX = rect.width / 2;
    let centerY = rect.height / 2;

    // Position dice animation near the rolling player's piece
    if (playerLayerRef.current && stageRef.current) {
      const playerPos = playerLayerRef.current.getPlayerPosition(diceResult.playerId);
      if (playerPos) {
        // Convert world coords to screen coords via mainContainer transform
        const mc = stageRef.current.getMainContainer();
        const screenX = mc.x + (METRO_BOARD_WIDTH / 2 + playerPos.x) * mc.scale.x;
        const screenY = mc.y + (METRO_BOARD_HEIGHT / 2 + playerPos.y) * mc.scale.y;
        // Clamp to stay within canvas bounds with margin
        const margin = 50;
        centerX = Math.max(margin, Math.min(rect.width - margin, screenX));
        centerY = Math.max(margin, Math.min(rect.height - margin, screenY - 60));
      }
    }

    animateDiceResult(
      screenEffectLayerRef.current,
      diceResult.values,
      diceResult.total,
      tweenRef.current,
      centerX,
      centerY,
    );

    // Highlight destination cell
    if (stationLayerRef.current && gameState) {
      const roller = gameState.players.find(p => p.id === diceResult.playerId);
      if (roller) {
        const destKeys: string[] = [];
        if (roller.position.type === 'main') {
          const destIndex = (roller.position.index + diceResult.total) % MAIN_BOARD_SIZE;
          destKeys.push(`main:${destIndex}`);
        } else if (roller.position.type === 'line') {
          // On branch line: advance within the line
          const linePos = roller.position;
          const line = LINE_CONFIGS.find(l => l.id === linePos.lineId);
          if (line) {
            const destIndex = linePos.index + diceResult.total;
            if (destIndex < line.cellCount) {
              destKeys.push(`line:${linePos.lineId}:${destIndex}`);
            }
          }
        }
        if (destKeys.length > 0) {
          stationLayerRef.current.highlightCells(destKeys);
        }
      }
    }
  }, [diceResult]);

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
};

export default GameCanvas;
