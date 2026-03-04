// client/src/ui/layouts/ResponsiveLayout.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

interface ResponsiveContextValue {
  breakpoint: Breakpoint;
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

// 断点配置
const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
};

const ResponsiveContext = createContext<ResponsiveContextValue>({
  breakpoint: 'desktop',
  width: 1024,
  height: 768,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
});

export const useResponsive = () => useContext(ResponsiveContext);

export const ResponsiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [context, setContext] = useState<ResponsiveContextValue>({
    breakpoint: 'desktop',
    width: 1024,
    height: 768,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  });

  useEffect(() => {
    const updateContext = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      let breakpoint: Breakpoint = 'desktop';
      if (width < BREAKPOINTS.mobile) {
        breakpoint = 'mobile';
      } else if (width < BREAKPOINTS.tablet) {
        breakpoint = 'mobile';
      } else if (width < BREAKPOINTS.desktop) {
        breakpoint = 'tablet';
      } else if (width >= BREAKPOINTS.wide) {
        breakpoint = 'wide';
      }

      setContext({
        breakpoint,
        width,
        height,
        isMobile: breakpoint === 'mobile',
        isTablet: breakpoint === 'tablet',
        isDesktop: breakpoint === 'desktop' || breakpoint === 'wide',
      });
    };

    updateContext();
    window.addEventListener('resize', updateContext);
    return () => window.removeEventListener('resize', updateContext);
  }, []);

  return (
    <ResponsiveContext.Provider value={context}>
      {children}
    </ResponsiveContext.Provider>
  );
};

// 响应式布局组件
interface GameLayoutProps {
  children: React.ReactNode;
  boardSlot?: React.ReactNode;
  sidebarSlot?: React.ReactNode;
  bottomSlot?: React.ReactNode;
}

export const GameLayout: React.FC<GameLayoutProps> = ({
  boardSlot,
  sidebarSlot,
  bottomSlot,
}) => {
  const { isMobile, isTablet } = useResponsive();

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex-1">
          {boardSlot}
        </div>
        <div className="border-t border-gray-200 overflow-auto max-h-[40vh]">
          {bottomSlot}
        </div>
      </div>
    );
  }

  if (isTablet) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex-1 p-4">
          {boardSlot}
        </div>
        <div className="h-64 border-t border-gray-200 p-4">
          {bottomSlot}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex">
          <div className="flex-1 p-4">
            {boardSlot}
          </div>
          <div className="w-80 p-4 border-l border-gray-200 overflow-auto">
            {sidebarSlot}
          </div>
        </div>
        <div className="h-48 border-t border-gray-200">
          {bottomSlot}
        </div>
      </div>
    </div>
  );
};
