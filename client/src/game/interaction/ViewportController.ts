// client/src/game/interaction/ViewportController.ts
// Controls PixiJS canvas viewport: zoom, pan, pinch-to-zoom, double-click reset, auto-focus.

import { Container } from 'pixi.js';
import { METRO_BOARD_WIDTH, METRO_BOARD_HEIGHT } from '../layout/MetroLayout';

// ============================================
// Constants
// ============================================

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const DEFAULT_ZOOM = 1.0;
const ZOOM_STEP = 0.1;
const PAN_ANIMATE_DURATION = 400; // ms
const DOUBLE_CLICK_THRESHOLD = 300; // ms
const PINCH_MIN_DISTANCE = 10; // minimum distance between two pointers to register

// ============================================
// Types
// ============================================

interface Point {
  x: number;
  y: number;
}

interface PointerState {
  id: number;
  x: number;
  y: number;
}

// ============================================
// ViewportController
// ============================================

export class ViewportController {
  private container: Container;
  private canvas: HTMLCanvasElement;
  private enabled = true;

  // Viewport state
  private scale = DEFAULT_ZOOM;
  private panX = 0;
  private panY = 0;
  private baseContainerX = 0;
  private baseContainerY = 0;
  private baseContainerScale = 1;

  // Drag state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartPanX = 0;
  private dragStartPanY = 0;

  // Pinch state
  private activePointers: Map<number, PointerState> = new Map();
  private initialPinchDistance = 0;
  private initialPinchScale = 1;

  // Double-click detection
  private lastClickTime = 0;
  private lastClickX = 0;
  private lastClickY = 0;

  // Animation
  private animationFrameId: number | null = null;

  // Bound event handlers (for clean removal)
  private onPointerDownBound: (e: PointerEvent) => void;
  private onPointerMoveBound: (e: PointerEvent) => void;
  private onPointerUpBound: (e: PointerEvent) => void;
  private onWheelBound: (e: WheelEvent) => void;

  constructor(container: Container, canvas: HTMLCanvasElement) {
    this.container = container;
    this.canvas = canvas;

    // Capture base position/scale from the container
    this.baseContainerX = container.x;
    this.baseContainerY = container.y;
    this.baseContainerScale = container.scale.x;

    // Bind event handlers
    this.onPointerDownBound = this.onPointerDown.bind(this);
    this.onPointerMoveBound = this.onPointerMove.bind(this);
    this.onPointerUpBound = this.onPointerUp.bind(this);
    this.onWheelBound = this.onWheel.bind(this);

    this.attachEvents();
  }

  // ============================================
  // Public API
  // ============================================

  /** Set zoom level, optionally centered on a screen coordinate. */
  setZoom(scale: number, centerX?: number, centerY?: number): void {
    const newScale = clamp(scale, MIN_ZOOM, MAX_ZOOM);
    if (newScale === this.scale) return;

    // If center is provided, adjust pan so that center point stays fixed
    if (centerX !== undefined && centerY !== undefined) {
      const rect = this.canvas.getBoundingClientRect();
      const canvasCenterX = rect.width / 2;
      const canvasCenterY = rect.height / 2;

      // The offset from screen center in world-space before zoom
      const worldOffsetX = (centerX - canvasCenterX - this.panX) / this.scale;
      const worldOffsetY = (centerY - canvasCenterY - this.panY) / this.scale;

      // After zoom, we want the same world point under the cursor
      this.panX = centerX - canvasCenterX - worldOffsetX * newScale;
      this.panY = centerY - canvasCenterY - worldOffsetY * newScale;
    }

    this.scale = newScale;
    this.applyTransform();
  }

  /** Reset zoom to 1x and center the viewport. */
  resetZoom(): void {
    this.cancelAnimation();
    const startScale = this.scale;
    const startPanX = this.panX;
    const startPanY = this.panY;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / PAN_ANIMATE_DURATION, 1);
      const eased = easeOutCubic(progress);

      this.scale = startScale + (DEFAULT_ZOOM - startScale) * eased;
      this.panX = startPanX + (0 - startPanX) * eased;
      this.panY = startPanY + (0 - startPanY) * eased;
      this.applyTransform();

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /** Pan to a specific offset (in screen pixels), optionally with smooth animation. */
  panTo(x: number, y: number, animate = false): void {
    if (!animate) {
      this.panX = x;
      this.panY = y;
      this.applyTransform();
      return;
    }

    this.cancelAnimation();
    const startPanX = this.panX;
    const startPanY = this.panY;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / PAN_ANIMATE_DURATION, 1);
      const eased = easeOutCubic(progress);

      this.panX = startPanX + (x - startPanX) * eased;
      this.panY = startPanY + (y - startPanY) * eased;
      this.applyTransform();

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  /** Focus the viewport on a world-space coordinate (e.g., a player's board position). */
  focusOnPlayer(worldX: number, worldY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;

    // Calculate the screen position of the world point accounting for current zoom
    const screenX = this.baseContainerX * this.scale + worldX * this.baseContainerScale * this.scale;
    const screenY = this.baseContainerY * this.scale + worldY * this.baseContainerScale * this.scale;

    // Pan needed to center that point
    const targetPanX = canvasCenterX - screenX;
    const targetPanY = canvasCenterY - screenY;

    this.panTo(targetPanX, targetPanY, true);
  }

  /** Enable all viewport interactions. */
  enable(): void {
    this.enabled = true;
  }

