// Maps the 1-10 difficulty input to generation parameters.

const BRAID = [0.6, 0.4, 0.25, 0.12, 0.05, 0, 0, 0, 0, 0];

export const DIFFICULTY_LABELS = ['Very easy', 'Very easy', 'Easy', 'Easy', 'Medium', 'Medium', 'Hard', 'Hard', 'Very hard', 'Expert'];

export function clampDifficulty(d) {
  return Math.min(10, Math.max(1, Math.round(Number(d) || 5)));
}

export function difficultyParams(d, cellType) {
  d = clampDifficulty(d);
  let placement;
  if (cellType === 'polar') placement = d <= 7 ? 'center' : 'farthest';
  else placement = d <= 4 ? 'corners' : d <= 7 ? 'edges' : 'farthest';
  return {
    // Fraction of dead ends opened up into loops (more ways through = easier).
    braid: BRAID[d - 1],
    // Growing-tree chance of extending the newest cell (higher = longer, deeper dead ends).
    bias: 0.15 + (d - 1) * 0.085,
    placement,
  };
}
