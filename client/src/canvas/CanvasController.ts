// client/src/canvas/CanvasController.ts

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface Point {
  x: number;
  y: number;
}

export class CanvasController {
  private viewport: Viewport = { x: 0, y: 0, scale: 1 };
  private isDragging = false;
  private lastMouse: Point = { x: 0, y: 0 };
  private lastTouchDist = 0;
  private lastTouchCenter: Point = { x: 0, y: 0 };
  private canvas: HTMLCanvasElement;
  private onViewportChange: (vp: Viewport) => void;
  private onHover?: (screenPos: Point, boardPos: Point) => void;
  private onClick?: (boardPos: Point) => void;

  // Zoom limits
  private readonly MIN_SCALE = 0.5;
  private readonly MAX_SCALE = 3;
  private readonly ZOOM_FACTOR = 0.1;

  constructor(
    canvas: HTMLCanvasElement,
    onViewportChange: (vp: Viewport) => void,
    options?: {
      onHover?: (screenPos: Point, boardPos: Point) => void;
      onClick?: (boardPos: Point) => void;
    }
  ) {
    this.canvas = canvas;
    this.onViewportChange = onViewportChange;
    this.onHover = options?.onHover;
    this.onClick = options?.onClick;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('mouseleave', this.onMouseLeave);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });

    // Touch events
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd);
  }

  public destroy(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
  }

  // === Getters/Setters ===

  public getViewport(): Viewport {
    return { ...this.viewport };
  }

  public setViewport(vp: Partial<Viewport>): void {
    if (vp.x !== undefined) this.viewport.x = vp.x;
    if (vp.y !== undefined) this.viewport.y = vp.y;
    if (vp.scale !== undefined) {
      this.viewport.scale = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, vp.scale));
    }
    this.onViewportChange({ ...this.viewport });
  }

  public reset(): void {
    this.viewport = { x: 0, y: 0, scale: 1 };
    this.onViewportChange({ ...this.viewport });
  }

  // === Coordinate Conversion ===

  public screenToBoard(screenX: number, screenY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left - rect.width / 2) / this.viewport.scale + this.viewport.x,
      y: (screenY - rect.top - rect.height / 2) / this.viewport.scale + this.viewport.y,
    };
  }

  public boardToScreen(boardX: number, boardY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (boardX - this.viewport.x) * this.viewport.scale + rect.width / 2,
      y: (boardY - this.viewport.y) * this.viewport.scale + rect.height / 2,
    };
  }

  // === Mouse Event Handlers ===

  private onMouseDown = (e: MouseEvent): void => {
    this.isDragging = true;
    this.lastMouse = { x: e.clientX, y: e.clientY };
    this.canvas.style.cursor = 'grabbing';
  };

  private onMouseMove = (e: MouseEvent): void => {
    const screenPos = { x: e.clientX, y: e.clientY };

    if (this.isDragging) {
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.viewport.x -= dx / this.viewport.scale;
      this.viewport.y -= dy / this.viewport.scale;
      this.lastMouse = screenPos;
      this.onViewportChange({ ...this.viewport });
    } else {
      // Hover detection
      const boardPos = this.screenToBoard(e.clientX, e.clientY);
      this.onHover?.(screenPos, boardPos);
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (this.isDragging) {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';

      // Detect click (minimal movement)
      const dx = Math.abs(e.clientX - this.lastMouse.x);
      const dy = Math.abs(e.clientY - this.lastMouse.y);
      if (dx < 5 && dy < 5) {
        const boardPos = this.screenToBoard(e.clientX, e.clientY);
        this.onClick?.(boardPos);
      }
    }
  };

  private onMouseLeave = (): void => {
    this.isDragging = false;
    this.canvas.style.cursor = 'grab';
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();

    // Get mouse position for zoom centering
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    // Calculate board position before zoom
    const boardX = mouseX / this.viewport.scale + this.viewport.x;
    const boardY = mouseY / this.viewport.scale + this.viewport.y;

    // Apply zoom
    const zoomDelta = e.deltaY > 0 ? -this.ZOOM_FACTOR : this.ZOOM_FACTOR;
    const newScale = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, this.viewport.scale + zoomDelta));

    // Adjust viewport to zoom toward mouse position
    this.viewport.x = boardX - mouseX / newScale;
    this.viewport.y = boardY - mouseY / newScale;
    this.viewport.scale = newScale;

    this.onViewportChange({ ...this.viewport });
  };

  // === Touch Event Handlers ===

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();

    if (e.touches.length === 1) {
      // Single touch - start drag
      this.isDragging = true;
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      // Pinch start
      this.isDragging = false;
      this.lastTouchDist = this.getTouchDistance(e.touches);
      this.lastTouchCenter = this.getTouchCenter(e.touches);
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();

    if (e.touches.length === 1 && this.isDragging) {
      // Single touch drag
      const touch = e.touches[0];
      const dx = touch.clientX - this.lastMouse.x;
      const dy = touch.clientY - this.lastMouse.y;
      this.viewport.x -= dx / this.viewport.scale;
      this.viewport.y -= dy / this.viewport.scale;
      this.lastMouse = { x: touch.clientX, y: touch.clientY };
      this.onViewportChange({ ...this.viewport });
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const newDist = this.getTouchDistance(e.touches);
      const newCenter = this.getTouchCenter(e.touches);

      if (this.lastTouchDist > 0) {
        // Calculate zoom
        const scaleDelta = newDist / this.lastTouchDist;
        const newScale = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, this.viewport.scale * scaleDelta));

        // Calculate pan from center movement
        const rect = this.canvas.getBoundingClientRect();
        const centerX = newCenter.x - rect.left - rect.width / 2;
        const centerY = newCenter.y - rect.top - rect.height / 2;

        // Adjust viewport
        const boardX = centerX / this.viewport.scale + this.viewport.x;
        const boardY = centerY / this.viewport.scale + this.viewport.y;
        this.viewport.x = boardX - centerX / newScale;
        this.viewport.y = boardY - centerY / newScale;
        this.viewport.scale = newScale;

        this.onViewportChange({ ...this.viewport });
      }

      this.lastTouchDist = newDist;
      this.lastTouchCenter = newCenter;
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length === 0) {
      this.isDragging = false;
      this.lastTouchDist = 0;
    } else if (e.touches.length === 1) {
      // Switch from pinch to single touch drag
      this.isDragging = true;
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  // === Touch Helpers ===

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getTouchCenter(touches: TouchList): Point {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }
}
