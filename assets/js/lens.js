import { clamp } from "./util.js";

/*
  Lens (V7)
  - trajectories: token × layer plane; each curve ≈ one token's hidden-state trajectory across layers
  - clusters: layer-wise clustering grid; particles flow across layers between clusters

  This file is intentionally dependency-free.
*/

function rand(seed){
  // xorshift32 deterministic rng
  let x = seed >>> 0;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

function lerp(a,b,t){ return a + (b-a)*t; }
function smooth(u){ return u*u*(3-2*u); }

function polyLengths(pts){
  const seg = new Array(Math.max(0, pts.length-1));
  let total = 0;
  for(let i=0;i<pts.length-1;i++){
    const dx = pts[i+1].x - pts[i].x;
    const dy = pts[i+1].y - pts[i].y;
    const l = Math.hypot(dx,dy);
    seg[i] = l;
    total += l;
  }
  return {seg, total: Math.max(1e-6, total)};
}

function pointAt(pts, lens, t01){
  const target = t01 * lens.total;
  let acc = 0;
  for(let i=0;i<lens.seg.length;i++){
    const l = lens.seg[i];
    if(acc + l >= target){
      const r = (target - acc) / (l || 1);
      return {
        x: pts[i].x + (pts[i+1].x - pts[i].x) * r,
        y: pts[i].y + (pts[i+1].y - pts[i].y) * r,
      };
    }
    acc += l;
  }
  const last = pts[pts.length-1];
  return {x:last.x, y:last.y};
}

function snap(v, step){
  return Math.round(v/step)*step;
}

/* -----------------------------
   Mode builders
-------------------------------- */

function buildTokenTrajectories(w, h, seed){
  const rng = rand(seed);
  const tokenCount = 7;
  const layerCount = 28;

  const mx = Math.max(22, w * 0.10);
  const my = Math.max(22, h * 0.14);
  const x0 = mx;
  const x1 = w - mx;
  const y0 = h - my; // layer 0 (bottom) - canvas y increases downward, so bottom has larger y
  const y1 = my;     // last layer (top) - top has smaller y

  const dx = tokenCount <= 1 ? 0 : (x1 - x0) / (tokenCount - 1);

  const paths = [];
  const ptsPer = 96;

  for(let t=0; t<tokenCount; t++){
    const baseX = x0 + t*dx;
    const isRed = (t === 1 || t === 3); // Mark trajectories 1 and 3 as red
    const phase = rng() * Math.PI * 2;
    
    // Much larger amplitudes for more extreme wandering
    const amp = 12 + rng()*18;
    const amp2 = 5 + rng()*12;
    const amp3 = 3 + rng()*8;
    const skew = rng() < 0.5 ? -1 : 1;

    // late-layer "signal concentration": slight bend & contraction near the top
    // Multiple kinks for more complex curves
    const kinkAt1 = 0.35 + rng()*0.15;
    const kinkAt2 = 0.65 + rng()*0.15;
    const kinkDir1 = (rng()-0.5) * 35;
    const kinkDir2 = (rng()-0.5) * 28;

    const pts = [];
    
    if(isRed){
      // Red trajectories: more extreme and complex
      const phase2 = rng() * Math.PI * 2;
      const phase3 = rng() * Math.PI * 2;
      
      const amp = 12 + rng()*18;
      const amp2 = 5 + rng()*12;
      const amp3 = 3 + rng()*8;
      
      const kinkAt1 = 0.35 + rng()*0.15;
      const kinkAt2 = 0.65 + rng()*0.15;
      const kinkDir1 = (rng()-0.5) * 35;
      const kinkDir2 = (rng()-0.5) * 28;
      
      for(let i=0;i<ptsPer;i++){
        const u = i/(ptsPer-1); // 0..1
        // Ensure y always increases (from bottom to top, no backward movement)
        const y = lerp(y0, y1, u);

        // More complex wandering with multiple frequency components
        const grow = 0.25 + 0.75*(u*u);
        const w1 = Math.sin(u*2*Math.PI*1.8 + phase) * amp;
        const w2 = Math.cos(u*2*Math.PI*4.2 + phase2*0.7) * amp2;
        const w3 = Math.sin(u*2*Math.PI*7.5 + phase3*1.3) * amp3;
        const w4 = Math.cos(u*2*Math.PI*11.3 + phase*0.5) * (amp*0.4);
        
        // Add more randomness per point
        const jitter = (rng() - 0.5) * 4;
        
        let x = baseX + (w1 + w2 + w3 + w4) * grow * (0.75 + 0.25*skew) + jitter;

        // Multiple kinks for more dramatic curves (only affect x, not y)
        if(u > kinkAt1){
          const kk1 = smooth((u - kinkAt1) / (1 - kinkAt1));
          x += kinkDir1 * kk1 * 0.6;
        }
        if(u > kinkAt2){
          const kk2 = smooth((u - kinkAt2) / (1 - kinkAt2));
          x += kinkDir2 * kk2 * 0.8;
        }

        pts.push({x,y});
      }
    } else {
      // Blue trajectories: original simple algorithm
      const amp = 7 + rng()*10;
      const amp2 = 2 + rng()*6;
      
      // late-layer "signal concentration": slight bend & contraction near the top
      const kinkAt = 0.72 + rng()*0.10;
      const kinkDir = (rng()-0.5) * 18;

      for(let i=0;i<ptsPer;i++){
        const u = i/(ptsPer-1); // 0..1
        // Ensure y always increases (from bottom to top, no backward movement)
        const y = lerp(y0, y1, u);

        // wander in x (hidden-dim movement projected)
        const grow = 0.35 + 0.65*(u*u);
        const w1 = Math.sin(u*2*Math.PI*1.25 + phase) * amp;
        const w2 = Math.cos(u*2*Math.PI*3.15 + phase*0.7) * amp2;
        let x = baseX + (w1 + w2) * grow * (0.85 + 0.15*skew);

        // kink near late layers (only affect x, not y)
        if(u > kinkAt){
          const kk = smooth((u - kinkAt) / (1 - kinkAt));
          x += kinkDir * kk;
        }

        pts.push({x,y});
      }
    }

    paths.push({
      base: pts,
      token: t,
      baseX,
      isRed: isRed,
    });
  }

  return {
    kind: "trajectories",
    tokenCount,
    layerCount,
    bounds: {x0,x1,y0,y1,my,mx},
    cycleMs: 8500,
    paths,
  };
}

function buildClusterFlows(w, h, seed){
  const rng = rand(seed);

  // we show a coarse "layer axis" (not every real layer)
  const layersShown = 12;
  const k = 4; // clusters per layer

  const mx = Math.max(20, w * 0.09);
  const my = Math.max(20, h * 0.18);
  const x0 = mx;
  const x1 = w - mx;
  const y0 = my;
  const y1 = h - my;
  const dx = (x1 - x0) / (layersShown - 1);

  // cluster centers per layer: centers[layerIndex][clusterIndex]
  // Also track cluster count per layer
  const centers = [];
  const clusterCounts = [];
  
  for(let li=0; li<layersShown; li++){
    const u = li/(layersShown-1);

    // Spindle distribution: 1-2 clusters at ends, 5-6 at middle
    // Use a sharper curve for more dramatic change
    const spindle = Math.sin(u * Math.PI);
    const spindleSharp = Math.pow(spindle, 1.5); // sharper transition
    
    // Cluster count: 1-2 at ends, 5-6 at middle
    const minClusters = 1;
    const maxClusters = 6;
    const clusterCount = Math.round(minClusters + spindleSharp * (maxClusters - minClusters));
    clusterCounts[li] = clusterCount;

    const x = x0 + li*dx;
    const layerCenters = [];
    
    // Distribute clusters vertically based on count
    if(clusterCount === 1){
      // Single cluster: vary position more to avoid all paths converging
      const basePos = 0.3 + rng() * 0.4; // Random between 0.3 and 0.7
      const mid = lerp(y0, y1, basePos) + Math.sin(u*2*Math.PI*0.7 + rng()*Math.PI*2) * 3;
      layerCenters.push({x, y: mid});
    } else if(clusterCount === 2){
      // Two clusters: top and bottom with more variation
      const topBase = 0.25 + rng() * 0.15; // 0.25 to 0.40
      const botBase = 0.60 + rng() * 0.15; // 0.60 to 0.75
      const top = lerp(y0, y1, topBase) + Math.sin(u*2*Math.PI + 0.6 + rng()*Math.PI) * 4;
      const bot = lerp(y0, y1, botBase) + Math.cos(u*2*Math.PI + 0.3 + rng()*Math.PI) * 4;
      layerCenters.push({x, y: top}, {x, y: bot});
    } else {
      // 3-6 clusters: distribute evenly with some variation
      const span = y1 - y0;
      const margin = span * 0.15;
      const usable = span - 2 * margin;
      const step = clusterCount > 1 ? usable / (clusterCount - 1) : 0;
      
      for(let k=0; k<clusterCount; k++){
        const t = k / (clusterCount - 1);
        const baseY = y0 + margin + t * usable;
        // Add more variation based on layer position and random seed
        const variation = Math.sin(u*2*Math.PI + k*0.8 + rng()*Math.PI*2) * 5;
        layerCenters.push({x, y: baseY + variation});
      }
    }
    
    centers[li] = layerCenters;
  }

  function buildFlowPath(){
    // markov-ish cluster assignments across layers
    const seq = new Array(layersShown);
    // Adapt to varying cluster counts per layer
    const firstCount = clusterCounts[0];
    seq[0] = Math.floor(rng() * firstCount);

    for(let li=1; li<layersShown; li++){
      const u = li/(layersShown-1);
      const spindle = Math.sin(u * Math.PI);
      const cur = seq[li-1];
      const nextCount = clusterCounts[li];

      // base switch probability increases in middle (more clusters to choose from)
      let pSwitch = 0.15 + spindle * 0.25;

      // Ensure cur is valid for previous layer
      const curIdx = Math.min(cur, centers[li-1].length - 1);
      const curY = centers[li-1][curIdx].y;
      
      let nxt = cur;
      if(rng() < pSwitch){
        // Map current cluster index to next layer's cluster indices
        // Try to stay in similar vertical position
        
        // Find closest cluster in next layer
        let closestIdx = 0;
        let minDist = Infinity;
        for(let k=0; k<nextCount; k++){
          const dist = Math.abs(centers[li][k].y - curY);
          if(dist < minDist){
            minDist = dist;
            closestIdx = k;
          }
        }
        
        // Sometimes pick nearby clusters instead of closest
        if(rng() < 0.6){
          nxt = closestIdx;
        } else {
          // Pick from nearby indices
          const opts = [];
          for(let k=0; k<nextCount; k++){
            const dist = Math.abs(centers[li][k].y - curY);
            if(dist < (y1 - y0) * 0.3) opts.push(k);
          }
          if(opts.length > 0){
            nxt = opts[Math.floor(rng() * opts.length)];
          } else {
            nxt = closestIdx;
          }
        }
      } else {
        // Stay in similar position - map to closest cluster
        let closestIdx = 0;
        let minDist = Infinity;
        for(let k=0; k<nextCount; k++){
          const dist = Math.abs(centers[li][k].y - curY);
          if(dist < minDist){
            minDist = dist;
            closestIdx = k;
          }
        }
        nxt = closestIdx;
      }

      // Ensure nxt is valid for nextCount
      if(nxt >= nextCount || nxt < 0){
        // Map to closest cluster based on vertical position
        let closestIdx = 0;
        let minDist = Infinity;
        for(let k=0; k<nextCount; k++){
          const dist = Math.abs(centers[li][k].y - curY);
          if(dist < minDist){
            minDist = dist;
            closestIdx = k;
          }
        }
        nxt = closestIdx;
      }
      
      // Final safety check
      nxt = Math.max(0, Math.min(nxt, nextCount - 1));

      seq[li] = nxt;
    }

    // densify into a polyline
    const pts = [];
    const sub = 8;
    for(let li=0; li<layersShown-1; li++){
      // Ensure indices are valid
      const idx0 = Math.min(seq[li], centers[li].length - 1);
      const idx1 = Math.min(seq[li+1], centers[li+1].length - 1);
      const p0 = centers[li][idx0];
      const p1 = centers[li+1][idx1];
      if(!p0 || !p1) continue; // Skip if invalid
      for(let s=0; s<sub; s++){
        const t = s/sub;
        pts.push({
          x: lerp(p0.x, p1.x, smooth(t)),
          y: lerp(p0.y, p1.y, smooth(t)),
        });
      }
    }
    // last point
    const lastIdx = Math.min(seq[layersShown-1], centers[layersShown-1].length - 1);
    const last = centers[layersShown-1][lastIdx];
    if(last) pts.push({x:last.x, y:last.y});
    return pts;
  }

  // Function to randomly assign thick/thin paths
  function assignThickThinPaths(pathsArray, rngFunc){
    const pathCount = pathsArray.length;
    const thickIndices = [];
    const thinIndices = [];
    for(let i=0;i<pathCount;i++){
      if(rngFunc() < 0.5){
        thickIndices.push(i);
      } else {
        thinIndices.push(i);
      }
    }
    // Ensure at least one thick and one thin path
    if(thickIndices.length === 0) thickIndices.push(0);
    if(thinIndices.length === 0) thinIndices.push(pathCount - 1);
    
    for(let i=0;i<pathCount;i++){
      pathsArray[i].isThick = thickIndices.includes(i);
    }
  }

  const paths = [];
  const pathCount = 6;
  for(let i=0;i<pathCount;i++){
    paths.push({ base: buildFlowPath() });
  }
  
  // Initial random assignment
  assignThickThinPaths(paths, rng);

  return {
    kind: "clusters",
    layersShown,
    clusterCounts, // track cluster count per layer
    bounds: {x0,x1,y0,y1,my,mx},
    centers,
    paths,
  };
}


/* -----------------------------
   Warp (pointer perturbation)
-------------------------------- */

function warpTrajPoints(basePts, pointer, now, w, h, bounds){
  const warped = new Array(basePts.length);

  const hasPtr = pointer.active;
  const px = pointer.x, py = pointer.y;

  // mostly horizontal influence; keep layer ordering stable
  for(let i=0;i<basePts.length;i++){
    const p = basePts[i];
    const u = i/(basePts.length-1);

    // mild time noise (x-dominant)
    const n = Math.sin((now*0.001) + i*0.15) * 0.9 + Math.cos((now*0.0012) - i*0.09) * 0.7;
    let x = p.x + n * 1.0;
    let y = p.y - n * 0.20;

    if(hasPtr){
      const dx = x - px;
      const dy = y - py;
      const d2 = dx*dx + dy*dy;
      const sigma = Math.min(w,h) * 0.20;
      const g = Math.exp(-d2/(sigma*sigma));
      const inv = 1 / (Math.sqrt(d2) + 0.001);

      // push away from pointer (mostly in x)
      x += dx * inv * g * 12;
      y += dy * inv * g * 3;
    }

    // keep in frame
    // Note: for trajectories, y0 is bottom (larger) and y1 is top (smaller)
    x = clamp(x, bounds.x0 - 18, bounds.x1 + 18);
    y = clamp(y, bounds.y1 - 8, bounds.y0 + 8);

    warped[i] = {x,y};
  }
  return warped;
}

function warpGenericPoints(basePts, pointer, now, w, h){
  const warped = new Array(basePts.length);
  const hasPtr = pointer.active;
  const px = pointer.x, py = pointer.y;

  for(let i=0;i<basePts.length;i++){
    const p = basePts[i];
    let x = p.x, y = p.y;

    // smooth noise
    const n = Math.sin((now*0.001) + i*0.18) * 0.9 + Math.cos((now*0.0012) - i*0.11) * 0.7;
    x += n * 1.0;
    y -= n * 0.8;

    if(hasPtr){
      const dx = x - px;
      const dy = y - py;
      const d2 = dx*dx + dy*dy;
      const sigma = Math.min(w,h) * 0.22;
      const g = Math.exp(-d2/(sigma*sigma));
      const inv = 1 / (Math.sqrt(d2) + 0.001);
      x += dx * inv * g * 12;
      y += dy * inv * g * 12;
    }

    // gentle gravity
    x += (w*0.5 - x) * 0.002;
    y += (h*0.5 - y) * 0.002;

    warped[i] = {x,y};
  }
  return warped;
}

/* -----------------------------
   Drawing helpers
-------------------------------- */

function cssVar(name, fallback){
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function drawScanlines(ctx, w, h){
  ctx.save();
  ctx.globalAlpha = 0.08;
  for(let y=0;y<h;y+=3){
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0,y,w,1);
  }
  ctx.restore();
}

function drawTrajBackdrop(ctx, w, h, meta){
  const soft = cssVar("--borderSoft", "rgba(11,16,32,0.22)");
  const muted = cssVar("--muted", "#445069");
  const {x0,x1,y0,y1} = meta.bounds;

  // faint grid inside the lens area
  ctx.save();
  ctx.strokeStyle = soft;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;

  // horizontal (layers)
  const rows = 6;
  for(let i=0;i<=rows;i++){
    const t = i/rows;
    const y = lerp(y0, y1, t);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }

  // vertical (tokens)
  const cols = meta.tokenCount-1;
  for(let i=0;i<=cols;i++){
    const t = cols<=0 ? 0 : i/cols;
    const x = lerp(x0, x1, t);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
  }

  ctx.restore();

  // Axis labels
  ctx.save();
  ctx.fillStyle = muted;
  ctx.globalAlpha = 0.7;
  ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Y-axis label: "layer" (vertical text on the left)
  const yCenter = (y0 + y1) / 2;
  ctx.save();
  ctx.translate(x0 - 20, yCenter);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("layer", 0, 0);
  ctx.restore();
  
  // X-axis label: "token" (horizontal text above the axis)
  const xCenter = (x0 + x1) / 2;
  ctx.fillText("token", xCenter, y1 - 20);
  
  ctx.restore();
}

function drawClusterBackdrop(ctx, meta, now){
  const accent = cssVar("--accent", "#1f57ff");
  const soft = cssVar("--borderSoft", "rgba(11,16,32,0.22)");
  const {centers, layersShown, clusterCounts} = meta;

  // Connect clusters across layers
  ctx.save();
  ctx.strokeStyle = soft;
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  
  try {
    const ySpan = meta.bounds ? (meta.bounds.y1 - meta.bounds.y0) : 300;
    const maxDist = ySpan * 0.5; // connection threshold
    
    for(let li=0; li<centers.length-1; li++){
      const currentLayer = centers[li];
      const nextLayer = centers[li+1];
      
      if(!currentLayer || !nextLayer || currentLayer.length === 0 || nextLayer.length === 0) continue;
      
      for(let k=0; k<currentLayer.length; k++){
        const p0 = currentLayer[k];
        if(!p0 || p0.x === undefined || p0.y === undefined) continue;
        
        // Find clusters in next layer that should be connected
        const connections = [];
        for(let nk=0; nk<nextLayer.length; nk++){
          const p1 = nextLayer[nk];
          if(!p1 || p1.x === undefined || p1.y === undefined) continue;
          const dy = Math.abs(p1.y - p0.y);
          
          // Connect if vertically close
          if(dy < maxDist){
            connections.push({idx: nk, dist: dy, p: p1});
          }
        }
        
        // Sort by distance and connect to closest ones
        if(connections.length > 0){
          connections.sort((a,b) => a.dist - b.dist);
          const connectCount = Math.min(connections.length, Math.max(1, Math.min(4, Math.floor(nextLayer.length * 0.7))));
          
          // Draw connections
          for(let c=0; c<connectCount; c++){
            const conn = connections[c];
            const p1 = conn.p;
            
            // Vary opacity based on distance
            const distFactor = Math.max(0.3, 1 - (conn.dist / maxDist));
            ctx.globalAlpha = 0.35 * distFactor;
            
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
          }
        }
      }
    }
  } catch(e) {
    console.error("Error drawing cluster connections:", e);
  }
  
  ctx.restore();

  // halos with spindle shape
  ctx.save();
  try {
    for(let li=0; li<centers.length; li++){
      if(!centers[li]) continue;
      const u = li / (layersShown - 1);
      const spindleFactor = Math.sin(u * Math.PI);
      const clusterCount = centers[li].length;
      
      for(let k=0; k<centers[li].length; k++){
        const p = centers[li][k];
        if(!p || p.x === undefined || p.y === undefined) continue;
        
        const baseHaloR = clusterCount <= 2 ? 22 : (clusterCount <= 4 ? 18 : 14);
        const haloScale = 0.6 + spindleFactor * 0.4;
        const haloR = baseHaloR * haloScale;
        
        ctx.beginPath();
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.06 * haloScale;
        ctx.arc(p.x, p.y, haloR * 1.75, 0, Math.PI*2);
        ctx.fill();

        ctx.beginPath();
        ctx.globalAlpha = 0.10 * haloScale;
        ctx.arc(p.x, p.y, haloR * 0.85, 0, Math.PI*2);
        ctx.fill();
      }
    }
  } catch(e) {
    console.error("Error drawing halos:", e);
  }
  ctx.restore();
  
  // cluster member points
  const t = now * 0.001;
  ctx.save();
  try {
    for(let li=0; li<centers.length; li++){
      if(!centers[li]) continue;
      const u = li / (layersShown - 1);
      const spindleFactor = Math.sin(u * Math.PI);
      const clusterCount = centers[li].length;
      
      for(let k=0; k<centers[li].length; k++){
        const p = centers[li][k];
        if(!p || p.x === undefined || p.y === undefined) continue;
        
        const pointsPerCluster = clusterCount <= 2 ? 24 : (clusterCount <= 4 ? 16 : 10);
        const baseR = clusterCount <= 2 ? 18 : (clusterCount <= 4 ? 14 : 10);
        const baseRPerCluster = baseR + spindleFactor * 6;
        const spin = (k % 2 === 0 ? 0.6 : -0.6) * (1 + k * 0.1);
        
        for(let i=0;i<pointsPerCluster;i++){
          const a = (i/pointsPerCluster) * Math.PI*2 + t*spin;
          const rr = baseRPerCluster * (0.28 + 0.75*(0.5+0.5*Math.sin(t*0.9 + i)));
          const x = p.x + Math.cos(a) * rr;
          const y = p.y + Math.sin(a) * rr;
          const pointSize = clusterCount <= 2 ? 1.8 : (clusterCount <= 4 ? 1.6 : 1.4);
          
          ctx.beginPath();
          ctx.fillStyle = accent;
          ctx.globalAlpha = 0.22 * (0.8 + spindleFactor * 0.2);
          ctx.arc(x, y, pointSize, 0, Math.PI*2);
          ctx.fill();
        }
      }
    }
  } catch(e) {
    console.error("Error drawing cluster points:", e);
  }
  ctx.restore();
}

function drawPixelPath(ctx, pts, seed, color, alpha){
  const pixelSize = 2.5;
  const jitter = 4.2;

  const roughPts = [];
  for(let j=0; j<pts.length; j++){
    const r = rand((seed + j*31) >>> 0);
    const x = snap(pts[j].x + (r()-0.5)*jitter, pixelSize);
    const y = snap(pts[j].y + (r()-0.5)*jitter, pixelSize);
    roughPts.push({x,y});
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.lineWidth = 2.4;
  ctx.globalAlpha = alpha;

  for(let j=0; j<roughPts.length-1; j++){
    const p0 = roughPts[j];
    const p1 = roughPts[j+1];
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  // pixel blocks for texture
  ctx.fillStyle = color;
  for(let j=0; j<roughPts.length; j+=3){
    const r = rand((seed + 2000 + j*17) >>> 0);
    const p = roughPts[j];
    const size = pixelSize * (0.8 + r() * 0.7);
    ctx.globalAlpha = alpha * (0.45 + r()*0.35);
    ctx.fillRect(
      Math.round(p.x - size/2),
      Math.round(p.y - size/2),
      Math.round(size),
      Math.round(size)
    );
  }

  ctx.restore();
}

function drawPixelPathThin(ctx, pts, seed, color, alpha){
  // Lighter pixelated path for cluster mode
  const pixelSize = 2.0;
  const jitter = 3.5;

  const roughPts = [];
  for(let j=0; j<pts.length; j++){
    const r = rand((seed + j*31) >>> 0);
    const x = snap(pts[j].x + (r()-0.5)*jitter, pixelSize);
    const y = snap(pts[j].y + (r()-0.5)*jitter, pixelSize);
    roughPts.push({x,y});
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.lineWidth = 1.8;
  ctx.globalAlpha = alpha;

  for(let j=0; j<roughPts.length-1; j++){
    const p0 = roughPts[j];
    const p1 = roughPts[j+1];
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  for(let j=0; j<roughPts.length; j+=5){
    const r = rand((seed + j*17 + 2000) >>> 0);
    const p = roughPts[j];
    const size = pixelSize * (0.6 + r()*0.4);
    ctx.globalAlpha = alpha * (0.30 + r()*0.20);
    ctx.fillRect(
      Math.round(p.x - size/2),
      Math.round(p.y - size/2),
      Math.round(size),
      Math.round(size)
    );
  }

  ctx.restore();
}

function drawSmoothPath(ctx, pts, color, alpha, width){
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for(let j=1;j<pts.length;j++) ctx.lineTo(pts[j].x, pts[j].y);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width || 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

/* -----------------------------
   Public API
-------------------------------- */

export function initLens(canvas, opts={}){
  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const pointer = { x: 0, y: 0, active: false };

  let w=10,h=10;
  function resize(){
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w*dpr);
    canvas.height = Math.floor(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let mode = opts.mode || "trajectories";
  let seed = 42;
  let meta = null;
  let paths = [];
  let particles = [];
  let modeStart = performance.now();
  let currentTraj = 0;
  let allCompleted = false;
  let reshuffleCounter = 0;
  let lastClusterReshuffle = performance.now();

  function build(reseed=false){
    if(reseed) seed += 1;
    modeStart = performance.now();
    reshuffleCounter = 0;
    lastClusterReshuffle = performance.now();

    if(mode === "trajectories") meta = buildTokenTrajectories(w,h,seed);
    else if(mode === "clusters") meta = buildClusterFlows(w,h,seed);
    else meta = buildTokenTrajectories(w,h,seed);

    paths = meta.paths || [];

    const rng = rand(seed + 999);
    particles = [];
    for(let i=0;i<paths.length;i++){
      particles.push({
        path: i,
        t: 0,
        speed: (mode === "clusters" ? 0.15 : 0.65),
        radius: 3.2 + rng()*1.4,
        completed: false,
      });
    }
    
    if(mode === "trajectories"){
      currentTraj = 0;
      allCompleted = false;
    } else {
      currentTraj = 0;
      allCompleted = false;
    }
  }

  build(false);

  function setMode(m){
    mode = m;
    build(true);
  }

  window.addEventListener("resize", ()=>{
    resize();
    build(false);
  });

  canvas.addEventListener("pointerenter", ()=>pointer.active = true);
  canvas.addEventListener("pointerleave", ()=>pointer.active = false);
  canvas.addEventListener("pointermove", (e)=>{
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.active = true;
  });

  let last = performance.now();
  function draw(now){
    const dt = Math.min(0.05, (now - last)/1000);
    last = now;

    if(mode === "trajectories" && meta && meta.cycleMs && (now - modeStart) > meta.cycleMs){
      build(true);
    }

    ctx.clearRect(0,0,w,h);
    drawScanlines(ctx, w, h);

    const ink = cssVar("--ink", "#0b1020");
    const accent = cssVar("--accent", "#1f57ff");
    const soft = cssVar("--borderSoft", "rgba(11,16,32,0.22)");

    if(mode === "trajectories") drawTrajBackdrop(ctx, w, h, meta);
    if(mode === "clusters") drawClusterBackdrop(ctx, meta, now);

    const warped = [];
    const lens = [];
    for(let i=0;i<paths.length;i++){
      const base = paths[i].base;
      const pts = (mode === "trajectories")
        ? warpTrajPoints(base, pointer, now, w, h, meta.bounds)
        : warpGenericPoints(base, pointer, now, w, h);
      warped.push(pts);
      lens.push(polyLengths(pts));
    }

    if(mode === "trajectories"){
      const redColor = "#ff4444";
      
      for(let i=0;i<warped.length;i++){
        const pts = warped[i];
        if(pts.length < 2) continue;
        
        const p = particles[i];
        if(!p) continue;
        
        const pathMeta = paths[i];
        const isRedTraj = pathMeta && pathMeta.isRed;
        
        if(p.completed || i < currentTraj || (allCompleted && i === currentTraj - 1)){
          const col = isRedTraj ? redColor : soft;
          drawPixelPath(ctx, pts, seed + i*97, col, 0.35);
        } else if(i === currentTraj && p.t > 0 && !p.completed){
          const col = isRedTraj ? redColor : accent;
          drawPixelPath(ctx, pts, seed + i*97, col, 0.85);
        }
      }
    } else if(mode === "clusters"){
      for(let i=0;i<warped.length;i++){
        const pts = warped[i];
        if(pts.length < 2) continue;
        const pathMeta = paths[i];
        const isThick = pathMeta && pathMeta.isThick;
        
        if(isThick){
          drawPixelPathThin(ctx, pts, seed + i*97, accent, 0.55);
        } else {
          drawSmoothPath(ctx, pts, soft, 0.50, 1.5);
        }
      }
    } else {
      for(let i=0;i<warped.length;i++){
        const pts = warped[i];
        if(pts.length < 2) continue;
        const col = (i===0) ? accent : soft;
        const a = (i===0) ? 0.70 : 0.55;
        drawSmoothPath(ctx, pts, col, a, 2);
      }
    }

    // Update and draw particles
    if(mode === "trajectories"){
      if(!allCompleted && currentTraj < particles.length){
        const p = particles[currentTraj];
        
        p.t += p.speed * dt;
        
        if(p.t >= 1){
          p.t = 1;
          p.completed = true;
          currentTraj = currentTraj + 1;
          
          if(currentTraj >= particles.length){
            allCompleted = true;
            if(particles.length > 0){
              particles[particles.length - 1].completed = true;
            }
            setTimeout(() => {
              currentTraj = 0;
              allCompleted = false;
              for(let i=0; i<particles.length; i++){
                particles[i].t = 0;
                particles[i].completed = false;
              }
            }, 500);
          }
        }
        
        if(p.t > 0 && !p.completed){
          const pos = pointAt(warped[p.path], lens[p.path], p.t);
          
          const pathMeta = paths[p.path];
          const isRedTraj = pathMeta && pathMeta.isRed;
          const glowColor = isRedTraj ? "#ff4444" : accent;
          
          ctx.beginPath();
          ctx.fillStyle = glowColor;
          ctx.globalAlpha = 0.20;
          ctx.arc(pos.x, pos.y, p.radius*2.8, 0, Math.PI*2);
          ctx.fill();
          
          ctx.beginPath();
          ctx.fillStyle = ink;
          ctx.globalAlpha = 0.95;
          ctx.arc(pos.x, pos.y, p.radius, 0, Math.PI*2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    } else if(mode === "clusters"){
      let shouldReshuffle = false;
      
      // Check if any particle completes a cycle
      for(const p of particles){
        p.t += p.speed * dt;
        if(p.t > 1){
          p.t -= 1;
          shouldReshuffle = true;
        }
      }
      
      // Also reshuffle periodically based on time (every 2-3 seconds)
      const timeSinceLastReshuffle = now - lastClusterReshuffle;
      if(timeSinceLastReshuffle > 2500){
        shouldReshuffle = true;
      }
      
      if(shouldReshuffle){
        reshuffleCounter += 1;
        lastClusterReshuffle = now;
        const rng = rand(seed + reshuffleCounter * 1000);
        const pathCount = paths.length;
        const thickIndices = [];
        const thinIndices = [];
        for(let i=0;i<pathCount;i++){
          if(rng() < 0.5){
            thickIndices.push(i);
          } else {
            thinIndices.push(i);
          }
        }
        if(thickIndices.length === 0) thickIndices.push(0);
        if(thinIndices.length === 0) thinIndices.push(pathCount - 1);
        
        for(let i=0;i<pathCount;i++){
          if(paths[i]) paths[i].isThick = thickIndices.includes(i);
        }
      }

      for(const p of particles){
        const pos = pointAt(warped[p.path], lens[p.path], p.t);

        ctx.beginPath();
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.16;
        ctx.arc(pos.x, pos.y, p.radius*2.6, 0, Math.PI*2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.90;
        ctx.arc(pos.x, pos.y, p.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else {
      for(const p of particles){
        p.t += p.speed * dt;
        if(p.t > 1) p.t -= 1;

        const pos = pointAt(warped[p.path], lens[p.path], p.t);

        ctx.beginPath();
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.16;
        ctx.arc(pos.x, pos.y, p.radius*2.6, 0, Math.PI*2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.90;
        ctx.arc(pos.x, pos.y, p.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    if(!reduced) requestAnimationFrame(draw);
  }

  if(!reduced) requestAnimationFrame(draw);
  else {
    // Static render for reduced motion
    const now = performance.now();
    ctx.clearRect(0,0,w,h);
    const ink = cssVar("--ink", "#0b1020");
    const accent = cssVar("--accent", "#1f57ff");
    const soft = cssVar("--borderSoft", "rgba(11,16,32,0.22)");

    if(mode === "trajectories") drawTrajBackdrop(ctx, w, h, meta);
    if(mode === "clusters") drawClusterBackdrop(ctx, meta, now);

    const warped = paths.map(p => (mode === "trajectories")
      ? warpTrajPoints(p.base, {active:false,x:0,y:0}, now, w, h, meta.bounds)
      : warpGenericPoints(p.base, {active:false,x:0,y:0}, now, w, h)
    );

    for(let i=0;i<warped.length;i++){
      const pts = warped[i];
      if(pts.length < 2) continue;
      if(mode === "trajectories"){
        const pathMeta = paths[i];
        const isRedTraj = pathMeta && pathMeta.isRed;
        const col = isRedTraj ? "#ff4444" : (i===0 ? accent : soft);
        drawPixelPath(ctx, pts, seed + i*97, col, i===0 ? 0.72 : 0.52);
      } else {
        drawSmoothPath(ctx, pts, i===0 ? accent : soft, i===0 ? 0.70 : 0.55, 2);
      }
    }

    // One dot per path
    for(let i=0;i<warped.length;i++){
      const pts = warped[i];
      if(pts.length < 2) continue;
      const l = polyLengths(pts);
      const pos = pointAt(pts, l, 0.62);
      ctx.beginPath();
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.16;
      ctx.arc(pos.x, pos.y, 8, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.90;
      ctx.arc(pos.x, pos.y, 3.6, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  return { setMode, get mode(){return mode;} };
}
