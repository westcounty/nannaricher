// client/src/game/GameCanvas.tsx
// Thin React wrapper (~90 lines) that manages PixiJS Application lifecycle
// and delegates rendering to the layered GameStage architecture.

import React, { useRef, useEffect } from 'react';
import { Application, Container } from 'pixi.js';
import type { GameState, Position } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../styles/tokens';

import { GameStage } from './GameStage';
import { BackgroundLayer } from './layers/BackgroundLayer';
import { BoardLayer } from './layers/BoardLayer';
import { LineLayer } from './layers/LineLayer';
import { PlayerLayer } from './layers/PlayerLayer';
import { TweenEngine } from './animations/TweenEngine';
import { ViewportController } from './interaction/ViewportController';
import { animateDiceResult } from './animations/DiceRollAnim';
import { showFloatingText } from './animations/FloatingText';
import { playSound } from '../audio/AudioManager';

interface GameCanvasProps {
  gameState: GameState;
  currentPlayerId: string | null;
  diceResult?: { playerId: string; values: number[]; total: number } | null;
  onCellClick?: (cellId: string, position: Position) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  currentPlayerId,
  diceResult,
  onCellClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const stageRef = useRef<GameStage | null>(null);
  const playerLayerRef = useRef<PlayerLayer | null>(null);
  const tweenRef = useRef<TweenEngine | null>(null);
  const effectLayerRef = useRef<Container | null>(null);
  const viewportRef = useRef<ViewportController | null>(null);
  const prevStateRef = useRef<GameState | null>(null);

  // Initialize PixiJS Application + layered stage
  useEffect(() => {
    const container = containerRef.current;
    if (!container || appRef.current) return;

    let cancelled = false;

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
      if (cancelled) { app.destroy(true); return; }
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
      stage.addLayer(new BackgroundLayer());
      stage.addLayer(new LineLayer());
      stage.addLayer(new BoardLayer({ onCellClick }));

      // Create PlayerLayer with animation support
      const playerLayer = new PlayerLayer();
      stage.addLayer(playerLayer);
      playerLayerRef.current = playerLayer;

      stage.init(app, w, h);

      // Create effect layer ON TOP of everything (after stage.init so it's above all layers)
      const effectContainer = new Container();
      app.stage.addChild(effectContainer);
      effectLayerRef.current = effectContainer;

      // Inject animation dependencies into PlayerLayer
      playerLayer.setAnimationDeps(tweenEngine, effectContainer);

      stageRef.current = stage;

      // Create ViewportController for zoom/pan
      const mainContainer = stage.getMainContainer();
      const vc = new ViewportController(mainContainer, app.canvas as HTMLCanvasElement);
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
      cancelled = true;
      // Destroy ViewportController
      viewportRef.current?.destroy();
      viewportRef.current = null;

      // Destroy TweenEngine
      tweenRef.current?.destroy();
      tweenRef.current = null;

      // Destroy effect layer
      if (effectLayerRef.current) {
        if (effectLayerRef.current.parent) {
          effectLayerRef.current.parent.removeChild(effectLayerRef.current);
        }
        effectLayerRef.current.destroy({ children: true });
        effectLayerRef.current = null;
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
    if (prevStateRef.current && effectLayerRef.current && playerLayerRef.current) {
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
          showFloatingText(effectLayerRef.current!, pos.x, pos.y - 30, text, color);
          if (player.id === currentPlayerId) {
            playSound(delta > 0 ? 'coin_gain' : 'coin_loss');
          }
        }

        // GPA change
        if (player.gpa !== prevPlayer.gpa) {
          const delta = player.gpa - prevPlayer.gpa;
          const text = `GPA ${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
          const color = '#60a5fa';
          showFloatingText(effectLayerRef.current!, pos.x, pos.y - 50, text, color);
          if (player.id === currentPlayerId) {
            playSound(delta > 0 ? 'gpa_up' : 'gpa_down');
          }
        }

        // Exploration change
        if (player.exploration !== prevPlayer.exploration) {
          const delta = player.exploration - prevPlayer.exploration;
          const text = `探索 ${delta > 0 ? '+' : ''}${delta}`;
          const color = '#fbbf24';
          showFloatingText(effectLayerRef.current!, pos.x, pos.y - 70, text, color);
          if (player.id === currentPlayerId) {
            playSound('explore_up');
          }
        }
      }
    }
    prevStateRef.current = gameState;

    stageRef.current?.updateState(gameState, currentPlayerId);
  }, [gameState, currentPlayerId]);

  // Animate dice result on the effect layer
  useEffect(() => {
    if (!diceResult || !effectLayerRef.current || !tweenRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    animateDiceResult(
      effectLayerRef.current,
      diceResult.values,
      diceResult.total,
      tweenRef.current,
      centerX,
      centerY,
    );
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

    // Use ResizeObserver to detect container size changes (CSS layout settling, flex recalc, etc.)
    const ro = new ResizeObserver(() => {
      handleResize();
    });
    ro.observe(container);

    // Also handle window resize as fallback
    window.addEventListener('resize', handleResize);
    return () => {
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
