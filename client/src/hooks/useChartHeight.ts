import { useEffect, useState } from "react";

type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl";

const BREAKPOINTS: Record<Breakpoint, number> = {
  xs: 320,
  sm: 375,
  md: 768,
  lg: 1024,
  xl: 1280,
};

export interface ChartHeightConfig {
  base?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

const DEFAULT_HEIGHTS: Required<ChartHeightConfig> = {
  base: 200,
  sm: 220,
  md: 280,
  lg: 320,
  xl: 360,
};

function pickHeight(width: number, config: Required<ChartHeightConfig>) {
  if (width >= BREAKPOINTS.xl) return config.xl;
  if (width >= BREAKPOINTS.lg) return config.lg;
  if (width >= BREAKPOINTS.md) return config.md;
  if (width >= BREAKPOINTS.sm) return config.sm;
  return config.base;
}

/**
 * Returns a responsive chart height (px) that updates on window resize.
 * Mobile-first: `base` is the default height, and each larger breakpoint
 * overrides as needed.
 *
 *   useChartHeight()                            // 200 / 220 / 280 / 320 / 360
 *   useChartHeight({ base: 180, md: 260, lg: 300 })
 */
export function useChartHeight(config: ChartHeightConfig = {}): number {
  const resolved: Required<ChartHeightConfig> = { ...DEFAULT_HEIGHTS, ...config };
  const [height, setHeight] = useState<number>(() => {
    if (typeof window === "undefined") return resolved.lg;
    return pickHeight(window.innerWidth, resolved);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setHeight(pickHeight(window.innerWidth, resolved));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved.base, resolved.sm, resolved.md, resolved.lg, resolved.xl]);

  return height;
}

/** Simple "is mobile viewport" hook (< 768px). */
export function useIsMobile(breakpoint: number = BREAKPOINTS.md): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsMobile(window.innerWidth < breakpoint);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [breakpoint]);

  return isMobile;
}

export default useChartHeight;
