

import { useEffect, useMemo, useRef, useState } from "react";

export interface GridMetrics {
  width: number;
  height: number;
  gridSizePx: number;
  cellSize: number;
}

export function useGridMetrics(rows: number, cols: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const el = ref.current;

    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height)
      });
    });

    ro.observe(el);

    // initial read
    const rect = el.getBoundingClientRect();
    setSize({
      width: Math.floor(rect.width),
      height: Math.floor(rect.height)
    });

    return () => ro.disconnect();
  }, []);

  const metrics = useMemo<GridMetrics>(() => {
    const width = size.width;
    const height = size.height;

    // If not measured yet
    if (width <= 0 || height <= 0 || rows <= 0 || cols <= 0) {
      return { width, height, gridSizePx: 0, cellSize: 0 };
    }

    // The grid is constrained to a square that fits inside the viewport.
    const gridSizePx = Math.min(width, height);

    // Cell size is derived from rows/cols
    const cellSize = Math.floor(
      Math.min(gridSizePx / cols, gridSizePx / rows)
    );

    return {
      width,
      height,
      gridSizePx,
      cellSize
    };
  }, [size.width, size.height, rows, cols]);

  return { ref, metrics };
}
