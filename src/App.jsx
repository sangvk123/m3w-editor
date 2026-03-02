import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const GRID_COLS = 9;
const GRID_ROWS = 11;
const LAYERS = [-1, 0, 1, 2];
const LAYER_LABELS = { "-1": "BG", "0": "GEM", "1": "CVR", "2": "OVR" };
const LAYER_COLORS = { "-1": "#1a3a2a", "0": "#1a1a3a", "1": "#3a1a1a", "2": "#2a1a3a" };
const GEM_IDS = ["gem_red","gem_blue","gem_green","gem_yellow","gem_purple"];
const POWERUP_IDS = ["pu_rocket_h","pu_rocket_v","pu_tnt","pu_propeller","pu_lightball"];

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCKER LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_BLOCKERS = [
  { id:"gem_red",    name:"Ruby",     layer:0, hp:1, posEdge:false, dmgType:"Color",    gravityImpact:false, turnTax:0,    color:"#e63946", icon:"◆", category:"gem" },
  { id:"gem_blue",   name:"Sapphire", layer:0, hp:1, posEdge:false, dmgType:"Color",    gravityImpact:false, turnTax:0,    color:"#457b9d", icon:"◆", category:"gem" },
  { id:"gem_green",  name:"Emerald",  layer:0, hp:1, posEdge:false, dmgType:"Color",    gravityImpact:false, turnTax:0,    color:"#2d6a4f", icon:"◆", category:"gem" },
  { id:"gem_yellow", name:"Topaz",    layer:0, hp:1, posEdge:false, dmgType:"Color",    gravityImpact:false, turnTax:0,    color:"#e9c46a", icon:"◆", category:"gem" },
  { id:"gem_purple", name:"Amethyst", layer:0, hp:1, posEdge:false, dmgType:"Color",    gravityImpact:false, turnTax:0,    color:"#9b5de5", icon:"◆", category:"gem" },
  // Power-ups (theo PowerUpDocument.docx)
  { id:"pu_rocket_h", name:"Rocket→",   layer:0, hp:1, posEdge:false, dmgType:"Power-up", gravityImpact:false, turnTax:-2,   color:"#f4a261", icon:"🚀", category:"powerup", puDir:"h" },
  { id:"pu_rocket_v", name:"Rocket↓",   layer:0, hp:1, posEdge:false, dmgType:"Power-up", gravityImpact:false, turnTax:-2,   color:"#ff7c43", icon:"🚀", category:"powerup", puDir:"v" },
  { id:"pu_tnt",      name:"TNT",        layer:0, hp:1, posEdge:false, dmgType:"Power-up", gravityImpact:false, turnTax:-3,   color:"#e76f51", icon:"💣", category:"powerup" },
  { id:"pu_propeller",name:"Propeller",  layer:0, hp:1, posEdge:false, dmgType:"Power-up", gravityImpact:false, turnTax:-2.5, color:"#48cae4", icon:"🚁", category:"powerup" },
  { id:"pu_lightball",name:"Light Ball", layer:0, hp:1, posEdge:false, dmgType:"Power-up", gravityImpact:false, turnTax:-4,   color:"#f72585", icon:"🔮", category:"powerup" },
  { id:"b_stone",    name:"Stone",    layer:1, hp:3, posEdge:true,  dmgType:"Color",    gravityImpact:true,  turnTax:3,    color:"#6b7280", icon:"⬛", category:"blocker" },
  { id:"b_ice",      name:"Ice",      layer:1, hp:2, posEdge:true,  dmgType:"Color",    gravityImpact:false, turnTax:2,    color:"#90e0ef", icon:"🧊", category:"blocker" },
  { id:"b_wood",     name:"Wood",     layer:1, hp:2, posEdge:true,  dmgType:"Color",    gravityImpact:true,  turnTax:2,    color:"#a0522d", icon:"🪵", category:"blocker" },
  { id:"b_chain",    name:"Chain",    layer:2, hp:1, posEdge:false, dmgType:"Power-up", gravityImpact:false, turnTax:2.5,  color:"#adb5bd", icon:"⛓", category:"blocker" },
  { id:"b_cage",     name:"Cage",     layer:2, hp:2, posEdge:false, dmgType:"Power-up", gravityImpact:false, turnTax:3.5,  color:"#8d99ae", icon:"🔒", category:"blocker" },
  { id:"m_slime",    name:"Slime",    layer:0, hp:4, posEdge:true,  dmgType:"All",      gravityImpact:true,  turnTax:5,    color:"#80b918", icon:"👾", category:"monster" },
  { id:"m_goblin",   name:"Goblin",   layer:0, hp:6, posEdge:true,  dmgType:"All",      gravityImpact:true,  turnTax:7,    color:"#d00000", icon:"👺", category:"monster" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CELL & GRID FACTORY
// ═══════════════════════════════════════════════════════════════════════════════
const makeCell = (x, y) => ({ x, y, isVoid:false, layers:{"-1":null,"0":null,"1":null,"2":null} });
const makeGrid = () => Array.from({length:GRID_ROWS},(_,y)=>Array.from({length:GRID_COLS},(_,x)=>makeCell(x,y)));
const cloneGrid = g => g.map(r => r.map(c => ({...c, layers:{...c.layers}})));

// ═══════════════════════════════════════════════════════════════════════════════
// PACING MATH
// ═══════════════════════════════════════════════════════════════════════════════
const snapshotBlockers = (grid, blockers) => {
  const items = [];
  grid.forEach(row => row.forEach(cell => {
    if (cell.isVoid) return;
    Object.entries(cell.layers).forEach(([layer, bid]) => {
      if (!bid) return;
      const b = blockers.find(b=>b.id===bid);
      if (b && b.turnTax > 0) items.push({x:cell.x,y:cell.y,layer:Number(layer),blockerId:b.id,name:b.name,icon:b.icon,color:b.color,turnTax:b.turnTax});
    });
  }));
  return items;
};
const calcTotalTurnTax = snap => snap.reduce((s,it)=>s+it.turnTax, 0);
const calcER = (tax, moves) => moves > 0 ? tax/moves : 0;
const buildRealTimeCurve = (totalTax, moves) => {
  const pts = [];
  for (let i=0; i<=11; i++) {
    const movesRemaining = Math.round(moves-(moves*i)/11);
    const taxCleared = Math.min(totalTax,(((moves-movesRemaining)/Math.max(moves,1))*totalTax));
    pts.push({ movesRemaining, real:Math.max(0,+(totalTax-taxCleared).toFixed(2)) });
  }
  return pts;
};
const interpolateTargetCurve = (targetArr, points, moves) =>
  points.map(pt => {
    const progress = 1 - pt.movesRemaining/Math.max(moves,1);
    const idx = progress*(targetArr.length-1);
    const lo=Math.floor(idx), hi=Math.min(Math.ceil(idx),targetArr.length-1);
    return {...pt, target:+(targetArr[lo]+(targetArr[hi]-targetArr[lo])*(idx-lo)).toFixed(2)};
  });

// ═══════════════════════════════════════════════════════════════════════════════
// ══  GAME ENGINE  ════════════════════════════════════════════════════════════
//
//  Nguồn: M3_-_Luật_Rơi.docx + M3_-_Rule_Ăn_Và_Swap.docx
//
// ═══════════════════════════════════════════════════════════════════════════════

const gemColor  = id => (id && id.startsWith("gem_")) ? id.slice(4) : null;
const isPowerup = id => id && POWERUP_IDS.includes(id);
const isGem     = id => id && GEM_IDS.includes(id);
const getGem    = (grid, x, y) =>
  (y>=0&&y<GRID_ROWS&&x>=0&&x<GRID_COLS) ? grid[y][x].layers["0"] : null;

// ─── cellCanReceiveGem ────────────────────────────────────────────────────────
// Ô có thể nhận hạt khi:  không void  +  không có blocker ở layer1 có gravityImpact
const cellCanReceiveGem = (cell, blockerLib) => {
  if (cell.isVoid) return false;
  const cover = cell.layers["1"];
  if (cover) {
    const b = blockerLib.find(b=>b.id===cover);
    if (b && b.gravityImpact) return false;
  }
  return true;
};

// ─── MATCH DETECTION ─────────────────────────────────────────────────────────
// Quét tất cả match ngang + dọc trên layer 0
function findAllMatches(grid) {
  const matches = [];

  // Quét ngang
  for (let y=0; y<GRID_ROWS; y++) {
    let x=0;
    while (x<GRID_COLS) {
      const id = getGem(grid,x,y);
      const color = gemColor(id);
      if (!color) { x++; continue; }
      let len=1;
      while (x+len<GRID_COLS && gemColor(getGem(grid,x+len,y))===color) len++;
      if (len>=3) {
        const cells=[];
        for(let i=0;i<len;i++) cells.push({x:x+i,y});
        matches.push({cells,color,dir:"h",len});
      }
      x+=len;
    }
  }

  // Quét dọc
  for (let x=0; x<GRID_COLS; x++) {
    let y=0;
    while (y<GRID_ROWS) {
      const id = getGem(grid,x,y);
      const color = gemColor(id);
      if (!color) { y++; continue; }
      let len=1;
      while (y+len<GRID_ROWS && gemColor(getGem(grid,x,y+len))===color) len++;
      if (len>=3) {
        const cells=[];
        for(let i=0;i<len;i++) cells.push({x,y:y+i});
        matches.push({cells,color,dir:"v",len});
      }
      y+=len;
    }
  }

  return matches;
}

// ─── RESOLVE MATCHES ─────────────────────────────────────────────────────────
// Áp dụng bảng ưu tiên từ Rule ăn:
//  PU5  → 5 thẳng hàng              → Disco (ăn hạt cùng màu)
//  PU5TL→ cross >=3 ngang + >=3 dọc, tổng>=5 → Bomb
//  PU4  → 4 thẳng hàng              → Rocket (ăn hàng/cột)
//  PUS  → 2×2 vuông                 → Rocket nhỏ (PU balloon, ăn objective)
//  M3   → 3 thẳng hàng              → biến mất
// spawnAt = điểm người chơi swap vào
function resolveMatches(rawMatches, swapTarget) {
  if (rawMatches.length===0) return [];
  const usedIdx = new Set();
  const resolved = [];

  // 1. PU5TL: hàng ngang >=3 giao với cột dọc >=3, tổng cells không trùng >= 5
  for (let hi=0; hi<rawMatches.length; hi++) {
    const mh = rawMatches[hi];
    if (mh.dir!=="h"||mh.len<3||usedIdx.has(hi)) continue;
    for (let vi=0; vi<rawMatches.length; vi++) {
      const mv = rawMatches[vi];
      if (mv.dir!=="v"||mv.len<3||usedIdx.has(vi)||mv.color!==mh.color) continue;
      const intersect = mh.cells.find(c=>mv.cells.some(v=>v.x===c.x&&v.y===c.y));
      if (!intersect) continue;
      const unique = [...mh.cells];
      mv.cells.forEach(c=>{ if(!unique.find(u=>u.x===c.x&&u.y===c.y)) unique.push(c); });
      if (unique.length>=5) {
        resolved.push({type:"PU5TL",cells:unique,color:mh.color,spawnAt:swapTarget||intersect,puId:"pu_tnt",matchDir:"TL"});
        usedIdx.add(hi); usedIdx.add(vi);
      }
    }
  }

  // 2. PU5: 5 thẳng hàng
  rawMatches.forEach((m,i)=>{
    if (usedIdx.has(i)||m.len<5) return;
    resolved.push({type:"PU5",cells:m.cells,color:m.color,
      spawnAt:swapTarget||m.cells[Math.floor(m.cells.length/2)],puId:"pu_lightball",matchDir:m.dir});
    usedIdx.add(i);
  });

  // 3. PU4: 4 thẳng hàng
  rawMatches.forEach((m,i)=>{
    if (usedIdx.has(i)||m.len<4) return;
    const rocketPuId = m.dir==="v" ? "pu_rocket_h" : "pu_rocket_v";
    resolved.push({type:"PU4",cells:m.cells,color:m.color,
      spawnAt:swapTarget||m.cells[Math.floor(m.cells.length/2)],puId:rocketPuId,matchDir:m.dir});
    usedIdx.add(i);
  });

  // 4. PUS: 2×2 vuông — detect từ pairs of parallel horizontal matches
  // Check toàn board
  const squareFound = new Set();
  for (let y=0; y<GRID_ROWS-1; y++) {
    for (let x=0; x<GRID_COLS-1; x++) {
      const c00=gemColor(rawMatches.find(m=>m.cells.find(c=>c.x===x&&c.y===y))?.color||"");
      // Simplified: check if all 4 cells in 2x2 have same color and are in any match
      const cells=[{x,y},{x:x+1,y},{x,y:y+1},{x:x+1,y:y+1}];
      const colors=cells.map(c=>rawMatches.find(m=>!usedIdx.has(rawMatches.indexOf(m))&&m.cells.find(mc=>mc.x===c.x&&mc.y===c.y))?.color);
      const allSame=colors.every(co=>co&&co===colors[0]);
      const sqKey=`${x},${y}`;
      if (allSame&&!squareFound.has(sqKey)) {
        squareFound.add(sqKey);
        // find match indices containing these cells
        rawMatches.forEach((m,i)=>{
          if (cells.find(c=>m.cells.find(mc=>mc.x===c.x&&mc.y===c.y))) usedIdx.add(i);
        });
        resolved.push({type:"PUS",cells,color:colors[0],
          spawnAt:swapTarget||cells[0],puId:"pu_propeller",matchDir:"sq"});
      }
    }
  }

  // 5. M3: phần còn lại
  rawMatches.forEach((m,i)=>{
    if (usedIdx.has(i)) return;
    resolved.push({type:"M3",cells:m.cells,color:m.color,spawnAt:null,puId:null});
    usedIdx.add(i);
  });

  return resolved;
}

// ─── APPLY MATCHES ────────────────────────────────────────────────────────────
// Xóa các hạt trong match, xử lý posEdge damage, spawn power-up
function applyMatches(grid, matches, blockerLib) {
  const g = cloneGrid(grid);
  const cleared = new Set();
  const puSpawns = [];

  matches.forEach(m => {
    m.cells.forEach(({x,y}) => {
      const k=`${x},${y}`;
      if (cleared.has(k)) return;
      cleared.add(k);
      g[y][x].layers["0"] = null;

      // posEdge: 4 ô lân cận nhận damage
      [{x:x-1,y},{x:x+1,y},{x,y:y-1},{x,y:y+1}].forEach(({x:nx,y:ny})=>{
        if (nx<0||nx>=GRID_COLS||ny<0||ny>=GRID_ROWS) return;
        [1,2].forEach(l=>{
          const bid = g[ny][nx].layers[l];
          if (!bid) return;
          const b = blockerLib.find(b=>b.id===bid);
          if (b && b.posEdge) {
            // Xóa blocker (1-hit simulation; production cần track HP per-cell)
            g[ny][nx].layers[l] = null;
          }
        });
      });
    });

    if (m.puId && m.spawnAt) {
      const {x,y}=m.spawnAt;
      if (x>=0&&x<GRID_COLS&&y>=0&&y<GRID_ROWS) puSpawns.push({x,y,puId:m.puId});
    }
  });

  puSpawns.forEach(({x,y,puId})=>{ g[y][x].layers["0"]=puId; });
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ══  POWER-UP ENGINE  ═══════════════════════════════════════════════════════
//
//  Nguồn: PowerUpDocument.docx
//
//  2.1 Rocket  → xóa toàn bộ 1 hàng (pu_rocket_h) hoặc 1 cột (pu_rocket_v)
//  2.2 TNT     → nổ bán kính 2 ô (diện tích ~25 ô)
//  2.3 Propeller → xóa 4 ô xung quanh + bay đến mục tiêu ưu tiên
//  2.4 LightBall → xóa tất cả gem cùng màu với gem kề bên khi swap
//
//  3.  Combo: Rocket+Rocket, Rocket+TNT, TNT+TNT, Propeller+X, LightBall+X
//  4.  Propeller pathfinding priority: objectives > spreading blockers > PUs > random
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Collect cells to destroy (without mutating grid) ───────────────────────
function getCellsInRadius(cx, cy, radius) {
  const cells = [];
  for (let dy=-radius; dy<=radius; dy++)
    for (let dx=-radius; dx<=radius; dx++) {
      const nx=cx+dx, ny=cy+dy;
      if (nx>=0&&nx<GRID_COLS&&ny>=0&&ny<GRID_ROWS)
        cells.push({x:nx,y:ny});
    }
  return cells;
}

function getRowCells(y) {
  return Array.from({length:GRID_COLS},(_,x)=>({x,y}));
}
function getColCells(x) {
  return Array.from({length:GRID_ROWS},(_,y)=>({x,y}));
}

// ─── Propeller pathfinding ─────────────────────────────────────────────────
// P1: ô có blocker là objective target  P2: spreading blockers (slime/goblin)
// P3: PU trên board  P4: random blocker
function propellerFindTarget(grid, objectives, blockerLib) {
  const objectiveIds = new Set((objectives||[]).map(o=>o.blockerId));
  const spreadingIds = new Set(["m_slime","m_goblin"]);

  // Scan tất cả ô
  let p1=null, p2=null, p3=null, p4=null;
  for (let y=0; y<GRID_ROWS && !p1; y++) {
    for (let x=0; x<GRID_COLS && !p1; x++) {
      const cell=grid[y][x];
      if (cell.isVoid) continue;
      const gem=cell.layers["0"];
      const cover=cell.layers["1"];
      const overlay=cell.layers["2"];
      // P1: objective blocker
      if (cover && objectiveIds.has(cover)) { p1={x,y}; break; }
      if (overlay && objectiveIds.has(overlay)) { p1={x,y}; break; }
      if (gem && objectiveIds.has(gem)) { p1={x,y}; break; }
    }
  }
  for (let y=0; y<GRID_ROWS; y++) {
    for (let x=0; x<GRID_COLS; x++) {
      const cell=grid[y][x]; if(cell.isVoid) continue;
      const gem=cell.layers["0"];
      const cover=cell.layers["1"];
      if (!p2 && (spreadingIds.has(gem)||spreadingIds.has(cover))) p2={x,y};
      if (!p3 && gem && POWERUP_IDS.includes(gem)) p3={x,y};
      if (!p4 && (cover||overlay)) p4={x,y};  // any blocker
    }
  }
  return p1||p2||p3||p4||{x:Math.floor(GRID_COLS/2),y:Math.floor(GRID_ROWS/2)};
}

// ─── Apply a single PU activation, returns {newGrid, destroyedCells, effects:[]} ──
// effects = list of follow-up PU activations triggered (for combo chain)
function activatePU(grid, puId, px, py, blockerLib, objectives, swapColor) {
  const g = cloneGrid(grid);
  const destroyed = new Set();
  const effects = []; // {puId, x, y} follow-up activations

  const destroy = (x,y) => {
    if (x<0||x>=GRID_COLS||y<0||y>=GRID_ROWS) return;
    const cell=g[y][x]; if(cell.isVoid) return;
    const k=`${x},${y}`;
    if (destroyed.has(k)) return;
    destroyed.add(k);
    // If there's a PU here, queue it for chain
    const gem=cell.layers["0"];
    if (gem && POWERUP_IDS.includes(gem) && !(gem===puId&&x===px&&y===py)) {
      effects.push({puId:gem,x,y});
    }
    cell.layers["0"]=null;
    // posEdge damage to adjacent blockers
    [{x:x-1,y},{x:x+1,y},{x,y:y-1},{x,y:y+1}].forEach(({x:nx,y:ny})=>{
      if(nx<0||nx>=GRID_COLS||ny<0||ny>=GRID_ROWS) return;
      [1,2].forEach(l=>{
        const bid=g[ny][nx].layers[l]; if(!bid) return;
        const b=blockerLib.find(b=>b.id===bid);
        if(b&&b.posEdge) g[ny][nx].layers[l]=null;
      });
    });
  };

  // Remove the PU itself first
  g[py][px].layers["0"]=null;

  switch(puId) {
    case "pu_rocket_h":
      // Rocket ngang → xóa toàn hàng py
      getRowCells(py).forEach(({x,y})=>destroy(x,y));
      break;

    case "pu_rocket_v":
      // Rocket dọc → xóa toàn cột px
      getColCells(px).forEach(({x,y})=>destroy(x,y));
      break;

    case "pu_tnt": {
      // TNT: bán kính 2, ~25 ô
      getCellsInRadius(px,py,2).forEach(({x,y})=>destroy(x,y));
      break;
    }

    case "pu_propeller": {
      // Propeller: xóa 4 ô xung quanh + bay đến mục tiêu
      [{x:px-1,y:py},{x:px+1,y:py},{x:px,y:py-1},{x:px,y:py+1}].forEach(({x,y})=>destroy(x,y));
      const target=propellerFindTarget(g,objectives,blockerLib);
      // Phá hủy ô đích
      const tc=g[target.y][target.x];
      [0,1,2].forEach(l=>{ if(tc.layers[l]) { tc.layers[l]=null; destroyed.add(`${target.x},${target.y}_L${l}`); } });
      break;
    }

    case "pu_lightball": {
      // Light Ball: xóa tất cả gem cùng màu với swapColor
      const targetColor = swapColor || gemColor(g[py]?.[px-1]?.layers["0"]) 
                        || gemColor(g[py]?.[px+1]?.layers["0"])
                        || gemColor(g[py-1]?.[px]?.layers["0"])
                        || gemColor(g[py+1]?.[px]?.layers["0"])
                        || "red"; // fallback
      for (let y=0; y<GRID_ROWS; y++)
        for (let x=0; x<GRID_COLS; x++)
          if (gemColor(g[y][x].layers["0"])===targetColor) destroy(x,y);
      break;
    }

    default: break;
  }

  const destroyedCells = [...destroyed].map(k=>{
    const parts=k.split(","); return {x:+parts[0],y:+parts[1]};
  }).filter(c=>!isNaN(c.x));

  return {newGrid:g, destroyedCells, effects};
}

// ─── COMBO LOGIC ──────────────────────────────────────────────────────────────
// Khi swap 2 PU với nhau → combo effect thay vì activate riêng lẻ
// Trả về {comboType, cells} hoặc null nếu không phải combo
function getComboEffect(pu1, pu2, x1,y1, x2,y2) {
  const isRocket = id => id==="pu_rocket_h"||id==="pu_rocket_v";
  if (isRocket(pu1)&&isRocket(pu2)) {
    // Rocket+Rocket → hình chữ thập (1 hàng + 1 cột tại điểm kết hợp)
    return { type:"COMBO_RR", x:x2, y:y2,
      cells:[...getRowCells(y2),...getColCells(x2)] };
  }
  if ((isRocket(pu1)&&pu2==="pu_tnt")||(pu1==="pu_tnt"&&isRocket(pu2))) {
    // Rocket+TNT → 3 hàng + 3 cột
    const cx=x2,cy=y2;
    const cells=[];
    [-1,0,1].forEach(d=>{
      getRowCells(cy+d).forEach(c=>cells.push(c));
      getColCells(cx+d).forEach(c=>cells.push(c));
    });
    return { type:"COMBO_RT", x:cx, y:cy, cells };
  }
  if (pu1==="pu_tnt"&&pu2==="pu_tnt") {
    // TNT+TNT → bán kính 4
    return { type:"COMBO_TT", x:x2, y:y2,
      cells:getCellsInRadius(x2,y2,4) };
  }
  if (pu1==="pu_propeller"&&pu2==="pu_propeller") {
    // Propeller+Propeller → 3 máy bay (3 targets)
    return { type:"COMBO_PP", x:x2, y:y2, cells:[] }; // handled specially
  }
  if (pu1==="pu_propeller"||pu2==="pu_propeller") {
    // Propeller+Rocket/TNT → mang PU kia đến target rồi nổ
    return { type:"COMBO_PX", x:x2, y:y2,
      carriedPu: pu1==="pu_propeller"?pu2:pu1, cells:[] };
  }
  if (pu1==="pu_lightball"&&pu2==="pu_lightball") {
    // LightBall+LightBall → xóa toàn bộ board
    const cells=[];
    for(let y=0;y<GRID_ROWS;y++) for(let x=0;x<GRID_COLS;x++) cells.push({x,y});
    return { type:"COMBO_LL", x:x2, y:y2, cells };
  }
  if (pu1==="pu_lightball"||pu2==="pu_lightball") {
    // LightBall+Rocket/TNT → biến tất cả gem cùng màu thành PU đó rồi kích hoạt
    const otherPu = pu1==="pu_lightball"?pu2:pu1;
    return { type:"COMBO_LX", x:x2, y:y2, transformPu:otherPu, cells:[] };
  }
  return null;
}

// Apply combo effect to grid, returns {newGrid, destroyedCells}
function applyCombo(grid, combo, blockerLib, objectives, swapColor) {
  const g = cloneGrid(grid);
  const destroyed = new Set();
  const dKey=(x,y)=>`${x},${y}`;
  const destroyCell=(x,y)=>{
    if(x<0||x>=GRID_COLS||y<0||y>=GRID_ROWS) return;
    const cell=g[y][x]; if(cell.isVoid) return;
    destroyed.add(dKey(x,y));
    cell.layers["0"]=null;
    [{x:x-1,y},{x:x+1,y},{x,y:y-1},{x,y:y+1}].forEach(({x:nx,y:ny})=>{
      if(nx<0||nx>=GRID_COLS||ny<0||ny>=GRID_ROWS) return;
      [1,2].forEach(l=>{
        const bid=g[ny][nx].layers[l]; if(!bid) return;
        const b=blockerLib.find(b=>b.id===bid);
        if(b&&b.posEdge) g[ny][nx].layers[l]=null;
      });
    });
  };

  // Remove both PUs at combo origin
  g[combo.y][combo.x].layers["0"]=null;

  if (combo.type==="COMBO_PP") {
    // 3 propeller → 3 different targets
    const t1=propellerFindTarget(g,objectives,blockerLib);
    [0,1,2,-1].forEach(l=>{ if(g[t1.y][t1.x].layers[l]!==undefined) g[t1.y][t1.x].layers[l]=null; });
    destroyed.add(dKey(t1.x,t1.y));
    const t2=propellerFindTarget(g,objectives,blockerLib);
    [0,1,2,-1].forEach(l=>{ if(g[t2.y][t2.x].layers[l]!==undefined) g[t2.y][t2.x].layers[l]=null; });
    destroyed.add(dKey(t2.x,t2.y));
    const t3=propellerFindTarget(g,objectives,blockerLib);
    [0,1,2,-1].forEach(l=>{ if(g[t3.y][t3.x].layers[l]!==undefined) g[t3.y][t3.x].layers[l]=null; });
    destroyed.add(dKey(t3.x,t3.y));
  } else if (combo.type==="COMBO_PX") {
    // Propeller mang PU đến target rồi nổ
    const target=propellerFindTarget(g,objectives,blockerLib);
    const {newGrid:ng, destroyedCells}=activatePU(g, combo.carriedPu, target.x, target.y, blockerLib, objectives, swapColor);
    return {newGrid:ng, destroyedCells};
  } else if (combo.type==="COMBO_LX") {
    // Light Ball + PU: biến tất cả gem màu swapColor thành PU rồi kích hoạt
    const tc = swapColor || "red";
    let ng2=g;
    for (let y=0; y<GRID_ROWS; y++) {
      for (let x=0; x<GRID_COLS; x++) {
        if (gemColor(ng2[y][x].layers["0"])===tc) {
          // Transform → PU rồi activate ngay
          ng2[y][x].layers["0"]=combo.transformPu;
          const {newGrid:ng3}=activatePU(ng2, combo.transformPu, x, y, blockerLib, objectives, null);
          ng2=ng3;
          destroyed.add(dKey(x,y));
        }
      }
    }
    return {newGrid:ng2, destroyedCells:[...destroyed].map(k=>{const p=k.split(",");return{x:+p[0],y:+p[1]};})};
  } else {
    // Regular cell list combos (RR, RT, TT, LL)
    combo.cells.forEach(({x,y})=>destroyCell(x,y));
  }

  return {newGrid:g, destroyedCells:[...destroyed].map(k=>{const p=k.split(",");return{x:+p[0],y:+p[1]};})};
}

// ─── GRAVITY: RƠI THẲNG + TRƯỢT CHÉO ────────────────────────────────────────
// Nguồn: Luật Rơi - "Hạt rơi thẳng từ trên xuống theo cột"
//        "Bên trái hoặc bên phải phía dưới hạt còn ô trống → trượt chéo một ô xuống"
//        "Ưu tiên trượt chéo về bên trái trước"
//        "Trong một cột nhiều hạt trượt → hạt trên cùng trượt trước"
//        "Hai cột cùng trượt vào cùng điểm → thay lượt"
function applyGravityStep(grid, blockerLib) {
  const g = cloneGrid(grid);
  let moved = false;

  // Phase A: Rơi thẳng — từng cột, duyệt từ dưới lên
  for (let x=0; x<GRID_COLS; x++) {
    for (let y=GRID_ROWS-2; y>=0; y--) {
      const gem = g[y][x].layers["0"];
      if (!gem || g[y][x].isVoid) continue;
      const by=y+1;
      if (by<GRID_ROWS && !g[by][x].isVoid && !g[by][x].layers["0"] && cellCanReceiveGem(g[by][x],blockerLib)) {
        g[by][x].layers["0"]=gem;
        g[y][x].layers["0"]=null;
        moved=true;
      }
    }
  }
  if (moved) return {newGrid:g,moved:true};

  // Phase B: Trượt chéo — chỉ xét khi không còn rơi thẳng nào
  // Với mỗi ô trống dưới cùng của một cột, xét ô chéo trái/phải có hạt không
  // "Hạt trên cùng của cột có thể trượt sẽ trượt trước"
  // "Ưu tiên cột có điểm rơi thấp hơn (số hàng lớn hơn)"
  // "Bằng nhau → thay lượt (trong một step chỉ slide 1 hạt từ mỗi side)"

  // Tìm tất cả slide option có thể
  const slideOpts = []; // {fromX,fromY,toX,toY}

  for (let toX=0; toX<GRID_COLS; toX++) {
    // toY = hàng trống thấp nhất trong cột toX
    let toY=-1;
    for (let y=GRID_ROWS-1; y>=0; y--) {
      if (!g[y][toX].isVoid && !g[y][toX].layers["0"] && cellCanReceiveGem(g[y][toX],blockerLib)) { toY=y; break; }
    }
    if (toY<0) continue;

    // Ưu tiên trái trước (dx=-1: hạt từ cột toX+1 trượt sang toX)
    for (const dx of [-1,1]) {
      const fromX = toX - dx; // dx=-1 → fromX=toX+1 (cột bên phải trượt trái)
      if (fromX<0||fromX>=GRID_COLS) continue;
      // Hạt trên cùng của cột fromX có thể trượt sang toX không?
      // Điều kiện: hạt ở fromY phải nằm ở hàng toY-1 (chéo 1 ô)
      // "Trượt chéo một ô xuống" → fromY = toY-1
      const fromY = toY-1;
      if (fromY<0) continue;
      // Ô fromX,fromY phải có gem
      const gem=g[fromY][fromX].layers["0"];
      if (!gem||g[fromY][fromX].isVoid) continue;
      // Ô bên dưới fromX,fromY (=fromX,toY) phải bị block hoặc occupied (không thể rơi thẳng)
      // → đã pass Phase A nên nếu bên dưới trống thì Phase A đã xử lý; nếu còn slide option thì bên dưới blocked
      // Nhưng phải kiểm tra: ô toX,toY thực sự trống
      if (g[toY][toX].layers["0"]) continue;
      slideOpts.push({fromX,fromY,toX,toY,dx,priority:toY});
    }
  }

  if (slideOpts.length===0) return {newGrid:g,moved:false};

  // Sắp xếp: toY lớn nhất trước (rơi thấp nhất), cùng toY thì dx=-1 trước (trái)
  slideOpts.sort((a,b)=>b.priority-a.priority||a.dx-b.dx);

  // Thực hiện tối đa 1 slide mỗi (toX,toY) để đảm bảo "thay lượt"
  const doneTarget=new Set();
  for (const s of slideOpts) {
    const tk=`${s.toX},${s.toY}`;
    if (doneTarget.has(tk)) continue;
    const gem=g[s.fromY][s.fromX].layers["0"];
    if (!gem||g[s.toY][s.toX].layers["0"]) continue;
    g[s.toY][s.toX].layers["0"]=gem;
    g[s.fromY][s.fromX].layers["0"]=null;
    doneTarget.add(tk);
    moved=true;
  }

  return {newGrid:g,moved};
}

// ─── SPAWN: Nguồn hạt từ TẤT CẢ các ô ──────────────────────────────────────
// Source rơi là toàn bộ board — mọi ô trống đều nhận hạt mới.
// spawnOneGem: điền từng ô trống một (trên→dưới, trái→phải) để animate tuần tự.
function spawnOneGem(grid, blockerLib) {
  for (let y=0; y<GRID_ROWS; y++) {
    for (let x=0; x<GRID_COLS; x++) {
      if (!grid[y][x].isVoid && !grid[y][x].layers["0"] && cellCanReceiveGem(grid[y][x],blockerLib)) {
        const g=cloneGrid(grid);
        g[y][x].layers["0"]=GEM_IDS[Math.floor(Math.random()*GEM_IDS.length)];
        return {newGrid:g, spawned:true, x, y};
      }
    }
  }
  return {newGrid:grid, spawned:false};
}

// fillAllEmptyCells: điền TẤT CẢ ô trống cùng lúc — dùng cho nút FILL trong editor
function fillAllEmptyCells(grid, blockerLib) {
  const g = cloneGrid(grid);
  let count = 0;
  for (let y=0; y<GRID_ROWS; y++) {
    for (let x=0; x<GRID_COLS; x++) {
      if (!g[y][x].isVoid && !g[y][x].layers["0"] && cellCanReceiveGem(g[y][x],blockerLib)) {
        g[y][x].layers["0"] = GEM_IDS[Math.floor(Math.random()*GEM_IDS.length)];
        count++;
      }
    }
  }
  return {newGrid:g, count};
}

function boardNeedsGems(grid, blockerLib) {
  for (let y=0; y<GRID_ROWS; y++)
    for (let x=0; x<GRID_COLS; x++)
      if (!grid[y][x].isVoid && !grid[y][x].layers["0"] && cellCanReceiveGem(grid[y][x],blockerLib))
        return true;
  return false;
}

// ─── SWAP ────────────────────────────────────────────────────────────────────
// "Hai hạt chỉ có thể swap khi đứng cạnh nhau, cùng hàng/cột, không swap với ô trống"
// "Sau swap: tạo match → giữ; không match → quay lại"
// "Power-up swap với hạt → luôn tính là match"
function canSwap(grid, x1,y1, x2,y2) {
  const adj=(Math.abs(x1-x2)===1&&y1===y2)||(Math.abs(y1-y2)===1&&x1===x2);
  if (!adj) return false;
  if (grid[y1][x1].isVoid||grid[y2][x2].isVoid) return false;
  const id1=grid[y1][x1].layers["0"];
  const id2=grid[y2][x2].layers["0"];
  if (!id1||!id2) return false; // Không swap với ô trống
  return true;
}

function doSwap(grid, x1,y1, x2,y2) {
  const g=cloneGrid(grid);
  const tmp=g[y1][x1].layers["0"];
  g[y1][x1].layers["0"]=g[y2][x2].layers["0"];
  g[y2][x2].layers["0"]=tmp;
  return g;
}

// Thực hiện swap + kiểm tra match; swapTarget = điểm người chơi "swap vào"
// Trả về thêm field: combo (nếu PU+PU), puActivation (nếu PU+gem), swapColor
function trySwap(grid, x1,y1, x2,y2) {
  if (!canSwap(grid,x1,y1,x2,y2)) return {valid:false,newGrid:grid,matches:[],hasPU:false,combo:null};
  const id1=grid[y1][x1].layers["0"];
  const id2=grid[y2][x2].layers["0"];
  const isPU1=isPowerup(id1), isPU2=isPowerup(id2);

  // ── Case 1: PU + PU → Combo ────────────────────────────────────────────
  if (isPU1 && isPU2) {
    const combo=getComboEffect(id1,id2,x1,y1,x2,y2);
    if (combo) return {valid:true,newGrid:doSwap(grid,x1,y1,x2,y2),matches:[],hasPU:true,combo,swapColor:null};
  }

  // ── Case 2: PU + gem → activate PU (swap vị trí, PU kích hoạt tại vị trí mới) ──
  if (isPU1 || isPU2) {
    const puId    = isPU1 ? id1 : id2;
    const gemId   = isPU1 ? id2 : id1;
    const activX  = isPU1 ? x2 : x1; // vị trí PU sau khi swap
    const activY  = isPU1 ? y2 : y1;
    const swapColor = gemColor(gemId);
    const swapped = doSwap(grid,x1,y1,x2,y2);
    return {valid:true,newGrid:swapped,matches:[],hasPU:true,combo:null,
            puActivation:{puId,x:activX,y:activY},swapColor};
  }

  // ── Case 3: gem + gem → normal match ──────────────────────────────────
  const swapped=doSwap(grid,x1,y1,x2,y2);
  const rawMatches=findAllMatches(swapped);
  if (rawMatches.length>0) {
    const resolved=resolveMatches(rawMatches,{x:x2,y:y2});
    return {valid:true,newGrid:swapped,matches:resolved,hasPU:false,combo:null,swapColor:null};
  }
  return {valid:false,newGrid:grid,matches:[],hasPU:false,combo:null};
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEVEL PRESETS
// ═══════════════════════════════════════════════════════════════════════════════
const generatePresets = () => {
  const presets=[];
  for (let i=1;i<=30;i++) {
    const grid=makeGrid();
    const stoneCount=Math.min(5+i*2,25), iceCount=Math.min(i,10), moves=20+Math.floor(i*1.5);
    let placed=0;
    for (let y=0;y<GRID_ROWS&&placed<stoneCount;y++)
      for (let x=0;x<GRID_COLS&&placed<stoneCount;x++)
        if((x+y+i)%3===0){grid[y][x].layers["1"]="b_stone";placed++;}
    placed=0;
    for (let y=0;y<GRID_ROWS&&placed<iceCount;y++)
      for (let x=0;x<GRID_COLS&&placed<iceCount;x++)
        if((x+y+i)%4===0&&!grid[y][x].layers["1"]){grid[y][x].layers["1"]="b_ice";placed++;}
    grid.forEach(row=>row.forEach(cell=>{
      if(!cell.isVoid&&!cell.layers["0"]) cell.layers["0"]=GEM_IDS[(cell.x+cell.y)%5];
    }));
    const snap=snapshotBlockers(grid,DEFAULT_BLOCKERS);
    const estTax=calcTotalTurnTax(snap);
    const tgt=Array.from({length:7},(_,k)=>+Math.max(0,estTax*(1-k/6)).toFixed(1));
    presets.push({id:`preset_${i}`,name:`Level ${String(i).padStart(3,"0")}`,
      chapter:Math.ceil(i/5),moves,objectives:[{blockerId:"b_stone",count:Math.max(3,stoneCount-2)}],
      targetPacingCurve:tgt,grid});
  }
  return presets;
};
const PRESETS=generatePresets();

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Editor state ─────────────────────────────────────────────────────────
  const [blockers,setBlockers]             = useState(DEFAULT_BLOCKERS);
  const [grid,setGrid]                     = useState(makeGrid);
  const [selectedLayer,setSelectedLayer]   = useState(0);
  const [selectedBlockerId,setSelectedBlockerId] = useState(null);
  const [tool,setTool]                     = useState("brush");
  const [levelMeta,setLevelMeta]           = useState({name:"Level_001",chapter:1,moves:25});
  const [objectives,setObjectives]         = useState([{blockerId:"b_stone",count:15}]);
  const [targetCurveInput,setTargetCurveInput] = useState([25,20,15,10,5,2,0]);
  const [activeTab,setActiveTab]           = useState("library");
  const [savedLevels,setSavedLevels]       = useState([]);
  const [isPainting,setIsPainting]         = useState(false);
  const [newBlockerForm,setNewBlockerForm] = useState(null);
  const [activeCategory,setActiveCategory] = useState("all");
  const [notification,setNotification]     = useState(null);

  // ── Simulator state ───────────────────────────────────────────────────────
  const [simMode,setSimMode]     = useState(false);
  const [simGrid,setSimGrid]     = useState(null);
  const [simMoves,setSimMoves]   = useState(0);
  const [simScore,setSimScore]   = useState(0);
  const [selected,setSelected]   = useState(null);  // {x,y}
  const [matchFlash,setMatchFlash] = useState([]);
  const [isAnimating,setIsAnimating] = useState(false);
  const [gravPhase,setGravPhase] = useState("idle");
  const [logLines,setLogLines]   = useState([]);
  const simGridRef               = useRef(null);
  const animRef                  = useRef(false);

  const notify=(msg,type="info")=>{ setNotification({msg,type}); setTimeout(()=>setNotification(null),2500); };
  const addLog=(msg)=>setLogLines(p=>[msg,...p.slice(0,29)]);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  // ── Pacing ────────────────────────────────────────────────────────────────
  const boardSnapshot = useMemo(()=>snapshotBlockers(grid,blockers),[grid,blockers]);
  const totalTax   = useMemo(()=>calcTotalTurnTax(boardSnapshot),[boardSnapshot]);
  const er         = calcER(totalTax,levelMeta.moves);
  const realPoints = buildRealTimeCurve(totalTax,levelMeta.moves);
  const chartData  = interpolateTargetCurve(targetCurveInput,realPoints,levelMeta.moves);
  const maxTarget  = Math.max(...targetCurveInput);
  const erStatus   = er<0.8?"EASY":er<=1.2?"BALANCED":er<=1.5?"HARD":"IMPOSSIBLE";
  const erColor    = er<0.8?"#4ade80":er<=1.2?"#facc15":er<=1.5?"#fb923c":"#ef4444";

  // ── Editor paint ──────────────────────────────────────────────────────────
  const applyTool=useCallback((x,y)=>{
    setGrid(prev=>{
      const next=cloneGrid(prev);
      const cell=next[y][x];
      if(tool==="void") cell.isVoid=!cell.isVoid;
      else if(tool==="eraser") cell.layers[selectedLayer]=null;
      else if(tool==="brush"&&selectedBlockerId&&!cell.isVoid) cell.layers[selectedLayer]=selectedBlockerId;
      return next;
    });
  },[tool,selectedLayer,selectedBlockerId]);

  // ── Level management ──────────────────────────────────────────────────────
  const levelToJSON=()=>({...levelMeta,objectives,targetPacingCurve:targetCurveInput,grid});
  const saveLevel=()=>{ const lvl={...levelToJSON(),savedAt:new Date().toISOString()};
    setSavedLevels(p=>[lvl,...p.filter(l=>l.name!==lvl.name)]); notify("Level saved!","success"); };
  const loadLevel=(lvl)=>{ setGrid(lvl.grid);
    setLevelMeta({name:lvl.name,chapter:lvl.chapter,moves:lvl.moves});
    setObjectives(lvl.objectives||[]); setTargetCurveInput(lvl.targetPacingCurve||[20,16,12,8,4,1,0]);
    notify(`Loaded: ${lvl.name}`,"info"); };
  const exportLevel=()=>{ const b=new Blob([JSON.stringify(levelToJSON(),null,2)],{type:"application/json"});
    const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u;
    a.download=`${levelMeta.name}.json`; a.click(); URL.revokeObjectURL(u); };
  const importLevel=(e)=>{ const file=e.target.files[0]; if(!file) return;
    const r=new FileReader(); r.onload=(ev)=>{
      try{loadLevel(JSON.parse(ev.target.result));notify("Imported!","success");}
      catch{notify("Invalid JSON","error");}
    }; r.readAsText(file); e.target.value=""; };
  const shareLevel=()=>{ const enc=btoa(unescape(encodeURIComponent(JSON.stringify(levelToJSON()))));
    navigator.clipboard.writeText(`${location.origin}${location.pathname}?level=${enc}`)
      .then(()=>notify("Share link copied!","success")); };
  useEffect(()=>{
    const enc=new URLSearchParams(location.search).get("level");
    if(enc){try{loadLevel(JSON.parse(decodeURIComponent(escape(atob(enc)))));}catch{}}
  },[]);

  const addBlocker=()=>{
    if(!newBlockerForm?.id||!newBlockerForm?.name) return;
    setBlockers(p=>[...p,{...newBlockerForm}]); setNewBlockerForm(null); notify("Blocker created!","success");
  };

  // ── FILL: điền hạt ngẫu nhiên vào tất cả ô layer 0 trống trong editor ──
  const fillGems=()=>{
    setGrid(prev=>{
      const {newGrid,count}=fillAllEmptyCells(prev,blockers);
      notify(`Filled ${count} cells with random gems`,"success");
      return newGrid;
    });
  };

  // ── CLEAR GEMS: xóa tất cả gem ở layer 0 (giữ blockers) ──
  const clearGems=()=>{
    setGrid(prev=>{
      const g=cloneGrid(prev);
      g.forEach(row=>row.forEach(cell=>{ if(cell.layers["0"]&&isGem(cell.layers["0"])) cell.layers["0"]=null; }));
      return g;
    });
    notify("Gems cleared","info");
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SIMULATOR
  // ═══════════════════════════════════════════════════════════════════════════

  const enterSimulator=()=>{
    // Auto-fill tất cả ô trống trước khi simulate
    const {newGrid:filled}=fillAllEmptyCells(cloneGrid(grid),blockers);
    const sg=filled;
    simGridRef.current=sg; setSimGrid(sg);
    setSimMoves(levelMeta.moves); setSimScore(0);
    setSelected(null); setLogLines([]); setMatchFlash([]);
    setIsAnimating(false); setGravPhase("idle"); animRef.current=false;
    setSimMode(true); addLog("▶ SIMULATION START");
  };
  const exitSimulator=()=>{ setSimMode(false); setSimGrid(null); setSelected(null); animRef.current=false; };

  // ── Gravity loop ─────────────────────────────────────────────────────────
  // Phase 1: Hạt trên bàn rơi thẳng + trượt chéo
  // Phase 2: Spawn từng hạt vào TẤT CẢ ô trống (nguồn = toàn board), tuần tự có delay
  //          Sau mỗi hạt spawn: chạy gravity để hạt settle trước khi spawn tiếp
  // Phase 3: Chain reaction check
  const runGravityLoop=useCallback(async(startGrid)=>{
    animRef.current=true;
    setIsAnimating(true);
    let g=startGrid;

    // ── Phase 1: Rơi thẳng + trượt chéo ──
    setGravPhase("falling");
    let step=0;
    while(step<300) {
      const {newGrid,moved}=applyGravityStep(g,blockers);
      if(!moved) break;
      g=newGrid; simGridRef.current=g; setSimGrid(cloneGrid(g));
      await sleep(52);
      step++;
    }

    // ── Phase 2: Spawn từng hạt vào tất cả ô trống, có delay giữa các hạt ──
    // Nguồn: tất cả ô trên board (không chỉ row 0)
    setGravPhase("spawning");
    let spawnStep=0;
    while(boardNeedsGems(g,blockers) && spawnStep<300) {
      const {newGrid,spawned}=spawnOneGem(g,blockers);
      if(!spawned) break;
      g=newGrid; simGridRef.current=g; setSimGrid(cloneGrid(g));
      await sleep(38); // delay giữa mỗi hạt spawn
      // Sau khi spawn: hạt settle (gravity) trước khi spawn tiếp
      let settle=0;
      while(settle<60){
        const {newGrid:fg,moved}=applyGravityStep(g,blockers);
        if(!moved) break;
        g=fg; simGridRef.current=g; setSimGrid(cloneGrid(g));
        await sleep(40);
        settle++;
      }
      spawnStep++;
    }

    // ── Phase 3: Chain reaction ──
    const chainMatches=findAllMatches(g);
    if(chainMatches.length>0){
      addLog(`⛓ Chain ×${chainMatches.length}`);
      const resolved=resolveMatches(chainMatches,null);
      setMatchFlash(resolved.flatMap(m=>m.cells));
      await sleep(220);
      setMatchFlash([]);
      g=applyMatches(g,resolved,blockers);
      simGridRef.current=g; setSimGrid(cloneGrid(g));
      setSimScore(prev=>prev+resolved.reduce((s,m)=>s+m.cells.length*10,0));
      await sleep(80);
      await runGravityLoop(g);
      return;
    }

    setGravPhase("idle"); setIsAnimating(false); animRef.current=false;
  },[blockers]);

  // ─── Tap / Click trong simulator ─────────────────────────────────────────
  // "Chạm lần 1 → chọn hạt; Chạm lần 2 → swap nếu hợp lệ, chọn mới nếu không swap được"
  const handleSimCellClick=useCallback(async(x,y)=>{
    if(isAnimating||animRef.current) return;
    const g=simGridRef.current; if(!g) return;
    const cell=g[y][x];
    if(cell.isVoid) return;
    const id=cell.layers["0"];

    if(!selected){
      if(!id){return;} // Không chọn ô trống
      setSelected({x,y});
      addLog(`◎ SELECT (${x},${y}) [${id}]`);
    } else {
      if(selected.x===x&&selected.y===y){ setSelected(null); return; }

      if(!canSwap(g,selected.x,selected.y,x,y)){
        // Không swap được
        if(id){ setSelected({x,y}); addLog(`◎ RESELECT (${x},${y})`); }
        else { setSelected(null); }
        return;
      }

      setSelected(null);
      const sx=selected.x, sy=selected.y;
      const {valid,newGrid,matches,hasPU,combo,puActivation,swapColor}=trySwap(g,sx,sy,x,y);

      if(!valid){
        addLog(`✗ (${sx},${sy})↔(${x},${y}) no match`);
        setMatchFlash([{x:sx,y:sy},{x,y}]);
        await sleep(250); setMatchFlash([]); return;
      }

      // Tiêu 1 lượt
      setSimMoves(p=>{ const nm=p-1; if(nm<=0) addLog("⚠ OUT OF MOVES"); return nm; });

      // ── Combo: PU + PU ──────────────────────────────────────────────────
      if (combo) {
        addLog(`💥 COMBO ${combo.type} @ (${combo.x},${combo.y})`);
        setMatchFlash(combo.cells.length>0 ? combo.cells : [{x:combo.x,y:combo.y}]);
        await sleep(300); setMatchFlash([]);
        const {newGrid:cg, destroyedCells}=applyCombo(newGrid,combo,blockers,objectives,swapColor);
        simGridRef.current=cg; setSimGrid(cloneGrid(cg));
        setSimScore(p=>p+destroyedCells.length*15);
        await runGravityLoop(cg);
        return;
      }

      // ── PU Activation: PU + gem ─────────────────────────────────────────
      if (puActivation) {
        addLog(`⚡ ${puActivation.puId} activated @ (${puActivation.x},${puActivation.y}) color=${swapColor||"?"}`);
        setMatchFlash([{x:puActivation.x,y:puActivation.y}]);
        await sleep(200); setMatchFlash([]);
        const {newGrid:pg, destroyedCells, effects}=activatePU(newGrid,puActivation.puId,puActivation.x,puActivation.y,blockers,objectives,swapColor);
        simGridRef.current=pg; setSimGrid(cloneGrid(pg));
        setSimScore(p=>p+destroyedCells.length*12);
        // Chain: kích hoạt PU bị phá trong quá trình nổ
        let chainGrid=pg;
        for (const eff of effects) {
          addLog(`  ⛓ chain → ${eff.puId} @ (${eff.x},${eff.y})`);
          setMatchFlash([{x:eff.x,y:eff.y}]);
          await sleep(150); setMatchFlash([]);
          const {newGrid:eg,destroyedCells:edc}=activatePU(chainGrid,eff.puId,eff.x,eff.y,blockers,objectives,null);
          chainGrid=eg; simGridRef.current=eg; setSimGrid(cloneGrid(eg));
          setSimScore(p=>p+edc.length*12);
        }
        await runGravityLoop(chainGrid);
        return;
      }

      // ── Normal match ─────────────────────────────────────────────────────
      addLog(`✓ SWAP (${sx},${sy})↔(${x},${y}) | ${matches.length} match`);
      matches.forEach(m=>{ if(m.type!=="M3") addLog(`  ★ ${m.type}→${m.puId}`); });
      setMatchFlash(matches.flatMap(m=>m.cells));
      await sleep(240); setMatchFlash([]);
      const afterMatch=applyMatches(newGrid,matches,blockers);
      simGridRef.current=afterMatch; setSimGrid(cloneGrid(afterMatch));
      setSimScore(p=>p+matches.reduce((s,m)=>s+m.cells.length*10,0));
      await runGravityLoop(afterMatch);
    }
  },[isAnimating,selected,blockers,runGravityLoop]);

  // ─── Double-tap / Right-click: kích hoạt power-up tại chỗ ───────────────
  // "Double tap → Power up kích hoạt ở vị trí hiện tại"
  const handleSimDblClick=useCallback(async(x,y)=>{
    if(isAnimating||animRef.current) return;
    const g=simGridRef.current; if(!g) return;
    const id=g[y][x].layers["0"];
    if(!isPowerup(id)) return;
    addLog(`⚡ DBL-TAP ${id} @ (${x},${y})`);
    setSelected(null);
    setMatchFlash([{x,y}]);
    await sleep(200); setMatchFlash([]);
    const {newGrid,destroyedCells,effects}=activatePU(g,id,x,y,blockers,objectives,null);
    simGridRef.current=newGrid; setSimGrid(cloneGrid(newGrid));
    setSimScore(p=>p+destroyedCells.length*12);
    addLog(`  → destroyed ${destroyedCells.length} cells`);
    // Chain effects
    let chainGrid=newGrid;
    for (const eff of effects) {
      addLog(`  ⛓ chain → ${eff.puId} @ (${eff.x},${eff.y})`);
      setMatchFlash([{x:eff.x,y:eff.y}]);
      await sleep(120); setMatchFlash([]);
      const {newGrid:eg,destroyedCells:edc}=activatePU(chainGrid,eff.puId,eff.x,eff.y,blockers,objectives,null);
      chainGrid=eg; simGridRef.current=eg; setSimGrid(cloneGrid(eg));
      setSimScore(p=>p+edc.length*12);
    }
    await runGravityLoop(chainGrid);
  },[isAnimating,blockers,objectives,runGravityLoop]);

  // ── Render ────────────────────────────────────────────────────────────────
  const activeGrid=simMode?simGrid:grid;
  const categories=["all","gem","powerup","blocker","monster"];
  const filteredBlockers=blockers.filter(b=>activeCategory==="all"||b.category===activeCategory);

  return(
    <div style={{fontFamily:"'JetBrains Mono','Courier New',monospace",background:"#0a0a0f",color:"#c9d1d9",
      height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",userSelect:"none"}}>

      {/* TOP BAR */}
      <header style={{background:"linear-gradient(90deg,#0d1117,#161b22)",borderBottom:"1px solid #21262d",
        padding:"6px 12px",display:"flex",alignItems:"center",gap:9,flexShrink:0}}>
        <div style={{color:"#58a6ff",fontWeight:700,fontSize:13,letterSpacing:3}}>M3W::EDITOR</div>
        <div style={{color:"#30363d",fontSize:9}}>v1.3</div>
        <div style={{flex:1}}/>

        {!simMode&&<>
          {[{key:"brush",label:"✏ BRUSH"},{key:"eraser",label:"⌫ ERASE"},{key:"void",label:"⬜ VOID"}].map(t=>(
            <button key={t.key} onClick={()=>setTool(t.key)} style={{
              background:tool===t.key?"#21262d":"transparent",
              border:`1px solid ${tool===t.key?"#58a6ff":"#30363d"}`,
              color:tool===t.key?"#58a6ff":"#8b949e",
              padding:"3px 9px",fontSize:9,cursor:"pointer",letterSpacing:1,fontFamily:"inherit"}}>{t.label}</button>
          ))}
          <Div/>
          {LAYERS.map(l=>(
            <button key={l} onClick={()=>setSelectedLayer(l)} style={{
              background:selectedLayer===l?LAYER_COLORS[l]:"transparent",
              border:`1px solid ${selectedLayer===l?"#58a6ff":"#30363d"}`,
              color:selectedLayer===l?"#e6edf3":"#8b949e",
              padding:"3px 7px",fontSize:9,cursor:"pointer",letterSpacing:1,fontFamily:"inherit"}}>L{l}:{LAYER_LABELS[l]}</button>
          ))}
          <Div/>
          <button onClick={fillGems} style={{
            background:"#1a2b00",border:"1px solid #4ade80",color:"#4ade80",
            padding:"3px 9px",fontSize:9,cursor:"pointer",letterSpacing:1,fontFamily:"inherit",fontWeight:700}}
            title="Fill all empty layer-0 cells with random gems">
            ★ FILL
          </button>
          <button onClick={clearGems} style={{
            background:"#2b1000",border:"1px solid #f97316",color:"#f97316",
            padding:"3px 9px",fontSize:9,cursor:"pointer",letterSpacing:1,fontFamily:"inherit"}}
            title="Clear all gems from layer 0 (keep blockers)">
            ✕ CLR
          </button>
          <Div/>
          <button onClick={saveLevel} style={BTN("#238636")}>SAVE</button>
          <button onClick={exportLevel} style={BTN("#1f6feb")}>EXPORT</button>
          <button onClick={shareLevel} style={BTN("#6e40c9")}>SHARE</button>
          <label style={{...BTN("#3d2b00"),cursor:"pointer"}}>IMPORT
            <input type="file" accept=".json" onChange={importLevel} style={{display:"none"}}/>
          </label>
          <Div/>
        </>}

        <button onClick={simMode?exitSimulator:enterSimulator} style={{
          background:simMode?"#3d0014":"#0d2b00",
          border:`1px solid ${simMode?"#f72585":"#4ade80"}`,
          color:simMode?"#f72585":"#4ade80",
          padding:"3px 12px",fontSize:9,cursor:"pointer",letterSpacing:2,fontWeight:700,fontFamily:"inherit"}}>
          {simMode?"◼ EXIT SIM":"▶ SIMULATE"}
        </button>

        {simMode&&<>
          <span style={{fontSize:10,color:"#e6edf3"}}>
            MOVES <span style={{color:simMoves<=5?"#ef4444":"#facc15",fontWeight:700}}>{simMoves}</span>
          </span>
          <span style={{fontSize:10,color:"#e6edf3"}}>
            SCORE <span style={{color:"#4ade80",fontWeight:700}}>{simScore}</span>
          </span>
          {gravPhase!=="idle"&&
            <span style={{fontSize:8,color:"#58a6ff",letterSpacing:1}}>
              {gravPhase==="falling"?"▼ FALLING":"★ SPAWN"}
            </span>}
        </>}
      </header>

      {/* NOTIFICATION */}
      {notification&&<div style={{position:"fixed",top:44,left:"50%",transform:"translateX(-50%)",
        background:notification.type==="error"?"#3d0000":notification.type==="success"?"#0d3d1a":"#0d1f3d",
        border:`1px solid ${notification.type==="error"?"#ef4444":notification.type==="success"?"#4ade80":"#58a6ff"}`,
        color:"#e6edf3",padding:"4px 14px",fontSize:10,letterSpacing:1,zIndex:9999}}>{notification.msg}</div>}

      {/* MAIN */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* LEFT */}
        <aside style={{width:206,background:"#0d1117",borderRight:"1px solid #21262d",
          display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{display:"flex",borderBottom:"1px solid #21262d"}}>
            {["library","presets","levels"].map(tab=>(
              <button key={tab} onClick={()=>setActiveTab(tab)} style={{
                flex:1,background:activeTab===tab?"#161b22":"transparent",border:"none",
                borderBottom:activeTab===tab?"2px solid #58a6ff":"2px solid transparent",
                color:activeTab===tab?"#58a6ff":"#8b949e",
                padding:"6px 2px",fontSize:8,cursor:"pointer",letterSpacing:1,fontFamily:"inherit",textTransform:"uppercase"}}>{tab}</button>
            ))}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:7}}>
            {activeTab==="library"&&<>
              <div style={{display:"flex",flexWrap:"wrap",gap:2,marginBottom:5}}>
                {categories.map(c=>(
                  <button key={c} onClick={()=>setActiveCategory(c)} style={{
                    background:activeCategory===c?"#21262d":"transparent",
                    border:`1px solid ${activeCategory===c?"#58a6ff":"#30363d"}`,
                    color:activeCategory===c?"#58a6ff":"#6e7681",
                    padding:"1px 5px",fontSize:7,cursor:"pointer",letterSpacing:1,fontFamily:"inherit"}}>{c.toUpperCase()}</button>
                ))}
              </div>
              {filteredBlockers.map(b=>(
                <div key={b.id} onClick={()=>{if(!simMode){setSelectedBlockerId(b.id);setTool("brush");}}}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"4px 5px",marginBottom:2,
                    cursor:simMode?"default":"pointer",
                    background:!simMode&&selectedBlockerId===b.id?"#161b22":"transparent",
                    border:`1px solid ${!simMode&&selectedBlockerId===b.id?"#58a6ff":"#21262d"}`}}>
                  <span style={{fontSize:13}}>{b.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:9,color:"#e6edf3"}}>{b.name}</div>
                    <div style={{fontSize:7,color:"#6e7681"}}>L{b.layer}|HP:{b.hp}|TAX:{b.turnTax}</div>
                  </div>
                  <div style={{width:5,height:5,borderRadius:"50%",background:b.color,flexShrink:0}}/>
                </div>
              ))}
              {!simMode&&(newBlockerForm
                ? <BlockerForm form={newBlockerForm} onChange={setNewBlockerForm} onConfirm={addBlocker} onCancel={()=>setNewBlockerForm(null)}/>
                : <button onClick={()=>setNewBlockerForm({id:"",name:"",layer:1,hp:2,posEdge:true,dmgType:"Color",gravityImpact:false,turnTax:2,color:"#888888",icon:"?",category:"blocker"})}
                    style={{width:"100%",marginTop:6,background:"transparent",border:"1px dashed #30363d",
                      color:"#58a6ff",padding:"5px",fontSize:9,cursor:"pointer",letterSpacing:1,fontFamily:"inherit"}}>+ NEW BLOCKER</button>
              )}
            </>}
            {activeTab==="presets"&&PRESETS.map(p=>(
              <div key={p.id} onClick={()=>loadLevel(p)}
                style={{padding:"5px 6px",cursor:"pointer",border:"1px solid #21262d",marginBottom:2,background:"transparent"}}
                onMouseEnter={e=>e.currentTarget.style.background="#161b22"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{fontSize:9,color:"#e6edf3"}}>{p.name}</div>
                <div style={{fontSize:7,color:"#6e7681"}}>CH{p.chapter}·{p.moves}mv</div>
              </div>
            ))}
            {activeTab==="levels"&&(savedLevels.length===0
              ? <div style={{color:"#6e7681",fontSize:9,textAlign:"center",padding:12}}>No saved levels.</div>
              : savedLevels.map((lvl,i)=>(
                <div key={i} onClick={()=>loadLevel(lvl)}
                  style={{padding:"5px 6px",cursor:"pointer",border:"1px solid #21262d",marginBottom:2,background:"transparent"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#161b22"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{fontSize:9,color:"#e6edf3"}}>{lvl.name}</div>
                  <div style={{fontSize:7,color:"#6e7681"}}>CH{lvl.chapter}·{lvl.moves}mv</div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* CENTER */}
        <main style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
          justifyContent:"center",overflow:"hidden",background:"#0a0a0f",gap:6,padding:"6px 0"}}>
          {activeGrid&&<GridCanvas
            grid={activeGrid} blockers={blockers}
            selectedLayer={simMode?0:selectedLayer}
            simMode={simMode} selected={selected} matchFlash={matchFlash}
            isPainting={isPainting} setIsPainting={setIsPainting}
            applyTool={applyTool}
            onSimClick={handleSimCellClick}
            onSimDblClick={handleSimDblClick}
          />}

          {/* Legend / hint bar */}
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
            {simMode?(
              <>
                <span style={{fontSize:7,color:"#6e7681",letterSpacing:0.5}}>CLICK=SELECT/SWAP</span>
                <span style={{fontSize:7,color:"#6e7681"}}>·</span>
                <span style={{fontSize:7,color:"#6e7681",letterSpacing:0.5}}>RIGHT-CLICK=ACTIVATE POWERUP</span>
                <span style={{fontSize:7,color:"#58a6ff",letterSpacing:0.5}}>■ SELECTED</span>
                <span style={{fontSize:7,color:"#facc15",letterSpacing:0.5}}>■ MATCH FLASH</span>
              </>
            ):Object.entries(LAYER_LABELS).map(([l,label])=>(
              <span key={l} style={{fontSize:7,color:selectedLayer===Number(l)?"#58a6ff":"#6e7681",letterSpacing:0.5}}>
                <span style={{display:"inline-block",width:6,height:6,background:LAYER_COLORS[l],marginRight:2,verticalAlign:"middle"}}/>
                L{l}:{label}
              </span>
            ))}
          </div>

          {/* Sim log */}
          {simMode&&<div style={{width:"100%",maxWidth:440,maxHeight:78,overflowY:"auto",
            background:"#0d1117",border:"1px solid #21262d",padding:"3px 8px",boxSizing:"border-box"}}>
            {logLines.map((l,i)=>(
              <div key={i} style={{fontSize:8,color:i===0?"#c9d1d9":"#6e7681",letterSpacing:0.3,lineHeight:1.5}}>{l}</div>
            ))}
          </div>}
        </main>

        {/* RIGHT */}
        <aside style={{width:252,background:"#0d1117",borderLeft:"1px solid #21262d",
          display:"flex",flexDirection:"column",overflow:"hidden"}}>

          <div style={{padding:"8px 11px",borderBottom:"1px solid #21262d"}}>
            <STitle>LEVEL PROPERTIES</STitle>
            <SField label="NAME"><input value={levelMeta.name} onChange={e=>setLevelMeta(p=>({...p,name:e.target.value}))} style={IS}/></SField>
            <div style={{display:"flex",gap:5}}>
              <SField label="CHAPTER" style={{flex:1}}><input type="number" value={levelMeta.chapter} onChange={e=>setLevelMeta(p=>({...p,chapter:+e.target.value}))} style={{...IS,width:"100%"}}/></SField>
              <SField label="MOVES" style={{flex:1}}><input type="number" value={levelMeta.moves} onChange={e=>setLevelMeta(p=>({...p,moves:+e.target.value}))} style={{...IS,width:"100%"}}/></SField>
            </div>
          </div>

          <div style={{padding:"8px 11px",borderBottom:"1px solid #21262d"}}>
            <STitle>OBJECTIVES</STitle>
            {objectives.map((obj,i)=>(
              <div key={i} style={{display:"flex",gap:3,alignItems:"center",marginBottom:3}}>
                <select value={obj.blockerId} onChange={e=>{const n=[...objectives];n[i]={...n[i],blockerId:e.target.value};setObjectives(n);}}
                  style={{...IS,flex:1,padding:"2px 3px"}}>
                  {blockers.filter(b=>b.category==="blocker"||b.category==="monster").map(b=>(
                    <option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
                <input type="number" min={1} value={obj.count}
                  onChange={e=>{const n=[...objectives];n[i]={...n[i],count:+e.target.value};setObjectives(n);}}
                  style={{...IS,width:38}}/>
                <button onClick={()=>setObjectives(objectives.filter((_,j)=>j!==i))}
                  style={{background:"transparent",border:"1px solid #30363d",color:"#ef4444",width:16,height:16,fontSize:9,cursor:"pointer",padding:0,fontFamily:"inherit"}}>×</button>
              </div>
            ))}
            <button onClick={()=>setObjectives([...objectives,{blockerId:"b_stone",count:10}])}
              style={{background:"transparent",border:"1px dashed #30363d",color:"#58a6ff",
                padding:"2px 6px",fontSize:8,cursor:"pointer",width:"100%",letterSpacing:1,fontFamily:"inherit"}}>+ ADD OBJECTIVE</button>
          </div>

          <div style={{padding:"8px 11px",borderBottom:"1px solid #21262d"}}>
            <STitle>PACING CURVE</STitle>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
              <span style={{fontSize:8,color:"#8b949e",letterSpacing:1}}>ER</span>
              <span style={{fontSize:11,fontWeight:700,color:erColor,border:`1px solid ${erColor}`,padding:"1px 5px"}}>{er.toFixed(2)}</span>
              <span style={{fontSize:8,color:erColor,letterSpacing:1}}>{erStatus}</span>
              <span style={{marginLeft:"auto",fontSize:8,color:"#6e7681"}}>TAX:<span style={{color:"#e6edf3"}}>{totalTax.toFixed(1)}</span>mv</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{fontSize:8,color:"#58a6ff"}}>── REAL</span>
              <span style={{fontSize:8,color:"#f72585"}}>╌╌ TARGET</span>
              <span style={{fontSize:7,color:"#6e7681"}}>Y=moves needed</span>
            </div>
            <ResponsiveContainer width="100%" height={96}>
              <LineChart data={chartData} margin={{top:2,right:2,left:-10,bottom:2}}>
                <XAxis dataKey="movesRemaining" tick={{fontSize:6,fill:"#6e7681"}}/>
                <YAxis tick={{fontSize:6,fill:"#6e7681"}}/>
                <Tooltip contentStyle={{background:"#161b22",border:"1px solid #30363d",fontSize:9}}
                  labelFormatter={v=>`${v} mv left`} formatter={(v,n)=>[`${v}mv`,n==="real"?"Real":"Target"]}/>
                <ReferenceLine y={0} stroke="#30363d"/>
                <Line type="monotone" dataKey="real" stroke="#58a6ff" strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="target" stroke="#f72585" strokeWidth={2} dot={false} strokeDasharray="4 2"/>
              </LineChart>
            </ResponsiveContainer>
            <div style={{fontSize:7,color:"#6e7681",marginTop:2,lineHeight:1.7}}>
              {er>1.5&&<div style={{color:"#ef4444"}}>⛔ Auto power-up activates</div>}
              {er>1.2&&er<=1.5&&<div style={{color:"#fb923c"}}>⚠ Lucky gem assist triggers</div>}
              {er<0.8&&totalTax>0&&<div style={{color:"#4ade80"}}>✓ Too easy — reduce moves</div>}
            </div>
          </div>

          <div style={{padding:"8px 11px",borderBottom:"1px solid #21262d"}}>
            <STitle>TARGET CURVE</STitle>
            {targetCurveInput.map((val,i)=>{
              const mx=Math.max(totalTax*1.5,10,maxTarget);
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:3,marginBottom:2}}>
                  <span style={{fontSize:7,color:"#6e7681",width:13,textAlign:"right"}}>T{i}</span>
                  <input type="range" min={0} max={Math.ceil(mx)} step={0.5} value={val}
                    onChange={e=>{const n=[...targetCurveInput];n[i]=+e.target.value;setTargetCurveInput(n);}}
                    style={{flex:1,accentColor:"#f72585"}}/>
                  <input type="number" min={0} step={0.5} value={val}
                    onChange={e=>{const n=[...targetCurveInput];n[i]=+e.target.value;setTargetCurveInput(n);}}
                    style={{...IS,width:32,padding:"1px 3px",fontSize:8,color:"#f72585"}}/>
                  <span style={{fontSize:7,color:"#6e7681"}}>mv</span>
                </div>
              );
            })}
            <div style={{display:"flex",gap:3,marginTop:4}}>
              {[["+ PT","#58a6ff",()=>setTargetCurveInput(p=>[...p,0])],
                ["- PT","#ef4444",()=>setTargetCurveInput(p=>p.length>2?p.slice(0,-1):p)],
                ["AUTO","#facc15",()=>{const n=targetCurveInput.length;setTargetCurveInput(Array.from({length:n},(_,k)=>+Math.max(0,totalTax*(1-k/(n-1))).toFixed(1)));}],
              ].map(([lbl,col,fn])=>(
                <button key={lbl} onClick={fn} style={{flex:1,background:"transparent",border:`1px dashed #30363d`,
                  color:col,fontSize:8,cursor:"pointer",padding:"3px",fontFamily:"inherit"}}>{lbl}</button>
              ))}
            </div>
          </div>

          <div style={{padding:"8px 11px",flex:1,overflowY:"auto"}}>
            <STitle>BOARD SNAPSHOT</STitle>
            {boardSnapshot.length===0
              ? <div style={{fontSize:8,color:"#6e7681",textAlign:"center",padding:"6px 0"}}>No blockers placed</div>
              : <>
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"1px 5px",marginBottom:3}}>
                    <span style={{fontSize:6,color:"#6e7681",letterSpacing:1}}>BLOCKER</span>
                    <span style={{fontSize:6,color:"#6e7681",letterSpacing:1}}>POS</span>
                    <span style={{fontSize:6,color:"#58a6ff",letterSpacing:1,textAlign:"right"}}>TAX</span>
                  </div>
                  {boardSnapshot.map((it,idx)=>(
                    <div key={idx} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"0 5px",
                      padding:"1px 0",borderBottom:"1px solid #161b22",alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:3}}>
                        <span style={{fontSize:9}}>{it.icon}</span>
                        <span style={{fontSize:7,color:"#c9d1d9"}}>{it.name}</span>
                        <span style={{fontSize:6,color:"#6e7681"}}>L{it.layer}</span>
                      </div>
                      <span style={{fontSize:6,color:"#6e7681"}}>{it.x},{it.y}</span>
                      <span style={{fontSize:8,color:"#58a6ff",fontWeight:700,textAlign:"right"}}>
                        {it.turnTax}<span style={{fontSize:6,color:"#6e7681",fontWeight:400}}>mv</span>
                      </span>
                    </div>
                  ))}
                  <div style={{marginTop:5,padding:"3px 5px",background:"#161b22",border:"1px solid #21262d",
                    display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:7,color:"#8b949e",letterSpacing:1}}>TOTAL</span>
                    <span style={{fontSize:10,color:"#58a6ff",fontWeight:700}}>{totalTax.toFixed(1)} mv</span>
                  </div>
                </>
            }
          </div>
        </aside>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRID CANVAS
// ═══════════════════════════════════════════════════════════════════════════════
const CELL_SZ=43;

function GridCanvas({grid,blockers,selectedLayer,simMode,selected,matchFlash,isPainting,setIsPainting,applyTool,onSimClick,onSimDblClick}){
  const getB=id=>id?blockers.find(b=>b.id===id):null;
  const flashSet=new Set(matchFlash.map(c=>`${c.x},${c.y}`));
  return(
    <div style={{display:"inline-grid",
      gridTemplateColumns:`repeat(${GRID_COLS},${CELL_SZ}px)`,
      gridTemplateRows:`repeat(${GRID_ROWS},${CELL_SZ}px)`,
      gap:1,background:"#161b22",border:"1px solid #30363d",padding:1,
      cursor:simMode?"pointer":"crosshair"}}
      onMouseLeave={()=>setIsPainting(false)}>
      {grid.map(row=>row.map(cell=>{
        const {x,y,isVoid,layers}=cell;
        const isSel=simMode&&selected?.x===x&&selected?.y===y;
        const isFlash=flashSet.has(`${x},${y}`);
        const gem=getB(layers["0"]);
        const cover=getB(layers["1"]);
        const overlay=getB(layers["2"]);
        const bg=getB(layers["-1"]);
        const mainB=simMode?gem:getB(layers[selectedLayer]);

        return(
          <div key={`${x}-${y}`}
            onMouseDown={()=>{ if(simMode)onSimClick(x,y); else{setIsPainting(true);applyTool(x,y);} }}
            onMouseEnter={()=>{ if(!simMode&&isPainting) applyTool(x,y); }}
            onMouseUp={()=>setIsPainting(false)}
            onContextMenu={e=>{e.preventDefault();if(simMode)onSimDblClick(x,y);}}
            style={{width:CELL_SZ,height:CELL_SZ,
              background:isVoid?"#050508":isFlash?"#2d2900":isSel?"#0d2535":"#0d1117",
              border:isVoid?"1px solid #0a0a0f":isSel?"1px solid #58a6ff":isFlash?"1px solid #facc15":"1px solid #21262d",
              position:"relative",display:"flex",alignItems:"center",justifyContent:"center",
              boxSizing:"border-box",
              boxShadow:isSel?"0 0 8px #58a6ff55":isFlash?"0 0 5px #facc1555":"none",
              transition:"background 0.06s,border 0.06s"}}>
            {isVoid
              ? <span style={{fontSize:12,color:"#1a1a2e"}}>✕</span>
              : <>
                  {bg&&<div style={{position:"absolute",inset:0,background:bg.color+"22"}}/>}

                  {/* Main gem / layer content */}
                  {mainB&&
                    <div style={{position:"relative",zIndex:2,textAlign:"center",lineHeight:1}}>
                      <div style={{fontSize:17,
                        filter:isFlash?"brightness(2.5) saturate(2)":"none",
                        transition:"filter 0.1s",
                        transform: mainB.id==="pu_rocket_v"?"rotate(90deg)":"none"}}>
                        {mainB.icon}
                      </div>
                      {/* Gem color stripe */}
                      {mainB.category==="gem"&&
                        <div style={{width:22,height:3,background:mainB.color+"dd",margin:"2px auto 0",borderRadius:2}}/>}
                      {/* PU type badge */}
                      {mainB.category==="powerup"&&
                        <div style={{fontSize:6,color:mainB.color,letterSpacing:0.5,marginTop:1,fontWeight:700}}>
                          {mainB.id==="pu_rocket_h"?"→ROW":
                           mainB.id==="pu_rocket_v"?"↓COL":
                           mainB.id==="pu_tnt"?"TNT":
                           mainB.id==="pu_propeller"?"PROP":
                           mainB.id==="pu_lightball"?"BALL":"PU"}
                        </div>}
                      {mainB.hp>1&&!simMode&&
                        <div style={{fontSize:6,color:"#c9d1d9"}}>♥{mainB.hp}</div>}
                    </div>}

                  {/* Ghost gem in editor non-gem layers */}
                  {!simMode&&gem&&selectedLayer!==0&&
                    <div style={{position:"absolute",inset:0,opacity:0.2,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <span style={{fontSize:8}}>{gem.icon}</span>
                    </div>}

                  {/* Cover indicator */}
                  {cover&&(simMode||selectedLayer!==1)&&
                    <div style={{position:"absolute",top:1,right:1,zIndex:3,lineHeight:1,
                      filter:simMode?"none":"opacity(0.7)"}}>
                      <span style={{fontSize:simMode?12:9}}>{cover.icon}</span>
                      {cover.hp>1&&<span style={{fontSize:5,color:"#fff",display:"block",textAlign:"center"}}>×{cover.hp}</span>}
                    </div>}

                  {/* Overlay indicator */}
                  {overlay&&(simMode||selectedLayer!==2)&&
                    <div style={{position:"absolute",bottom:1,right:1,zIndex:3,opacity:simMode?1:0.7}}>
                      <span style={{fontSize:simMode?12:9}}>{overlay.icon}</span>
                    </div>}

                  {/* Active layer tint (editor) */}
                  {!simMode&&<div style={{position:"absolute",inset:0,pointerEvents:"none",
                    background:LAYER_COLORS[selectedLayer]+"15",
                    border:mainB?`1px solid ${mainB.color}44`:"none"}}/>}

                  {/* Selected highlight (sim) */}
                  {isSel&&<div style={{position:"absolute",inset:0,border:"2px solid #58a6ff",
                    boxSizing:"border-box",pointerEvents:"none"}}/>}

                  {/* Coords */}
                  <div style={{position:"absolute",bottom:0,left:1,fontSize:5,color:"#30363d",lineHeight:1}}>{x},{y}</div>
                </>}
          </div>
        );
      }))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCKER FORM
// ═══════════════════════════════════════════════════════════════════════════════
function BlockerForm({form,onChange,onConfirm,onCancel}){
  const set=(k,v)=>onChange(p=>({...p,[k]:v}));
  return(
    <div style={{border:"1px solid #21262d",padding:7,marginTop:6,background:"#0d1117"}}>
      <div style={{fontSize:8,color:"#58a6ff",letterSpacing:2,marginBottom:5}}>NEW BLOCKER</div>
      {[{key:"id",label:"ID",type:"text"},{key:"name",label:"NAME",type:"text"},
        {key:"hp",label:"HP",type:"number"},{key:"turnTax",label:"TAX",type:"number"},
        {key:"color",label:"COLOR",type:"color"},{key:"icon",label:"ICON",type:"text"}].map(f=>(
        <div key={f.key} style={{display:"flex",alignItems:"center",gap:3,marginBottom:2}}>
          <span style={{fontSize:7,color:"#6e7681",width:30,flexShrink:0}}>{f.label}</span>
          <input type={f.type} value={form[f.key]??""} onChange={e=>set(f.key,f.type==="number"?+e.target.value:e.target.value)}
            style={{...IS,flex:1,padding:"2px 3px"}}/>
        </div>
      ))}
      <div style={{display:"flex",gap:3,marginBottom:2}}>
        <span style={{fontSize:7,color:"#6e7681",width:30}}>LAYER</span>
        <select value={form.layer} onChange={e=>set("layer",+e.target.value)} style={{...IS,flex:1}}>
          {LAYERS.map(l=><option key={l} value={l}>L{l}:{LAYER_LABELS[l]}</option>)}
        </select>
      </div>
      <div style={{display:"flex",gap:3,marginBottom:2}}>
        <span style={{fontSize:7,color:"#6e7681",width:30}}>DMG</span>
        <select value={form.dmgType} onChange={e=>set("dmgType",e.target.value)} style={{...IS,flex:1}}>
          {["Color","Power-up","Chain","All"].map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={{display:"flex",gap:3,marginBottom:2}}>
        <span style={{fontSize:7,color:"#6e7681",width:30}}>CAT</span>
        <select value={form.category} onChange={e=>set("category",e.target.value)} style={{...IS,flex:1}}>
          {["gem","powerup","blocker","monster"].map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:3}}>
        {[{key:"posEdge",label:"POS-EDGE"},{key:"gravityImpact",label:"GRAVITY"}].map(f=>(
          <label key={f.key} style={{display:"flex",alignItems:"center",gap:2,fontSize:7,color:"#8b949e",cursor:"pointer"}}>
            <input type="checkbox" checked={!!form[f.key]} onChange={e=>set(f.key,e.target.checked)} style={{accentColor:"#58a6ff"}}/>
            {f.label}
          </label>
        ))}
      </div>
      <div style={{display:"flex",gap:3,marginTop:4}}>
        <button onClick={onConfirm} style={{...BTN("#238636"),flex:1,fontSize:8}}>CREATE</button>
        <button onClick={onCancel} style={{...BTN("#3d1a1a"),flex:1,fontSize:8}}>CANCEL</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MICRO HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const STitle=({children})=>(
  <div style={{fontSize:8,letterSpacing:2,color:"#8b949e",marginBottom:5,fontWeight:700}}>{children}</div>
);
const SField=({label,children,style})=>(
  <div style={{marginBottom:4,...style}}>
    <div style={{fontSize:7,color:"#6e7681",letterSpacing:1,marginBottom:1}}>{label}</div>
    {children}
  </div>
);
const Div=()=><div style={{width:1,height:18,background:"#21262d",flexShrink:0}}/>;
const IS={background:"#161b22",border:"1px solid #30363d",color:"#c9d1d9",
  padding:"2px 5px",fontSize:9,width:"100%",boxSizing:"border-box",fontFamily:"inherit",outline:"none"};
const BTN=bg=>({background:bg,border:"none",color:"#e6edf3",
  padding:"3px 9px",fontSize:8,cursor:"pointer",letterSpacing:1,fontFamily:"inherit"});
