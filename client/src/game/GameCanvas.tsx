// client/src/game/GameCanvas.tsx
// Thin React wrapper (~90 lines) that manages PixiJS Application lifecycle
// and delegates rendering to the layered GameStage architecture.

import React, { useRef, useEffect } from 'react';
import { Application } from 'pixi.js';
import type { GameState, Position } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../styles/tokens';

import { GameStage } from './GameStage';
import { BackgroundLayer } from './layers/BackgroundLayer';
import { BoardLayer } from './layers/BoardLayer';
import { LineLayer } from './layers/LineLayer';
import { PlayerLayer } from './layers/PlayerLayer';

interface GameCanvasProps {
  gameState: GameState;
  currentPlayerId: string | null;
  onCellClick?: (cellId: string, position: Position) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  currentPlayerId,
  onCellClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const stageRef = useRef<GameStage | null>(null);

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
      backgroundColor: 0xf0f0f0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      container.appendChild(app.canvas);
      appRef.current = app;

      // Build the layered stage
      const stage = new GameStage();
      stage.addLayer(new BackgroundLayer());
      stage.addLayer(new LineLayer());
      stage.addLayer(new BoardLayer({ onCellClick }));
      stage.addLayer(new PlayerLayer());
      stage.init(app, rect.width, rect.height);

      stageRef.current = stage;

      console.log('[GameCanvas] PixiJS initialized with layered renderer');
    }).catch(err => {
      console.error('[GameCanvas] Init error:', err);
    });

    return () => {
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
        backgroundColor: '#f0f0f0',
        borderRadius: DESIGN_TOKENS.radius.lg,
        overflow: 'hidden',
      }}
    />
  );
};

export default GameCanvas;
