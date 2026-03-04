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

      stage.init(app, rect.width, rect.height);

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

  // Push state updates to the stage
  useEffect(() => {
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

  // Handle viewport resize
  useEffect(() => {
    const handleResize = () => {
      const app = appRef.current;
      const container = containerRef.current;
      if (!app || !container) return;

      const rect = container.getBoundingClientRect();
      app.renderer.resize(rect.width, rect.height);
      stageRef.current?.resize(rect.width, rect.height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        backgroundColor: '#0F0A1A',
        borderRadius: DESIGN_TOKENS.radius.lg,
        overflow: 'hidden',
      }}
    />
  );
};

export default GameCanvas;
