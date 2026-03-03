// client/src/game/pieces/Dice.tsx
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Container, Graphics, Text } from '@pixi/react';
import { Graphics as PixiGraphics, TextStyle } from 'pixi.js';

interface DiceProps {
  values: number[];
  isRolling: boolean;
  onRollComplete?: (values: number[]) => void;
  x?: number;
  y?: number;
}

export const Dice: React.FC<DiceProps> = ({
  values,
  isRolling,
  onRollComplete,
  x = 0,
  y = 0,
}) => {
  const [displayValues, setDisplayValues] = useState(values);
  const [rotation, setRotation] = useState(0);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 滚动动画
  useEffect(() => {
    if (isRolling) {
      let frame = 0;
      rollIntervalRef.current = setInterval(() => {
        // 随机显示值
        setDisplayValues([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ].slice(0, values.length));
        setRotation(frame * 30);
        frame++;

        if (frame >= 30) { // 1.5秒后停止
          if (rollIntervalRef.current) {
            clearInterval(rollIntervalRef.current);
          }
          setDisplayValues(values);
          setRotation(0);
          onRollComplete?.(values);
        }
      }, 50);
    }

    return () => {
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
      }
    };
  }, [isRolling, values, onRollComplete]);

  return (
    <Container x={x} y={y} rotation={rotation * Math.PI / 180}>
      {displayValues.map((value, index) => (
        <DiceFace
          key={index}
          value={value}
          x={index * 60 - (displayValues.length - 1) * 30}
          y={0}
        />
      ))}
    </Container>
  );
};

interface DiceFaceProps {
  value: number;
  x: number;
  y: number;
}

const DiceFace: React.FC<DiceFaceProps> = ({ value, x, y }) => {
  const drawFace = useCallback((g: PixiGraphics) => {
    g.clear();

    // 骰子背景
    g.beginFill(0xffffff);
    g.drawRoundedRect(-25, -25, 50, 50, 8);
    g.endFill();

    // 边框
    g.lineStyle(2, 0x333333);
    g.drawRoundedRect(-25, -25, 50, 50, 8);

    // 点数
    g.beginFill(0x333333);
    const dotPositions = getDotPositions(value);
    for (const pos of dotPositions) {
      g.drawCircle(pos.x, pos.y, 5);
    }
    g.endFill();
  }, [value]);

  return (
    <Container x={x} y={y}>
      <Graphics draw={drawFace} />
    </Container>
  );
};

// 获取骰子点数位置
function getDotPositions(value: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const offset = 12;

  switch (value) {
    case 1:
      positions.push({ x: 0, y: 0 });
      break;
    case 2:
      positions.push({ x: -offset, y: -offset });
      positions.push({ x: offset, y: offset });
      break;
    case 3:
      positions.push({ x: -offset, y: -offset });
      positions.push({ x: 0, y: 0 });
      positions.push({ x: offset, y: offset });
      break;
    case 4:
      positions.push({ x: -offset, y: -offset });
      positions.push({ x: offset, y: -offset });
      positions.push({ x: -offset, y: offset });
      positions.push({ x: offset, y: offset });
      break;
    case 5:
      positions.push({ x: -offset, y: -offset });
      positions.push({ x: offset, y: -offset });
      positions.push({ x: 0, y: 0 });
      positions.push({ x: -offset, y: offset });
      positions.push({ x: offset, y: offset });
      break;
    case 6:
      positions.push({ x: -offset, y: -offset });
      positions.push({ x: offset, y: -offset });
      positions.push({ x: -offset, y: 0 });
      positions.push({ x: offset, y: 0 });
      positions.push({ x: -offset, y: offset });
      positions.push({ x: offset, y: offset });
      break;
  }

  return positions;
}
