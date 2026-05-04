import { useRef, useState, useCallback } from "react";

interface Props {
  isDrawMode: boolean;
  isEraserMode: boolean;
  strokes: string[];
  onAddStroke: (path: string) => void;
  onRemoveStroke: (index: number) => void;
  color?: string;
}

function getRelativePoint(
  e: MouseEvent | TouchEvent,
  svg: SVGSVGElement
): { x: number; y: number } | null {
  const rect = svg.getBoundingClientRect();
  let clientX: number, clientY: number;
  if ("touches" in e) {
    if (!e.touches[0]) return null;
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;
  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

export function DrawOverlay({
  isDrawMode,
  isEraserMode,
  strokes,
  onAddStroke,
  onRemoveStroke,
  color = "#ef4444",
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDrawing = useRef(false);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawMode) return;
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const pt = getRelativePoint(e.nativeEvent, svg);
      if (!pt) return;
      isDrawing.current = true;
      setCurrentPath(`M ${pt.x} ${pt.y}`);
    },
    [isDrawMode]
  );

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawMode || !isDrawing.current) return;
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const pt = getRelativePoint(e.nativeEvent, svg);
      if (!pt) return;
      setCurrentPath((prev) =>
        prev ? `${prev} L ${pt.x} ${pt.y}` : `M ${pt.x} ${pt.y}`
      );
    },
    [isDrawMode]
  );

  const handleEnd = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    setCurrentPath((prev) => {
      if (prev && prev.length > 10) {
        onAddStroke(prev);
      }
      return null;
    });
  }, [onAddStroke]);

  const isActive = isDrawMode || isEraserMode;
  if (!isActive && strokes.length === 0) return null;

  const cursor = isDrawMode ? "crosshair" : isEraserMode ? "pointer" : "default";

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full rounded-sm"
      style={{
        pointerEvents: isActive ? "auto" : "none",
        cursor,
        zIndex: 10,
      }}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={() => {
        handleEnd();
        setHoveredIndex(null);
      }}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    >
      {strokes.map((d, i) => {
        const isHovered = isEraserMode && hoveredIndex === i;
        return (
          <g key={i}>
            {/* Visible stroke */}
            <path
              d={d}
              fill="none"
              stroke={isHovered ? "#f97316" : color}
              strokeWidth={isHovered ? "2.5" : "1.5"}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              opacity={isHovered ? 1 : 0.85}
              strokeDasharray={isHovered ? "4 2" : undefined}
              style={{ transition: "stroke 0.1s, stroke-width 0.1s" }}
            />
            {/* Wide invisible hit area for easy clicking in eraser mode */}
            {isEraserMode && (
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setHoveredIndex(null);
                  onRemoveStroke(i);
                }}
              />
            )}
          </g>
        );
      })}

      {/* Stroke being drawn */}
      {currentPath && (
        <path
          d={currentPath}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          opacity="0.85"
        />
      )}
    </svg>
  );
}
