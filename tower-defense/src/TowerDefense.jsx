import { useState, useEffect, useRef, useCallback } from "react";

const PIXEL_FONT = `"Press Start 2P", "Courier New", monospace`;
const CELL = 32;
const COLS = 13;
const ROWS = 15;
const CW = COLS * CELL;
const CH = ROWS * CELL;
const GOLD_CAP = 8000;
const GOLD_CAP_MAP = 15000; // during map-change waves
const MAX_TOWERS = 25;
const MAX_BUILDINGS = 8;

const BUILDING_KEYS = ["forge", "hopital", "rempart", "radar"];
const ROULETTE_EVENTS = [
  // Bonus (positive) — 7 events
  { id: "jackpot", symbol: "💰", name: "JACKPOT", desc: "Or x2 cette vague!", type: "bonus", color: "#fbbf24", weight: 2 },
  { id: "cadence", symbol: "⚡", name: "CADENCE", desc: "Tours tirent +40% vite", type: "bonus", color: "#38bdf8", weight: 2 },
  { id: "fortifie", symbol: "🛡", name: "FORTIFIÉ", desc: "Tours +4 armure", type: "bonus", color: "#94a3b8", weight: 2 },
  { id: "miracle", symbol: "💚", name: "MIRACLE", desc: "Heal complet!", type: "bonus", color: "#4ade80", weight: 1 },
  { id: "precision", symbol: "🎯", name: "PRÉCISION", desc: "Tours +50% dégâts", type: "bonus", color: "#c084fc", weight: 2 },
  { id: "tresor", symbol: "💎", name: "TRÉSOR", desc: "+500 or!", type: "bonus", color: "#fde047", weight: 2 },
  { id: "regen", symbol: "🔄", name: "REGEN", desc: "Tours regénèrent 12hp/s", type: "bonus", color: "#34d399", weight: 2 },
  // Malus (negative) — 12 events, higher weights
  { id: "titan", symbol: "👹", name: "TITAN", desc: "Un mega boss arrive!", type: "malus", color: "#ef4444", weight: 3 },
  { id: "invasion", symbol: "🗼", name: "INVASION", desc: "+4 tourelles ennemies!", type: "malus", color: "#f97316", weight: 3 },
  { id: "rush", symbol: "💨", name: "RUSH", desc: "Ennemis +60% vitesse", type: "malus", color: "#a78bfa", weight: 3 },
  { id: "enrage", symbol: "🔴", name: "ENRAGÉ", desc: "Ennemis fous! +SPD +HP +DMG", type: "malus", color: "#dc2626", weight: 3 },
  { id: "blinde", symbol: "💀", name: "BLINDÉ", desc: "Ennemis +60% HP", type: "malus", color: "#6b7280", weight: 3 },
  { id: "brouillard", symbol: "🌑", name: "BROUILLARD", desc: "Portée tours -30%", type: "malus", color: "#475569", weight: 3 },
  { id: "sabotage", symbol: "💣", name: "SABOTAGE", desc: "2 tours prennent -50% HP", type: "malus", color: "#b91c1c", weight: 3 },
  { id: "taxe", symbol: "🏦", name: "TAXE", desc: "-30% de votre or!", type: "malus", color: "#78716c", weight: 3 },
  { id: "demolition", symbol: "🧨", name: "DÉMOLITION", desc: "1 tour aléatoire détruite!", type: "malus", color: "#991b1b", weight: 2 },
  { id: "horde", symbol: "🐺", name: "HORDE", desc: "x2 ennemis cette vague!", type: "malus", color: "#7c3aed", weight: 2 },
  { id: "corrosion", symbol: "🧪", name: "CORROSION", desc: "Tours perdent toute armure", type: "malus", color: "#84cc16", weight: 3 },
  { id: "famine", symbol: "🚫", name: "FAMINE", desc: "-50% or des kills", type: "malus", color: "#a3a3a3", weight: 3 },
];
const ROULETTE_CHANCE = 0.40; // fixed 40% chance per wave
function pickRouletteEvent() {
  const totalWeight = ROULETTE_EVENTS.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const ev of ROULETTE_EVENTS) { r -= ev.weight; if (r <= 0) return ev; }
  return ROULETTE_EVENTS[ROULETTE_EVENTS.length - 1];
}

function generatePath(seed) {
  const rng = ((s) => {
    let v = s;
    return () => { v = (v * 16807 + 0) % 2147483647; return (v & 0x7fffffff) / 0x7fffffff; };
  })(seed);

  const cells = new Set();
  const waypoints = [];
  let row = 1;
  const entryCol = Math.floor(rng() * 3);
  let col = entryCol;
  waypoints.push({ x: -10, y: row * CELL + CELL / 2 });
  cells.add(`${col},${row}`);

  const goHoriz = (fromCol, toCol, r) => {
    const dir = toCol > fromCol ? 1 : -1;
    for (let c = fromCol; dir > 0 ? c <= toCol : c >= toCol; c += dir) cells.add(`${c},${r}`);
    waypoints.push({ x: toCol * CELL + CELL / 2, y: r * CELL + CELL / 2 });
  };
  const goVert = (c, fromRow, toRow) => {
    const dir = toRow > fromRow ? 1 : -1;
    for (let r = fromRow; dir > 0 ? r <= toRow : r >= toRow; r += dir) cells.add(`${c},${r}`);
    waypoints.push({ x: c * CELL + CELL / 2, y: toRow * CELL + CELL / 2 });
  };

  if (entryCol > 0) for (let c = 0; c < entryCol; c++) cells.add(`${c},1`);

  const segments = 8 + Math.floor(rng() * 5);
  let direction = rng() < 0.5 ? 1 : -1;
  for (let seg = 0; seg < segments; seg++) {
    let targetCol = direction > 0
      ? Math.min(COLS - 2, col + 2 + Math.floor(rng() * 6))
      : Math.max(1, col - 2 - Math.floor(rng() * 6));
    goHoriz(col, targetCol, row); col = targetCol;
    const drop = 1 + Math.floor(rng() * 3);
    const newRow = Math.min(ROWS - 2, row + drop);
    goVert(col, row, newRow); row = newRow;
    if (row >= ROWS - 2) break;
    if (rng() < 0.7 && row < ROWS - 4) {
      const dc = Math.max(1, Math.min(COLS - 2, col + (rng() < 0.5 ? 1 : -1) * (1 + Math.floor(rng() * 4))));
      goHoriz(col, dc, row); col = dc;
      const dr = Math.min(ROWS - 2, row + 1 + Math.floor(rng() * 2));
      goVert(col, row, dr); row = dr;
    }
    if (rng() < 0.3 && row < ROWS - 3) {
      const back = Math.max(1, Math.min(COLS - 2, col + (direction > 0 ? -1 : 1) * (1 + Math.floor(rng() * 2))));
      goHoriz(col, back, row); col = back;
    }
    direction *= -1;
  }
  if (row < ROWS - 2) { goVert(col, row, ROWS - 2); row = ROWS - 2; }
  const exitCol = Math.min(COLS - 1, Math.max(col, COLS - 3 + Math.floor(rng() * 3)));
  if (exitCol !== col) { goHoriz(col, exitCol, row); col = exitCol; }
  for (let c = col; c < COLS; c++) cells.add(`${c},${row}`);
  waypoints.push({ x: CW + 10, y: row * CELL + CELL / 2 });
  return { cells, waypoints };
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function generateCampaignSpiralCoord(index) {
  if (index <= 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  let stepLen = 1;
  let dir = 0; // 0:right, 1:down, 2:left, 3:up
  let produced = 0;
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  while (produced < index) {
    for (let rep = 0; rep < 2; rep++) {
      const [dx, dy] = dirs[dir % 4];
      for (let i = 0; i < stepLen; i++) {
        x += dx;
        y += dy;
        produced++;
        if (produced === index) return { x, y };
      }
      dir++;
    }
    stepLen++;
  }
  return { x, y };
}

function getCampaignTowerMapMultipliers(mapNum) {
  const idx = Math.max(0, mapNum - 1);
  return {
    dmgMult: 1 + idx * 0.08,
    rateMult: Math.max(0.75, 1 - idx * 0.03),
    rangeMult: 1 + idx * 0.015,
    hpBonusPerMap: 28,
  };
}

// Generate a path inside a map tile that connects multiple border points.
// borderPoints: array of {col, row, side} in local coordinates (0..COLS-1, 0..ROWS-1).
// The path visits all border points, zigzagging through the map.
function generateCampaignPath(seed, borderPoints) {
  const rng = ((s) => {
    let v = s;
    return () => { v = (v * 16807 + 0) % 2147483647; return (v & 0x7fffffff) / 0x7fffffff; };
  })(seed);

  if (!borderPoints || borderPoints.length === 0) {
    borderPoints = [{ col: 0, row: Math.floor(ROWS / 2), side: "left" }];
  }

  const cells = new Set();
  // We'll build segments between consecutive border points
  // and collect waypoints for each segment separately
  const segmentWaypoints = []; // array of arrays of waypoints, one per border point pair

  const goHoriz = (fromCol, toCol, r) => {
    const dir = toCol > fromCol ? 1 : -1;
    for (let c = fromCol; dir > 0 ? c <= toCol : c >= toCol; c += dir) cells.add(`${c},${r}`);
  };
  const goVert = (c, fromRow, toRow) => {
    const dir = toRow > fromRow ? 1 : -1;
    for (let r = fromRow; dir > 0 ? r <= toRow : r >= toRow; r += dir) cells.add(`${c},${r}`);
  };

  // Connect each pair of consecutive border points
  for (let bp = 0; bp < borderPoints.length - 1; bp++) {
    const start = borderPoints[bp];
    const end = borderPoints[bp + 1];
    const wps = [];
    let col = start.col, row = start.row;
    cells.add(`${col},${row}`);
    wps.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });

    // Number of zigzag segments between these two points
    const segments = 3 + Math.floor(rng() * 4);
    for (let seg = 0; seg < segments; seg++) {
      const progress = (seg + 1) / (segments + 1);
      const targetRow = clamp(Math.round(row + (end.row - row) * progress + (rng() - 0.5) * 5), 1, ROWS - 2);
      const targetCol = clamp(Math.round(col + (end.col - col) * progress + (rng() - 0.5) * 6), 1, COLS - 2);

      if (rng() < 0.5) {
        goHoriz(col, targetCol, row); col = targetCol;
        wps.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
        goVert(col, row, targetRow); row = targetRow;
        wps.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
      } else {
        goVert(col, row, targetRow); row = targetRow;
        wps.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
        goHoriz(col, targetCol, row); col = targetCol;
        wps.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
      }

      // Extra zigzag for complexity
      if (rng() < 0.35 && seg < segments - 1) {
        const zigCol = clamp(col + (rng() < 0.5 ? -1 : 1) * (2 + Math.floor(rng() * 3)), 1, COLS - 2);
        goHoriz(col, zigCol, row); col = zigCol;
        wps.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
      }
    }

    // Final connection to end point
    if (col !== end.col) { goHoriz(col, end.col, row); col = end.col; }
    wps.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
    if (row !== end.row) { goVert(col, row, end.row); row = end.row; }
    wps.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
    cells.add(`${end.col},${end.row}`);

    segmentWaypoints.push(wps);
  }

  // If only one border point, generate a path that goes into the map and back
  if (borderPoints.length === 1) {
    const bp = borderPoints[0];
    const wps = [];
    let col = bp.col, row = bp.row;
    cells.add(`${col},${row}`);
    wps.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
    // Go to center of map
    const midCol = Math.floor(COLS / 2);
    const midRow = Math.floor(ROWS / 2);
    goHoriz(col, midCol, row); col = midCol;
    wps.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
    goVert(col, row, midRow); row = midRow;
    wps.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
    segmentWaypoints.push(wps);
  }

  // Flatten all waypoints in order
  const allWaypoints = [];
  segmentWaypoints.forEach((seg) => seg.forEach((wp) => allWaypoints.push(wp)));

  return { cells, waypoints: allWaypoints, segmentWaypoints, borderPoints };
}

// Legacy function kept for normal/surprise modes
function generatePathWithOptions(seed, options = {}) {
  const rng = ((s) => {
    let v = s;
    return () => { v = (v * 16807 + 0) % 2147483647; return (v & 0x7fffffff) / 0x7fffffff; };
  })(seed);

  const cells = new Set();
  const waypoints = [];
  let row = clamp(options.entryRow ?? 1, 1, ROWS - 2);
  const entryCol = clamp(options.entryCol ?? Math.floor(rng() * 3), 0, 2);
  let col = entryCol;
  waypoints.push({ x: -10, y: row * CELL + CELL / 2 });
  cells.add(`${col},${row}`);

  const goHoriz = (fromCol, toCol, r) => {
    const dir = toCol > fromCol ? 1 : -1;
    for (let c = fromCol; dir > 0 ? c <= toCol : c >= toCol; c += dir) cells.add(`${c},${r}`);
    waypoints.push({ x: toCol * CELL + CELL / 2, y: r * CELL + CELL / 2 });
  };
  const goVert = (c, fromRow, toRow) => {
    const dir = toRow > fromRow ? 1 : -1;
    for (let r = fromRow; dir > 0 ? r <= toRow : r >= toRow; r += dir) cells.add(`${c},${r}`);
    waypoints.push({ x: c * CELL + CELL / 2, y: toRow * CELL + CELL / 2 });
  };

  if (entryCol > 0) for (let c = 0; c < entryCol; c++) cells.add(`${c},${row}`);

  const segments = 5 + Math.floor(rng() * 4);
  let direction = rng() < 0.5 ? 1 : -1;
  for (let seg = 0; seg < segments; seg++) {
    let targetCol = direction > 0
      ? Math.min(COLS - 2, col + 3 + Math.floor(rng() * 5))
      : Math.max(1, col - 3 - Math.floor(rng() * 5));
    goHoriz(col, targetCol, row); col = targetCol;
    const drop = 1 + Math.floor(rng() * 2);
    const newRow = Math.min(ROWS - 2, row + drop);
    goVert(col, row, newRow); row = newRow;
    if (row >= ROWS - 2) break;
    if (rng() < 0.4 && row < ROWS - 4) {
      const dc = Math.max(1, Math.min(COLS - 2, col + (rng() < 0.5 ? 1 : -1) * (2 + Math.floor(rng() * 3))));
      goHoriz(col, dc, row); col = dc;
      const dr = Math.min(ROWS - 2, row + 1);
      goVert(col, row, dr); row = dr;
    }
    direction *= -1;
  }
  if (row < ROWS - 2) { goVert(col, row, ROWS - 2); row = ROWS - 2; }
  const exitCol = Math.min(COLS - 1, Math.max(col, COLS - 3 + Math.floor(rng() * 3)));
  if (exitCol !== col) { goHoriz(col, exitCol, row); col = exitCol; }
  for (let c = col; c < COLS; c++) cells.add(`${c},${row}`);
  waypoints.push({ x: CW + 10, y: row * CELL + CELL / 2 });
  return { cells, waypoints };
}

function offsetPathToWorld(path, colOffset, rowOffset) {
  const cells = new Set();
  path.cells.forEach((key) => {
    const [c, r] = key.split(",").map(Number);
    cells.add(`${c + colOffset},${r + rowOffset}`);
  });
  const waypoints = path.waypoints.map((w) => ({
    x: w.x + colOffset * CELL,
    y: w.y + rowOffset * CELL,
  }));
  return { cells, waypoints };
}

function rebuildCampaignCompositePath(g) {
  const cells = new Set();
  (g.campaignMaps || []).forEach((m) => {
    m.path.cells.forEach((k) => cells.add(k));
  });
  const latest = g.campaignMaps && g.campaignMaps.length > 0
    ? g.campaignMaps[g.campaignMaps.length - 1].path
    : g.path;
  g.path = { cells, waypoints: latest.waypoints };
  // Rebuild spawnPaths from stored borderEntries
  g.spawnPaths = buildCampaignSpawnPaths(g.campaignMaps);
}

// For each map, build spawn paths from each border entry to the base (map 0).
// Each spawn path chains: this map's entry→hub waypoints + through neighbor maps toward map 0.
function buildCampaignSpawnPaths(maps) {
  if (!maps || maps.length === 0) return [];
  // Build adjacency: for each map, which maps are its neighbors and on which side
  const spiralMap = new Map(); // "x,y" → map index
  maps.forEach((m, i) => {
    const sx = Math.round(m.colOffset / COLS);
    const sy = Math.round(m.rowOffset / ROWS);
    spiralMap.set(`${sx},${sy}`, i);
  });

  // BFS from each map to map 0 to find the shortest path through the map graph
  function bfsMapPath(startIdx) {
    if (startIdx === 0) return [0];
    const q = [startIdx];
    const prev = new Map();
    prev.set(startIdx, -1);
    let qi = 0;
    while (qi < q.length) {
      const cur = q[qi++];
      if (cur === 0) break;
      const m = maps[cur];
      const sx = Math.round(m.colOffset / COLS);
      const sy = Math.round(m.rowOffset / ROWS);
      const nbs = [[sx + 1, sy], [sx - 1, sy], [sx, sy + 1], [sx, sy - 1]];
      for (const [nx, ny] of nbs) {
        const nk = `${nx},${ny}`;
        if (spiralMap.has(nk) && !prev.has(spiralMap.get(nk))) {
          const ni = spiralMap.get(nk);
          prev.set(ni, cur);
          q.push(ni);
        }
      }
    }
    if (!prev.has(0)) return [startIdx]; // can't reach base
    const path = [];
    let cur = 0;
    while (cur !== -1) { path.push(cur); cur = prev.get(cur); }
    path.reverse();
    return path;
  }

  // For each map, find the border point on the side facing a given neighbor
  function findBorderWpToward(mapIdx, neighborIdx) {
    const m = maps[mapIdx];
    const n = maps[neighborIdx];
    const dx = Math.round((n.colOffset - m.colOffset) / COLS);
    const dy = Math.round((n.rowOffset - m.rowOffset) / ROWS);
    let targetSide = "";
    if (dx === 1) targetSide = "right";
    else if (dx === -1) targetSide = "left";
    else if (dy === 1) targetSide = "bottom";
    else if (dy === -1) targetSide = "top";
    // Find the border point on that side
    const bp = (m.borderPoints || []).find((b) => b.side === targetSide);
    if (bp) return { col: m.colOffset + bp.col, row: m.rowOffset + bp.row };
    // Fallback: middle of that edge
    if (targetSide === "right") return { col: m.colOffset + COLS - 1, row: m.rowOffset + Math.floor(ROWS / 2) };
    if (targetSide === "left") return { col: m.colOffset, row: m.rowOffset + Math.floor(ROWS / 2) };
    if (targetSide === "bottom") return { col: m.colOffset + Math.floor(COLS / 2), row: m.rowOffset + ROWS - 1 };
    if (targetSide === "top") return { col: m.colOffset + Math.floor(COLS / 2), row: m.rowOffset };
    return { col: m.colOffset + Math.floor(COLS / 2), row: m.rowOffset + Math.floor(ROWS / 2) };
  }

  // Collect all spawn paths: one per "outer" border entry of each map
  const spawnPaths = [];
  maps.forEach((m, mapIdx) => {
    // Find borders that DON'T connect to any existing map = spawn entries
    const sx = Math.round(m.colOffset / COLS);
    const sy = Math.round(m.rowOffset / ROWS);
    const sides = ["left", "right", "top", "bottom"];
    const sideDx = { left: -1, right: 1, top: 0, bottom: 0 };
    const sideDy = { left: 0, right: 0, top: -1, bottom: 1 };

    sides.forEach((side) => {
      const nx = sx + sideDx[side];
      const ny = sy + sideDy[side];
      const neighborKey = `${nx},${ny}`;
      if (spiralMap.has(neighborKey)) return; // not an outer border

      const bp = (m.borderPoints || []).find((b) => b.side === side);
      if (!bp) return;

      // This is an outer border entry — build spawn waypoints from here to base
      const startWp = { x: (m.colOffset + bp.col) * CELL + CELL / 2, y: (m.rowOffset + bp.row) * CELL + CELL / 2 };
      const mapPath = bfsMapPath(mapIdx);

      const chainWp = [startWp];
      // Walk through each map in the path toward base
      for (let pi = 0; pi < mapPath.length; pi++) {
        const curMapIdx = mapPath[pi];
        const curMap = maps[curMapIdx];

        if (pi < mapPath.length - 1) {
          // Add waypoints toward the border facing the next map
          const nextMapIdx = mapPath[pi + 1];
          const borderWp = findBorderWpToward(curMapIdx, nextMapIdx);
          // Add the map's internal waypoints that lead to this border
          // Use the segment waypoints from the border we entered to the border we exit
          chainWp.push({ x: borderWp.col * CELL + CELL / 2, y: borderWp.row * CELL + CELL / 2 });
        } else {
          // Last map (base map) — walk to the center/hub of map 0
          const hubWp = curMap.path.waypoints[Math.floor(curMap.path.waypoints.length / 2)];
          if (hubWp) chainWp.push(hubWp);
        }
      }
      spawnPaths.push(chainWp);
    });
  });

  // If no outer borders found (shouldn't happen), fallback to last map's waypoints
  if (spawnPaths.length === 0 && maps.length > 0) {
    spawnPaths.push(maps[maps.length - 1].path.waypoints);
  }

  return spawnPaths;
}

