import {
  PatternProject,
  RowCellInOrder,
  RowInstruction,
  StitchRun,
} from '../types/pattern';

function getDirectionForStandardRow(
  rowNumber: number,
  workingDirection: PatternProject['settings']['workingDirection'],
  handedness: PatternProject['settings']['handedness']
): 'right_to_left' | 'left_to_right' {
  if (workingDirection === 'right_to_left') return 'right_to_left';
  if (workingDirection === 'left_to_right') return 'left_to_right';

  // Alternating rows:
  // Right-handed starts Row 1 (odd / Right Side) Right-to-Left, Row 2 (even / Wrong Side) Left-to-Right.
  // Left-handed starts Row 1 (odd / Right Side) Left-to-Right, Row 2 (even / Wrong Side) Right-to-Left.
  const isOdd = rowNumber % 2 === 1;
  if (handedness === 'right') {
    return isOdd ? 'right_to_left' : 'left_to_right';
  }
  return isOdd ? 'left_to_right' : 'right_to_left';
}

export function generateRowInstruction(
  project: PatternProject,
  rowNumber: number
): RowInstruction {
  const { width, height, grid, palette, settings } = project;
  const fallbackColor = palette[0] ?? { id: 'default', hex: '#FAF5E8', name: 'Natural Cream' };

  // Corner-to-Corner diagonal reading
  if (settings.method === 'c2c') {
    const totalDiagonals = width + height - 1;
    const clampedRow = Math.max(1, Math.min(totalDiagonals, rowNumber));
    const d = clampedRow - 1; // 0-indexed diagonal distance from bottom-right or bottom-left corner
    const startFromRightCorner = settings.handedness === 'right';
    const isOdd = clampedRow % 2 === 1;
    const goUpward =
      settings.workingDirection === 'alternating'
        ? isOdd
        : settings.workingDirection === 'right_to_left';

    const cells: RowCellInOrder[] = [];
    // Collect cells on diagonal d
    const rawCoords: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= d; i++) {
      const fromBottom = i;
      const fromEdge = d - i;
      const y = height - 1 - fromBottom;
      const x = startFromRightCorner ? width - 1 - fromEdge : fromEdge;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        rawCoords.push({ x, y });
      }
    }
    const orderedCoords = goUpward ? rawCoords : [...rawCoords].reverse();
    orderedCoords.forEach((coord, idx) => {
      const colorIndex = grid[coord.y * width + coord.x] ?? 0;
      cells.push({
        col: coord.x,
        row: coord.y,
        stepNumber: idx + 1,
        colorIndex,
        color: palette[colorIndex] ?? fallbackColor,
      });
    });

    const runs = groupRuns(cells);
    const direction = goUpward ? 'diagonal_up_right' : 'diagonal_down_left';
    const directionLabel = goUpward
      ? 'Work diagonally upward across corner'
      : 'Work diagonally downward across corner';
    const startingCorner = startFromRightCorner ? 'Bottom-Right Corner' : 'Bottom-Left Corner';

    return {
      rowNumber: clampedRow,
      totalStitches: cells.length,
      direction,
      directionLabel,
      startingCorner,
      sideLabel: settings.workingDirection === 'alternating' ? (isOdd ? 'Right Side' : 'Wrong Side') : 'Front',
      runs,
      cells,
    };
  }

  // Standard horizontal crochet rows (Single, Half Double, Double, Tunisian, Mosaic)
  // Row 1 is at the bottom (y = height - 1), working up to Row height (y = 0).
  const clampedRow = Math.max(1, Math.min(height, rowNumber));
  const y = height - clampedRow;
  const dir = getDirectionForStandardRow(clampedRow, settings.workingDirection, settings.handedness);

  // Tunisian Simple Stitch & Overlay Mosaic always work across the front (Right Side facing)
  const isOneWayMethod = settings.method === 'tunisian_simple' || settings.method === 'mosaic';
  const effectiveDir = isOneWayMethod
    ? settings.handedness === 'right'
      ? 'right_to_left'
      : 'left_to_right'
    : dir;

  const cells: RowCellInOrder[] = [];
  if (effectiveDir === 'right_to_left') {
    for (let step = 0; step < width; step++) {
      const x = width - 1 - step;
      const colorIndex = grid[y * width + x] ?? 0;
      cells.push({
        col: x,
        row: y,
        stepNumber: step + 1,
        colorIndex,
        color: palette[colorIndex] ?? fallbackColor,
      });
    }
  } else {
    for (let step = 0; step < width; step++) {
      const x = step;
      const colorIndex = grid[y * width + x] ?? 0;
      cells.push({
        col: x,
        row: y,
        stepNumber: step + 1,
        colorIndex,
        color: palette[colorIndex] ?? fallbackColor,
      });
    }
  }

  const runs = groupRuns(cells);
  const isOdd = clampedRow % 2 === 1;
  const sideLabel: RowInstruction['sideLabel'] = isOneWayMethod
    ? 'Front'
    : settings.workingDirection === 'alternating'
      ? isOdd
        ? 'Right Side'
        : 'Wrong Side'
      : 'Front';

  const directionLabel =
    effectiveDir === 'right_to_left' ? 'Work from right to left' : 'Work from left to right';

  const startingCorner =
    settings.handedness === 'right' ? 'Bottom-Right Start' : 'Bottom-Left Start';

  return {
    rowNumber: clampedRow,
    totalStitches: cells.length,
    direction: effectiveDir,
    directionLabel,
    startingCorner,
    sideLabel,
    runs,
    cells,
  };
}

function groupRuns(cells: RowCellInOrder[]): StitchRun[] {
  if (cells.length === 0) return [];
  const runs: StitchRun[] = [];
  let currentColorIdx = cells[0].colorIndex;
  let currentColor = cells[0].color;
  let count = 1;
  let startStitch = cells[0].stepNumber;

  for (let i = 1; i < cells.length; i++) {
    const cell = cells[i];
    if (cell.colorIndex === currentColorIdx) {
      count++;
    } else {
      runs.push({
        colorIndex: currentColorIdx,
        color: currentColor,
        count,
        startStitch,
        endStitch: startStitch + count - 1,
      });
      currentColorIdx = cell.colorIndex;
      currentColor = cell.color;
      count = 1;
      startStitch = cell.stepNumber;
    }
  }
  runs.push({
    colorIndex: currentColorIdx,
    color: currentColor,
    count,
    startStitch,
    endStitch: startStitch + count - 1,
  });
  return runs;
}

export function generateAllRowInstructions(project: PatternProject): RowInstruction[] {
  const totalRows =
    project.settings.method === 'c2c'
      ? Math.max(1, project.width + project.height - 1)
      : Math.max(1, project.height);
  const list: RowInstruction[] = [];
  for (let r = 1; r <= totalRows; r++) {
    list.push(generateRowInstruction(project, r));
  }
  return list;
}
