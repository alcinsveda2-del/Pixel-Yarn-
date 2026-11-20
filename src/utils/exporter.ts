import { jsPDF } from 'jspdf';
import { getContrastTextColor, hexToRgb } from '../data/yarnLibrary';
import { PatternProject } from '../types/pattern';
import {
  calculateDimensions,
  computeColorUsage,
  CROCHET_METHOD_SPECS,
  getTotalRowsForProject,
  YARN_WEIGHT_SPECS,
} from './crochetMath';
import { generateAllRowInstructions } from './rowInstructions';

export interface PdfExportOptions {
  includeGrid: boolean;
  includeLegend: boolean;
  includeSettings: boolean;
  includeInstructions: boolean;
}

function renderPatternGridCanvas(
  project: PatternProject,
  cellSize: number,
  includeAxes: boolean
): HTMLCanvasElement {
  const marginLeft = includeAxes ? 42 : 0;
  const marginBottom = includeAxes ? 34 : 0;
  const marginTop = includeAxes ? 14 : 0;
  const marginRight = includeAxes ? 14 : 0;

  const gridW = project.width * cellSize;
  const gridH = project.height * cellSize;

  const canvas = document.createElement('canvas');
  canvas.width = marginLeft + gridW + marginRight;
  canvas.height = marginTop + gridH + marginBottom;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < project.height; y++) {
    for (let x = 0; x < project.width; x++) {
      const colorIdx = project.grid[y * project.width + x] ?? 0;
      const color = project.palette[colorIdx] ?? project.palette[0];
      ctx.fillStyle = color ? color.hex : '#FAF5E8';
      ctx.fillRect(marginLeft + x * cellSize, marginTop + y * cellSize, cellSize, cellSize);
    }
  }

  // Gridlines
  if (cellSize >= 6) {
    ctx.strokeStyle = 'rgba(30, 29, 32, 0.18)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= project.width; x++) {
      const px = marginLeft + x * cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, marginTop);
      ctx.lineTo(px, marginTop + gridH);
      ctx.stroke();
    }
    for (let y = 0; y <= project.height; y++) {
      const py = marginTop + y * cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(marginLeft, py);
      ctx.lineTo(marginLeft + gridW, py);
      ctx.stroke();
    }
  }

  // Bold 5/10 stitch guides
  if (cellSize >= 5) {
    ctx.strokeStyle = 'rgba(30, 29, 32, 0.45)';
    ctx.lineWidth = 1.4;
    for (let x = 0; x <= project.width; x += 10) {
      const px = marginLeft + x * cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, marginTop);
      ctx.lineTo(px, marginTop + gridH);
      ctx.stroke();
    }
    for (let row = 0; row <= project.height; row += 10) {
      const py = marginTop + (project.height - row) * cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(marginLeft, py);
      ctx.lineTo(marginLeft + gridW, py);
      ctx.stroke();
    }
  }

  if (includeAxes) {
    ctx.fillStyle = '#333138';
    ctx.font = '600 11px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const rowStep = project.height > 40 ? 5 : 1;
    for (let row = 1; row <= project.height; row++) {
      if (row === 1 || row === project.height || row % rowStep === 0) {
        const y = project.height - row;
        ctx.fillText(String(row), marginLeft - 6, marginTop + y * cellSize + cellSize / 2);
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const colStep = project.width > 40 ? 5 : 1;
    for (let col = 1; col <= project.width; col++) {
      if (col === 1 || col === project.width || col % colStep === 0) {
        const x = col - 1;
        ctx.fillText(String(col), marginLeft + x * cellSize + cellSize / 2, marginTop + gridH + 6);
      }
    }
  }

  return canvas;
}

export function exportPatternAsPng(
  project: PatternProject,
  highRes: boolean
): void {
  const cellSize = highRes ? 28 : 14;
  const gridCanvas = renderPatternGridCanvas(project, cellSize, highRes);
  const usage = computeColorUsage(project).filter((u) => u.stitchCount > 0);

  const headerH = highRes ? 92 : 52;
  const legendRows = Math.ceil(usage.length / (highRes ? 3 : 2));
  const legendH = highRes ? Math.max(80, legendRows * 36 + 50) : 0;

  const out = document.createElement('canvas');
  out.width = Math.max(gridCanvas.width, highRes ? 900 : 480);
  out.height = headerH + gridCanvas.height + legendH;

  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#FAF7F2';
  ctx.fillRect(0, 0, out.width, out.height);

  // Header
  ctx.fillStyle = '#1E1D20';
  ctx.font = highRes ? '700 26px sans-serif' : '700 16px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(project.name, 24, highRes ? 18 : 12);

  const dims = calculateDimensions(
    project.width,
    project.height,
    project.settings.stitchGaugePer10Cm,
    project.settings.rowGaugePer10Cm
  );
  const methodLabel = CROCHET_METHOD_SPECS[project.settings.method]?.shortLabel ?? 'Crochet';
  ctx.fillStyle = '#5D5A63';
  ctx.font = highRes ? '500 14px sans-serif' : '500 11px sans-serif';
  ctx.fillText(
    `${project.width} × ${project.height} stitches · ${methodLabel} · ~${dims.widthCm.toFixed(1)} × ${dims.heightCm.toFixed(1)} cm · PixelYarn`,
    24,
    highRes ? 54 : 33
  );

  // Draw Grid centered
  const gridX = Math.floor((out.width - gridCanvas.width) / 2);
  ctx.drawImage(gridCanvas, gridX, headerH);

  // Draw Legend for High-Res PNG
  if (highRes && usage.length > 0) {
    const startY = headerH + gridCanvas.height + 16;
    const cols = 3;
    const colW = (out.width - 48) / cols;
    ctx.fillStyle = '#1E1D20';
    ctx.font = '700 15px sans-serif';
    ctx.fillText('Colour Legend', 24, startY);

    usage.forEach((u, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const bx = 24 + c * colW;
      const by = startY + 28 + r * 34;

      ctx.fillStyle = u.color.hex;
      ctx.strokeStyle = '#D5CEC0';
      ctx.lineWidth = 1;
      ctx.fillRect(bx, by, 22, 22);
      ctx.strokeRect(bx, by, 22, 22);

      ctx.fillStyle = '#1E1D20';
      ctx.font = '600 13px sans-serif';
      ctx.fillText(
        `${u.color.name} (${u.stitchCount} sts · ${u.percentage.toFixed(1)}%)`,
        bx + 30,
        by + 4
      );
    });
  }

  const link = document.createElement('a');
  const safeName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'pixelyarn-pattern';
  link.download = `${safeName}${highRes ? '-highres' : ''}.png`;
  link.href = out.toDataURL('image/png');
  link.click();
}

export function exportPatternAsPdf(
  project: PatternProject,
  options: PdfExportOptions = {
    includeGrid: true,
    includeLegend: true,
    includeSettings: true,
    includeInstructions: true,
  }
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  const dims = calculateDimensions(
    project.width,
    project.height,
    project.settings.stitchGaugePer10Cm,
    project.settings.rowGaugePer10Cm
  );
  const methodSpec = CROCHET_METHOD_SPECS[project.settings.method];
  const weightSpec = YARN_WEIGHT_SPECS[project.settings.yarnWeight];
  const totalRows = getTotalRowsForProject(project);
  const usage = computeColorUsage(project).filter((u) => u.stitchCount > 0);

  // Header
  doc.setFillColor(31, 32, 36);
  doc.rect(0, 0, pageW, 24, 'F');
  doc.setTextColor(250, 247, 242);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(project.name, margin, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(216, 208, 230);
  doc.text(
    `PixelYarn Studio  |  ${project.width} x ${project.height} stitches  |  ${totalRows} rows  |  ${usage.length} colours`,
    margin,
    18
  );

  y = 31;
  doc.setTextColor(30, 29, 32);

  // Settings Summary
  if (options.includeSettings) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Project Settings & Gauge', margin, y);
    y += 5;

    doc.setDrawColor(225, 218, 206);
    doc.setFillColor(250, 247, 242);
    doc.roundedRect(margin, y, contentW, 24, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const dirLabel =
      project.settings.workingDirection === 'alternating'
        ? 'Alternating rows'
        : project.settings.workingDirection === 'right_to_left'
          ? 'Always Right to Left'
          : 'Always Left to Right';
    const handLabel = project.settings.handedness === 'right' ? 'Right-handed' : 'Left-handed';

    doc.text(`Method: ${methodSpec?.label ?? project.settings.method}`, margin + 4, y + 6);
    doc.text(`Direction: ${dirLabel} (${handLabel})`, margin + 4, y + 12);
    doc.text(`Yarn: ${project.settings.yarnBrand} ${project.settings.yarnName} (${weightSpec?.label})`, margin + 4, y + 18);

    const col2X = margin + contentW * 0.52;
    doc.text(`Hook Size: ${project.settings.hookSizeMm} mm`, col2X, y + 6);
    doc.text(
      `Gauge: ${project.settings.stitchGaugePer10Cm} sts x ${project.settings.rowGaugePer10Cm} rows / 10 cm`,
      col2X,
      y + 12
    );
    doc.text(
      `Est. Finished Size: ${dims.widthCm.toFixed(1)} x ${dims.heightCm.toFixed(1)} cm (${dims.widthIn.toFixed(1)} x ${dims.heightIn.toFixed(1)} in)`,
      col2X,
      y + 18
    );

    y += 30;
  }

  // Printable Pattern Grid Preview
  if (options.includeGrid) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Pattern Stitch Grid', margin, y);
    y += 4;

    const cellPx = Math.max(8, Math.min(20, Math.floor(900 / Math.max(project.width, project.height))));
    const gridCanvas = renderPatternGridCanvas(project, cellPx, true);
    const imgData = gridCanvas.toDataURL('image/png');
    const maxDrawH = options.includeLegend ? 115 : pageH - y - margin;
    const aspect = gridCanvas.width / gridCanvas.height;
    let drawW = contentW;
    let drawH = drawW / aspect;
    if (drawH > maxDrawH) {
      drawH = maxDrawH;
      drawW = drawH * aspect;
    }
    const drawX = margin + (contentW - drawW) / 2;
    doc.addImage(imgData, 'PNG', drawX, y, drawW, drawH);
    y += drawH + 8;
  }

  // Color Legend Table
  if (options.includeLegend && usage.length > 0) {
    if (y > pageH - 45) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Colour Legend & Yarn Quantities', margin, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFillColor(240, 235, 226);
    doc.rect(margin, y, contentW, 6.5, 'F');
    doc.setTextColor(60, 56, 66);
    doc.text('Swatch', margin + 2, y + 4.5);
    doc.text('Colour Name', margin + 16, y + 4.5);
    doc.text('HEX', margin + 72, y + 4.5);
    doc.text('Stitches', margin + 98, y + 4.5);
    doc.text('Share', margin + 124, y + 4.5);
    doc.text('Est. Yarn', margin + 146, y + 4.5);
    y += 7;

    doc.setFont('helvetica', 'normal');
    usage.forEach((u, idx) => {
      if (y > pageH - 16) {
        doc.addPage();
        y = margin;
      }
      const [r, g, b] = hexToRgb(u.color.hex);
      if (idx % 2 === 1) {
        doc.setFillColor(250, 248, 244);
        doc.rect(margin, y, contentW, 6.5, 'F');
      }
      doc.setFillColor(r, g, b);
      doc.setDrawColor(180, 175, 168);
      doc.rect(margin + 2, y + 1, 8, 4.5, 'FD');

      doc.setTextColor(30, 29, 32);
      const label = u.color.brand ? `${u.color.name}` : u.color.name;
      doc.text(label.slice(0, 30), margin + 16, y + 4.5);
      doc.text(u.color.hex, margin + 72, y + 4.5);
      doc.text(String(u.stitchCount), margin + 98, y + 4.5);
      doc.text(`${u.percentage.toFixed(1)}%`, margin + 124, y + 4.5);
      doc.text(`~${u.estimatedMeters.toFixed(1)} m`, margin + 146, y + 4.5);
      y += 6.5;
    });
    y += 6;
  }

  // Row-by-Row Instructions
  if (options.includeInstructions) {
    const instructions = generateAllRowInstructions(project);
    if (y > pageH - 35 || options.includeGrid) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 29, 32);
    doc.text('Row-by-Row Crochet Instructions', margin, y);
    y += 7;

    instructions.forEach((inst) => {
      const runsText = inst.runs
        .map((run) => `${run.count} ${run.color.name}`)
        .join(', ');
      const lines = doc.splitTextToSize(runsText, contentW - 10) as string[];
      const blockH = 7 + lines.length * 4.2 + 3;

      if (y + blockH > pageH - margin) {
        doc.addPage();
        y = margin;
      }

      // Checkbox + Row heading
      doc.setDrawColor(140, 134, 150);
      doc.rect(margin, y, 3.6, 3.6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 29, 32);
      const dirArrow = inst.direction === 'right_to_left' ? 'R->L' : inst.direction === 'left_to_right' ? 'L->R' : 'Diag';
      doc.text(
        `Row ${inst.rowNumber}  (${inst.totalStitches} sts · ${dirArrow} · ${inst.sideLabel})`,
        margin + 6,
        y + 3
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(70, 66, 76);
      doc.text(lines, margin + 6, y + 7.5);
      y += blockH;
    });
  }

  void getContrastTextColor;
  const safeName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'pixelyarn-pattern';
  doc.save(`${safeName}-pattern.pdf`);
}