function getCampaignWorldBounds(campaignMaps) {
  if (!campaignMaps || campaignMaps.length === 0) {
    return { minX: 0, minY: 0, maxX: CW, maxY: CH };
  }
  let minCol = Infinity, minRow = Infinity, maxCol = -Infinity, maxRow = -Infinity;
  campaignMaps.forEach((m) => {
    minCol = Math.min(minCol, m.colOffset);
    minRow = Math.min(minRow, m.rowOffset);
    maxCol = Math.max(maxCol, m.colOffset + COLS);
    maxRow = Math.max(maxRow, m.rowOffset + ROWS);
  });
  return {
    minX: minCol * CELL,
    minY: minRow * CELL,
    maxX: maxCol * CELL,
    maxY: maxRow * CELL,
  };
}

// For a given side ("left","right","top","bottom"), pick a random border point
function pickBorderPoint(side, rng) {
  const randRow = 2 + Math.floor(rng() * (ROWS - 4));
  const randCol = 2 + Math.floor(rng() * (COLS - 4));
  if (side === "left") return { col: 0, row: randRow, side };
  if (side === "right") return { col: COLS - 1, row: randRow, side };
  if (side === "top") return { col: randCol, row: 0, side };
  if (side === "bottom") return { col: randCol, row: ROWS - 1, side };
  return { col: 0, row: randRow, side };
}

// Get the matching border point on the adjacent map's side
function mirrorBorderPoint(bp) {
  if (bp.side === "left") return { col: COLS - 1, row: bp.row, side: "right" };
  if (bp.side === "right") return { col: 0, row: bp.row, side: "left" };
  if (bp.side === "top") return { col: bp.col, row: ROWS - 1, side: "bottom" };
  if (bp.side === "bottom") return { col: bp.col, row: 0, side: "top" };
  return bp;
}

// Get the opposite side
function oppositeSide(side) {
  if (side === "left") return "right";
  if (side === "right") return "left";
  if (side === "top") return "bottom";
  if (side === "bottom") return "top";
  return side;
}

// Get the side from one spiral position to an adjacent one
function getSide(fromSpiral, toSpiral) {
  const dx = toSpiral.x - fromSpiral.x;
  const dy = toSpiral.y - fromSpiral.y;
  if (dx === 1) return "right";
  if (dx === -1) return "left";
  if (dy === 1) return "bottom";
  if (dy === -1) return "top";
  return null;
}

// Build the full campaign world with multi-border maps.
// Each map has an entry point on every border that touches another map.
// Paths inside each map connect all its border points.
function buildCampaignPreviewWorld(seedStart, levels = 3) {
  const totalMaps = (levels * 2 - 1) ** 2;
  let mapSeed = seedStart;
  const rng = ((s) => {
    let v = s;
    return () => { v = (v * 16807 + 0) % 2147483647; return (v & 0x7fffffff) / 0x7fffffff; };
  })(mapSeed);

  // Pre-compute spiral positions
  const spirals = [];
  for (let i = 0; i < totalMaps; i++) spirals.push(generateCampaignSpiralCoord(i));

  // Build a lookup: "spiralX,spiralY" → map index
  const spiralLookup = new Map();
  spirals.forEach((s, i) => spiralLookup.set(`${s.x},${s.y}`, i));

  // Phase 1: Determine border points for each map.
  // For each pair of adjacent maps, pick ONE shared connection point on the border.
  // Store it so both maps use the same row/col on their shared edge.
  const borderConnections = new Map(); // "mapA-mapB" (sorted) → { sideFromA, point: {col,row} }

  function getConnectionKey(i, j) {
    return i < j ? `${i}-${j}` : `${j}-${i}`;
  }

  // For each map, compute its neighbors and connection points
  const mapBorderPoints = []; // array of arrays of {col,row,side}
  for (let idx = 0; idx < totalMaps; idx++) {
    const s = spirals[idx];
    const neighbors = [
      { dx: 1, dy: 0, side: "right" },
      { dx: -1, dy: 0, side: "left" },
      { dx: 0, dy: 1, side: "bottom" },
      { dx: 0, dy: -1, side: "top" },
    ];
    const bps = [];
    for (const n of neighbors) {
      const nk = `${s.x + n.dx},${s.y + n.dy}`;
      if (!spiralLookup.has(nk)) {
        // Outer border — still add a border point for spawn entry
        bps.push(pickBorderPoint(n.side, rng));
        continue;
      }
      const neighborIdx = spiralLookup.get(nk);
      const connKey = getConnectionKey(idx, neighborIdx);
      if (!borderConnections.has(connKey)) {
        // First time seeing this pair — pick the connection point
        const bp = pickBorderPoint(n.side, rng);
        borderConnections.set(connKey, { point: bp });
        bps.push(bp);
      } else {
        // Already decided — use the mirror of the stored point
        const stored = borderConnections.get(connKey);
        const mirrored = mirrorBorderPoint(stored.point);
        // Ensure side is correct for this map
        mirrored.side = n.side;
        // Row/col must match: for left/right borders row matches, for top/bottom col matches
        if (n.side === "left" || n.side === "right") {
          mirrored.row = stored.point.row;
          mirrored.col = n.side === "left" ? 0 : COLS - 1;
        } else {
          mirrored.col = stored.point.col;
          mirrored.row = n.side === "top" ? 0 : ROWS - 1;
        }
        bps.push(mirrored);
      }
    }
    mapBorderPoints.push(bps);
  }

  // Phase 2: Generate paths inside each map connecting all its border points
  const maps = [];
  const allCells = new Set();

  for (let idx = 0; idx < totalMaps; idx++) {
    const spiral = spirals[idx];
    const colOffset = spiral.x * COLS;
    const rowOffset = spiral.y * ROWS;
    const bps = mapBorderPoints[idx];

    // Sort border points to create a good path: order by angle from center
    const cx = COLS / 2, cy = ROWS / 2;
    bps.sort((a, b) => Math.atan2(a.row - cy, a.col - cx) - Math.atan2(b.row - cy, b.col - cx));

    const localPath = generateCampaignPath(mapSeed, bps);
    const worldPath = offsetPathToWorld(localPath, colOffset, rowOffset);

    const mapObj = {
      index: idx, colOffset, rowOffset, path: worldPath,
      borderPoints: bps, // local coordinates
      spawnCell: { col: colOffset + bps[0].col, row: rowOffset + bps[0].row },
    };
    maps.push(mapObj);
    worldPath.cells.forEach((k) => allCells.add(k));
    mapSeed = mapSeed * 3 + 17;
  }

  // Phase 3: Build global waypoints and spawn paths
  const globalWaypoints = [];
  maps.forEach((m) => m.path.waypoints.forEach((wp) => globalWaypoints.push(wp)));

  // Base cell = center of map 0
  const centerMap = maps[0];
  const baseCell = {
    col: centerMap.colOffset + Math.floor(COLS / 2),
    row: centerMap.rowOffset + Math.floor(ROWS / 2),
  };

  const spawnPaths = buildCampaignSpawnPaths(maps);

  return {
    maps,
    path: { cells: allCells, waypoints: globalWaypoints },
    spawnPaths,
    baseCell,
    mapSeed,
    prevExitRow: Math.floor(ROWS / 2),
  };
}

const TOWER_DEFS = {
  archer: { name: "Archer", symbol: "🏹", cost: 50, damage: 12, range: 105, rate: 650, color: "#4ade80", upgCost: 40, upgDmg: 8, upgRange: 8, desc: "Rapide 150hp ×2@5", maxHp: 150, armor: 0 },
  cannon: { name: "Canon", symbol: "💣", cost: 100, damage: 35, range: 72, rate: 1400, color: "#f87171", splash: 38, upgCost: 70, upgDmg: 22, upgRange: 5, desc: "Zone+ 280hp🛡", maxHp: 280, armor: 3 },
  ice:    { name: "Glace", symbol: "❄️", cost: 75, damage: 6, range: 115, rate: 850, color: "#60a5fa", slow: 0.35, slowDur: 2200, upgCost: 50, upgDmg: 4, upgRange: 12, desc: "Slow 120hp", maxHp: 120, armor: 0 },
  fire:   { name: "Feu", symbol: "🔥", cost: 125, damage: 20, range: 80, rate: 500, color: "#fb923c", dot: 8, dotDur: 3000, upgCost: 60, upgDmg: 12, upgRange: 6, desc: "DoT 180hp🛡", maxHp: 180, armor: 1 },
  sniper: { name: "Sniper", symbol: "🎯", cost: 150, damage: 90, range: 160, rate: 2200, color: "#c084fc", upgCost: 90, upgDmg: 50, upgRange: 15, desc: "Longue 100hp", maxHp: 100, armor: 0 },
  support:{ name: "Soutien", symbol: "💫", cost: 80, damage: 0, range: 90, rate: 0, color: "#e879f9", upgCost: 55, upgDmg: 0, upgRange: 15, desc: "Buff 1→3", maxHp: 100, armor: 0, isSupport: true,
    buffDmg: 0.3, buffRate: 0.85, buffRegen: 3, upgBuffDmg: 0.08, upgBuffRegen: 2 },
  forge:    { name: "Forge", symbol: "⚒️", cost: 120, damage: 0, range: 85, rate: 0, color: "#f59e0b", upgCost: 65, upgDmg: 0, upgRange: 10, desc: "DMG+30%", maxHp: 160, armor: 1, isBuilding: true,
    bType: "forge", bBuffDmg: 0.3, bUpgDmg: 0.1 },
  rempart:  { name: "Rempart", symbol: "🏰", cost: 130, damage: 0, range: 80, rate: 0, color: "#94a3b8", upgCost: 70, upgDmg: 0, upgRange: 10, desc: "+Armure +HP", maxHp: 250, armor: 3, isBuilding: true,
    bType: "rempart", bBuffArmor: 2, bBuffHp: 0.2, bUpgArmor: 1, bUpgHp: 0.08 },
  hopital:  { name: "Hôpital", symbol: "🏥", cost: 100, damage: 0, range: 90, rate: 0, color: "#34d399", upgCost: 55, upgDmg: 0, upgRange: 12, desc: "Soin/s", maxHp: 130, armor: 0, isBuilding: true,
    bType: "hopital", bRegen: 8, bUpgRegen: 5 },
  radar:    { name: "Radar", symbol: "📡", cost: 110, damage: 0, range: 95, rate: 0, color: "#38bdf8", upgCost: 60, upgDmg: 0, upgRange: 15, desc: "Portée+", maxHp: 100, armor: 0, isBuilding: true,
    bType: "radar", bBuffRange: 0.2, bUpgRange: 0.06 },
};

// XP thresholds for tower veterancy ranks
const XP_RANKS = [
  { xp: 0,   rank: 0, label: "",          dmgMult: 1,    hpMult: 1,    rateMult: 1,    star: "" },
  { xp: 40,  rank: 1, label: "Vétéran",   dmgMult: 1.1,  hpMult: 1.15, rateMult: 0.95, star: "⭐" },
  { xp: 100, rank: 2, label: "Élite",     dmgMult: 1.2,  hpMult: 1.3,  rateMult: 0.9,  star: "⭐⭐" },
  { xp: 200, rank: 3, label: "Héroïque",  dmgMult: 1.35, hpMult: 1.5,  rateMult: 0.85, star: "⭐⭐⭐" },
  { xp: 350, rank: 4, label: "Légendaire",dmgMult: 1.5,  hpMult: 1.75, rateMult: 0.8,  star: "🌟" },
];

function getRank(xp) {
  let r = XP_RANKS[0];
  for (const rank of XP_RANKS) { if (xp >= rank.xp) r = rank; }
  return r;
}
function getNextRank(xp) {
  for (const rank of XP_RANKS) { if (xp < rank.xp) return rank; }
  return null;
}

const ENEMY_DEFS = {
  goblin:   { hp: 55,   speed: 1.7,  gold: 12, color: "#22c55e", size: 6,  shape: "circle" },
  orc:      { hp: 150,  speed: 1.15, gold: 22, color: "#a855f7", size: 9,  shape: "square", shoots: true, eDmg: 4, eRange: 55, eRate: 2500 },
  wolf:     { hp: 80,   speed: 2.6,  gold: 16, color: "#94a3b8", size: 7,  shape: "circle" },
  troll:    { hp: 380,  speed: 0.7,  gold: 40, color: "#f97316", size: 12, shape: "diamond", shoots: true, eDmg: 8, eRange: 50, eRate: 3000 },
  mage:     { hp: 120,  speed: 1.4,  gold: 30, color: "#06b6d4", size: 8,  shape: "circle", healer: true },
  sapper:   { hp: 100,  speed: 1.8,  gold: 25, color: "#facc15", size: 7,  shape: "square", shoots: true, eDmg: 15, eRange: 40, eRate: 1800 },
  boss:     { hp: 1000, speed: 0.5,  gold: 120,color: "#ef4444", size: 15, shape: "star", shoots: true, eDmg: 12, eRange: 70, eRate: 2000 },
  megaboss: { hp: 3000, speed: 0.35, gold: 300,color: "#dc2626", size: 18, shape: "star", shoots: true, eDmg: 20, eRange: 80, eRate: 1500 },
};

function generateWave(waveNum, options = {}) {
  const mode = options.mode || "normal";
  const mapNum = options.mapNum || 1;
  const localWave = options.localWave || waveNum;
  const tierWave = mode === "campaign" ? localWave : waveNum;
  const progressionWave = mode === "campaign" ? (localWave + (mapNum - 1) * 2) : waveNum;
  const enemies = [];
  let hpScale = 1 + waveNum * 0.28;
  let spdScale = 1 + waveNum * 0.015;
  let isBoss = waveNum % 5 === 0;
  let isMega = waveNum % 10 === 0;

  if (mode === "campaign") {
    isBoss = localWave >= 5;
    isMega = localWave === 7;
    const mapStrength = 1 + (mapNum - 1) * 0.16;
    hpScale *= mapStrength;
    spdScale *= 1 + (mapNum - 1) * 0.03;
  }

  if (isMega) {
    enemies.push({ type: "megaboss", delay: 0 });
    for (let i = 0; i < 4 + waveNum / 4; i++) enemies.push({ type: Math.random() < 0.5 ? "troll" : "sapper", delay: 400 + i * 400 });
    for (let i = 0; i < 3; i++) enemies.push({ type: "mage", delay: 700 + i * 600 });
  } else if (isBoss) {
    enemies.push({ type: "boss", delay: 0 });
    const extraBossAdds = mode === "campaign" ? Math.floor(localWave - 4) : 0;
    for (let i = 0; i < 4 + waveNum / 4 + extraBossAdds; i++) enemies.push({ type: Math.random() < 0.4 ? "sapper" : "orc", delay: 400 + i * 400 });
  } else if (tierWave <= 2) {
    for (let i = 0; i < 6 + progressionWave * 3; i++) enemies.push({ type: "goblin", delay: i * 600 });
  } else if (tierWave <= 4) {
    for (let i = 0; i < 6 + progressionWave * 2; i++) {
      enemies.push({ type: Math.random() < 0.3 ? "orc" : "goblin", delay: i * 500 });
    }
  } else if (tierWave <= 7) {
    for (let i = 0; i < 8 + progressionWave; i++) {
      const r = Math.random();
      const t = r < 0.15 ? "sapper" : r < 0.3 ? "wolf" : r < 0.5 ? "orc" : r < 0.65 ? "troll" : "goblin";
      enemies.push({ type: t, delay: i * 420 });
    }
  } else {
    for (let i = 0; i < 10 + progressionWave; i++) {
      const r = Math.random();
      const t = r < 0.1 ? "mage" : r < 0.22 ? "sapper" : r < 0.35 ? "wolf" : r < 0.55 ? "troll" : r < 0.75 ? "orc" : "goblin";
      enemies.push({ type: t, delay: i * 330 });
    }
  }
  let out = enemies.map((e) => ({ ...e, hpScale, spdScale }));
  if (mode === "campaign" && localWave >= 5) {
    const bossStepMult = localWave === 5 ? 1.25 : localWave === 6 ? 1.45 : 1.75;
    out = out.map((e) => ({
      ...e,
      hpScale: (e.hpScale || 1) * bossStepMult,
      spdScale: (e.spdScale || 1) * (1 + (localWave - 4) * 0.03),
    }));
  }
  return out;
}

function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }

// Generate alternate path from a point to the exit row
function generateAltPath(baseCenterCol, baseCenterRow, exitRow, exitWaypoint, pathCells, towers) {
  const cells = new Set();
  const waypoints = [];
  let col = baseCenterCol, row = baseCenterRow;
  cells.add(`${col},${row}`);
  waypoints.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });

  // Navigate down to exit row with some zigzag
  while (row < exitRow) {
    const drop = Math.min(exitRow - row, 1 + Math.floor(Math.random() * 2));
    for (let r = row; r <= row + drop; r++) { cells.add(`${col},${r}`); }
    row += drop;
    waypoints.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
    if (row >= exitRow) break;
    // Horizontal shift
    const shift = Math.random() < 0.5 ? -1 : 1;
    const newCol = Math.max(0, Math.min(COLS - 1, col + shift * (1 + Math.floor(Math.random() * 3))));
    const dir = newCol > col ? 1 : -1;
    for (let c = col; dir > 0 ? c <= newCol : c >= newCol; c += dir) cells.add(`${c},${row}`);
    col = newCol;
    waypoints.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
  }
  // Connect to exit
  const exitCol = Math.floor(exitWaypoint.x / CELL);
  if (col !== exitCol) {
    const dir = exitCol > col ? 1 : -1;
    for (let c = col; dir > 0 ? c <= exitCol : c >= exitCol; c += dir) cells.add(`${c},${row}`);
    col = exitCol;
    waypoints.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
  }
  for (let c = col; c < COLS; c++) cells.add(`${c},${row}`);
  waypoints.push({ x: CW + 10, y: row * CELL + CELL / 2 });
  return { cells, waypoints };
}

// Generate an enemy base: cluster of 8 turrets + buff buildings
function generateEnemyBase(g) {
  const waveNum = g.wave;
  // Find a valid area for the base - prefer middle of map, not on existing path
  const candidates = [];
  for (let r = 3; r <= Math.floor(ROWS * 0.55); r++) {
    for (let c = 2; c <= COLS - 3; c++) {
      if (!g.path.cells.has(`${c},${r}`) && !g.towers.find(t => t.col === c && t.row === r)) {
        // Check how much space around
        let freeCount = 0;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nc = c + dc, nr = r + dr;
            if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && !g.path.cells.has(`${nc},${nr}`)) freeCount++;
          }
        }
        if (freeCount >= 12) candidates.push({ col: c, row: r, freeCount });
      }
    }
  }
  if (candidates.length === 0) return null;
  // Pick the best candidate (most free space)
  candidates.sort((a, b) => b.freeCount - a.freeCount);
  const center = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];

  // Place 8 turrets around center
  const baseTurrets = [];
  const baseBuildings = [];
  const usedCells = new Set();
  usedCells.add(`${center.col},${center.row}`);

  // Spiral outward from center
  const offsets = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2],[2,1],[-2,1],[1,2],[-1,2],[2,-1],[-2,-1]];
  const dmgScale = 1 + waveNum * 0.15;

  let turretCount = 0;
  let buildingCount = 0;
  const buildingTypes = [
    { type: "rage", symbol: "🔴", color: "#ef4444", desc: "DMG+", buffDmg: 0.3 + waveNum * 0.02 },
    { type: "haste", symbol: "🟡", color: "#fbbf24", desc: "SPD+", buffSpd: 0.25 + waveNum * 0.015 },
    { type: "fortify", symbol: "🟣", color: "#a855f7", desc: "HP+", buffHp: 0.3 + waveNum * 0.025 },
  ];

  for (const [dc, dr] of offsets) {
    if (turretCount >= 8 && buildingCount >= 2) break;
    const nc = center.col + dc, nr = center.row + dr;
    if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
    if (g.path.cells.has(`${nc},${nr}`)) continue;
    if (g.towers.find(t => t.col === nc && t.row === nr)) continue;
    if (g.enemyTurrets.find(et => et.col === nc && et.row === nr)) continue;
    if (usedCells.has(`${nc},${nr}`)) continue;
    usedCells.add(`${nc},${nr}`);

    // First 2 slots = buff buildings, rest = turrets
    if (buildingCount < 2 && (dc === 0 || dr === 0) && Math.abs(dc) + Math.abs(dr) === 1) {
      const bType = buildingTypes[buildingCount % buildingTypes.length];
      baseBuildings.push({
        col: nc, row: nr, x: nc * CELL + CELL / 2, y: nr * CELL + CELL / 2,
        hp: Math.floor(300 + waveNum * 30), maxHp: Math.floor(300 + waveNum * 30),
        gold: 60 + waveNum * 8, range: 120, ...bType, isBase: true,
      });
      buildingCount++;
    } else if (turretCount < 8) {
      baseTurrets.push({
        col: nc, row: nr, x: nc * CELL + CELL / 2, y: nr * CELL + CELL / 2,
        hp: Math.floor(200 + waveNum * 25), maxHp: Math.floor(200 + waveNum * 25),
        armor: Math.floor(waveNum / 5),
        damage: Math.floor(7 * dmgScale), range: 90 + Math.min(50, waveNum * 2),
        rate: 1500 - Math.min(600, waveNum * 25),
        maxTargets: 1, lastShot: 0, gold: 40 + waveNum * 5, isBase: true,
      });
      turretCount++;
    }
  }

  if (turretCount < 4) return null; // Not enough space

  return {
    centerCol: center.col, centerRow: center.row,
    turrets: baseTurrets, buildings: baseBuildings,
    alive: true, wavesSurvived: 0,
  };
}

