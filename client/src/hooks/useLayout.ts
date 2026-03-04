// client/src/hooks/useLayout.ts
// Layout detection hook and helpers for responsive breakpoints

import { useEffect, useState } from 'react';
import { DESIGN_TOKENS } from '../styles/tokens';

export type LayoutMode = 'desktop' | 'tablet' | 'mobile';

export const BREAKPOINT_MOBILE = DESIGN_TOKENS.breakpoint.mobile;  // 768
export const BREAKPOINT_TABLET = DESIGN_TOKENS.breakpoint.tablet;   // 1024

export function getLayout(width: number): LayoutMode {
  if (width >= BREAKPOINT_TABLET) return 'desktop';
  if (width >= BREAKPOINT_MOBILE) return 'tablet';
  return 'mobile';
}

export function useLayout(): LayoutMode {
  const [layout, setLayout] = useState<LayoutMode>(() => getLayout(window.innerWidth));

  useEffect(() => {
    let rafId: number;
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setLayout(getLayout(window.innerWidth));
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return layout;
}