  /** Disable all viewport interactions. */
  disable(): void {
    this.enabled = false;
    this.isDragging = false;
    this.activePointers.clear();
  }

  /** Clean up all event listeners and cancel animations. */
  destroy(): void {
    this.cancelAnimation();
    this.detachEvents();
    this.activePointers.clear();
  }

  /** Get the current zoom scale. */
  getScale(): number {
    return this.scale;
  }

  // ============================================
  // Event Handlers
  // ============================================

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled) return;

    this.activePointers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

    if (this.activePointers.size === 1) {
      // Single pointer: start drag or detect double-click
      const now = performance.now();
      const dx = e.clientX - this.lastClickX;
      const dy = e.clientY - this.lastClickY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (now - this.lastClickTime < DOUBLE_CLICK_THRESHOLD && distance < 20) {
        // Double click/tap: reset zoom
        this.resetZoom();
        this.lastClickTime = 0;
        return;
      }

      this.lastClickTime = now;
      this.lastClickX = e.clientX;
      this.lastClickY = e.clientY;

      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragStartPanX = this.panX;
      this.dragStartPanY = this.panY;
      this.cancelAnimation();

      this.canvas.style.cursor = 'grabbing';
    } else if (this.activePointers.size === 2) {
      // Two pointers: start pinch-to-zoom
      this.isDragging = false;
      this.canvas.style.cursor = 'default';

      const pointers = Array.from(this.activePointers.values());
      this.initialPinchDistance = getDistance(pointers[0], pointers[1]);
      this.initialPinchScale = this.scale;
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.enabled) return;

    // Update pointer tracking
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
    }

    if (this.activePointers.size === 2) {
      // Pinch-to-zoom
      const pointers = Array.from(this.activePointers.values());
      const currentDistance = getDistance(pointers[0], pointers[1]);

      if (this.initialPinchDistance > PINCH_MIN_DISTANCE) {
        const scaleFactor = currentDistance / this.initialPinchDistance;
        const newScale = clamp(this.initialPinchScale * scaleFactor, MIN_ZOOM, MAX_ZOOM);
        const center = getMidpoint(pointers[0], pointers[1]);

        // Get canvas-relative coordinates
        const rect = this.canvas.getBoundingClientRect();
        const centerX = center.x - rect.left;
        const centerY = center.y - rect.top;

        this.setZoom(newScale, centerX, centerY);
      }
    } else if (this.isDragging && this.activePointers.size === 1) {
      // Single-pointer drag = pan
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      this.panX = this.dragStartPanX + dx;
      this.panY = this.dragStartPanY + dy;
      this.applyTransform();
    }
  }

  private onPointerUp(e: PointerEvent): void {
    this.activePointers.delete(e.pointerId);

    if (this.activePointers.size === 0) {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    } else if (this.activePointers.size === 1) {
      // Switching from pinch back to single-pointer
      const remaining = Array.from(this.activePointers.values())[0];
      this.isDragging = true;
      this.dragStartX = remaining.x;
      this.dragStartY = remaining.y;
      this.dragStartPanX = this.panX;
      this.dragStartPanY = this.panY;
    }
  }

  private onWheel(e: WheelEvent): void {
    if (!this.enabled) return;
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const direction = e.deltaY < 0 ? 1 : -1;
    const newScale = clamp(this.scale + direction * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);

    this.setZoom(newScale, cursorX, cursorY);
  }

  // ============================================
  // Internal Helpers
  // ============================================

  /** Apply current scale and pan offset to the PixiJS container. */
  private applyTransform(): void {
    // Soft pan limits: prevent dragging the board entirely out of view
    const maxPanX = (METRO_BOARD_WIDTH * this.baseContainerScale * this.scale) / 2;
    const maxPanY = (METRO_BOARD_HEIGHT * this.baseContainerScale * this.scale) / 2;
    this.panX = clamp(this.panX, -maxPanX, maxPanX);
    this.panY = clamp(this.panY, -maxPanY, maxPanY);

    const effectiveScale = this.baseContainerScale * this.scale;
    this.container.scale.set(effectiveScale);
    this.container.x = this.baseContainerX * this.scale + this.panX;
    this.container.y = this.baseContainerY * this.scale + this.panY;
  }

  /** Cancel any running animation. */
  private cancelAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /** Attach pointer and wheel events to the canvas. */
  private attachEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDownBound);
    this.canvas.addEventListener('pointermove', this.onPointerMoveBound);
    this.canvas.addEventListener('pointerup', this.onPointerUpBound);
    this.canvas.addEventListener('pointercancel', this.onPointerUpBound);
    this.canvas.addEventListener('pointerleave', this.onPointerUpBound);
    this.canvas.addEventListener('wheel', this.onWheelBound, { passive: false });

    this.canvas.style.touchAction = 'none';
    this.canvas.style.cursor = 'grab';
  }

  /** Remove all event listeners from the canvas. */
  private detachEvents(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDownBound);
    this.canvas.removeEventListener('pointermove', this.onPointerMoveBound);
    this.canvas.removeEventListener('pointerup', this.onPointerUpBound);
    this.canvas.removeEventListener('pointercancel', this.onPointerUpBound);
    this.canvas.removeEventListener('pointerleave', this.onPointerUpBound);
    this.canvas.removeEventListener('wheel', this.onWheelBound);
  }
}

// ============================================
// Utility Functions
// ============================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function getDistance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getMidpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}
