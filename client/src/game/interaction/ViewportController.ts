// client/src/game/interaction/ViewportController.ts
// Controls PixiJS canvas viewport: zoom, pan, pinch-to-zoom, double-click reset, auto-focus.

import { Container } from 'pixi.js';
import { METRO_BOARD_WIDTH, METRO_BOARD_HEIGHT } from '../layout/MetroLayout';

// ============================================
// Constants
// ============================================

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5.0;
const DEFAULT_ZOOM = 3.5;
const ZOOM_STEP = 0.1;
const PAN_ANIMATE_DURATION = 400; // ms
const DOUBLE_CLICK_THRESHOLD = 300; // ms
const PINCH_MIN_DISTANCE = 10; // minimum distance between two pointers to register
const DRAG_THRESHOLD = 5; // pixels of movement before drag activates (prevents click swallowing)

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

  // Pinch zoom momentum
  private lastPinchScale = 0;
  private pinchVelocity = 0;
  private lastPinchTime = 0;
  private pinchMomentumFrameId: number | null = null;
  private lastPinchCenter: Point = { x: 0, y: 0 };

  // Drag momentum / snap-back
  private snapBackFrameId: number | null = null;

  // Animation
  private animationFrameId: number | null = null;

  // Bound event handlers (for clean removal)
  private onPointerDownBound: (e: PointerEvent) => void;
  private onPointerMoveBound: (e: PointerEvent) => void;
  private onPointerUpBound: (e: PointerEvent) => void;
  private onWheelBound: (e: WheelEvent) => void;
  private onKeyDownBound: (e: KeyboardEvent) => void;

  // Optional callback for Home key (focus on current player)
  public onFocusRequest?: () => void;

  // Zoom change callbacks (for LOD rendering)
  private _onZoomChangeCallbacks: ((zoom: number) => void)[] = [];

  /** Register a callback to be invoked whenever the zoom level changes. */
  public onZoomChange(cb: (zoom: number) => void): void {
    this._onZoomChangeCallbacks.push(cb);
  }

  /** Notify all zoom-change listeners of the current zoom level. */
  private notifyZoomChange(): void {
    const zoom = this.scale;
    for (const cb of this._onZoomChangeCallbacks) {
      cb(zoom);
    }
  }

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
    this.onKeyDownBound = this.onKeyDown.bind(this);

    this.attachEvents();
    this.centerOnBoard();
  }

  /** Center the viewport on the board. */
  centerOnBoard(): void {
    const rect = this.canvas.getBoundingClientRect();
    const centerX = METRO_BOARD_WIDTH / 2;
    const centerY = METRO_BOARD_HEIGHT / 2;
    this.panX = rect.width / 2 - (this.baseContainerX + centerX * this.baseContainerScale) * this.scale;
    this.panY = rect.height / 2 - (this.baseContainerY + centerY * this.baseContainerScale) * this.scale;
    this.applyTransform();
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

  /** Reset zoom to default level and trigger focus request (centers on current player). */
  resetZoom(): void {
    // If we have a focus request callback, use focusOnSelf instead
    if (this.onFocusRequest) {
      this.onFocusRequest();
      return;
    }

    // Fallback: animate to default zoom centered on board
    this.cancelAnimation();
    const startScale = this.scale;
    const startPanX = this.panX;
    const startPanY = this.panY;
    const startTime = performance.now();

    const rect = this.canvas.getBoundingClientRect();
    const centerX = METRO_BOARD_WIDTH / 2;
    const centerY = METRO_BOARD_HEIGHT / 2;
    const targetPanX = rect.width / 2 - (this.baseContainerX + centerX * this.baseContainerScale) * DEFAULT_ZOOM;
    const targetPanY = rect.height / 2 - (this.baseContainerY + centerY * this.baseContainerScale) * DEFAULT_ZOOM;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / PAN_ANIMATE_DURATION, 1);
      const eased = easeOutCubic(progress);

      this.scale = startScale + (DEFAULT_ZOOM - startScale) * eased;
      this.panX = startPanX + (targetPanX - startPanX) * eased;
      this.panY = startPanY + (targetPanY - startPanY) * eased;
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

  /** Focus on self: reset zoom to default level and center on a world-space coordinate. */
  focusOnSelf(worldX: number, worldY: number): void {
    this.cancelAnimation();
    const rect = this.canvas.getBoundingClientRect();
    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;

    const startScale = this.scale;
    const startPanX = this.panX;
    const startPanY = this.panY;

    const targetScale = DEFAULT_ZOOM;
    const screenX = this.baseContainerX * targetScale + worldX * this.baseContainerScale * targetScale;
    const screenY = this.baseContainerY * targetScale + worldY * this.baseContainerScale * targetScale;
    const targetPanX = canvasCenterX - screenX;
    const targetPanY = canvasCenterY - screenY;

    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / PAN_ANIMATE_DURATION, 1);
      const eased = easeOutCubic(progress);

      this.scale = startScale + (targetScale - startScale) * eased;
      this.panX = startPanX + (targetPanX - startPanX) * eased;
      this.panY = startPanY + (targetPanY - startPanY) * eased;
      this.applyTransform();

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /** Set interaction enabled state (for disabling during modals). */
  setInteractionEnabled(enabled: boolean): void {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
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
    if (this.pinchMomentumFrameId !== null) {
      cancelAnimationFrame(this.pinchMomentumFrameId);
      this.pinchMomentumFrameId = null;
    }
    if (this.snapBackFrameId !== null) {
      cancelAnimationFrame(this.snapBackFrameId);
      this.snapBackFrameId = null;
    }
    this.detachEvents();
    this.activePointers.clear();
  }

  /** Get the current zoom scale. */
  getScale(): number {
    return this.scale;
  }

  /**
   * Update cached base transform after external resize changes the container.
   * Preserves the current world-space focus point so the view doesn't jump.
   */
  updateBaseTransform(): void {
    const rect = this.canvas.getBoundingClientRect();
    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;

    // Calculate the world point currently at screen center (using OLD base values)
    const oldEffectiveScale = this.baseContainerScale * this.scale;
    const worldFocusX = (canvasCenterX - this.panX - this.baseContainerX * this.scale) / oldEffectiveScale;
    const worldFocusY = (canvasCenterY - this.panY - this.baseContainerY * this.scale) / oldEffectiveScale;

    // Read new base values from the resized container
    this.baseContainerX = this.container.x;
    this.baseContainerY = this.container.y;
    this.baseContainerScale = this.container.scale.x;

    // Recalculate pan so the same world point stays at screen center
    const newEffectiveScale = this.baseContainerScale * this.scale;
    this.panX = canvasCenterX - this.baseContainerX * this.scale - worldFocusX * newEffectiveScale;
    this.panY = canvasCenterY - this.baseContainerY * this.scale - worldFocusY * newEffectiveScale;

    this.applyTransform();
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
        // Double click/tap: zoom to point or zoom out if already zoomed in
        this.lastClickTime = 0;
        const rect = this.canvas.getBoundingClientRect();
        const tapX = e.clientX - rect.left;
        const tapY = e.clientY - rect.top;
        const targetZoom = this.scale < 2 ? 3.0 : 1.5;
        this.animateZoomToPoint(tapX, tapY, targetZoom);
        return;
      }

      this.lastClickTime = now;
      this.lastClickX = e.clientX;
      this.lastClickY = e.clientY;

      this.isDragging = false; // Don't activate drag until threshold exceeded
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragStartPanX = this.panX;
      this.dragStartPanY = this.panY;
      this.cancelAnimation();
      this.canvas.setPointerCapture(e.pointerId);
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

        // Track zoom velocity for momentum
        const now = performance.now();
        if (this.lastPinchTime > 0) {
          const dt = now - this.lastPinchTime;
          if (dt > 0) {
            this.pinchVelocity = (newScale - this.lastPinchScale) / dt * 16; // normalize to ~per-frame
          }
        }
        this.lastPinchScale = newScale;
        this.lastPinchTime = now;
        this.lastPinchCenter = { x: centerX, y: centerY };

        this.setZoom(newScale, centerX, centerY);
      }
    } else if (this.activePointers.size === 1) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      if (!this.isDragging) {
        // Check if movement exceeds drag threshold
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= DRAG_THRESHOLD) {
          this.isDragging = true;
          this.canvas.style.cursor = 'grabbing';
        }
      }

      if (this.isDragging) {
        // Single-pointer drag = pan
        this.panX = this.dragStartPanX + dx;
        this.panY = this.dragStartPanY + dy;
        this.applyTransform();
      }
    }
  }

  private onPointerUp(e: PointerEvent): void {
    const wasPinching = this.activePointers.size === 2;
    const wasDragging = this.isDragging;
    this.activePointers.delete(e.pointerId);

    if (this.activePointers.size === 0) {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';

      // Apply zoom momentum if we just finished a pinch
      if (wasPinching && Math.abs(this.pinchVelocity) > 0.001) {
        this.applyZoomMomentum(this.pinchVelocity, this.lastPinchCenter.x, this.lastPinchCenter.y);
      }
      this.pinchVelocity = 0;
      this.lastPinchTime = 0;

      // Snap back to bounds if dragged past limits (rubber-band effect)
      if (wasDragging) {
        this.snapToBounds();
      }
    } else if (this.activePointers.size === 1) {
      // Switching from pinch back to single-pointer
      const remaining = Array.from(this.activePointers.values())[0];
      this.isDragging = true;
      this.dragStartX = remaining.x;
      this.dragStartY = remaining.y;
      this.dragStartPanX = this.panX;
      this.dragStartPanY = this.panY;
      // Reset pinch momentum tracking
      this.pinchVelocity = 0;
      this.lastPinchTime = 0;
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

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;

    const PAN_STEP = 50;
    switch (e.key) {
      case '+':
      case '=':
        e.preventDefault();
        this.setZoom(this.scale + ZOOM_STEP);
        break;
      case '-':
        e.preventDefault();
        this.setZoom(this.scale - ZOOM_STEP);
        break;
      case '0':
        e.preventDefault();
        this.resetZoom();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.panTo(this.panX + PAN_STEP, this.panY);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.panTo(this.panX - PAN_STEP, this.panY);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.panTo(this.panX, this.panY + PAN_STEP);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.panTo(this.panX, this.panY - PAN_STEP);
        break;
      case 'Home':
        e.preventDefault();
        this.onFocusRequest?.();
        break;
    }
  }

  // ============================================
  // Internal Helpers
  // ============================================

  /** Animate zoom to a specific level centered on a screen point. */
  private animateZoomToPoint(screenX: number, screenY: number, targetZoom: number): void {
    this.cancelAnimation();
    const startScale = this.scale;
    const startPanX = this.panX;
    const startPanY = this.panY;
    const startTime = performance.now();

    const rect = this.canvas.getBoundingClientRect();
    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;

    // Calculate world point under the tap
    const worldX = (screenX - canvasCenterX - this.panX) / this.scale;
    const worldY = (screenY - canvasCenterY - this.panY) / this.scale;

    // Target pan so the same world point stays under the tap position
    const targetPanX = screenX - canvasCenterX - worldX * targetZoom;
    const targetPanY = screenY - canvasCenterY - worldY * targetZoom;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / PAN_ANIMATE_DURATION, 1);
      const eased = easeOutCubic(progress);

      this.scale = startScale + (targetZoom - startScale) * eased;
      this.panX = startPanX + (targetPanX - startPanX) * eased;
      this.panY = startPanY + (targetPanY - startPanY) * eased;
      this.applyTransform();

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /** Apply zoom momentum after pinch gesture ends. */
  private applyZoomMomentum(lastVelocity: number, centerX: number, centerY: number): void {
    if (Math.abs(lastVelocity) < 0.001) return;
    if (this.pinchMomentumFrameId !== null) {
      cancelAnimationFrame(this.pinchMomentumFrameId);
    }
    let velocity = lastVelocity * 0.5; // dampen initial
    const decay = () => {
      velocity *= 0.9;
      if (Math.abs(velocity) < 0.001) {
        this.pinchMomentumFrameId = null;
        return;
      }
      const newScale = clamp(this.scale + velocity, MIN_ZOOM, MAX_ZOOM);
      if (newScale !== this.scale) {
        this.setZoom(newScale, centerX, centerY);
      }
      this.pinchMomentumFrameId = requestAnimationFrame(decay);
    };
    this.pinchMomentumFrameId = requestAnimationFrame(decay);
  }

  /** Rubber-band effect: allow dragging past bounds with elastic resistance. */
  private rubberBand(value: number, min: number, max: number, elasticity: number = 0.3): number {
    if (value < min) return min + (value - min) * elasticity;
    if (value > max) return max + (value - max) * elasticity;
    return value;
  }

  /** Snap pan back to valid bounds with an animated tween. */
  private snapToBounds(): void {
    const boardScreenW = METRO_BOARD_WIDTH * this.baseContainerScale * this.scale;
    const boardScreenH = METRO_BOARD_HEIGHT * this.baseContainerScale * this.scale;
    const rect = this.canvas.getBoundingClientRect();
    const marginX = Math.max(rect.width * 0.8, boardScreenW);
    const marginY = Math.max(rect.height * 0.8, boardScreenH);

    const clampedX = clamp(this.panX, -marginX, marginX);
    const clampedY = clamp(this.panY, -marginY, marginY);

    // If already in bounds, nothing to do
    if (clampedX === this.panX && clampedY === this.panY) return;

    if (this.snapBackFrameId !== null) {
      cancelAnimationFrame(this.snapBackFrameId);
    }

    const startX = this.panX;
    const startY = this.panY;
    const startTime = performance.now();
    const duration = 250;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);

      this.panX = startX + (clampedX - startX) * eased;
      this.panY = startY + (clampedY - startY) * eased;
      this.applyTransform(true); // skip rubber-band during snap-back

      if (progress < 1) {
        this.snapBackFrameId = requestAnimationFrame(animate);
      } else {
        this.snapBackFrameId = null;
      }
    };

    this.snapBackFrameId = requestAnimationFrame(animate);
  }

  /** Apply current scale and pan offset to the PixiJS container. */
  private applyTransform(hardClamp = false): void {
    // Soft pan limits: allow centering on any board position while preventing
    // the board from being dragged completely off-screen.
    // Use the full rendered board extent (not half) so edge positions can be centered.
    const boardScreenW = METRO_BOARD_WIDTH * this.baseContainerScale * this.scale;
    const boardScreenH = METRO_BOARD_HEIGHT * this.baseContainerScale * this.scale;
    const rect = this.canvas.getBoundingClientRect();
    const marginX = Math.max(rect.width * 0.8, boardScreenW);
    const marginY = Math.max(rect.height * 0.8, boardScreenH);
    if (hardClamp || !this.isDragging) {
      this.panX = clamp(this.panX, -marginX, marginX);
      this.panY = clamp(this.panY, -marginY, marginY);
    } else {
      // Rubber-band effect during active drag
      this.panX = this.rubberBand(this.panX, -marginX, marginX);
      this.panY = this.rubberBand(this.panY, -marginY, marginY);
    }

    const effectiveScale = this.baseContainerScale * this.scale;
    this.container.scale.set(effectiveScale);
    this.container.x = this.baseContainerX * this.scale + this.panX;
    this.container.y = this.baseContainerY * this.scale + this.panY;

    this.notifyZoomChange();
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
    this.canvas.addEventListener('lostpointercapture', this.onPointerUpBound);
    this.canvas.addEventListener('wheel', this.onWheelBound, { passive: false });
    // Keyboard navigation (canvas must be focusable)
    if (!this.canvas.hasAttribute('tabindex')) {
      this.canvas.setAttribute('tabindex', '0');
    }
    this.canvas.addEventListener('keydown', this.onKeyDownBound);

    this.canvas.style.touchAction = 'none';
    this.canvas.style.cursor = 'grab';
  }

  /** Remove all event listeners from the canvas. */
  private detachEvents(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDownBound);
    this.canvas.removeEventListener('pointermove', this.onPointerMoveBound);
    this.canvas.removeEventListener('pointerup', this.onPointerUpBound);
    this.canvas.removeEventListener('pointercancel', this.onPointerUpBound);
    this.canvas.removeEventListener('lostpointercapture', this.onPointerUpBound);
    this.canvas.removeEventListener('wheel', this.onWheelBound);
    this.canvas.removeEventListener('keydown', this.onKeyDownBound);
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