export default function TowerDefense() {
  const canvasRef = useRef(null);
  const panRef = useRef({ active: false, moved: false, lastX: 0, lastY: 0, startX: 0, startY: 0 });
  const [gameMode, setGameMode] = useState("menu"); // "menu", "normal", "surprise", "campaign", "campaign-test"
  const [selectedTower, setSelectedTower] = useState(null);
  const [gold, setGold] = useState(250);
  const [lives, setLives] = useState(20);
  const [wave, setWave] = useState(0);
  const [phase, setPhase] = useState("prep");
  const [selectedPlaced, setSelectedPlaced] = useState(null);
  const [mapNum, setMapNum] = useState(1);
  const [mapTransition, setMapTransition] = useState(false);
  const [needsNewMap, setNeedsNewMap] = useState(false);
  const [rouletteActive, setRouletteActive] = useState(false);
  const [rouletteResult, setRouletteResult] = useState(null);
  const [rouletteSpin, setRouletteSpin] = useState(0);
  const [unlockedBuildings, setUnlockedBuildings] = useState([]);
  const [score, setScore] = useState(0);
  const [showHighscores, setShowHighscores] = useState(false);
  const [highscores, setHighscores] = useState([]);
  const [showNameInput, setShowNameInput] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [finalScore, setFinalScore] = useState(0);
  const [finalMode, setFinalMode] = useState("normal");
  const [paused, setPaused] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [campaignCoord, setCampaignCoord] = useState({ x: 0, y: 0 });

  const gs = useRef({
    towers: [], enemies: [], bullets: [], eBullets: [], particles: [], texts: [], flashes: [], enemyTurrets: [], enemyBuildings: [],
    enemyBase: null, altPath: null, altPathCells: null, frozenZones: [],
    gold: 250, lives: 20, wave: 0, phase: "prep",
    waveEnemies: [], waveTimer: 0, spawnIndex: 0,
    selectedTowerType: null, selectedPlacedTower: null,
    path: generatePath(42), mapSeed: 42, mapNum: 1,
    campaignMaps: [], spawnPaths: [], camX: 0, camY: 0, zoom: 1, baseCell: null,
    lastTap: 0, healTimer: 0, veteranXp: 0, needsNewMap: false,
    waveMods: {}, mode: "normal", score: 0, totalKills: 0, basesDestroyed: 0,
    campaignMapIndex: 0, campaignPrevExitRow: 1,
    paused: false,
  });

  // Highscore system using persistent storage
  const loadHighscores = useCallback(async () => {
    try {
      const data = localStorage.getItem("td-highscores");
      if (data) {
        setHighscores(JSON.parse(data));
      }
    } catch (e) {
      setHighscores([]);
    }
  }, []);

  const saveHighscore = useCallback(async (name, pts, mode, waveNum, mapCount) => {
    try {
      let scores = [];
      try {
        const data = localStorage.getItem("td-highscores");
        if (data) scores = JSON.parse(data);
      } catch (e) { /* empty */ }
      scores.push({ name: name.slice(0, 12), score: pts, mode, wave: waveNum, map: mapCount, date: new Date().toLocaleDateString("fr-FR") });
      scores.sort((a, b) => b.score - a.score);
      scores = scores.slice(0, 10);
      localStorage.setItem("td-highscores", JSON.stringify(scores));
      setHighscores(scores);
    } catch (e) {
      console.error("Failed to save highscore:", e);
    }
  }, []);

  const isHighscore = useCallback((pts) => {
    if (highscores.length < 10) return true;
    return pts > highscores[highscores.length - 1].score;
  }, [highscores]);

  // Load highscores on mount
  useEffect(() => { loadHighscores(); }, [loadHighscores]);

  // Score calculation helper
  const SCORE_POINTS = {
    kill_goblin: 10, kill_orc: 25, kill_wolf: 15, kill_troll: 40, kill_mage: 30,
    kill_sapper: 20, kill_boss: 200, kill_megaboss: 500,
    kill_turret: 50, kill_building: 60, base_destroyed: 500,
    wave_clear: 100, perfect_wave: 50, map_change: 300,
  };

  const syncState = useCallback(() => {
    const g = gs.current;
    const currentCap = g.needsNewMap ? GOLD_CAP_MAP : GOLD_CAP;
    g.gold = Math.min(g.gold, currentCap);
    setGold(g.gold); setLives(g.lives); setWave(g.wave);
    setPhase(g.phase); setSelectedPlaced(g.selectedPlacedTower);
    setMapNum(g.mapNum); setNeedsNewMap(g.needsNewMap);
    setScore(g.score);
    setZoom(g.zoom || 1);
    setCampaignCoord(generateCampaignSpiralCoord(g.campaignMapIndex || 0));
  }, []);

  const restartGame = useCallback(() => {
    const g = gs.current;
    g.towers = []; g.enemies = []; g.bullets = []; g.eBullets = [];
    g.particles = []; g.texts = []; g.flashes = []; g.enemyTurrets = []; g.enemyBuildings = [];
    g.enemyBase = null; g.altPath = null; g.altPathCells = null; g.frozenZones = [];
    g.gold = 250; g.lives = 20; g.wave = 0; g.phase = "prep";
    g.waveEnemies = []; g.waveTimer = 0; g.spawnIndex = 0;
    g.selectedTowerType = null; g.selectedPlacedTower = null;
    g.mapSeed = Date.now() % 100000; g.path = generatePath(g.mapSeed);
    g.campaignMaps = []; g.spawnPaths = []; g.camX = 0; g.camY = 0; g.zoom = 1; g.baseCell = null;
    g.mapNum = 1; g.needsNewMap = false; g.healTimer = 0; g.veteranXp = 0;
    g.waveMods = {}; g.score = 0; g.totalKills = 0; g.basesDestroyed = 0;
    g.campaignMapIndex = 0; g.campaignPrevExitRow = 1;
    g.paused = false;
    setZoom(1);
    setSelectedTower(null);
    setPaused(false);
    setRouletteActive(false); setRouletteResult(null);
    setUnlockedBuildings([]);
    setGameMode("menu");
    syncState();
  }, [syncState]);

  const newMap = useCallback(() => {
    const g = gs.current;
    // Save total XP from old towers as veteran knowledge
    const totalXp = g.towers.reduce((sum, t) => sum + t.xp, 0);
    g.veteranXp = Math.floor(totalXp * 0.4); // 40% XP carries over
    g.mapSeed = g.mapSeed * 3 + 17;
    if (g.mode === "campaign") {
      const nextIndex = (g.campaignMapIndex || 0) + 1;
      const nextSpiral = generateCampaignSpiralCoord(nextIndex);
      const colOffset = nextSpiral.x * COLS;
      const rowOffset = nextSpiral.y * ROWS;

      // Determine border points for the new map
      const connRng = ((s) => { let v = s; return () => { v = (v * 16807 + 0) % 2147483647; return (v & 0x7fffffff) / 0x7fffffff; }; })(g.mapSeed);

      // Build a spiral lookup of existing maps
      const spiralLookup = new Map();
      g.campaignMaps.forEach((m) => {
        const sx = Math.round(m.colOffset / COLS);
        const sy = Math.round(m.rowOffset / ROWS);
        spiralLookup.set(`${sx},${sy}`, m);
      });

      const bps = [];
      const sides = [
        { side: "left", dx: -1, dy: 0 },
        { side: "right", dx: 1, dy: 0 },
        { side: "top", dx: 0, dy: -1 },
        { side: "bottom", dx: 0, dy: 1 },
      ];

      for (const s of sides) {
        const neighborKey = `${nextSpiral.x + s.dx},${nextSpiral.y + s.dy}`;
        const neighborMap = spiralLookup.get(neighborKey);
        if (neighborMap) {
          // This side connects to an existing map — match their border point
          const theirSide = oppositeSide(s.side);
          const theirBp = (neighborMap.borderPoints || []).find((b) => b.side === theirSide);
          if (theirBp) {
            // Mirror the point: same row for left/right, same col for top/bottom
            const bp = { ...mirrorBorderPoint(theirBp), side: s.side };
            bps.push(bp);
          } else {
            bps.push(pickBorderPoint(s.side, connRng));
          }
        } else {
          // Outer border — spawn entry
          bps.push(pickBorderPoint(s.side, connRng));
        }
      }

      // Sort by angle from center for path generation
      const cx = COLS / 2, cy = ROWS / 2;
      bps.sort((a, b) => Math.atan2(a.row - cy, a.col - cx) - Math.atan2(b.row - cy, b.col - cx));

      const localPath = generateCampaignPath(g.mapSeed, bps);
      const worldPath = offsetPathToWorld(localPath, colOffset, rowOffset);
      const newMapObj = {
        index: nextIndex, colOffset, rowOffset, path: worldPath,
        borderPoints: bps,
        spawnCell: { col: colOffset + bps[0].col, row: rowOffset + bps[0].row },
      };

      g.campaignMaps.push(newMapObj);
      g.campaignMapIndex = nextIndex;
      rebuildCampaignCompositePath(g);

      const bounds = getCampaignWorldBounds(g.campaignMaps);
      const viewW = CW / (g.zoom || 1);
      const viewH = CH / (g.zoom || 1);
      g.camX = clamp(colOffset * CELL + viewW * 0.2, bounds.minX - viewW * 0.25, bounds.maxX - viewW + viewW * 0.25);
      g.camY = clamp(rowOffset * CELL + viewH * 0.2, bounds.minY - viewH * 0.25, bounds.maxY - viewH + viewH * 0.25);
    } else {
      g.path = generatePath(g.mapSeed);
      g.spawnPaths = [g.path.waypoints];
    }
    g.mapNum++;
    if (g.mode === "campaign") {
      g.enemies = []; g.bullets = []; g.eBullets = []; g.flashes = [];
      g.enemyTurrets = []; g.enemyBuildings = [];
    } else {
      g.towers = []; g.enemies = []; g.bullets = []; g.eBullets = []; g.flashes = []; g.enemyTurrets = []; g.enemyBuildings = [];
    }
    g.enemyBase = null; g.altPath = null; g.altPathCells = null; g.frozenZones = [];
    // Scaled gold bonus: 200 base + 50 per map + refund for lost towers
    g.gold += 250 + g.mapNum * 75;
    // Map change score bonus
    g.score += Math.floor(SCORE_POINTS.map_change * (g.mode === "surprise" ? 1.5 : g.mode === "campaign" ? 1.25 : 1));
    g.selectedPlacedTower = null; g.selectedTowerType = null;
    g.needsNewMap = false;
    setSelectedTower(null);
    setMapTransition(true);
    setTimeout(() => setMapTransition(false), 1800);
    syncState();
  }, [syncState]);

  const applyRouletteAndStart = useCallback((event) => {
    const g = gs.current;
    g.waveMods = {};
    if (event) {
      switch (event.id) {
        case "jackpot": g.waveMods.goldX2 = true; break;
        case "cadence": g.waveMods.towerRateBonus = 0.6; break;
        case "fortifie": g.waveMods.towerArmorBonus = 4; break;
        case "miracle": g.towers.forEach(t => { t.hp = t.maxHp; }); break;
        case "precision": g.waveMods.towerDmgBonus = 0.5; break;
        case "tresor": g.gold += 500; break;
        case "regen": g.waveMods.towerRegen = 12; break;
        case "titan": g.waveMods.titan = true; break;
        case "invasion": g.waveMods.extraTurrets = 4; break;
        case "rush": g.waveMods.enemySpeedBonus = 0.6; break;
        case "enrage": g.waveMods.enemyDmgBonus = 0.5; g.waveMods.enemySpeedBonus = 0.3; g.waveMods.enemyHpBonus = 0.25; break;
        case "blinde": g.waveMods.enemyHpBonus = 0.6; break;
        case "brouillard": g.waveMods.towerRangeMalus = 0.3; break;
        case "sabotage": {
          const alive = g.towers.filter(t => t.hp > 0);
          for (let i = 0; i < Math.min(2, alive.length); i++) {
            const t = alive[Math.floor(Math.random() * alive.length)];
            t.hp = Math.max(1, Math.floor(t.hp * 0.5));
            g.texts.push({ x: t.x, y: t.y - 15, text: "💣-50%", life: 1.5 });
          }
          break;
        }
        case "taxe": {
          const lost = Math.floor(g.gold * 0.3);
          g.gold = Math.max(0, g.gold - lost);
          g.texts.push({ x: CW / 2, y: 30, text: `🏦 -${lost}💰 TAXE!`, life: 2 });
          break;
        }
        case "demolition": {
          const candidates = g.towers.filter(t => t.hp > 0);
          if (candidates.length > 0) {
            const victim = candidates[Math.floor(Math.random() * candidates.length)];
            g.texts.push({ x: victim.x, y: victim.y - 15, text: "🧨 BOOM!", life: 2 });
            for (let i = 0; i < 20; i++) g.particles.push({ x: victim.x, y: victim.y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 1.2, size: 4, color: "#ef4444" });
            if (g.selectedPlacedTower === victim) g.selectedPlacedTower = null;
            g.towers = g.towers.filter(t => t !== victim);
          }
          break;
        }
        case "horde": g.waveMods.horde = true; break;
        case "corrosion": {
          g.towers.forEach(t => {
            if (t.armor > 0) {
              g.texts.push({ x: t.x, y: t.y - 12, text: "🧪0🛡", life: 1.2 });
              t.armor = 0;
            }
          });
          break;
        }
        case "famine": g.waveMods.goldHalf = true; break;
      }
    }
    syncState();
  }, [syncState]);

  // This function actually generates enemies and starts spawning.
  // Called DIRECTLY if no roulette, or AFTER roulette animation finishes.
  const beginSpawning = useCallback((waveNum) => {
    const g = gs.current;
    const localWave = g.mode === "campaign" ? ((waveNum - 1) % 7) + 1 : waveNum;
    g.waveEnemies = generateWave(waveNum, { mode: g.mode, mapNum: g.mapNum, localWave });
    g.spawnIndex = 0; g.waveTimer = 0;

    // Apply roulette mods to enemies if any
    if (g.waveMods.enemyHpBonus) {
      g.waveEnemies.forEach(e => { e.hpScale = (e.hpScale || 1) * (1 + g.waveMods.enemyHpBonus); });
    }
    if (g.waveMods.enemySpeedBonus) {
      g.waveEnemies.forEach(e => { e.spdScale = (e.spdScale || 1) * (1 + g.waveMods.enemySpeedBonus); });
    }
    // Titan: insert mega boss at front
    if (g.waveMods.titan) {
      const hpScale = (1 + waveNum * 0.28) * 1.5;
      g.waveEnemies.unshift({ type: "megaboss", delay: 0, hpScale, spdScale: 1 });
      for (let i = 1; i < g.waveEnemies.length; i++) g.waveEnemies[i].delay += 800;
    }
    // Horde: double the enemies
    if (g.waveMods.horde) {
      const dupes = g.waveEnemies.map(e => ({ ...e, delay: e.delay + 200 }));
      g.waveEnemies.push(...dupes);
    }
    // ENEMY BASE: extra mobs and mark them to use alt path
    if (g.enemyBase && g.enemyBase.alive) {
      // +10% mob strength per wave the base has survived
      const baseBuff = 1 + g.enemyBase.wavesSurvived * 0.10;
      if (baseBuff > 1) {
        g.waveEnemies.forEach(e => {
          e.hpScale = (e.hpScale || 1) * baseBuff;
          e.spdScale = (e.spdScale || 1) * (1 + g.enemyBase.wavesSurvived * 0.03);
        });
      }
      // Add 60% extra enemies
      const extraCount = Math.floor(g.waveEnemies.length * 0.6);
      const lastDelay = g.waveEnemies.length > 0 ? g.waveEnemies[g.waveEnemies.length - 1].delay : 0;
      for (let i = 0; i < extraCount; i++) {
        const template = g.waveEnemies[i % g.waveEnemies.length];
        g.waveEnemies.push({ ...template, delay: lastDelay + 300 + i * 350 });
      }
      // Mark all enemies to use alt path
      g.waveEnemies.forEach(e => { e.useAltPath = true; });
    }
    // Extra turrets from invasion
    if (g.waveMods.extraTurrets) {
      const extra = g.waveMods.extraTurrets;
      const candidateCells = [];
      g.path.cells.forEach((key) => {
        const [c, r] = key.split(",").map(Number);
        for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nc = c + dc, nr = r + dr;
          if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && !g.path.cells.has(`${nc},${nr}`) && !g.towers.find(t => t.col === nc && t.row === nr) && !g.enemyTurrets.find(et => et.col === nc && et.row === nr)) {
            if (!candidateCells.find(cc => cc.col === nc && cc.row === nr)) candidateCells.push({ col: nc, row: nr });
          }
        }
      });
      const dmgScale = 1 + waveNum * 0.15;
      for (let i = 0; i < extra && candidateCells.length > 0; i++) {
        const idx = Math.floor(Math.random() * candidateCells.length);
        const cell = candidateCells.splice(idx, 1)[0];
        g.enemyTurrets.push({
          col: cell.col, row: cell.row, x: cell.col * CELL + CELL / 2, y: cell.row * CELL + CELL / 2,
          hp: Math.floor(250 + waveNum * 30), maxHp: Math.floor(250 + waveNum * 30),
          armor: Math.floor(waveNum / 5), damage: Math.floor(8 * dmgScale), range: 100 + Math.min(60, waveNum * 3),
          rate: 1400 - Math.min(700, waveNum * 30), maxTargets: 1 + Math.floor(waveNum / 6), lastShot: 0, gold: 50 + waveNum * 6,
        });
      }
    }

    g.phase = "wave"; // NOW spawning begins
    syncState();
  }, [syncState]);

  const startWave = useCallback(() => {
    const g = gs.current;
    if (g.paused) return;
    if (g.mode === "campaign-test") return;
    if (g.phase !== "prep") return;
    if (g.needsNewMap) { newMap(); return; }
    g.wave++;
    g.waveEnemies = []; // EMPTY — nothing to spawn yet
    g.spawnIndex = 0; g.waveTimer = 0;
    g.selectedPlacedTower = null; g.waveMods = {};
    g.phase = "busy"; // not "prep" (hides button), not "wave" (no spawn)

    // Surprise/Campaign mode: unlock building every 3 waves
    if ((g.mode === "surprise" || g.mode === "campaign") && g.wave % 3 === 0) {
      const unlockIdx = Math.floor(g.wave / 3) - 1;
      if (unlockIdx < BUILDING_KEYS.length) {
        const newKey = BUILDING_KEYS[unlockIdx];
        setUnlockedBuildings(prev => prev.includes(newKey) ? prev : [...prev, newKey]);
        g.texts.push({ x: CW / 2, y: 30, text: `🔓 ${TOWER_DEFS[newKey].symbol} ${TOWER_DEFS[newKey].name} débloqué!`, life: 2 });
      }
    }
    // Spawn enemy turrets from wave 4+
    if (g.wave >= 4) {
      const numTurrets = Math.min(6, 2 + Math.floor((g.wave - 2) / 2));
      const candidateCells = [];
      g.path.cells.forEach((key) => {
        const [c, r] = key.split(",").map(Number);
        if (r <= Math.floor(ROWS * 0.4)) {
          for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
            const nc = c + dc, nr = r + dr;
            if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS
              && !g.path.cells.has(`${nc},${nr}`)
              && !(g.altPathCells && g.altPathCells.has(`${nc},${nr}`))
              && !g.towers.find(t => t.col === nc && t.row === nr)
              && !g.enemyTurrets.find(et => et.col === nc && et.row === nr)) {
              if (!candidateCells.find(cc => cc.col === nc && cc.row === nr)) candidateCells.push({ col: nc, row: nr });
            }
          }
        }
      });
      g.enemyTurrets = g.enemyTurrets.filter(et => et.isBase && et.hp > 0); // keep alive base turrets
      if (candidateCells.length > 0) {
        const seedIdx = Math.floor(Math.random() * candidateCells.length);
        const seed = candidateCells[seedIdx];
        candidateCells.sort((a, b) => {
          const da = Math.abs(a.col - seed.col) + Math.abs(a.row - seed.row);
          const db = Math.abs(b.col - seed.col) + Math.abs(b.row - seed.row);
          return da - db;
        });
        const dmgScale = 1 + g.wave * 0.15;
        for (let i = 0; i < numTurrets && i < candidateCells.length; i++) {
          const cell = candidateCells[i];
          g.enemyTurrets.push({
            col: cell.col, row: cell.row,
            x: cell.col * CELL + CELL / 2, y: cell.row * CELL + CELL / 2,
            hp: Math.floor(250 + g.wave * 30), maxHp: Math.floor(250 + g.wave * 30),
            armor: Math.floor(g.wave / 5),
            damage: Math.floor(8 * dmgScale), range: 100 + Math.min(60, g.wave * 3),
            rate: 1400 - Math.min(700, g.wave * 30),
            maxTargets: 1 + Math.floor(g.wave / 6),
            lastShot: 0, gold: 50 + g.wave * 6,
          });
          for (let j = 0; j < 6; j++)
            g.particles.push({ x: cell.col * CELL + CELL / 2, y: cell.row * CELL + CELL / 2, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 1, size: 3, color: "#ef4444" });
        }
      }
    }
    // Spawn enemy buff buildings from wave 6+
    if (g.wave >= 6) {
      const numBuildings = Math.min(3, Math.floor((g.wave - 4) / 3));
      const midCells = [];
      g.path.cells.forEach((key) => {
        const [c, r] = key.split(",").map(Number);
        if (r >= Math.floor(ROWS * 0.25) && r <= Math.floor(ROWS * 0.75)) {
          for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nc = c + dc, nr = r + dr;
            if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS
              && !g.path.cells.has(`${nc},${nr}`)
              && !g.towers.find(t => t.col === nc && t.row === nr)
              && !g.enemyTurrets.find(et => et.col === nc && et.row === nr)
              && !(g.enemyBuildings || []).find(eb => eb.col === nc && eb.row === nr)) {
              if (!midCells.find(mc => mc.col === nc && mc.row === nr)) midCells.push({ col: nc, row: nr });
            }
          }
        }
      });
      g.enemyBuildings = (g.enemyBuildings || []).filter(eb => eb.isBase && eb.hp > 0); // keep alive base buildings
      const buildingTypes = [
        { type: "rage", symbol: "🔴", color: "#ef4444", desc: "DMG+", buffDmg: 0.3 + g.wave * 0.02 },
        { type: "haste", symbol: "🟡", color: "#fbbf24", desc: "SPD+", buffSpd: 0.25 + g.wave * 0.015 },
        { type: "fortify", symbol: "🟣", color: "#a855f7", desc: "HP+", buffHp: 0.3 + g.wave * 0.025 },
      ];
      for (let i = 0; i < numBuildings && midCells.length > 0; i++) {
        const idx = Math.floor(Math.random() * midCells.length);
        const cell = midCells.splice(idx, 1)[0];
        const bType = buildingTypes[i % buildingTypes.length];
        g.enemyBuildings.push({
          col: cell.col, row: cell.row,
          x: cell.col * CELL + CELL / 2, y: cell.row * CELL + CELL / 2,
          hp: Math.floor(200 + g.wave * 25), maxHp: Math.floor(200 + g.wave * 25),
          gold: 55 + g.wave * 7, range: 100,
          ...bType,
        });
        for (let j = 0; j < 8; j++)
          g.particles.push({ x: cell.col * CELL + CELL / 2, y: cell.row * CELL + CELL / 2, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 1, size: 3, color: bType.color });
      }
    }

    // ENEMY BASE - wave 13+, 35% chance, only if no base currently active
    if (!g.enemyBase) {
      g.altPath = null; g.altPathCells = null;
    }
    const localWaveForBase = g.mode === "campaign" ? ((g.wave - 1) % 7) + 1 : g.wave;
    const canSpawnBase = g.mode === "campaign" ? g.wave > 7 : g.wave >= 13;
    const baseChance = g.mode === "campaign" ? 0.55 : 0.35;
    if (canSpawnBase && !g.enemyBase && Math.random() < baseChance) {
      const base = generateEnemyBase(g);
      if (base) {
        g.enemyBase = base;
        // Add base turrets and buildings to game
        g.enemyTurrets.push(...base.turrets);
        (g.enemyBuildings || (g.enemyBuildings = [])).push(...base.buildings);

        // Generate alt path from base center to exit
        const exitWp = g.path.waypoints[g.path.waypoints.length - 1];
        const exitRow = Math.floor(exitWp.y / CELL);
        const alt = generateAltPath(base.centerCol, base.centerRow, exitRow, exitWp, g.path.cells, g.towers);
        g.altPath = alt.waypoints;
        g.altPathCells = alt.cells;

        // Destroy allied towers on the alt path (free!)
        const destroyed = [];
        g.towers = g.towers.filter(t => {
          if (alt.cells.has(`${t.col},${t.row}`)) {
            destroyed.push(t);
            g.texts.push({ x: t.x, y: t.y - 15, text: "💥 ÉCRASÉ!", life: 1.5 });
            for (let i = 0; i < 12; i++)
              g.particles.push({ x: t.x, y: t.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 1, size: 4, color: "#f97316" });
            if (g.selectedPlacedTower === t) g.selectedPlacedTower = null;
            return false;
          }
          return true;
        });

        // Announce base
        g.texts.push({ x: CW / 2, y: 20, text: "⚠️ BASE ENNEMIE DÉTECTÉE!", life: 2.5 });
        g.texts.push({ x: CW / 2, y: 35, text: `🗼×${base.turrets.length} + ${base.buildings.length} bâtiments`, life: 2 });
        if (destroyed.length > 0) g.texts.push({ x: CW / 2, y: 50, text: `💥 ${destroyed.length} tour(s) détruites!`, life: 2 });

        // Big particle explosion at base center
        for (let i = 0; i < 30; i++)
          g.particles.push({ x: base.centerCol * CELL + CELL / 2, y: base.centerRow * CELL + CELL / 2, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 1.5, size: 5, color: "#f97316" });
      }
    }

    // Surprise mode roulette — fixed 40% chance
    const waveNum = g.wave;
    if (g.mode === "surprise" && waveNum >= 2 && Math.random() < ROULETTE_CHANCE) {
      const chosen = pickRouletteEvent();
      setRouletteActive(true);
      setRouletteResult(null);
      setRouletteSpin(0);
      let spinCount = 0;
      const spinInterval = setInterval(() => {
        spinCount++;
        setRouletteSpin(spinCount);
        if (spinCount >= 20) {
          clearInterval(spinInterval);
          setRouletteResult(chosen);
          applyRouletteAndStart(chosen);
          // Show result 2.5s, THEN generate enemies and start
          setTimeout(() => {
            setRouletteActive(false);
            beginSpawning(waveNum); // enemies generated HERE, phase="wave" HERE
          }, 2500);
        }
      }, 100);
      syncState();
    } else {
      // No roulette — generate enemies and start immediately
      beginSpawning(waveNum);
    }
  }, [syncState, newMap, applyRouletteAndStart, beginSpawning]);

  const handleCanvasTap = useCallback((cx, cy) => {
    const g = gs.current;
    if (g.paused) return;
    const now = Date.now();
    if (now - g.lastTap < 200) return;
    g.lastTap = now;

    // Restart from game over
    if (g.phase === "gameover") {
      g.phase = "scoreboard"; // prevent double-click
      setFinalScore(g.score);
      setFinalMode(g.mode);
      if (isHighscore(g.score)) {
        setShowNameInput(true);
      } else {
        setShowHighscores(true);
      }
      return;
    }
    if (g.phase === "scoreboard") return;

    const col = Math.floor(cx / CELL), row = Math.floor(cy / CELL);
    if (g.mode === "campaign") {
      const inAnyMap = (g.campaignMaps || []).some((m) => (
        col >= m.colOffset && col < m.colOffset + COLS && row >= m.rowOffset && row < m.rowOffset + ROWS
      ));
      if (!inAnyMap) return;
    } else {
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    }

    const existing = g.towers.find((t) => t.col === col && t.row === row);
    if (existing) {
      g.selectedPlacedTower = existing; g.selectedTowerType = null;
      setSelectedTower(null); syncState(); return;
    }
    if (g.selectedTowerType && !g.path.cells.has(`${col},${row}`) && !(g.altPathCells && g.altPathCells.has(`${col},${row}`))) {
      const def = TOWER_DEFS[g.selectedTowerType];
      if (g.gold >= def.cost && !g.towers.find((t) => t.col === col && t.row === row) && !g.enemyTurrets.find((et) => et.col === col && et.row === row) && !(g.enemyBuildings || []).find((eb) => eb.col === col && eb.row === row)) {
        // Check tower/building limit
        const isBuilding = def.isBuilding;
        const currentTowers = g.towers.filter(t => !TOWER_DEFS[t.type].isBuilding).length;
        const currentBuildings = g.towers.filter(t => TOWER_DEFS[t.type].isBuilding).length;
        if (isBuilding ? currentBuildings >= MAX_BUILDINGS : currentTowers >= MAX_TOWERS) return;
        g.gold -= def.cost;
        const startXp = g.veteranXp || 0;
        const rank = getRank(startXp);
        const camp = g.mode === "campaign" ? getCampaignTowerMapMultipliers(g.mapNum) : { dmgMult: 1, rateMult: 1, rangeMult: 1, hpBonusPerMap: 20 };
        const mapHpBonus = (g.mapNum - 1) * camp.hpBonusPerMap;
        const baseRange = Math.floor(def.range * camp.rangeMult);
        const baseMaxHp = Math.floor((def.maxHp + mapHpBonus) * rank.hpMult);
        const tDmg = Math.floor(def.damage * rank.dmgMult * camp.dmgMult);
        const tRate = Math.max(200, Math.floor(def.rate * rank.rateMult * camp.rateMult));
        g.towers.push({
          col, row, x: col * CELL + CELL / 2, y: row * CELL + CELL / 2,
          type: g.selectedTowerType, level: 1, lastShot: 0,
          baseDamage: def.damage, baseRange, baseRate: def.rate,
          damage: tDmg, range: baseRange, rate: tRate,
          hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp,
          armor: def.armor + rank.rank, xp: startXp, kills: 0,
          mapDmgMult: camp.dmgMult, mapRateMult: camp.rateMult, mapHpBonus,
        });
        // Rank up particles if veteran
        if (rank.rank > 0) {
          g.texts.push({ x: col * CELL + CELL / 2, y: row * CELL - 4, text: rank.star, life: 1.2 });
        }
        for (let i = 0; i < 8; i++)
          g.particles.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 1, size: 3, color: def.color });
        syncState();
      }
    } else { g.selectedPlacedTower = null; syncState(); }
  }, [syncState, restartGame, isHighscore]);

  const upgradeTower = useCallback(() => {
    const g = gs.current; const t = g.selectedPlacedTower; if (!t) return;
    const def = TOWER_DEFS[t.type]; const cost = def.upgCost * t.level;
    if (g.gold >= cost && t.level < 5) {
      g.gold -= cost; t.level++;
      const rank = getRank(t.xp);
      const def = TOWER_DEFS[t.type];
      const lvlDmg = def.upgDmg * (t.level - 1);
      const lvlRange = def.upgRange * (t.level - 1);
      const lvlRate = 60 * (t.level - 1);
      t.damage = Math.floor((t.baseDamage + lvlDmg) * rank.dmgMult * (t.mapDmgMult || 1));
      t.range = t.baseRange + lvlRange;
      t.rate = Math.max(200, Math.floor((t.baseRate - lvlRate) * rank.rateMult * (t.mapRateMult || 1)));
      t.baseMaxHp = Math.floor((def.maxHp + (t.mapHpBonus ?? ((g.mapNum - 1) * 20)) + (t.level - 1) * 20) * rank.hpMult);
      t.maxHp = t.baseMaxHp;
      t.hp = Math.min(t.hp + 40, t.maxHp);
      t.armor = def.armor + rank.rank;
      for (let i = 0; i < 12; i++)
        g.particles.push({ x: t.x, y: t.y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 1, size: 3, color: "#fbbf24" });
      syncState();
    }
  }, [syncState]);

  const repairTower = useCallback(() => {
    const g = gs.current; const t = g.selectedPlacedTower; if (!t) return;
    const repairCost = Math.ceil((t.maxHp - t.hp) * 0.4);
    if (repairCost > 0 && g.gold >= repairCost) {
      g.gold -= repairCost; t.hp = t.maxHp;
      for (let i = 0; i < 6; i++)
        g.particles.push({ x: t.x, y: t.y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3, life: 0.8, size: 2, color: "#4ade80" });
      syncState();
    }
  }, [syncState]);

  const sellTower = useCallback(() => {
    const g = gs.current; const t = g.selectedPlacedTower; if (!t) return;
    const def = TOWER_DEFS[t.type];
    g.gold += Math.floor(def.cost * 0.6 + def.upgCost * (t.level - 1) * 0.4);
    g.towers = g.towers.filter((tw) => tw !== t);
    g.selectedPlacedTower = null; syncState();
  }, [syncState]);

  const togglePause = useCallback(() => {
    const g = gs.current;
    if (gameMode === "menu") return;
    if (g.phase === "gameover" || g.phase === "scoreboard") return;
    g.paused = !g.paused;
    setPaused(g.paused);
  }, [gameMode]);

  const nudgeCamera = useCallback((dx, dy) => {
    const g = gs.current;
    if (g.mode !== "campaign" && g.mode !== "campaign-test") return;
    const bounds = getCampaignWorldBounds(g.campaignMaps);
    const viewW = CW / (g.zoom || 1);
    const viewH = CH / (g.zoom || 1);
    const padX = viewW * 0.25;
    const padY = viewH * 0.25;
    g.camX = clamp(g.camX + dx, bounds.minX - padX, bounds.maxX - viewW + padX);
    g.camY = clamp(g.camY + dy, bounds.minY - padY, bounds.maxY - viewH + padY);
    syncState();
  }, [syncState]);

  const adjustZoom = useCallback((delta) => {
    const g = gs.current;
    if (g.mode !== "campaign" && g.mode !== "campaign-test") return;
    const oldZoom = g.zoom || 1;
    const nextZoom = clamp(oldZoom + delta, 0.35, 2.2);
    if (Math.abs(nextZoom - oldZoom) < 0.001) return;
    const centerX = g.camX + CW / oldZoom / 2;
    const centerY = g.camY + CH / oldZoom / 2;
    g.zoom = nextZoom;
    const viewW = CW / nextZoom;
    const viewH = CH / nextZoom;
    g.camX = centerX - viewW / 2;
    g.camY = centerY - viewH / 2;
    const bounds = getCampaignWorldBounds(g.campaignMaps);
    const padX = viewW * 0.25;
    const padY = viewH * 0.25;
    g.camX = clamp(g.camX, bounds.minX - padX, bounds.maxX - viewW + padX);
    g.camY = clamp(g.camY, bounds.minY - padY, bounds.maxY - viewH + padY);
    syncState();
  }, [syncState]);

  const startMode = useCallback((mode) => {
    const g = gs.current;
    g.mode = mode;
    g.waveMods = {};
    g.campaignMapIndex = 0;
    g.campaignPrevExitRow = 1;
    g.paused = false;
    g.camX = 0; g.camY = 0; g.zoom = 1;
    if (mode === "campaign") {
      // First map: border entries on all 4 sides
      const connRng = ((s) => { let v = s; return () => { v = (v * 16807 + 0) % 2147483647; return (v & 0x7fffffff) / 0x7fffffff; }; })(g.mapSeed);
      const bps = [
        pickBorderPoint("left", connRng),
        pickBorderPoint("right", connRng),
        pickBorderPoint("top", connRng),
        pickBorderPoint("bottom", connRng),
      ];
      // Sort by angle from center for path generation
      const cx = COLS / 2, cy = ROWS / 2;
      bps.sort((a, b) => Math.atan2(a.row - cy, a.col - cx) - Math.atan2(b.row - cy, b.col - cx));
      const localPath = generateCampaignPath(g.mapSeed, bps);
      const basePath = offsetPathToWorld(localPath, 0, 0);
      const firstMap = {
        index: 0, colOffset: 0, rowOffset: 0, path: basePath,
        borderPoints: bps,
        spawnCell: { col: bps[0].col, row: bps[0].row },
      };
      g.campaignMaps = [firstMap];
      g.path = { cells: new Set(basePath.cells), waypoints: basePath.waypoints };
      g.baseCell = { col: Math.floor(COLS / 2), row: Math.floor(ROWS / 2) };
      g.spawnPaths = buildCampaignSpawnPaths(g.campaignMaps);
      g.campaignMapIndex = 0;
      g.zoom = 1;
      g.wave = 0; g.phase = "prep"; g.needsNewMap = false;
      g.enemies = []; g.bullets = []; g.eBullets = []; g.flashes = []; g.enemyTurrets = []; g.enemyBuildings = [];
      g.enemyBase = null; g.altPath = null; g.altPathCells = null; g.frozenZones = [];
      g.selectedPlacedTower = null; g.selectedTowerType = null;
      setUnlockedBuildings([]);
    } else if (mode === "campaign-test") {
      const preview = buildCampaignPreviewWorld(g.mapSeed, 3);
      g.campaignMaps = preview.maps;
      g.path = preview.path;
      g.spawnPaths = preview.spawnPaths;
      g.baseCell = preview.baseCell;
      g.mapSeed = preview.mapSeed;
      g.campaignPrevExitRow = preview.prevExitRow;
      g.campaignMapIndex = preview.maps.length - 1;
      g.mapNum = preview.maps.length;
      g.wave = 0; g.phase = "prep"; g.needsNewMap = false;
      g.enemies = []; g.bullets = []; g.eBullets = []; g.flashes = []; g.enemyTurrets = []; g.enemyBuildings = [];
      g.enemyBase = null; g.altPath = null; g.altPathCells = null; g.frozenZones = [];
      g.selectedPlacedTower = null; g.selectedTowerType = null;
      const bounds = getCampaignWorldBounds(preview.maps);
      const worldW = Math.max(1, bounds.maxX - bounds.minX);
      const worldH = Math.max(1, bounds.maxY - bounds.minY);
      const fitZoom = clamp(Math.min((CW * 0.92) / worldW, (CH * 0.92) / worldH), 0.35, 1);
      g.zoom = fitZoom;
      const viewW = CW / g.zoom;
      const viewH = CH / g.zoom;
      g.camX = clamp((bounds.minX + bounds.maxX - viewW) / 2, bounds.minX - viewW * 0.25, bounds.maxX - viewW + viewW * 0.25);
      g.camY = clamp((bounds.minY + bounds.maxY - viewH) / 2, bounds.minY - viewH * 0.25, bounds.maxY - viewH + viewH * 0.25);
      setUnlockedBuildings([]);
    } else {
      g.campaignMaps = [];
      g.path = generatePath(g.mapSeed);
      g.spawnPaths = [g.path.waypoints];
      g.baseCell = null;
      g.zoom = 1;
      g.selectedPlacedTower = null;
      g.selectedTowerType = null;
      if (mode === "normal") setUnlockedBuildings([...BUILDING_KEYS]);
      else setUnlockedBuildings([]);
    }
    setPaused(false);
    setGameMode(mode);
    syncState();
  }, [syncState]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "p" || e.key === "P" || e.code === "Space") {
        e.preventDefault();
        togglePause();
      }
      const step = CELL * 2;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") nudgeCamera(-step, 0);
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") nudgeCamera(step, 0);
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") nudgeCamera(0, -step);
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") nudgeCamera(0, step);
      if (e.key === "+" || e.key === "=") adjustZoom(0.1);
      if (e.key === "-" || e.key === "_") adjustZoom(-0.1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePause, nudgeCamera, adjustZoom]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId, lastTime = performance.now();

    const loop = (now) => {
      const dt = Math.min(now - lastTime, 50); lastTime = now;
      const g = gs.current; const wp = g.path.waypoints;

      if (!g.paused) {

      // Spawn — only when phase is "wave" (not during roulette "busy" phase)
      if (g.phase === "wave" && g.spawnIndex < g.waveEnemies.length) {
        g.waveTimer += dt;
        const ne = g.waveEnemies[g.spawnIndex];
        if (g.waveTimer >= ne.delay) {
          const spawnPaths = ((g.mode === "campaign" || g.mode === "campaign-test") && (g.spawnPaths || []).length > 0) ? g.spawnPaths : [wp];
          // In campaign, enemies cycle through all outer border spawn paths
          const chosenWp = spawnPaths[g.spawnIndex % spawnPaths.length] || wp;
          const def = ENEMY_DEFS[ne.type];
          const enemy = {
            x: chosenWp[0].x, y: chosenWp[0].y,
            hp: Math.floor(def.hp * ne.hpScale), maxHp: Math.floor(def.hp * ne.hpScale),
            speed: def.speed * ne.spdScale, baseSpeed: def.speed * ne.spdScale,
            gold: def.gold + Math.floor(g.wave * 2.5),
            color: def.color, size: def.size, shape: def.shape,
            waypointIdx: 1, slowTimer: 0, dotTimer: 0, dotDmg: 0,
            type: ne.type, healer: def.healer || false,
            shoots: def.shoots || false,
            eDmg: Math.floor((def.eDmg || 0) * (1 + g.wave * 0.08)),
            eRange: def.eRange || 0,
            eRate: def.eRate || 9999,
            lastEShot: 0,
          };
          enemy.customWp = chosenWp;
          // Alt path: after 1st cell, teleport to base center and follow alt path
          if (ne.useAltPath && g.altPath && g.enemyBase && g.enemyBase.alive) {
            enemy.customWp = [chosenWp[0], ...g.altPath];
            enemy.useAltPath = true;
          }
          g.enemies.push(enemy);
          g.spawnIndex++;
        }
      }

      // Move enemies
      g.enemies.forEach((e) => {
        const eWp = e.customWp || wp;
        if (e.waypointIdx >= eWp.length) return;
        const w = eWp[e.waypointIdx];
        const dx = w.x - e.x, dy = w.y - e.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        // Teleport effect when switching to alt path (waypoint 1 = base center)
        if (e.useAltPath && e.waypointIdx === 1 && d > CELL * 3) {
          e.x = w.x; e.y = w.y; e.waypointIdx++;
          // Teleport particles
          g.particles.push({ x: e.x, y: e.y, vx: 0, vy: -2, life: 0.8, size: 4, color: "#f97316" });
          g.particles.push({ x: e.x, y: e.y, vx: 2, vy: 0, life: 0.8, size: 4, color: "#f97316" });
          g.particles.push({ x: e.x, y: e.y, vx: -2, vy: 0, life: 0.8, size: 4, color: "#f97316" });
          return;
        }
        const spd = e.speed * (dt / 16);
        if (d < spd + 2) { e.x = w.x; e.y = w.y; e.waypointIdx++; }
        else { e.x += (dx / d) * spd; e.y += (dy / d) * spd; }
        if (e.slowTimer > 0) { e.slowTimer -= dt; if (e.slowTimer <= 0) e.speed = e.baseSpeed; }
        if (e.dotTimer > 0) { e.dotTimer -= dt; e.hp -= e.dotDmg * (dt / 1000); }
      });

      // Enemy buildings buff nearby enemies
      g.enemies.forEach((e) => { e.buffedDmg = 1; e.buffedSpd = 1; e.buffedHp = false; });
      (g.enemyBuildings || []).forEach((eb) => {
        if (eb.hp <= 0) return;
        g.enemies.forEach((e) => {
          if (dist(eb, e) <= eb.range) {
            if (eb.type === "rage") e.buffedDmg = (e.buffedDmg || 1) * (1 + eb.buffDmg);
            if (eb.type === "haste") e.buffedSpd = Math.max(e.buffedSpd || 1, 1 + eb.buffSpd);
            if (eb.type === "fortify") e.buffedHp = true;
          }
        });
      });
      // Apply haste
      g.enemies.forEach((e) => {
        if (e.buffedSpd > 1 && e.slowTimer <= 0) e.speed = Math.max(e.speed, e.baseSpeed * e.buffedSpd);
      });

      // Enemies shoot towers
      g.enemies.forEach((e) => {
        if (!e.shoots || e.hp <= 0) return;
        if (now - e.lastEShot < e.eRate) return;
        const rageMult = (e.buffedDmg || 1) * (1 + ((g.waveMods || {}).enemyDmgBonus || 0));
        const rageDmg = Math.floor(e.eDmg * rageMult);
        let closest = null, minD = Infinity;
        g.towers.forEach((t) => {
          const d = dist(e, t);
          if (d <= e.eRange && d < minD) { minD = d; closest = t; }
        });
        if (closest) {
          e.lastEShot = now;
          g.eBullets.push({
            x: e.x, y: e.y, tx: closest.x, ty: closest.y,
            target: closest, speed: 3, damage: rageDmg, color: e.color,
          });
          // Muzzle flash line from enemy to target
          g.flashes.push({ x1: e.x, y1: e.y, x2: closest.x, y2: closest.y, life: 1, color: e.color });
          // Recoil particles
          const angle = Math.atan2(closest.y - e.y, closest.x - e.x);
          for (let i = 0; i < 4; i++) {
            const spread = (Math.random() - 0.5) * 0.8;
            g.particles.push({
              x: e.x + Math.cos(angle) * e.size,
              y: e.y + Math.sin(angle) * e.size,
              vx: Math.cos(angle + spread) * (2 + Math.random() * 2),
              vy: Math.sin(angle + spread) * (2 + Math.random() * 2),
              life: 0.5, size: 2.5, color: "#ff6666",
            });
          }
        }
      });

      // Move enemy bullets
      g.eBullets = g.eBullets.filter((b) => {
        if (!g.towers.includes(b.target)) return false;
        const dx = b.target.x - b.x, dy = b.target.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 10) {
          const reducedDmg = Math.max(1, b.damage - (b.target.effectiveArmor || b.target.armor || 0));
          b.target.hp -= reducedDmg;
          for (let i = 0; i < 4; i++)
            g.particles.push({ x: b.target.x, y: b.target.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 0.6, size: 3, color: "#ff4444" });
          // Destroy tower
          if (b.target.hp <= 0) {
            g.texts.push({ x: b.target.x, y: b.target.y - 14, text: "💥", life: 1.2 });
            for (let i = 0; i < 15; i++)
              g.particles.push({ x: b.target.x, y: b.target.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, life: 1, size: 4, color: "#f87171" });
            if (g.selectedPlacedTower === b.target) g.selectedPlacedTower = null;
            g.towers = g.towers.filter((tw) => tw !== b.target);
          }
          return false;
        }
        b.x += (dx / d) * b.speed * (dt / 16);
        b.y += (dy / d) * b.speed * (dt / 16);
        return true;
      });

      // Healer
      g.healTimer = (g.healTimer || 0) + dt;
      if (g.healTimer > 1000) {
        g.healTimer = 0;
        g.enemies.filter((e) => e.healer && e.hp > 0).forEach((h) => {
          g.enemies.forEach((e) => {
            if (e !== h && dist(e, h) < 60 && e.hp > 0 && e.hp < e.maxHp) {
              e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.05);
              g.particles.push({ x: e.x, y: e.y - e.size, vx: (Math.random() - 0.5) * 2, vy: -1.5, life: 0.5, size: 3, color: "#06b6d4" });
            }
          });
        });
      }

      // Remove reached end
      g.enemies = g.enemies.filter((e) => {
        const eWp = e.customWp || wp;
        if (e.waypointIdx >= eWp.length) {
          g.lives = Math.max(0, g.lives - 1);
          if (g.lives <= 0 && g.phase !== "gameover" && g.phase !== "scoreboard") {
            // Final score: add wave bonus
            g.score += g.wave * 50;
            g.phase = "gameover";
          }
          return false;
        }
        return true;
      });

      // Support tower buff logic
      g.towers.forEach((t) => { t.buffed = false; t.supportedBy = null; t.supportCount = 0; t.buffedDamage = 0; t.buffedRate = 0; t.bldgBonusDmg = 0; t.bldgBonusArmor = 0; t.bldgBonusHp = 0; t.bldgBonusRange = 0; t.bldgRegen = 0; });
      // Track which allies are already support-buffed to distribute across supports
      const alreadySupportBuffed = new Set();
      g.towers.filter(t => TOWER_DEFS[t.type].isSupport).forEach((sup) => {
        const def = TOWER_DEFS[sup.type];
        const buffDmg = def.buffDmg + (sup.level - 1) * def.upgBuffDmg;
        const buffRate = Math.pow(def.buffRate, 1 + (sup.level - 1) * 0.05);
        const buffRegen = def.buffRegen + (sup.level - 1) * def.upgBuffRegen;
        // Number of allies buffed: lv1-2=1, lv3-4=2, lv5=3
        const maxTargets = sup.level >= 5 ? 3 : sup.level >= 3 ? 2 : 1;
        // Find allies in range, prioritize unbuffed first then by damage
        const alliesInRange = g.towers.filter(ally => {
          if (ally === sup || TOWER_DEFS[ally.type].isSupport || TOWER_DEFS[ally.type].isBuilding) return false;
          return dist(sup, ally) <= sup.range;
        }).sort((a, b) => {
          const aBuffed = alreadySupportBuffed.has(a) ? 1 : 0;
          const bBuffed = alreadySupportBuffed.has(b) ? 1 : 0;
          if (aBuffed !== bBuffed) return aBuffed - bBuffed; // unbuffed first
          return b.damage - a.damage; // then by damage
        });
        const buffTargets = alliesInRange.slice(0, maxTargets);
        sup.buffTargets = buffTargets;
        sup.buffTarget = buffTargets[0] || null;
        buffTargets.forEach(ally => {
          alreadySupportBuffed.add(ally);
          ally.buffed = true;
          ally.supportedBy = sup;
          ally.supportCount = (ally.supportCount || 0) + 1;
          // Stack buffs: second support at 60% efficiency
          const stackMult = ally.supportCount > 1 ? 0.6 : 1;
          const bonusPct = buffDmg * stackMult;
          // Accumulate buff on base damage
          const prevBonus = ally.buffedDamage > 0 ? (ally.buffedDamage / ally.damage - 1) : 0;
          ally.buffedDamage = Math.floor(ally.damage * (1 + prevBonus + bonusPct));
          ally.buffedRate = Math.max(150, Math.min(ally.buffedRate || 9999, Math.floor(ally.rate * buffRate)));
          if (ally.hp < ally.maxHp) {
            ally.hp = Math.min(ally.maxHp, ally.hp + buffRegen * (dt / 1000));
          }
        });
      });

      // Player building buff logic
      g.towers.filter(t => TOWER_DEFS[t.type].isBuilding).forEach((bld) => {
        const def = TOWER_DEFS[bld.type];
        g.towers.forEach((ally) => {
          if (ally === bld || TOWER_DEFS[ally.type].isBuilding) return;
          if (dist(bld, ally) > bld.range) return;
          if (def.bType === "forge") {
            ally.bldgBonusDmg += def.bBuffDmg + (bld.level - 1) * def.bUpgDmg;
          } else if (def.bType === "rempart") {
            ally.bldgBonusArmor += def.bBuffArmor + (bld.level - 1) * def.bUpgArmor;
            ally.bldgBonusHp = Math.max(ally.bldgBonusHp, def.bBuffHp + (bld.level - 1) * def.bUpgHp);
          } else if (def.bType === "hopital") {
            ally.bldgRegen += def.bRegen + (bld.level - 1) * def.bUpgRegen;
          } else if (def.bType === "radar") {
            ally.bldgBonusRange = Math.max(ally.bldgBonusRange, def.bBuffRange + (bld.level - 1) * def.bUpgRange);
          }
        });
      });
      // Apply building buffs
      g.towers.forEach((t) => {
        if (TOWER_DEFS[t.type].isBuilding) return;
        // Forge damage
        if (t.bldgBonusDmg > 0) {
          const boosted = Math.floor(t.damage * (1 + t.bldgBonusDmg));
          if (t.buffed) t.buffedDamage = Math.floor(t.buffedDamage * (1 + t.bldgBonusDmg));
          else { t.buffed = true; t.buffedDamage = boosted; t.buffedRate = t.rate; }
        }
        // Radar range
        if (t.bldgBonusRange > 0) t.effectiveRange = Math.floor(t.range * (1 + t.bldgBonusRange));
        else t.effectiveRange = t.range;
        // Hopital regen
        if (t.bldgRegen > 0 && t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + t.bldgRegen * (dt / 1000));
        // Rempart: temporary armor & hp boost
        t.effectiveArmor = (t.armor || 0) + t.bldgBonusArmor;
      });

      // Towers shoot (skip support & building towers)
      const wm = g.waveMods || {};
      // Wave mod: tower regen
      if (wm.towerRegen) {
        g.towers.forEach(t => { if (t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + wm.towerRegen * (dt / 1000)); });
      }
      g.towers.forEach((t) => {
        const def = TOWER_DEFS[t.type];
        if (def.isSupport || def.isBuilding) return;
        let effectiveRate = t.buffed ? (t.buffedRate || t.rate) : t.rate;
        let effectiveDmg = t.buffed ? (t.buffedDamage || t.damage) : t.damage;
        let effectiveRange = t.effectiveRange || t.range;
        // Apply wave mods
        if (wm.towerRateBonus) effectiveRate = Math.floor(effectiveRate * (1 - wm.towerRateBonus));
        if (wm.towerDmgBonus) effectiveDmg = Math.floor(effectiveDmg * (1 + wm.towerDmgBonus));
        if (wm.towerRangeMalus) effectiveRange = Math.floor(effectiveRange * (1 - wm.towerRangeMalus));
        t.effectiveArmor = (t.effectiveArmor || t.armor || 0) + (wm.towerArmorBonus || 0);
        if (now - t.lastShot < effectiveRate) return;
        let target = null, bestProg = -1, minD = Infinity;
        g.enemies.forEach((e) => {
          const d = dist(t, e);
          if (d <= effectiveRange && (e.waypointIdx > bestProg || (e.waypointIdx === bestProg && d < minD))) {
            bestProg = e.waypointIdx; minD = d; target = e;
          }
        });
        g.enemyTurrets.forEach((et) => {
          const d = dist(t, et);
          if (d <= effectiveRange && d < minD * 0.8) { target = et; minD = d; }
        });
        (g.enemyBuildings || []).forEach((eb) => {
          const d = dist(t, eb);
          if (d <= effectiveRange && d < minD * 0.7) { target = eb; minD = d; }
        });
        if (target) {
          t.lastShot = now;
          const splashSize = (def.splash || 0) + (t.type === "cannon" ? (t.level - 1) * 10 : 0); // Canon: +10 splash per level
          g.bullets.push({
            x: t.x, y: t.y, target, speed: 5.5, damage: effectiveDmg, type: t.type,
            splash: splashSize, slow: def.slow || 0, slowDur: def.slowDur || 0,
            dot: def.dot || 0, dotDur: def.dotDur || 0, color: def.color,
            sourceTower: t,
          });
          // Archer lv5: double shot at a second target
          if (t.type === "archer" && t.level >= 5) {
            let target2 = null, bestProg2 = -1, minD2 = Infinity;
            g.enemies.forEach((e) => {
              if (e === target) return;
              const d = dist(t, e);
              if (d <= effectiveRange && (e.waypointIdx > bestProg2 || (e.waypointIdx === bestProg2 && d < minD2))) {
                bestProg2 = e.waypointIdx; minD2 = d; target2 = e;
              }
            });
            if (!target2) target2 = target; // no second target, double-tap same
            g.bullets.push({
              x: t.x, y: t.y, target: target2, speed: 5.5, damage: effectiveDmg, type: t.type,
              splash: 0, slow: 0, slowDur: 0, dot: 0, dotDur: 0, color: def.color,
              sourceTower: t,
            });
          }
        }
      });

      // Enemy turrets shoot player towers (multi-target)
      g.enemyTurrets.forEach((et) => {
        if (et.hp <= 0) return;
        if (now - et.lastShot < et.rate) return;
        // Find up to maxTargets towers in range
        const targets = [];
        g.towers.slice().sort((a, b) => dist(et, a) - dist(et, b)).forEach((t) => {
          if (targets.length < (et.maxTargets || 1) && dist(et, t) <= et.range) targets.push(t);
        });
        if (targets.length > 0) {
          et.lastShot = now;
          targets.forEach((tgt) => {
            g.eBullets.push({ x: et.x, y: et.y, tx: tgt.x, ty: tgt.y, target: tgt, speed: 3.5, damage: et.damage, color: "#ef4444" });
            g.flashes.push({ x1: et.x, y1: et.y, x2: tgt.x, y2: tgt.y, life: 1, color: "#ef4444" });
          });
          for (let i = 0; i < 4; i++) {
            g.particles.push({ x: et.x, y: et.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 0.5, size: 3, color: "#ff6666" });
          }
        }
      });

      // Apply armor to enemy turrets when hit by tower bullets
      // (handled in bullet hit section via target.armor)

      // Kill enemy turrets
      g.enemyTurrets = g.enemyTurrets.filter((et) => {
        if (et.hp <= 0) {
          let etGold = (g.waveMods || {}).goldX2 ? et.gold * 2 : et.gold;
          if ((g.waveMods || {}).goldHalf) etGold = Math.floor(etGold * 0.5);
          g.gold += etGold;
          g.texts.push({ x: et.x, y: et.y - 10, text: `+${etGold}💰🗼`, life: 1.2 });
          for (let i = 0; i < 14; i++) g.particles.push({ x: et.x, y: et.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 1, size: 4, color: "#ef4444" });
          g.score += Math.floor(SCORE_POINTS.kill_turret * (g.mode === "surprise" ? 1.5 : 1));
          return false;
        }
        return true;
      });

      // Kill enemy buildings
      g.enemyBuildings = (g.enemyBuildings || []).filter((eb) => {
        if (eb.hp <= 0) {
          let ebGold = (g.waveMods || {}).goldX2 ? eb.gold * 2 : eb.gold;
          if ((g.waveMods || {}).goldHalf) ebGold = Math.floor(ebGold * 0.5);
          g.gold += ebGold;
          g.texts.push({ x: eb.x, y: eb.y - 10, text: `+${ebGold}💰${eb.symbol}`, life: 1.2 });
          for (let i = 0; i < 16; i++) g.particles.push({ x: eb.x, y: eb.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, life: 1.2, size: 4, color: eb.color });
          g.score += Math.floor(SCORE_POINTS.kill_building * (g.mode === "surprise" ? 1.5 : 1));
          return false;
        }
        return true;
      });

      // Check if enemy base is destroyed
      if (g.enemyBase && g.enemyBase.alive) {
        const baseTurretsAlive = g.enemyTurrets.some(et => et.isBase && et.hp > 0);
        const baseBuildingsAlive = (g.enemyBuildings || []).some(eb => eb.isBase && eb.hp > 0);
        if (!baseTurretsAlive && !baseBuildingsAlive) {
          g.enemyBase.alive = false;
          g.altPath = null;
          g.altPathCells = null;
          // Switch remaining alt-path enemies back to normal path
          g.enemies.forEach(e => {
            if (e.useAltPath) {
              e.useAltPath = false;
              e.customWp = null;
              // Find nearest normal waypoint
              let bestIdx = 1, bestD = Infinity;
              wp.forEach((w, i) => { const d = dist(e, w); if (d < bestD) { bestD = d; bestIdx = i; } });
              e.waypointIdx = Math.max(bestIdx, 1);
            }
          });
          g.texts.push({ x: CW / 2, y: CH / 2 - 20, text: "💥 BASE ENNEMIE DÉTRUITE!", life: 2.5 });
          g.score += Math.floor(SCORE_POINTS.base_destroyed * (g.mode === "surprise" ? 1.5 : 1));
          g.basesDestroyed++;
          // Big celebration particles
          const cx = g.enemyBase.centerCol * CELL + CELL / 2;
          const cy = g.enemyBase.centerRow * CELL + CELL / 2;
          for (let i = 0; i < 40; i++)
            g.particles.push({ x: cx, y: cy, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, life: 2, size: 5, color: ["#fbbf24","#ef4444","#f97316","#4ade80"][i%4] });
          // Bonus gold
          const baseBonus = 100 + g.wave * 20;
          g.gold += baseBonus;
          g.texts.push({ x: CW / 2, y: CH / 2 - 5, text: `+${baseBonus}💰 BONUS BASE`, life: 2 });
        }
      }

      // Update frozen zones
      g.frozenZones = (g.frozenZones || []).filter(fz => {
        fz.timer -= dt;
        // Slow enemies in the zone
        g.enemies.forEach(e => {
          const d = Math.sqrt((e.x - fz.x) ** 2 + (e.y - fz.y) ** 2);
          if (d <= fz.radius) {
            e.speed = e.baseSpeed * 0.4;
            e.slowTimer = Math.max(e.slowTimer, 500);
          }
        });
        return fz.timer > 0;
      });

      // Tower bullets
      g.bullets = g.bullets.filter((b) => {
        const dx = b.target.x - b.x, dy = b.target.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 8 || b.target.hp <= 0) {
          if (b.target.hp > 0) {
            const armorReduction = b.target.armor || 0;
            const fortifyMult = b.target.buffedHp ? 0.5 : 1; // fortify = 50% less damage
            const effectiveDmg = Math.max(1, Math.floor((b.damage - armorReduction) * fortifyMult));
            b.target.hp -= effectiveDmg;
            b.target.lastHitTower = b.sourceTower;
            if (b.slow > 0 && b.target.baseSpeed) { b.target.speed = b.target.baseSpeed * b.slow; b.target.slowTimer = b.slowDur; }
            if (b.dot > 0 && b.target.dotTimer !== undefined) { b.target.dotDmg = b.dot; b.target.dotTimer = b.dotDur; }
            if (b.splash > 0) {
              g.enemies.forEach((e) => { if (e !== b.target && dist(e, b.target) < b.splash) e.hp -= Math.floor(b.damage * 0.5); });
              for (let i = 0; i < 8; i++) g.particles.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, life: 1, size: 4, color: "#ff6b35" });
            }
            // ICE tower: frozen ground zone when upgraded (level 2+)
            if (b.type === "ice" && b.sourceTower && b.sourceTower.level >= 2) {
              const iceLevel = b.sourceTower.level;
              const radius = 15 + (iceLevel - 2) * 7; // 15 at lv2, 22 at lv3, 29 at lv4, 36 at lv5
              const duration = 1800 + (iceLevel - 2) * 600; // 1.8s at lv2, up to 3.6s at lv5
              g.frozenZones.push({ x: b.target.x, y: b.target.y, radius, timer: duration, maxTimer: duration });
              // Ice particles
              for (let i = 0; i < 6; i++)
                g.particles.push({ x: b.target.x, y: b.target.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 0.8, size: 3, color: "#93c5fd" });
            }
            // FIRE tower: line pierce when upgraded (level 2+)
            if (b.type === "fire" && b.sourceTower && b.sourceTower.level >= 2) {
              const fireLevel = b.sourceTower.level;
              const pierceCount = fireLevel - 1; // 1 extra at lv2, 2 at lv3, 3 at lv4, 4 at lv5
              const pierceRange = 40 + fireLevel * 15; // how far the line extends
              // Direction from tower to target
              const angle = Math.atan2(b.target.y - b.sourceTower.y, b.target.x - b.sourceTower.x);
              let pierced = 0;
              // Sort enemies by distance along the line from the target
              const lineEnemies = g.enemies.filter(e => {
                if (e === b.target || e.hp <= 0) return false;
                // Project enemy onto the line from target in the direction of angle
                const ex = e.x - b.target.x, ey = e.y - b.target.y;
                const proj = ex * Math.cos(angle) + ey * Math.sin(angle);
                const perp = Math.abs(-ex * Math.sin(angle) + ey * Math.cos(angle));
                return proj > 0 && proj < pierceRange && perp < 18;
              }).sort((a, b2) => {
                const ax = a.x - b.target.x, ay = a.y - b.target.y;
                const bx = b2.x - b.target.x, by = b2.y - b.target.y;
                return (ax * Math.cos(angle) + ay * Math.sin(angle)) - (bx * Math.cos(angle) + by * Math.sin(angle));
              });
              for (const e of lineEnemies) {
                if (pierced >= pierceCount) break;
                const pierceDmg = Math.max(1, Math.floor(b.damage * 0.7));
                e.hp -= pierceDmg;
                e.lastHitTower = b.sourceTower;
                if (b.dot > 0) { e.dotDmg = b.dot; e.dotTimer = b.dotDur; }
                pierced++;
                // Fire trail particles
                for (let i = 0; i < 3; i++)
                  g.particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, life: 0.6, size: 3, color: "#fb923c" });
              }
              // Visual fire line
              if (pierced > 0) {
                const endX = b.target.x + Math.cos(angle) * pierceRange;
                const endY = b.target.y + Math.sin(angle) * pierceRange;
                g.flashes.push({ x1: b.target.x, y1: b.target.y, x2: endX, y2: endY, life: 0.8, color: "#fb923c" });
              }
            }
            for (let i = 0; i < 3; i++) g.particles.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 0.7, size: 2, color: b.color });
          }
          return false;
        }
        b.x += (dx / d) * b.speed * (dt / 16); b.y += (dy / d) * b.speed * (dt / 16);
        return true;
      });

      // Kill & gold + XP
      g.enemies = g.enemies.filter((e) => {
        if (e.hp <= 0) {
          let killGold = (g.waveMods || {}).goldX2 ? e.gold * 2 : e.gold;
          if ((g.waveMods || {}).goldHalf) killGold = Math.floor(killGold * 0.5);
          g.gold += killGold;
          g.texts.push({ x: e.x, y: e.y - 10, text: `+${e.gold}💰`, life: 1 });
          for (let i = 0; i < 10; i++) g.particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 1, size: e.size * 0.35, color: e.color });
          // Score
          const scoreKey = `kill_${e.type}`;
          const pts = SCORE_POINTS[scoreKey] || 10;
          const modeMult = g.mode === "surprise" ? 1.5 : 1;
          g.score += Math.floor(pts * modeMult);
          g.totalKills++;
          // Award XP to killing tower
          const killer = e.lastHitTower;
          if (killer && g.towers.includes(killer)) {
            const oldRank = getRank(killer.xp);
            const xpGain = 5 + Math.floor(e.maxHp / 30);
            killer.xp += xpGain;
            killer.kills++;
            // Share XP to support tower if buffed
            if (killer.supportedBy && g.towers.includes(killer.supportedBy)) {
              killer.supportedBy.xp += Math.floor(xpGain * 0.5);
              killer.supportedBy.kills++;
            }
            const newRank = getRank(killer.xp);
            // Rank up! Recalc stats + heal
            if (newRank.rank > oldRank.rank) {
              const def = TOWER_DEFS[killer.type];
              const lvlDmg = def.upgDmg * (killer.level - 1);
              const lvlRange = def.upgRange * (killer.level - 1);
              const lvlRate = 60 * (killer.level - 1);
              killer.damage = Math.floor((killer.baseDamage + lvlDmg) * newRank.dmgMult * (killer.mapDmgMult || 1));
              killer.range = Math.floor((killer.baseRange + lvlRange) * 1);
              killer.rate = Math.max(200, Math.floor((killer.baseRate - lvlRate) * newRank.rateMult * (killer.mapRateMult || 1)));
              killer.baseMaxHp = Math.floor((def.maxHp + (killer.mapHpBonus ?? ((g.mapNum - 1) * 20)) + (killer.level - 1) * 20) * newRank.hpMult);
              killer.maxHp = killer.baseMaxHp;
              killer.hp = killer.maxHp; // full heal on rank up!
              killer.armor = def.armor + newRank.rank;
              g.texts.push({ x: killer.x, y: killer.y - 18, text: newRank.star + newRank.label, life: 1.5 });
              for (let i = 0; i < 15; i++)
                g.particles.push({ x: killer.x, y: killer.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 1.2, size: 3, color: "#fbbf24" });
            }
          }
          return false;
        }
        return true;
      });

      // Particles, texts
      g.particles = g.particles.filter((p) => { p.x += p.vx * (dt / 16); p.y += p.vy * (dt / 16); p.vy += 0.08; p.life -= 0.025; return p.life > 0; });
      g.texts = g.texts.filter((t) => { t.y -= 0.6 * (dt / 16); t.life -= 0.018; return t.life > 0; });
      g.flashes = g.flashes.filter((f) => { f.life -= 0.08; return f.life > 0; });

      // Wave clear check
      if (g.phase === "wave" && g.spawnIndex >= g.waveEnemies.length && g.enemies.length === 0) {
        g.phase = "prep";
        if (g.wave % (g.mode === "campaign" ? 7 : 10) === 0) g.needsNewMap = true;
        // Clear base state only if destroyed; persist if alive
        if (g.enemyBase && g.enemyBase.alive) {
          g.enemyBase.wavesSurvived++;
          g.texts.push({ x: CW / 2, y: 85, text: `⚠️ Base ennemie survit! +${g.enemyBase.wavesSurvived * 10}% force`, life: 2 });
        } else {
          g.enemyBase = null; g.altPath = null; g.altPathCells = null;
        }
        g.frozenZones = [];
        // Wave clear bonus: scales with wave
        const clearBonus = 30 + g.wave * 12;
        // Interest: 8% of current gold (capped at 80)
        const interest = Math.min(80, Math.floor(g.gold * 0.08));
        // Survival bonus if all lives intact
        const survivalBonus = g.lives >= 20 ? 15 : 0;
        const totalBonus = clearBonus + interest + survivalBonus;
        g.gold += totalBonus;
        g.texts.push({ x: CW / 2, y: 40, text: `+${clearBonus}💰 clear`, life: 1.5 });
        if (interest > 0) g.texts.push({ x: CW / 2, y: 55, text: `+${interest}💰 intérêt`, life: 1.5 });
        if (survivalBonus > 0) g.texts.push({ x: CW / 2, y: 70, text: `+${survivalBonus}💰 parfait!`, life: 1.5 });
        // Score: wave clear + bonus for perfect
        const modeMult = g.mode === "surprise" ? 1.5 : 1;
        const waveScore = Math.floor((SCORE_POINTS.wave_clear + g.wave * 20) * modeMult);
        const perfectScore = g.lives >= 20 ? Math.floor(SCORE_POINTS.perfect_wave * modeMult) : 0;
        g.score += waveScore + perfectScore;
        // Regen towers between waves - veteran towers heal more
        g.towers.forEach((t) => {
          const rank = getRank(t.xp);
          const regenPct = 0.2 + rank.rank * 0.1; // 20% base + 10% per rank
          t.hp = Math.min(t.maxHp, t.hp + Math.floor(t.maxHp * regenPct));
        });
        g.waveMods = {};
      }
      syncState();
      }

      // === DRAW ===
      ctx.clearRect(0, 0, CW, CH);
      const bgGrad = ctx.createLinearGradient(0, 0, 0, CH);
      bgGrad.addColorStop(0, "#0d1117"); bgGrad.addColorStop(1, "#161b22");
      ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, CW, CH);

      ctx.fillStyle = "rgba(255,255,255,0.03)";
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) ctx.fillRect(c * CELL + CELL / 2, r * CELL + CELL / 2, 1, 1);

      ctx.save();
      if (g.mode === "campaign" || g.mode === "campaign-test") {
        const z = g.zoom || 1;
        ctx.setTransform(z, 0, 0, z, -g.camX * z, -g.camY * z);
      }

      if ((g.mode === "campaign" || g.mode === "campaign-test") && (g.campaignMaps || []).length > 0) {
        g.campaignMaps.forEach((m) => {
          const x = m.colOffset * CELL;
          const y = m.rowOffset * CELL;
          ctx.fillStyle = "rgba(20,30,45,0.35)";
          ctx.fillRect(x, y, CW, CH);
          ctx.strokeStyle = "rgba(96,165,250,0.28)";
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, CW - 1, CH - 1);
          ctx.fillStyle = "rgba(96,165,250,0.45)";
          ctx.font = `6px ${PIXEL_FONT}`;
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText(`M${m.index + 1}`, x + 4, y + 4);
        });
      }

      // Path
      g.path.cells.forEach((key) => {
        const [c, r] = key.split(",").map(Number);
        ctx.fillStyle = "#252d3a"; ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = "rgba(180,160,130,0.07)";
        for (let i = 0; i < 4; i++) {
          const px = ((c * 7 + r * 11 + i * 37) % (CELL - 6)) + 3;
          const py = ((c * 13 + r * 5 + i * 23) % (CELL - 6)) + 3;
          ctx.fillRect(c * CELL + px, r * CELL + py, 2, 2);
        }
      });

      ctx.font = `7px ${PIXEL_FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (g.mode === "campaign" || g.mode === "campaign-test") {
        // Show base marker
        if (g.baseCell) {
          ctx.fillStyle = "rgba(239,68,68,0.8)";
          ctx.fillText("🏠", g.baseCell.col * CELL + CELL / 2, g.baseCell.row * CELL + CELL / 2);
        }
        // Show border entry markers on each map
        const spiralLookup = new Set();
        (g.campaignMaps || []).forEach((m) => {
          const sx = Math.round(m.colOffset / COLS);
          const sy = Math.round(m.rowOffset / ROWS);
          spiralLookup.add(`${sx},${sy}`);
        });
        (g.campaignMaps || []).forEach((m) => {
          const sx = Math.round(m.colOffset / COLS);
          const sy = Math.round(m.rowOffset / ROWS);
          const sideDx = { left: -1, right: 1, top: 0, bottom: 0 };
          const sideDy = { left: 0, right: 0, top: -1, bottom: 1 };
          (m.borderPoints || []).forEach((bp) => {
            const nx = sx + (sideDx[bp.side] || 0);
            const ny = sy + (sideDy[bp.side] || 0);
            const isOuter = !spiralLookup.has(`${nx},${ny}`);
            if (isOuter) {
              ctx.fillStyle = "rgba(74,222,128,0.6)";
              ctx.fillText("▶", (m.colOffset + bp.col) * CELL + CELL / 2, (m.rowOffset + bp.row) * CELL + CELL / 2);
            }
          });
        });
      } else {
        ctx.fillStyle = "rgba(74,222,128,0.4)"; ctx.fillText("▶IN", 14, wp[0].y);
        ctx.fillStyle = "rgba(239,68,68,0.4)"; ctx.fillText("OUT▶", CW - 14, wp[wp.length - 1].y);
      }

      // Alt path (orange) when enemy base is alive
      if (g.altPathCells && g.enemyBase && g.enemyBase.alive) {
        g.altPathCells.forEach((key) => {
          const [c, r] = key.split(",").map(Number);
          const pulse = (Math.sin(now * 0.005 + c + r) + 1) * 0.1 + 0.25;
          ctx.fillStyle = `rgba(249,115,22,${pulse})`; ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
          // Orange glow border
          ctx.strokeStyle = `rgba(251,146,60,${pulse * 0.6})`; ctx.lineWidth = 1;
          ctx.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
        });
        // Base center marker
        const bcx = g.enemyBase.centerCol * CELL + CELL / 2;
        const bcy = g.enemyBase.centerRow * CELL + CELL / 2;
        const basePulse = (Math.sin(now * 0.004) + 1) * 0.2 + 0.3;
        ctx.strokeStyle = `rgba(239,68,68,${basePulse})`; ctx.lineWidth = 2;
        ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(bcx, bcy, 40 + Math.sin(now * 0.003) * 5, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.font = `6px ${PIXEL_FONT}`; ctx.fillStyle = `rgba(239,68,68,${basePulse + 0.3})`;
        ctx.fillText("⚠ BASE", bcx, bcy - 48);
      }

      // Frozen zones (ice ground)
      (g.frozenZones || []).forEach(fz => {
        const alpha = Math.min(0.5, fz.timer / fz.maxTimer * 0.6);
        // Outer glow
        ctx.fillStyle = `rgba(147,197,253,${alpha * 0.3})`;
        ctx.beginPath(); ctx.arc(fz.x, fz.y, fz.radius + 4, 0, Math.PI * 2); ctx.fill();
        // Main frozen area
        ctx.fillStyle = `rgba(96,165,250,${alpha})`;
        ctx.beginPath(); ctx.arc(fz.x, fz.y, fz.radius, 0, Math.PI * 2); ctx.fill();
        // Inner crystalline pattern
        ctx.strokeStyle = `rgba(219,234,254,${alpha * 0.7})`; ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 * i) / 6;
          ctx.beginPath();
          ctx.moveTo(fz.x, fz.y);
          ctx.lineTo(fz.x + Math.cos(a) * fz.radius * 0.7, fz.y + Math.sin(a) * fz.radius * 0.7);
          ctx.stroke();
        }
        // ❄ symbol
        ctx.font = "10px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.globalAlpha = alpha * 1.5;
        ctx.fillText("❄️", fz.x, fz.y);
        ctx.globalAlpha = 1;
      });

      // Towers
      g.towers.forEach((t) => {
        const def = TOWER_DEFS[t.type]; const isSel = g.selectedPlacedTower === t;
        if (isSel) {
          ctx.beginPath(); ctx.arc(t.x, t.y, t.effectiveRange || t.range, 0, Math.PI * 2);
          ctx.strokeStyle = `${def.color}44`; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = `${def.color}0d`; ctx.fill();
        }
        // Damaged visual
        const hpRatio = t.hp / t.maxHp;
        const dmgShake = hpRatio < 0.3 ? (Math.random() - 0.5) * 2 : 0;

        ctx.fillStyle = "#28233a"; ctx.fillRect(t.col * CELL + 2 + dmgShake, t.row * CELL + 2, CELL - 4, CELL - 4);
        ctx.fillStyle = def.color; ctx.globalAlpha = 0.4 + hpRatio * 0.5;
        ctx.fillRect(t.col * CELL + 4 + dmgShake, t.row * CELL + 4, CELL - 8, CELL - 8);
        ctx.globalAlpha = 1;

        // Level pips
        ctx.fillStyle = "#fbbf24";
        for (let i = 0; i < t.level; i++) ctx.fillRect(t.col * CELL + 5 + i * 5, t.row * CELL + CELL - 7, 3, 2);

        ctx.font = "14px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(def.symbol, t.x + dmgShake, t.y - 1);

        // Tower HP bar
        const thpW = CELL - 6;
        const thpH = 2;
        const thpX = t.col * CELL + 3;
        const thpY = t.row * CELL + 1;
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(thpX, thpY, thpW, thpH);
        ctx.fillStyle = hpRatio > 0.5 ? "#4ade80" : hpRatio > 0.25 ? "#fbbf24" : "#ef4444";
        ctx.fillRect(thpX, thpY, thpW * hpRatio, thpH);

        // XP rank glow & indicator
        const tRank = getRank(t.xp);
        if (tRank.rank > 0) {
          const rankColors = ["", "#a3e635", "#38bdf8", "#c084fc", "#fbbf24"];
          const rc = rankColors[tRank.rank] || "#fbbf24";
          ctx.shadowColor = rc; ctx.shadowBlur = 6 + tRank.rank * 2;
          ctx.strokeStyle = rc; ctx.lineWidth = 1;
          ctx.strokeRect(t.col * CELL + 3 + dmgShake, t.row * CELL + 3, CELL - 6, CELL - 6);
          ctx.shadowBlur = 0;
          // XP bar (tiny, below HP bar)
          const nextR = getNextRank(t.xp);
          if (nextR) {
            const prevXp = tRank.xp;
            const xpPct = (t.xp - prevXp) / (nextR.xp - prevXp);
            ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(thpX, thpY + 3, thpW, 1);
            ctx.fillStyle = rc; ctx.fillRect(thpX, thpY + 3, thpW * xpPct, 1);
          }
        }

        // Damage cracks if low HP
        if (hpRatio < 0.5) {
          ctx.strokeStyle = "rgba(255,80,80,0.3)"; ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(t.col * CELL + 8, t.row * CELL + 10);
          ctx.lineTo(t.col * CELL + CELL / 2, t.row * CELL + CELL / 2);
          ctx.lineTo(t.col * CELL + CELL - 8, t.row * CELL + CELL - 6);
          ctx.stroke();
        }

        if (isSel) { ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2; ctx.strokeRect(t.col * CELL + 1, t.row * CELL + 1, CELL - 2, CELL - 2); }
      });

      // Support beams
      g.towers.filter(t => TOWER_DEFS[t.type].isSupport && (t.buffTargets || []).length > 0).forEach((sup) => {
        const targets = sup.buffTargets || [];
        targets.forEach((tgt, tIdx) => {
          if (!tgt) return;
          const pulse = (Math.sin(now * 0.008 + tIdx * 1.5) + 1) * 0.15 + 0.3;
          // Beam
          ctx.strokeStyle = `rgba(232,121,249,${pulse})`;
          ctx.lineWidth = 2;
          ctx.shadowColor = "#e879f9"; ctx.shadowBlur = 6;
          ctx.beginPath(); ctx.moveTo(sup.x, sup.y); ctx.lineTo(tgt.x, tgt.y); ctx.stroke();
          ctx.shadowBlur = 0;
          // Energy particles along beam
          const t2 = ((now * 0.003) + tIdx * 0.33) % 1;
          const px = sup.x + (tgt.x - sup.x) * t2;
          const py = sup.y + (tgt.y - sup.y) * t2;
          ctx.fillStyle = `rgba(232,121,249,${0.8})`;
          ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
          // Buff glow on target
          ctx.strokeStyle = `rgba(232,121,249,${pulse * 0.6})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(tgt.x, tgt.y, CELL * 0.6, 0, Math.PI * 2); ctx.stroke();
        });
      });

      // Player building auras
      g.towers.filter(t => TOWER_DEFS[t.type].isBuilding).forEach((bld) => {
        const bdef = TOWER_DEFS[bld.type];
        const pulse = (Math.sin(now * 0.004 + bld.col * 2) + 1) * 0.12 + 0.12;
        ctx.strokeStyle = `${bdef.color}55`; ctx.lineWidth = 1.5;
        ctx.shadowColor = bdef.color; ctx.shadowBlur = 5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(bld.x, bld.y, bld.range, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur = 0;
        ctx.strokeStyle = `${bdef.color}${Math.floor(pulse * 255).toString(16).padStart(2,"0")}`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(bld.x, bld.y, 12 + Math.sin(now * 0.006) * 3, 0, Math.PI * 2); ctx.stroke();
        g.towers.forEach((ally) => {
          if (ally === bld || TOWER_DEFS[ally.type].isBuilding) return;
          if (dist(bld, ally) <= bld.range) {
            ctx.strokeStyle = `${bdef.color}22`; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(bld.x, bld.y); ctx.lineTo(ally.x, ally.y); ctx.stroke();
          }
        });
      });

      // Enemy turrets
      g.enemyTurrets.forEach((et) => {
        ctx.fillStyle = "#3b1111"; ctx.fillRect(et.col * CELL + 2, et.row * CELL + 2, CELL - 4, CELL - 4);
        const etHpR = et.hp / et.maxHp;
        ctx.fillStyle = "#ef4444"; ctx.globalAlpha = 0.5 + etHpR * 0.4;
        ctx.fillRect(et.col * CELL + 4, et.row * CELL + 4, CELL - 8, CELL - 8);
        ctx.globalAlpha = 1;
        ctx.font = "14px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🗼", et.x, et.y - 1);
        // Armor indicator
        if (et.armor > 0) {
          ctx.font = `5px ${PIXEL_FONT}`; ctx.fillStyle = "#94a3b8";
          ctx.fillText(`🛡${et.armor}`, et.x, et.row * CELL + CELL - 3);
        }
        // Multi-target indicator
        if ((et.maxTargets || 1) > 1) {
          ctx.font = `5px ${PIXEL_FONT}`; ctx.fillStyle = "#fbbf24";
          ctx.fillText(`×${et.maxTargets}`, et.x + 10, et.row * CELL + 6);
        }
        const ePulse = (Math.sin(now * 0.006) + 1) * 0.15 + 0.2;
        ctx.strokeStyle = `rgba(239,68,68,${ePulse})`; ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(et.x, et.y, et.range, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        const etbW = CELL - 6, etbX = et.col * CELL + 3;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(etbX, et.row * CELL + 1, etbW, 3);
        ctx.fillStyle = etHpR > 0.5 ? "#ef4444" : "#fbbf24";
        ctx.fillRect(etbX, et.row * CELL + 1, etbW * etHpR, 3);
        // Corner spikes
        ctx.fillStyle = "rgba(239,68,68,0.6)";
        ctx.fillRect(et.col * CELL + 1, et.row * CELL + 1, 4, 2);
        ctx.fillRect(et.col * CELL + CELL - 5, et.row * CELL + 1, 4, 2);
        ctx.fillRect(et.col * CELL + 1, et.row * CELL + CELL - 3, 4, 2);
        ctx.fillRect(et.col * CELL + CELL - 5, et.row * CELL + CELL - 3, 4, 2);
      });

      // Enemy buff buildings
      (g.enemyBuildings || []).forEach((eb) => {
        const ebHpR = eb.hp / eb.maxHp;
        // Background
        ctx.fillStyle = "#1a0a2e"; ctx.fillRect(eb.col * CELL + 1, eb.row * CELL + 1, CELL - 2, CELL - 2);
        // Colored fill
        ctx.fillStyle = eb.color; ctx.globalAlpha = 0.3 + ebHpR * 0.3;
        ctx.fillRect(eb.col * CELL + 3, eb.row * CELL + 3, CELL - 6, CELL - 6);
        ctx.globalAlpha = 1;
        // Symbol
        ctx.font = "13px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(eb.symbol, eb.x, eb.y - 1);
        // Buff aura ring (pulsing)
        const bPulse = (Math.sin(now * 0.005 + eb.col) + 1) * 0.15 + 0.15;
        ctx.strokeStyle = eb.color + "88"; ctx.lineWidth = 1.5;
        ctx.shadowColor = eb.color; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(eb.x, eb.y, eb.range, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        // Inner glow
        ctx.strokeStyle = `${eb.color}${Math.floor(bPulse * 255).toString(16).padStart(2,"0")}`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(eb.x, eb.y, 14 + Math.sin(now * 0.008) * 3, 0, Math.PI * 2); ctx.stroke();
        // HP bar
        const ebbW = CELL - 6, ebbX = eb.col * CELL + 3;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(ebbX, eb.row * CELL + 1, ebbW, 3);
        ctx.fillStyle = eb.color; ctx.fillRect(ebbX, eb.row * CELL + 1, ebbW * ebHpR, 3);
        // Type label
        ctx.font = `5px ${PIXEL_FONT}`; ctx.fillStyle = eb.color;
        ctx.fillText(eb.desc, eb.x, eb.row * CELL + CELL - 3);
      });

      // Enemies
      g.enemies.forEach((e) => {
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath();
        ctx.ellipse(e.x + 1, e.y + e.size * 0.5, e.size * 0.7, e.size * 0.25, 0, 0, Math.PI * 2); ctx.fill();
        let fill = e.color;
        if (e.slowTimer > 0) fill = "#93c5fd"; if (e.dotTimer > 0) fill = "#fb923c";
        // Enragé visual: red pulsing glow
        const wm = g.waveMods || {};
        if (wm.enemyDmgBonus || wm.enemySpeedBonus || wm.enemyHpBonus) {
          const glow = (Math.sin(now * 0.01) + 1) * 0.2 + 0.2;
          ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 8 + glow * 6;
          if (!e.slowTimer && !e.dotTimer) fill = "#ff6b6b";
        }
        ctx.fillStyle = fill;
        if (e.shape === "circle") { ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2); ctx.fill(); }
        else if (e.shape === "square") { ctx.fillRect(e.x - e.size, e.y - e.size, e.size * 2, e.size * 2); }
        else if (e.shape === "diamond") { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.PI / 4); ctx.fillRect(-e.size * 0.8, -e.size * 0.8, e.size * 1.6, e.size * 1.6); ctx.restore(); }
        else if (e.shape === "star") { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = (Math.PI * 2 * i) / 10 - Math.PI / 2; const r = i % 2 === 0 ? e.size : e.size * 0.5; if (i === 0) ctx.moveTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r); else ctx.lineTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
        ctx.shadowBlur = 0;

        // Shooter indicator
        if (e.shoots) {
          ctx.strokeStyle = "rgba(255,100,100,0.4)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.eRange, 0, Math.PI * 2); ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
        }

        if (e.healer) {
          ctx.strokeStyle = "rgba(6,182,212,0.5)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.size + 3 + Math.sin(now * 0.005) * 2, 0, Math.PI * 2); ctx.stroke();
        }

        // Building buff indicators
        let hasAnyBuff = false;
        (g.enemyBuildings || []).forEach((eb) => {
          if (eb.hp > 0 && dist(eb, e) <= eb.range) {
            hasAnyBuff = true;
            const glowA = (Math.sin(now * 0.006) + 1) * 0.15 + 0.1;
            ctx.strokeStyle = `${eb.color}${Math.floor(glowA * 255).toString(16).padStart(2,"0")}`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.size + 2, 0, Math.PI * 2); ctx.stroke();
          }
        });
        if (hasAnyBuff) {
          ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = `4px ${PIXEL_FONT}`;
          ctx.fillText("BUFF", e.x, e.y + e.size + 6);
        }

        const barW = e.size * 2.4, barH = 3, barX = e.x - barW / 2, barY = e.y - e.size - 7;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        const hpPct = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = hpPct > 0.5 ? "#4ade80" : hpPct > 0.25 ? "#fbbf24" : "#ef4444";
        ctx.fillRect(barX, barY, barW * hpPct, barH);
      });

      // Enemy shot flashes
      g.flashes.forEach((f) => {
        ctx.globalAlpha = f.life * 0.7;
        ctx.strokeStyle = "#ff4444"; ctx.lineWidth = 3;
        ctx.shadowColor = "#ff2222"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = "#ffaaaa"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.shadowBlur = 0;
        if (f.life > 0.5) {
          ctx.fillStyle = `rgba(255,200,100,${f.life})`;
          ctx.beginPath(); ctx.arc(f.x1, f.y1, 5 * f.life, 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;

      // Tower bullets
      g.bullets.forEach((b) => {
        ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(b.x, b.y, 1.5, 0, Math.PI * 2); ctx.fill();
      });

      // Enemy bullets (red-ish)
      g.eBullets.forEach((b) => {
        ctx.fillStyle = "#ff4444"; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffaaaa"; ctx.beginPath(); ctx.arc(b.x, b.y, 1.5, 0, Math.PI * 2); ctx.fill();
        // Trail
        ctx.strokeStyle = "rgba(255,68,68,0.3)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(b.x, b.y);
        const tdx = b.target.x - b.x, tdy = b.target.y - b.y, td = Math.sqrt(tdx*tdx+tdy*tdy) || 1;
        ctx.lineTo(b.x - (tdx/td) * 8, b.y - (tdy/td) * 8); ctx.stroke();
      });

      // Particles
      g.particles.forEach((p) => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); });
      ctx.globalAlpha = 1;
      g.texts.forEach((t) => { ctx.globalAlpha = Math.max(0, t.life); ctx.font = `7px ${PIXEL_FONT}`; ctx.fillStyle = "#fbbf24"; ctx.textAlign = "center"; ctx.fillText(t.text, t.x, t.y); });
      ctx.globalAlpha = 1;

      ctx.restore();

      // Game over
      if (g.phase === "gameover" || g.phase === "scoreboard") {
        ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(0, 0, CW, CH);
        ctx.textAlign = "center"; ctx.font = `16px ${PIXEL_FONT}`; ctx.fillStyle = "#ef4444";
        ctx.fillText("GAME OVER", CW / 2, CH / 2 - 50);
        ctx.font = `10px ${PIXEL_FONT}`; ctx.fillStyle = "#fbbf24";
        ctx.fillText(`Vague ${g.wave} · Carte ${g.mapNum}`, CW / 2, CH / 2 - 15);
        ctx.font = `12px ${PIXEL_FONT}`; ctx.fillStyle = "#e879f9";
        ctx.fillText(`⭐ ${g.score.toLocaleString()} pts`, CW / 2, CH / 2 + 15);
        ctx.font = `7px ${PIXEL_FONT}`; ctx.fillStyle = "#94a3b8";
        ctx.fillText(`${g.totalKills} kills · ${g.basesDestroyed} bases`, CW / 2, CH / 2 + 35);
        const goPulse = (Math.sin(now * 0.005) + 1) * 0.3 + 0.4;
        ctx.fillStyle = `rgba(255,255,255,${goPulse})`;
        ctx.font = `7px ${PIXEL_FONT}`;
        ctx.fillText("CLIQUE POUR CONTINUER", CW / 2, CH / 2 + 60);
      }

      if (g.paused && g.phase !== "gameover" && g.phase !== "scoreboard") {
        ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, CW, CH);
        ctx.textAlign = "center";
        ctx.font = `14px ${PIXEL_FONT}`; ctx.fillStyle = "#fbbf24";
        ctx.fillText("PAUSE", CW / 2, CH / 2 - 8);
        ctx.font = `7px ${PIXEL_FONT}`; ctx.fillStyle = "#94a3b8";
        ctx.fillText("P / Espace pour reprendre", CW / 2, CH / 2 + 18);
      }

      ctx.fillStyle = "rgba(0,0,0,0.04)";
      for (let sl = 0; sl < CH; sl += 3) ctx.fillRect(0, sl, CW, 1);

      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [syncState, gameMode]);

  const handleCanvasPointerDown = (e) => {
    const g = gs.current;
    if (g.mode !== "campaign" && g.mode !== "campaign-test") return;
    panRef.current.active = true;
    panRef.current.moved = false;
    panRef.current.lastX = e.clientX;
    panRef.current.lastY = e.clientY;
    panRef.current.startX = e.clientX;
    panRef.current.startY = e.clientY;
    canvasRef.current?.setPointerCapture?.(e.pointerId);
  };

  const handleCanvasPointerMove = (e) => {
    if (!panRef.current.active) return;
    const g = gs.current;
    if (g.mode !== "campaign" && g.mode !== "campaign-test") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    const dx = e.clientX - panRef.current.lastX;
    const dy = e.clientY - panRef.current.lastY;
    const totalMove = Math.abs(e.clientX - panRef.current.startX) + Math.abs(e.clientY - panRef.current.startY);
    if (totalMove > 6) panRef.current.moved = true;
    panRef.current.lastX = e.clientX;
    panRef.current.lastY = e.clientY;
    if (dx !== 0 || dy !== 0) {
      // drag map with finger/mouse: camera moves opposite to pointer delta
      nudgeCamera((-dx * scaleX) / (g.zoom || 1), (-dy * scaleY) / (g.zoom || 1));
    }
  };

  const handleCanvasPointerUp = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const g = gs.current;
    const sx = (e.clientX - rect.left) * (CW / rect.width);
    const sy = (e.clientY - rect.top) * (CH / rect.height);
    const wasDrag = panRef.current.active && panRef.current.moved;
    panRef.current.active = false;
    panRef.current.moved = false;
    if ((g.mode === "campaign" || g.mode === "campaign-test") && wasDrag) return;
    if (g.mode === "campaign" || g.mode === "campaign-test") {
      handleCanvasTap((sx / (g.zoom || 1)) + g.camX, (sy / (g.zoom || 1)) + g.camY);
    } else {
      handleCanvasTap(sx, sy);
    }
  };

  const handleCanvasPointerCancel = () => {
    panRef.current.active = false;
    panRef.current.moved = false;
  };

  const handleCanvasWheel = (e) => {
    const g = gs.current;
    if (g.mode !== "campaign" && g.mode !== "campaign-test") return;
    e.preventDefault();
    adjustZoom(e.deltaY > 0 ? -0.08 : 0.08);
  };

  const selectTowerType = (type) => { gs.current.selectedTowerType = type; gs.current.selectedPlacedTower = null; setSelectedTower(type); setSelectedPlaced(null); };
  const canAfford = (cost) => gold >= cost;
  const selDef = selectedPlaced ? TOWER_DEFS[selectedPlaced.type] : null;
  const upgCost = selectedPlaced ? selDef.upgCost * selectedPlaced.level : 0;
  const repairCost = selectedPlaced ? Math.ceil((selectedPlaced.maxHp - selectedPlaced.hp) * 0.4) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "#0a0b10", fontFamily: PIXEL_FONT, userSelect: "none", padding: "6px 0" }}>
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />

      {/* MENU SCREEN */}
      {gameMode === "menu" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 20, padding: 20 }}>
          <div style={{ fontSize: 16, color: "#fbbf24", textAlign: "center", textShadow: "0 0 20px rgba(251,191,36,0.5)" }}>🏰 TOWER DEFENSE 🏰 <span style={{ fontSize: 10, color: "#666", marginLeft: 4 }}>v16</span></div>
          <div style={{ fontSize: 7, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>Choisis ton mode de jeu</div>
          <button onClick={() => startMode("normal")} onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); startMode("normal"); }}
            style={{ background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#000", border: "none", borderRadius: 10, padding: "16px 32px", fontSize: 10, fontFamily: PIXEL_FONT, cursor: "pointer", touchAction: "manipulation", minWidth: 220, minHeight: 56, boxShadow: "0 4px 20px rgba(74,222,128,0.3)" }}>
            ⚔️ MODE NORMAL
          </button>
          <div style={{ fontSize: 5, color: "rgba(255,255,255,0.3)", textAlign: "center", maxWidth: 250, marginTop: -12 }}>
            Tous les bâtiments disponibles dès le début. Le classique.
          </div>
          <button onClick={() => startMode("surprise")} onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); startMode("surprise"); }}
            style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", color: "#000", border: "none", borderRadius: 10, padding: "16px 32px", fontSize: 10, fontFamily: PIXEL_FONT, cursor: "pointer", touchAction: "manipulation", minWidth: 220, minHeight: 56, boxShadow: "0 4px 20px rgba(245,158,11,0.3)", animation: "pulse 1.5s infinite" }}>
            🎰 MODE SURPRISE
          </button>
          <div style={{ fontSize: 5, color: "rgba(255,255,255,0.3)", textAlign: "center", maxWidth: 250, marginTop: -12 }}>
            Bâtiments débloqués tous les 3 niveaux. Roulette bonus/malus à chaque vague !
          </div>
          <button onClick={() => startMode("campaign")} onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); startMode("campaign"); }}
            style={{ background: "linear-gradient(135deg, #60a5fa, #3b82f6)", color: "#000", border: "none", borderRadius: 10, padding: "16px 32px", fontSize: 10, fontFamily: PIXEL_FONT, cursor: "pointer", touchAction: "manipulation", minWidth: 220, minHeight: 56, boxShadow: "0 4px 20px rgba(59,130,246,0.35)" }}>
            🐌 MODE CAMPAGNE
          </button>
          <div style={{ fontSize: 5, color: "rgba(255,255,255,0.3)", textAlign: "center", maxWidth: 280, marginTop: -12 }}>
            Escargot horaire, nouvelle carte tous les 7 niveaux, boss aux niveaux 5-6-7 de chaque carte.
          </div>
          <button onClick={() => startMode("campaign-test")} onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); startMode("campaign-test"); }}
            style={{ background: "linear-gradient(135deg, #22d3ee, #0ea5e9)", color: "#000", border: "none", borderRadius: 10, padding: "14px 24px", fontSize: 9, fontFamily: PIXEL_FONT, cursor: "pointer", touchAction: "manipulation", minWidth: 220, minHeight: 52, boxShadow: "0 4px 20px rgba(14,165,233,0.35)" }}>
            🧪 TEST ESCARGOT x3
          </button>
          <div style={{ fontSize: 5, color: "rgba(255,255,255,0.3)", textAlign: "center", maxWidth: 280, marginTop: -12 }}>
            Aperçu final: génération automatique de 3 niveaux d'escargot (navigation caméra).
          </div>
          <button onClick={() => setShowHighscores(true)} onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setShowHighscores(true); }}
            style={{ background: "none", border: "2px solid #fbbf24", borderRadius: 10, padding: "10px 28px", fontSize: 9, fontFamily: PIXEL_FONT, cursor: "pointer", touchAction: "manipulation", minWidth: 180, minHeight: 44, color: "#fbbf24", marginTop: 8 }}>
            🏆 HIGHSCORES
          </button>
        </div>
      )}

      {/* ROULETTE OVERLAY */}
      {rouletteActive && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 10, color: "#fbbf24" }}>🎰 ROULETTE 🎰</div>
          {!rouletteResult ? (
            <div style={{ fontSize: 30, animation: "spin 0.1s linear infinite" }}>
              {ROULETTE_EVENTS[rouletteSpin % ROULETTE_EVENTS.length].symbol}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 40 }}>{rouletteResult.symbol}</div>
              <div style={{ fontSize: 12, color: rouletteResult.color, textShadow: `0 0 20px ${rouletteResult.color}50` }}>{rouletteResult.name}</div>
              <div style={{ fontSize: 7, color: rouletteResult.type === "bonus" ? "#4ade80" : "#ef4444", border: `1px solid ${rouletteResult.type === "bonus" ? "#4ade80" : "#ef4444"}`, borderRadius: 4, padding: "4px 10px" }}>
                {rouletteResult.type === "bonus" ? "👍 BONUS" : "👎 MALUS"} — {rouletteResult.desc}
              </div>
            </div>
          )}
          <style>{`@keyframes spin { 0% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.2) rotate(10deg); } 100% { transform: scale(1) rotate(0deg); } }`}</style>
        </div>
      )}

      {gameMode !== "menu" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>

      {mapTransition && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, flexDirection: "column", gap: 12 }}>
          <div style={{ color: "#fbbf24", fontSize: 14 }}>🗺️ NOUVELLE CARTE !</div>
          <div style={{ color: "#60a5fa", fontSize: 9 }}>Carte {mapNum}</div>
          <div style={{ color: "#4ade80", fontSize: 7 }}>+{250 + mapNum * 75}💰 bonus</div>
          {gs.current.veteranXp > 0 && <div style={{ color: "#c084fc", fontSize: 7 }}>⭐ XP vétérane transmise : {gs.current.veteranXp} XP</div>}
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 7 }}>Place tes tours !</div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: CW, maxWidth: "96vw", padding: "5px 6px", marginBottom: 3, background: "#141820", borderRadius: 5, border: "1px solid #252d3a", fontSize: 8 }}>
        <span style={{ color: gold >= (needsNewMap ? GOLD_CAP_MAP : GOLD_CAP) ? "#ef4444" : "#fbbf24" }}>💰 {gold >= 1000 ? `${(gold/1000).toFixed(1)}k` : gold}{gold >= (needsNewMap ? GOLD_CAP_MAP : GOLD_CAP) ? " MAX" : ""}</span>
        <span style={{ color: "#e879f9", fontSize: 7 }}>⭐{score.toLocaleString()}</span>
        <span style={{ color: "#60a5fa" }}>🌊 {wave} · 🗺️ {mapNum}</span>
        {(gameMode === "campaign" || gameMode === "campaign-test") && <span style={{ color: "#60a5fa", fontSize: 6 }}>🐌 ({campaignCoord.x},{campaignCoord.y}){gameMode === "campaign" ? ` · N${((wave % 7) || 7)}/7` : ""}</span>}
        <span style={{ color: (() => { const ct = gs.current.towers.filter(t => !TOWER_DEFS[t.type].isBuilding).length; return ct >= MAX_TOWERS ? "#ef4444" : "#94a3b8"; })(), fontSize: 7 }}>🗼{gs.current.towers.filter(t => !TOWER_DEFS[t.type].isBuilding).length}/{MAX_TOWERS} 🏗{gs.current.towers.filter(t => TOWER_DEFS[t.type].isBuilding).length}/{MAX_BUILDINGS}</span>
        <button onClick={() => setShowHighscores(true)} onTouchEnd={(e) => { e.stopPropagation(); setShowHighscores(true); }} style={{ background: "none", border: "1px solid #444", borderRadius: 3, color: "#fbbf24", fontSize: 8, fontFamily: PIXEL_FONT, cursor: "pointer", padding: "2px 5px", lineHeight: 1, touchAction: "manipulation", minHeight: 22, minWidth: 22 }}>🏆</button>
        {gameMode === "surprise" && <span style={{ color: "#f59e0b", fontSize: 6 }}>🎰</span>}
        {gameMode === "campaign" && <span style={{ color: "#60a5fa", fontSize: 6 }}>🐌</span>}
        {gameMode === "campaign-test" && <span style={{ color: "#22d3ee", fontSize: 6 }}>🧪</span>}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ color: "#f87171" }}>❤️ {lives}</span>
          <button onClick={togglePause} onTouchEnd={(e) => { e.stopPropagation(); togglePause(); }} style={{ background: "none", border: `1px solid ${paused ? "#60a5fa" : "#444"}`, borderRadius: 3, color: paused ? "#60a5fa" : "#888", fontSize: 10, fontFamily: PIXEL_FONT, cursor: "pointer", padding: "4px 8px", lineHeight: 1, touchAction: "manipulation", minHeight: 28, minWidth: 28 }}>{paused ? "▶" : "⏸"}</button>
          <button onClick={restartGame} onTouchEnd={(e) => { e.stopPropagation(); restartGame(); }} style={{ background: "none", border: "1px solid #444", borderRadius: 3, color: "#888", fontSize: 10, fontFamily: PIXEL_FONT, cursor: "pointer", padding: "4px 8px", lineHeight: 1, touchAction: "manipulation", minHeight: 28, minWidth: 28 }}>↺</button>
        </div>
      </div>

      {(gameMode === "campaign" || gameMode === "campaign-test") && (
        <div style={{ display: "flex", gap: 5, marginBottom: 4, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 6 }}>Cam:</span>
          <button onClick={() => nudgeCamera(-CELL * 2, 0)} style={{ background: "#141820", border: "1px solid #2b3344", color: "#60a5fa", borderRadius: 5, fontSize: 10, fontFamily: PIXEL_FONT, minWidth: 34, minHeight: 32, cursor: "pointer", touchAction: "manipulation" }}>◀</button>
          <button onClick={() => nudgeCamera(0, -CELL * 2)} style={{ background: "#141820", border: "1px solid #2b3344", color: "#60a5fa", borderRadius: 5, fontSize: 10, fontFamily: PIXEL_FONT, minWidth: 34, minHeight: 32, cursor: "pointer", touchAction: "manipulation" }}>▲</button>
          <button onClick={() => nudgeCamera(0, CELL * 2)} style={{ background: "#141820", border: "1px solid #2b3344", color: "#60a5fa", borderRadius: 5, fontSize: 10, fontFamily: PIXEL_FONT, minWidth: 34, minHeight: 32, cursor: "pointer", touchAction: "manipulation" }}>▼</button>
          <button onClick={() => nudgeCamera(CELL * 2, 0)} style={{ background: "#141820", border: "1px solid #2b3344", color: "#60a5fa", borderRadius: 5, fontSize: 10, fontFamily: PIXEL_FONT, minWidth: 34, minHeight: 32, cursor: "pointer", touchAction: "manipulation" }}>▶</button>
          <button onClick={() => adjustZoom(-0.1)} style={{ background: "#141820", border: "1px solid #2b3344", color: "#22d3ee", borderRadius: 5, fontSize: 10, fontFamily: PIXEL_FONT, minWidth: 34, minHeight: 32, cursor: "pointer", touchAction: "manipulation" }}>－</button>
          <span style={{ color: "#22d3ee", fontSize: 6, minWidth: 36, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => adjustZoom(0.1)} style={{ background: "#141820", border: "1px solid #2b3344", color: "#22d3ee", borderRadius: 5, fontSize: 10, fontFamily: PIXEL_FONT, minWidth: 34, minHeight: 32, cursor: "pointer", touchAction: "manipulation" }}>＋</button>
          <span style={{ color: "rgba(96,165,250,0.8)", fontSize: 5 }}>👆 Glisser la carte pour naviguer</span>
        </div>
      )}

      <div style={{ position: "relative", borderRadius: 5, overflow: "hidden", border: "2px solid #252d3a", boxShadow: "0 0 20px rgba(40,30,80,0.5)" }}>
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerCancel}
          onWheel={handleCanvasWheel}
          style={{ display: "block", maxWidth: "96vw", cursor: (gameMode === "campaign" || gameMode === "campaign-test") ? "grab" : "pointer", touchAction: "none" }}
        />
        {phase === "prep" && phase !== "gameover" && gameMode !== "campaign-test" && (
          <button
            onClick={(e) => { e.stopPropagation(); startWave(); }}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); startWave(); }}
            style={{
              position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
              background: needsNewMap ? "#f59e0b" : "#a78bfa",
              color: "#000", border: "3px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "12px 24px",
              fontSize: 11, fontFamily: PIXEL_FONT, cursor: "pointer", animation: "pulse 1.5s infinite",
              zIndex: 50, touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
              minHeight: 48, minWidth: 180, boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
            }}>
            {needsNewMap ? "🗺️ NOUVELLE CARTE" : wave === 0 ? "▶ VAGUE 1" : `▶ VAGUE ${wave + 1}`}
          </button>
        )}
        {phase === "wave" && (
          <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.5)", fontSize: 7, background: "rgba(0,0,0,0.5)", padding: "4px 10px", borderRadius: 4 }}>⚔️ Vague en cours...</div>
        )}
        {gameMode === "campaign-test" && (
          <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", color: "#22d3ee", fontSize: 7, background: "rgba(0,0,0,0.6)", padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(34,211,238,0.5)" }}>🧪 Aperçu escargot x3 — flèches/WASD pour naviguer</div>
        )}
        {paused && (
          <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", color: "#60a5fa", fontSize: 7, background: "rgba(0,0,0,0.65)", padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(96,165,250,0.45)" }}>⏸ PAUSE</div>
        )}
      </div>

      {/* Tower info panel */}
      {gameMode !== "campaign-test" && selectedPlaced && (
        <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 5, background: "#141820", borderRadius: 5, padding: "5px 8px", border: "1px solid #252d3a", maxWidth: "96vw", flexWrap: "wrap", justifyContent: "center", fontSize: 7 }}>
          <span style={{ color: "#fff" }}>{selDef.symbol} {selDef.name} Nv.{selectedPlaced.level}</span>
          {(() => { const r = getRank(selectedPlaced.xp); const nr = getNextRank(selectedPlaced.xp); return r.rank > 0 ? (
            <span style={{ color: ["","#a3e635","#38bdf8","#c084fc","#fbbf24"][r.rank], fontSize: 6 }}>{r.star}{r.label}</span>
          ) : nr ? <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 6 }}>XP:{selectedPlaced.xp}/{nr.xp}</span> : null; })()}
          {selDef.isBuilding ? (
            <span style={{ color: selDef.color, fontSize: 6 }}>
              {selDef.bType === "forge" && `⚒️+${Math.round((selDef.bBuffDmg + (selectedPlaced.level-1) * selDef.bUpgDmg) * 100)}%DMG`}
              {selDef.bType === "rempart" && `🛡+${selDef.bBuffArmor + (selectedPlaced.level-1) * selDef.bUpgArmor} ARM · +${Math.round((selDef.bBuffHp + (selectedPlaced.level-1) * selDef.bUpgHp) * 100)}%HP`}
              {selDef.bType === "hopital" && `🏥 ${selDef.bRegen + (selectedPlaced.level-1) * selDef.bUpgRegen} HP/s`}
              {selDef.bType === "radar" && `📡+${Math.round((selDef.bBuffRange + (selectedPlaced.level-1) * selDef.bUpgRange) * 100)}% portée`}
            </span>
          ) : selDef.isSupport ? (
            <span style={{ color: "#e879f9", fontSize: 6 }}>BUFF:+{Math.round((selDef.buffDmg + (selectedPlaced.level-1) * selDef.upgBuffDmg) * 100)}%DMG · REGEN:{selDef.buffRegen + (selectedPlaced.level-1) * selDef.upgBuffRegen}/s · ×{selectedPlaced.level >= 5 ? 3 : selectedPlaced.level >= 3 ? 2 : 1}cibles</span>
          ) : (
            <span style={{ color: "#a78bfa" }}>DMG:{selectedPlaced.damage}{selectedPlaced.buffed ? ` (${selectedPlaced.buffedDamage})` : ""}</span>
          )}
          <span style={{ color: "#f87171" }}>HP:{Math.floor(selectedPlaced.hp)}/{Math.floor(selectedPlaced.maxHp)}</span>
          <span style={{ color: "#94a3b8", fontSize: 6 }}>🛡{selectedPlaced.armor} ·💀{selectedPlaced.kills}</span>
          {selectedPlaced.level < 5 && (
            <button onClick={upgradeTower} onTouchEnd={(e) => { e.stopPropagation(); upgradeTower(); }} disabled={!canAfford(upgCost)} style={{ background: canAfford(upgCost) ? "#4ade80" : "#333", color: "#000", border: "none", borderRadius: 3, padding: "5px 8px", fontSize: 7, fontFamily: PIXEL_FONT, cursor: canAfford(upgCost) ? "pointer" : "default", opacity: canAfford(upgCost) ? 1 : 0.4, touchAction: "manipulation", minHeight: 32 }}>⬆{upgCost}💰</button>
          )}
          {repairCost > 0 && (
            <button onClick={repairTower} onTouchEnd={(e) => { e.stopPropagation(); repairTower(); }} disabled={!canAfford(repairCost)} style={{ background: canAfford(repairCost) ? "#60a5fa" : "#333", color: "#000", border: "none", borderRadius: 3, padding: "5px 8px", fontSize: 7, fontFamily: PIXEL_FONT, cursor: canAfford(repairCost) ? "pointer" : "default", opacity: canAfford(repairCost) ? 1 : 0.4, touchAction: "manipulation", minHeight: 32 }}>🔧{repairCost}💰</button>
          )}
          <button onClick={sellTower} onTouchEnd={(e) => { e.stopPropagation(); sellTower(); }} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 3, padding: "5px 8px", fontSize: 7, fontFamily: PIXEL_FONT, cursor: "pointer", touchAction: "manipulation", minHeight: 32 }}>Vendre</button>
        </div>
      )}

      {/* Tower shop */}
      {gameMode !== "menu" && gameMode !== "campaign-test" && (
      <div style={{ display: "flex", gap: 3, marginTop: 4, flexWrap: "wrap", justifyContent: "center", maxWidth: "96vw" }}>
        {Object.entries(TOWER_DEFS).filter(([,d]) => !d.isBuilding).map(([key, def]) => (
          <button key={key} onClick={() => selectTowerType(key)}
            onTouchEnd={(e) => { e.stopPropagation(); selectTowerType(key); }}
            style={{
            background: selectedTower === key ? def.color + "22" : "#141820",
            border: `2px solid ${selectedTower === key ? def.color : "#252d3a"}`,
            borderRadius: 5, padding: "4px 4px", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
            minWidth: 50, minHeight: 40, opacity: canAfford(def.cost) && gs.current.towers.filter(t => !TOWER_DEFS[t.type].isBuilding).length < MAX_TOWERS ? 1 : 0.35,
            touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
          }}>
            <span style={{ fontSize: 13 }}>{def.symbol}</span>
            <span style={{ color: "#fbbf24", fontSize: 5, fontFamily: PIXEL_FONT }}>{def.cost}💰</span>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 4, fontFamily: PIXEL_FONT }}>{def.desc}</span>
          </button>
        ))}
      </div>
      )}
      {/* Building shop */}
      {gameMode !== "menu" && gameMode !== "campaign-test" && unlockedBuildings.length > 0 && (
        <div style={{ display: "flex", gap: 3, marginTop: 2, flexWrap: "wrap", justifyContent: "center", maxWidth: "96vw" }}>
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 5, fontFamily: PIXEL_FONT, alignSelf: "center" }}>BAT:</span>
          {Object.entries(TOWER_DEFS).filter(([k, d]) => d.isBuilding && unlockedBuildings.includes(k)).map(([key, def]) => (
            <button key={key} onClick={() => selectTowerType(key)}
              onTouchEnd={(e) => { e.stopPropagation(); selectTowerType(key); }}
              style={{
              background: selectedTower === key ? def.color + "22" : "#0d1117",
              border: `2px solid ${selectedTower === key ? def.color : "#1e2530"}`,
              borderRadius: 5, padding: "4px 4px", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
              minWidth: 50, minHeight: 40, opacity: canAfford(def.cost) && gs.current.towers.filter(t => TOWER_DEFS[t.type].isBuilding).length < MAX_BUILDINGS ? 1 : 0.35,
              touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
            }}>
              <span style={{ fontSize: 13 }}>{def.symbol}</span>
              <span style={{ color: "#fbbf24", fontSize: 5, fontFamily: PIXEL_FONT }}>{def.cost}💰</span>
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 4, fontFamily: PIXEL_FONT }}>{def.desc}</span>
            </button>
          ))}
          {gameMode === "surprise" && BUILDING_KEYS.filter(k => !unlockedBuildings.includes(k)).length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {BUILDING_KEYS.filter(k => !unlockedBuildings.includes(k)).map(k => (
                <span key={k} style={{ fontSize: 12, opacity: 0.2 }}>{TOWER_DEFS[k].symbol}🔒</span>
              ))}
            </div>
          )}
        </div>
      )}
      {(gameMode === "surprise" || gameMode === "campaign") && unlockedBuildings.length === 0 && (
        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 5, marginTop: 2 }}>🔒 Bâtiments débloqués tous les 3 niveaux</div>
      )}

      {(gameMode === "campaign" || gameMode === "campaign-test") && (
        <div style={{ color: "rgba(96,165,250,0.75)", fontSize: 5, marginTop: 2 }}>
          {gameMode === "campaign"
            ? `🐌 Carte ${mapNum} · spiral (${campaignCoord.x},${campaignCoord.y}) · Boss N5/N6/N7`
            : `🧪 Aperçu final · 3 niveaux d'escargot · ${mapNum} cartes`}
        </div>
      )}

      {/* Active wave mod indicator */}
      {gameMode === "surprise" && phase === "wave" && rouletteResult && !rouletteActive && (
        <div style={{ marginTop: 3, padding: "3px 10px", borderRadius: 4, fontSize: 6,
          background: rouletteResult.type === "bonus" ? "rgba(74,222,128,0.15)" : "rgba(239,68,68,0.15)",
          border: `1px solid ${rouletteResult.type === "bonus" ? "#4ade8040" : "#ef444440"}`,
          color: rouletteResult.color }}>
          {rouletteResult.symbol} {rouletteResult.name} actif
        </div>
      )}

      {/* Enemy base active indicator */}
      {gs.current.enemyBase && gs.current.enemyBase.alive && (
        <div style={{ marginTop: 3, padding: "3px 10px", borderRadius: 4, fontSize: 6,
          background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.4)",
          color: "#f97316", animation: "pulse 1.5s infinite" }}>
          ⚠️ BASE ENNEMIE {gs.current.enemyBase.wavesSurvived > 0 ? `(${gs.current.enemyBase.wavesSurvived} vagues · +${gs.current.enemyBase.wavesSurvived * 10}% force)` : ""} — Détruisez-la!
        </div>
      )}

      </div>)}

      <style>{`@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }`}</style>

      {/* Name input overlay for highscore */}
      {showNameInput && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, flexDirection: "column", gap: 12 }}>
          <div style={{ background: "#1a1f2e", border: "2px solid #fbbf24", borderRadius: 10, padding: "24px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, maxWidth: "90vw" }}>
            <div style={{ fontSize: 16, color: "#fbbf24" }}>🏆 NOUVEAU HIGHSCORE!</div>
            <div style={{ fontSize: 20, color: "#e879f9" }}>⭐ {finalScore.toLocaleString()} pts</div>
            <div style={{ fontSize: 8, color: "#94a3b8" }}>Vague {wave} · Carte {mapNum} · {finalMode === "surprise" ? "🎰 Surprise" : finalMode === "campaign" ? "🐌 Campagne" : "Normal"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center", marginTop: 6 }}>
              <div style={{ fontSize: 8, color: "#fbbf24" }}>Entre ton pseudo :</div>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.slice(0, 12))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && playerName.trim()) {
                    saveHighscore(playerName.trim(), finalScore, finalMode, wave, mapNum);
                    setShowNameInput(false);
                    setPlayerName("");
                    setShowHighscores(true);
                  }
                }}
                placeholder="Pseudo (12 max)"
                maxLength={12}
                autoFocus
                style={{
                  background: "#0d1117", border: "2px solid #4ade80", borderRadius: 5,
                  color: "#4ade80", fontSize: 12, fontFamily: PIXEL_FONT, padding: "8px 12px",
                  textAlign: "center", width: 180, outline: "none",
                }}
              />
              <button
                onClick={() => {
                  if (playerName.trim()) {
                    saveHighscore(playerName.trim(), finalScore, finalMode, wave, mapNum);
                    setShowNameInput(false);
                    setPlayerName("");
                    setShowHighscores(true);
                  }
                }}
                style={{
                  background: "#4ade8022", border: "2px solid #4ade80", borderRadius: 5,
                  color: "#4ade80", fontSize: 9, fontFamily: PIXEL_FONT, padding: "6px 20px",
                  cursor: "pointer", marginTop: 4,
                }}
              >VALIDER</button>
              <button
                onClick={() => { setShowNameInput(false); setShowHighscores(true); }}
                style={{
                  background: "none", border: "1px solid #555", borderRadius: 5,
                  color: "#888", fontSize: 7, fontFamily: PIXEL_FONT, padding: "4px 12px",
                  cursor: "pointer",
                }}
              >Passer</button>
            </div>
          </div>
        </div>
      )}

      {/* Highscore table overlay */}
      {showHighscores && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, flexDirection: "column", gap: 12 }}
          onClick={() => { setShowHighscores(false); if (phase === "gameover") restartGame(); }}>
          <div style={{ background: "#1a1f2e", border: "2px solid #fbbf24", borderRadius: 10, padding: "20px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, maxWidth: "90vw", minWidth: 280 }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, color: "#fbbf24" }}>🏆 HIGHSCORES</div>
            {highscores.length === 0 ? (
              <div style={{ color: "#666", fontSize: 8 }}>Aucun score enregistré</div>
            ) : (
              <div style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", borderBottom: "1px solid #333", marginBottom: 4 }}>
                  <span style={{ color: "#94a3b8", fontSize: 6, width: 20 }}>#</span>
                  <span style={{ color: "#94a3b8", fontSize: 6, flex: 1 }}>Joueur</span>
                  <span style={{ color: "#94a3b8", fontSize: 6, width: 70, textAlign: "right" }}>Score</span>
                  <span style={{ color: "#94a3b8", fontSize: 6, width: 40, textAlign: "right" }}>Vague</span>
                  <span style={{ color: "#94a3b8", fontSize: 6, width: 35, textAlign: "right" }}>Mode</span>
                </div>
                {highscores.map((hs, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", padding: "4px 8px",
                    background: i === 0 ? "rgba(251,191,36,0.08)" : i < 3 ? "rgba(251,191,36,0.03)" : "transparent",
                    borderRadius: 3, marginBottom: 1,
                    border: hs.score === finalScore && phase === "gameover" ? "1px solid #4ade80" : "1px solid transparent",
                  }}>
                    <span style={{ color: i === 0 ? "#fbbf24" : i < 3 ? "#f59e0b" : "#666", fontSize: 7, width: 20 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                    <span style={{ color: i < 3 ? "#fbbf24" : "#e2e8f0", fontSize: 7, flex: 1, overflow: "hidden" }}>{hs.name}</span>
                    <span style={{ color: "#e879f9", fontSize: 7, width: 70, textAlign: "right" }}>{hs.score.toLocaleString()}</span>
                    <span style={{ color: "#60a5fa", fontSize: 7, width: 40, textAlign: "right" }}>{hs.wave}</span>
                    <span style={{ color: hs.mode === "surprise" ? "#f59e0b" : hs.mode === "campaign" ? "#60a5fa" : "#94a3b8", fontSize: 6, width: 35, textAlign: "right" }}>{hs.mode === "surprise" ? "🎰" : hs.mode === "campaign" ? "🐌" : "⚔️"}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => { setShowHighscores(false); if (phase === "gameover") restartGame(); }}
              style={{
                background: "#4ade8022", border: "2px solid #4ade80", borderRadius: 5,
                color: "#4ade80", fontSize: 9, fontFamily: PIXEL_FONT, padding: "6px 20px",
                cursor: "pointer", marginTop: 6,
              }}
            >{phase === "gameover" ? "REJOUER" : "FERMER"}</button>
          </div>
        </div>
      )}

    </div>
  );
}
