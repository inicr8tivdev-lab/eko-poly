import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { BOARD, type Space } from "@/game/board";
import { getEventVisualTheme, isSpaceAffectedByEvent } from "@/game/events";
import type { GameState } from "@/game/engine";

const CORNER_UNITS = 160;
const TRACK_UNITS = 100;
const BOARD_UNITS = CORNER_UNITS * 2 + TRACK_UNITS * 9; // 1220

type CellSide = "bottom" | "left" | "top" | "right" | "corner";

interface BoardCellRect {
  index: number;
  space: Space;
  row: number;
  col: number;
  side: CellSide;
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  rimX: number;
  rimY: number;
}

function gridPosition(i: number): { row: number; col: number; side: CellSide } {
  if (i % 10 === 0) {
    const map: Record<number, [number, number]> = {
      0: [10, 10],
      10: [10, 0],
      20: [0, 0],
      30: [0, 10],
    };
    const [row, col] = map[i] ?? [10, 10];
    return { row, col, side: "corner" };
  }
  if (i < 10) return { row: 10, col: 10 - i, side: "bottom" };
  if (i < 20) return { row: 10 - (i - 10), col: 0, side: "left" };
  if (i < 30) return { row: 0, col: i - 20, side: "top" };
  return { row: i - 30, col: 10, side: "right" };
}

function axisStart(idx: number): number {
  if (idx === 0) return 0;
  if (idx === 10) return CORNER_UNITS + 9 * TRACK_UNITS;
  return CORNER_UNITS + (idx - 1) * TRACK_UNITS;
}

function axisSize(idx: number): number {
  return idx === 0 || idx === 10 ? CORNER_UNITS : TRACK_UNITS;
}

function getBoardCellRect(index: number): BoardCellRect {
  const { row, col, side } = gridPosition(index);
  const x = axisStart(col);
  const y = axisStart(row);
  const width = axisSize(col);
  const height = axisSize(row);
  const cx = x + width / 2;
  const cy = y + height / 2;

  let rimX = cx;
  let rimY = cy;
  if (side === "bottom") rimY = y;
  else if (side === "top") rimY = y + height;
  else if (side === "left") rimX = x + width;
  else if (side === "right") rimX = x;
  else {
    rimX = col === 0 ? x + width : x;
    rimY = row === 0 ? y + height : y;
  }

  return {
    index,
    space: BOARD[index]!,
    row,
    col,
    side,
    x,
    y,
    width,
    height,
    cx,
    cy,
    rimX,
    rimY,
  };
}

const ALL_CELL_RECTS: BoardCellRect[] = BOARD.map((_, i) => getBoardCellRect(i));

