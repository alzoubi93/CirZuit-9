import React, { useEffect, useRef } from "react";
import { PcbDoc, PcbTrack, PcbVia, PcbPad, PcbZone, PcbLayerId, PcbLayer, getCopperLayerStandardColor, isCopperLayer, isViaVisible, getViaRenderingStyles, determineViaType } from "@/lib/pcb";
import { drawTrackPathToCanvas } from "@/lib/arcGeometry";
import { renderZoneOnCanvas, isZoneVisible, isZoneOnLayer } from "@/lib/zoneGeometry";

interface PcbCanvasLayerProps {
  pcb: PcbDoc;
  pan: { x: number; y: number };
  zoom: number;
  boardRotation: number;
  selectedTrackId: string | null;
  selectedId: string | null;
  selection: any;
  groupSelected: { footprints: string[]; tracks: string[]; vias: string[]; pads: string[] } | null;
  highlightedNetIds: number[];
  trackNetMap: Map<string, number>;
  activeLayer: PcbLayerId;
  dimInactiveLayers: boolean;
  containerWidth: number;
  containerHeight: number;
}

export const PcbCanvasLayer: React.FC<PcbCanvasLayerProps> = ({
  pcb,
  pan,
  zoom,
  boardRotation,
  selectedTrackId,
  selectedId,
  selection,
  groupSelected,
  highlightedNetIds,
  trackNetMap,
  activeLayer,
  dimInactiveLayers,
  containerWidth,
  containerHeight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = containerWidth || canvas.clientWidth || 800;
    const h = containerHeight || canvas.clientHeight || 600;

    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set up viewport transformation (high DPI + pan + zoom + board rotation)
    ctx.scale(dpr, dpr);
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    if (boardRotation) {
      ctx.rotate((boardRotation * Math.PI) / 180);
    }

    const layerMap = new Map<string, PcbLayer>();
    (pcb.layers || []).forEach((l) => layerMap.set(l.id, l));

    const isLayerVisible = (layerId: string) => {
      const layer = layerMap.get(layerId);
      return layer ? layer.visible : true;
    };

    const getLayerColor = (layerId: string) => {
      const layer = layerMap.get(layerId);
      if (layer?.color) return layer.color;
      return getCopperLayerStandardColor(layerId);
    };

    const getLayerAlpha = (layerId: string) => {
      if (!dimInactiveLayers) return 1.0;
      if (layerId === activeLayer || layerId === "multi_layer" || layerId === "drill") return 1.0;
      return 0.25;
    };

    // 0. RENDER NATIVE ZONES, COPPER POURS & KEEPOUTS (Canvas accelerated)
    const zones = pcb.zones || [];
    const visibleLayerIdsForZones = new Set(
      (pcb.layers || [])
        .filter((l) => isLayerVisible(l.id))
        .map((l) => l.id)
    );

    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      if (!isZoneVisible(z, visibleLayerIdsForZones, pcb.layers)) continue;

      const isZoneSel = selection?.kind === "zone" && selection.id === z.id;
      const isGroupSel = false; // zones can be singled or highlighted
      const isActive = !dimInactiveLayers || isZoneOnLayer(z, activeLayer, pcb.layers);
      const layerCol = getLayerColor(z.layer);

      renderZoneOnCanvas(ctx, z, layerCol, {
        isActiveLayer: isActive,
        isSelected: isZoneSel,
        isGroupSelected: isGroupSel,
        dimInactive: dimInactiveLayers,
      });
    }

    // 1. RENDER TRACKS & POLYS (Canvas accelerated)
    const tracks = pcb.tracks || [];
    for (let i = 0; i < tracks.length; i++) {
      const tr = tracks[i];
      if (!tr.points || tr.points.length < 2) continue;
      if (!isLayerVisible(tr.layer)) continue;

      const isSel = selectedTrackId === tr.id;
      const trackNetId = trackNetMap.get(tr.id);
      const isHi = trackNetId !== undefined && highlightedNetIds.includes(trackNetId);
      const isGroupSel = groupSelected?.tracks.includes(tr.id) || false;

      const alpha = getLayerAlpha(tr.layer);
      ctx.globalAlpha = alpha;

      let strokeColor = getLayerColor(tr.layer);
      const strokeWidth = tr.width || 0.4;

      if (isGroupSel) {
        strokeColor = "#f59e0b";
      } else if (isSel) {
        strokeColor = "#3b82f6";
      }

      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = strokeColor;

      drawTrackPathToCanvas(ctx, tr);
      ctx.stroke();

      // Highlight / Selection overlays
      if (isHi || isSel || isGroupSel) {
        ctx.beginPath();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = strokeWidth + (isHi ? 1.5 : 0.8);
        ctx.strokeStyle = isGroupSel ? "#f59e0b" : isHi ? "rgba(59, 130, 246, 0.7)" : "rgba(96, 165, 250, 0.8)";
        drawTrackPathToCanvas(ctx, tr);
        ctx.stroke();
      }
    }

    // 2. RENDER STANDALONE & FOOTPRINT PADS (Canvas accelerated)
    const allPads: { pad: PcbPad; footprintId?: string }[] = [];
    (pcb.pads || []).forEach((p) => allPads.push({ pad: p }));
    (pcb.footprints || []).forEach((fp) => {
      // KiCad-origin footprints are rendered by KicadFootprintRenderer. Their
      // pads must not be duplicated by the legacy canvas pad layer.
      if (fp.nativeKicadFootprint) return;
      (fp.pads || []).forEach((p) => {
        // Calculate absolute position for footprint pads
        const rad = ((fp.rotation || 0) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const absX = fp.x + (p.x * cos - p.y * sin);
        const absY = fp.y + (p.x * sin + p.y * cos);
        allPads.push({
          pad: { ...p, x: absX, y: absY },
          footprintId: fp.id,
        });
      });
    });

    for (let i = 0; i < allPads.length; i++) {
      const { pad, footprintId } = allPads[i];
      if (!isLayerVisible(pad.layer)) continue;

      const isPadSel = (selection?.kind === "pad" && selection.id === pad.id) || (footprintId && selectedId === footprintId);
      const isGroupSel = groupSelected?.pads.includes(pad.id) || (footprintId && groupSelected?.footprints.includes(footprintId));

      ctx.globalAlpha = getLayerAlpha(pad.layer);
      let padColor = getLayerColor(pad.layer);

      if (isGroupSel) padColor = "#f59e0b";
      else if (isPadSel) padColor = "#8b5cf6";

      ctx.fillStyle = padColor;

      if (pad.shape === "rect") {
        ctx.fillRect(pad.x - pad.width / 2, pad.y - pad.height / 2, pad.width, pad.height);
        if (isPadSel || isGroupSel) {
          ctx.strokeStyle = isGroupSel ? "#f59e0b" : "#3b82f6";
          ctx.lineWidth = 0.2;
          ctx.strokeRect(pad.x - pad.width / 2, pad.y - pad.height / 2, pad.width, pad.height);
        }
      } else {
        ctx.beginPath();
        ctx.arc(pad.x, pad.y, pad.width / 2, 0, Math.PI * 2);
        ctx.fill();
        if (isPadSel || isGroupSel) {
          ctx.strokeStyle = isGroupSel ? "#f59e0b" : "#3b82f6";
          ctx.lineWidth = 0.2;
          ctx.stroke();
        }
      }

      // Drill hole
      if (pad.drill) {
        ctx.fillStyle = "#121214";
        ctx.beginPath();
        ctx.arc(pad.x, pad.y, pad.drill / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. RENDER VIAS (Canvas accelerated with native layer spans)
    const vias = pcb.vias || [];
    const visibleLayerIds = new Set(
      (pcb.layers || [])
        .filter((l) => isLayerVisible(l.id))
        .map((l) => l.id)
    );
    if (isLayerVisible("drill")) visibleLayerIds.add("drill");

    for (let i = 0; i < vias.length; i++) {
      const v = vias[i];
      if (!isViaVisible(v, visibleLayerIds, pcb.layers)) continue;

      const isViaSel = selection?.kind === "via" && selection.id === v.id;
      const isGroupSel = groupSelected?.vias.includes(v.id) || false;

      ctx.globalAlpha = getLayerAlpha("drill");

      const styles = getViaRenderingStyles(v, activeLayer, pcb.layers, isViaSel, isGroupSel);
      const radius = (v.diameter || 0.8) / 2;
      const drillRadius = (v.drill || 0.4) / 2;

      // Outer copper annular ring
      ctx.fillStyle = styles.outerColor;
      ctx.strokeStyle = styles.strokeColor;
      ctx.lineWidth = styles.strokeWidth;
      ctx.beginPath();
      ctx.arc(v.x, v.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner drill hole (offset if specified)
      const holeX = v.x + (v.drillOffset?.x || 0);
      const holeY = v.y + (v.drillOffset?.y || 0);
      ctx.fillStyle = styles.drillColor;
      ctx.beginPath();
      ctx.arc(holeX, holeY, drillRadius, 0, Math.PI * 2);
      ctx.fill();

      // Visual indicator for Microvia or Blind/Buried
      if (styles.viaType === "micro") {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.arc(holeX, holeY, (radius + drillRadius) / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (styles.viaType === "blind") {
        // Subtle dual crosshair marker for blind/buried
        ctx.strokeStyle = "rgba(6, 182, 212, 0.7)";
        ctx.lineWidth = 0.06;
        ctx.beginPath();
        ctx.moveTo(holeX - radius * 0.7, holeY);
        ctx.lineTo(holeX + radius * 0.7, holeY);
        ctx.moveTo(holeX, holeY - radius * 0.7);
        ctx.lineTo(holeX, holeY + radius * 0.7);
        ctx.stroke();
      }
    }

    // 4. RENDER NATIVE BOARD GRAPHICS
    const graphics = pcb.graphics || [];
    for (let i = 0; i < graphics.length; i++) {
      const g = graphics[i];
      if (!isLayerVisible(g.layer)) continue;
      const isSel = selection?.kind === "graphic" && selection.id === g.id;
      const layerObj = pcb.layers?.find(l => l.id === g.layer);
      const color = isSel ? "#3b82f6" : (layerObj?.color || "#ffd166");
      const width = g.stroke?.width || g.width || 0.2;

      ctx.globalAlpha = getLayerAlpha(g.layer);
      ctx.strokeStyle = color;
      ctx.fillStyle = g.fill === "solid" ? color : "none";
      ctx.lineWidth = width;

      if (g.kind === "line") {
        ctx.beginPath();
        ctx.moveTo(g.start.x, g.start.y);
        ctx.lineTo(g.end.x, g.end.y);
        ctx.stroke();
      } else if (g.kind === "arc") {
        ctx.beginPath();
        ctx.moveTo(g.start.x, g.start.y);
        if (g.mid) {
          ctx.quadraticCurveTo(g.mid.x, g.mid.y, g.end.x, g.end.y);
        } else {
          ctx.lineTo(g.end.x, g.end.y);
        }
        ctx.stroke();
      } else if (g.kind === "circle") {
        const r = g.radius || Math.hypot(g.end.x - g.center.x, g.end.y - g.center.y);
        ctx.beginPath();
        ctx.arc(g.center.x, g.center.y, r, 0, Math.PI * 2);
        if (g.fill === "solid") ctx.fill();
        ctx.stroke();
      } else if (g.kind === "rect") {
        const minX = Math.min(g.start.x, g.end.x);
        const minY = Math.min(g.start.y, g.end.y);
        const w = Math.abs(g.end.x - g.start.x);
        const h = Math.abs(g.end.y - g.start.y);
        if (g.fill === "solid") ctx.fillRect(minX, minY, w, h);
        ctx.strokeRect(minX, minY, w, h);
      } else if ((g.kind === "poly" || g.kind === "curve") && g.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(g.points[0].x, g.points[0].y);
        for (let ptI = 1; ptI < g.points.length; ptI++) {
          ctx.lineTo(g.points[ptI].x, g.points[ptI].y);
        }
        if (g.fill === "solid") ctx.fill();
        ctx.stroke();
      } else if (g.kind === "text") {
        ctx.fillStyle = color;
        ctx.font = `${g.bold ? "bold " : ""}${g.size?.y || 1.2}px monospace`;
        ctx.fillText(g.text, g.position.x, g.position.y);
      }
    }

    // 5. RENDER DIMENSIONS
    const dimensions = pcb.dimensions || [];
    for (let i = 0; i < dimensions.length; i++) {
      const dim = dimensions[i];
      if (!isLayerVisible(dim.layer)) continue;
      if (dim.points.length < 2) continue;
      const p1 = dim.points[0];
      const p2 = dim.points[1];
      const layerObj = pcb.layers?.find(l => l.id === dim.layer);
      const color = layerObj?.color || "#06b6d4";

      ctx.globalAlpha = getLayerAlpha(dim.layer);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 0.15;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 0.25, 0, Math.PI * 2);
      ctx.arc(p2.x, p2.y, 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. RENDER TARGETS
    const targets = pcb.targets || [];
    for (let i = 0; i < targets.length; i++) {
      const tg = targets[i];
      if (!isLayerVisible(tg.layer)) continue;
      const layerObj = pcb.layers?.find(l => l.id === tg.layer);
      const color = layerObj?.color || "#e11d48";
      const s = tg.size || 3;
      const r = s / 2;

      ctx.globalAlpha = getLayerAlpha(tg.layer);
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.2;

      ctx.beginPath();
      ctx.arc(tg.x, tg.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(tg.x, tg.y, r * 0.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(tg.x - r * 1.3, tg.y);
      ctx.lineTo(tg.x + r * 1.3, tg.y);
      ctx.moveTo(tg.x, tg.y - r * 1.3);
      ctx.lineTo(tg.x, tg.y + r * 1.3);
      ctx.stroke();
    }

    ctx.restore();
  }, [
    pcb,
    pan,
    zoom,
    boardRotation,
    selectedTrackId,
    selectedId,
    selection,
    groupSelected,
    highlightedNetIds,
    trackNetMap,
    activeLayer,
    dimInactiveLayers,
    containerWidth,
    containerHeight,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none z-0"
    />
  );
};