export function BoardEventOverlay({ state }: { state: GameState }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const activeEvent = state.phase !== "gameover" ? (state.activeEvent ?? null) : null;

  const affectedCells = useMemo(() => {
    if (!activeEvent) return [];
    return ALL_CELL_RECTS.filter((cell) => isSpaceAffectedByEvent(cell.space, activeEvent));
  }, [activeEvent]);

  const theme = useMemo(
    () => (activeEvent ? getEventVisualTheme(activeEvent) : null),
    [activeEvent],
  );

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll("*").interrupt();

    if (!activeEvent || !theme) {
      svg.select("g.event-cells").selectAll("*").remove();
      svg.select("g.event-links").selectAll("*").remove();
      svg.select("g.event-beacon").selectAll("*").remove();
      return;
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReducedMotion ? 0 : 200;

    const defs = svg.select<SVGDefsElement>("defs");
    defs
      .select("#ekopoly-hazard-hatch path")
      .attr("stroke", theme.strokeHex)
      .attr("stroke-opacity", 0.35);
    defs
      .select("#ekopoly-event-dots circle")
      .attr("fill", theme.strokeHex)
      .attr("fill-opacity", 0.3);

    const patternUrl =
      theme.tone === "alert" ? "url(#ekopoly-hazard-hatch)" : "url(#ekopoly-event-dots)";

    const cellsLayer = svg.select<SVGGElement>("g.event-cells");
    const cellGroups = cellsLayer
      .selectAll<SVGGElement, BoardCellRect>("g.event-cell")
      .data(affectedCells, (d) => d.index)
      .join(
        (enter) => {
          const g = enter
            .append("g")
            .attr("class", "event-cell")
            .attr("data-space-index", (d) => d.index)
            .attr("opacity", duration === 0 ? 1 : 0);

          g.append("rect").attr("class", "event-cell-tint");
          g.append("rect").attr("class", "event-cell-pattern");
          g.append("rect").attr("class", "event-cell-frame");
          g.append("polygon").attr("class", "event-cell-marker");

          if (duration > 0) {
            g.transition().duration(duration).ease(d3.easeCubicOut).attr("opacity", 1);
          }
          return g;
        },
        (update) => update.attr("data-space-index", (d) => d.index).attr("opacity", 1),
        (exit) => exit.remove(),
      );

    cellGroups
      .select<SVGRectElement>("rect.event-cell-tint")
      .attr("x", (d) => d.x + 2)
      .attr("y", (d) => d.y + 2)
      .attr("width", (d) => Math.max(0, d.width - 4))
      .attr("height", (d) => Math.max(0, d.height - 4))
      .attr("rx", 4)
      .attr("fill", theme.hex)
      .attr("fill-opacity", theme.fillOpacity);

    cellGroups
      .select<SVGRectElement>("rect.event-cell-pattern")
      .attr("x", (d) => d.x + 2)
      .attr("y", (d) => d.y + 2)
      .attr("width", (d) => Math.max(0, d.width - 4))
      .attr("height", (d) => Math.max(0, d.height - 4))
      .attr("rx", 4)
      .attr("fill", patternUrl);

    cellGroups
      .select<SVGRectElement>("rect.event-cell-frame")
      .attr("x", (d) => d.x + 3)
      .attr("y", (d) => d.y + 3)
      .attr("width", (d) => Math.max(0, d.width - 6))
      .attr("height", (d) => Math.max(0, d.height - 6))
      .attr("rx", 4)
      .attr("fill", "none")
      .attr("stroke", theme.strokeHex)
      .attr("stroke-width", 4)
      .attr("stroke-dasharray", theme.tone === "alert" ? "10 6" : "none");

    cellGroups
      .select<SVGPolygonElement>("polygon.event-cell-marker")
      .attr("fill", theme.strokeHex)
      .attr("points", (d) => {
        const size = 18;
        const x1 = d.x + d.width - 3;
        const y1 = d.y + 3;
        return `${x1 - size},${y1} ${x1},${y1} ${x1},${y1 + size}`;
      });

    // Draw D3 curved connectors between targeted property-group / utility / transport tiles.
    const linksLayer = svg.select<SVGGElement>("g.event-links");
    const showGroupLinks = affectedCells.length >= 2 && affectedCells.length <= 6;
    const linkPairs: [BoardCellRect, BoardCellRect][] = showGroupLinks
      ? affectedCells.slice(0, -1).map((cell, idx) => [cell, affectedCells[idx + 1]!])
      : [];

    const curveGenerator = d3
      .line<[number, number]>()
      .x((p) => p[0])
      .y((p) => p[1])
      .curve(d3.curveBasis);

    linksLayer
      .selectAll<SVGPathElement, [BoardCellRect, BoardCellRect]>("path.event-group-link")
      .data(linkPairs)
      .join("path")
      .attr("class", "event-group-link")
      .attr("fill", "none")
      .attr("stroke", theme.strokeHex)
      .attr("stroke-width", 3.5)
      .attr("stroke-opacity", 0.55)
      .attr("stroke-dasharray", "8 6")
      .attr("d", ([a, b]) => {
        const midX = (a.rimX + b.rimX) / 2;
        const midY = (a.rimY + b.rimY) / 2;
        // Pull control point slightly toward the board perimeter center if cells span corners.
        const sameEdge = a.side === b.side;
        const ctrlX = sameEdge ? midX + (610 - midX) * 0.08 : midX + (610 - midX) * 0.14;
        const ctrlY = sameEdge ? midY + (610 - midY) * 0.08 : midY + (610 - midY) * 0.14;
        return (
          curveGenerator([
            [a.rimX, a.rimY],
            [ctrlX, ctrlY],
            [b.rimX, b.rimY],
          ]) ?? ""
        );
      });

    // For city-wide events without tile targets (e.g. Marina Dividend), outline the inner board rim.
    const beaconLayer = svg.select<SVGGElement>("g.event-beacon");
    const showRimBeacon = affectedCells.length === 0;
    beaconLayer
      .selectAll<SVGRectElement, number>("rect.event-center-beacon")
      .data(showRimBeacon ? [1] : [])
      .join("rect")
      .attr("class", "event-center-beacon")
      .attr("x", CORNER_UNITS + 3)
      .attr("y", CORNER_UNITS + 3)
      .attr("width", BOARD_UNITS - CORNER_UNITS * 2 - 6)
      .attr("height", BOARD_UNITS - CORNER_UNITS * 2 - 6)
      .attr("rx", 8)
      .attr("fill", "none")
      .attr("stroke", theme.strokeHex)
      .attr("stroke-width", 5)
      .attr("stroke-opacity", 0.45)
      .attr("stroke-dasharray", "12 8");

    return () => {
      svg.selectAll("*").interrupt();
    };
  }, [activeEvent, affectedCells, theme]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${BOARD_UNITS} ${BOARD_UNITS}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      data-testid="board-event-overlay"
      data-event-id={activeEvent?.id ?? ""}
      data-event-tone={theme?.tone ?? ""}
      data-event-tint={theme?.hex ?? ""}
      data-affected-count={affectedCells.length}
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
    >
      <defs>
        <pattern
          id="ekopoly-hazard-hatch"
          width="16"
          height="16"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <path d="M 0,0 L 0,16" stroke="#dc2626" strokeWidth="4" strokeOpacity="0.35" />
        </pattern>
        <pattern id="ekopoly-event-dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="9" cy="9" r="2.2" fill="#047857" fillOpacity="0.3" />
        </pattern>
      </defs>
      <g className="event-cells" />
      <g className="event-links" />
      <g className="event-beacon" />
    </svg>
  );
}
