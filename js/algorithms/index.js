import { backtracker } from './backtracker.js';
import { growingTree } from './growing-tree.js';
import { prim } from './prim.js';
import { kruskal } from './kruskal.js';
import { wilson } from './wilson.js';
import { aldousBroder } from './aldous-broder.js';
import { huntAndKill } from './hunt-and-kill.js';
import { eller, sidewinder, binaryTree, recursiveDivision } from './rect-only.js';

export const ALGORITHMS = [
  {
    id: 'growing-tree',
    name: 'Growing Tree (tuned by difficulty)',
    desc: 'Blends long winding corridors with branching. Higher difficulty means longer, twistier dead ends.',
    fn: growingTree,
  },
  {
    id: 'backtracker',
    name: 'Recursive Backtracker',
    desc: 'Long, winding corridors with few but deep dead ends.',
    fn: backtracker,
  },
  {
    id: 'prim',
    name: "Prim's",
    desc: 'Grows outward from a point. Lots of short dead ends and a branchy feel.',
    fn: prim,
  },
  {
    id: 'kruskal',
    name: "Kruskal's",
    desc: 'Merges random regions together. Many short dead ends, evenly spread.',
    fn: kruskal,
  },
  {
    id: 'wilson',
    name: "Wilson's",
    desc: 'Unbiased: every possible maze is equally likely. Slow start on big mazes.',
    fn: wilson,
  },
  {
    id: 'aldous-broder',
    name: 'Aldous-Broder',
    desc: 'Unbiased random walk. Very slow on large mazes.',
    fn: aldousBroder,
    slow: true,
  },
  {
    id: 'hunt-and-kill',
    name: 'Hunt-and-Kill',
    desc: 'Like the backtracker, with long corridors, but hunts for new starting points instead of backing up.',
    fn: huntAndKill,
  },
  {
    id: 'eller',
    name: "Eller's",
    desc: 'Builds one row at a time using very little memory. Great for huge mazes.',
    fn: eller,
    rectOnly: true,
  },
  {
    id: 'sidewinder',
    name: 'Sidewinder',
    desc: 'Row-based with a clear path along the top edge. Easier to solve from the bottom up.',
    fn: sidewinder,
    rectOnly: true,
  },
  {
    id: 'binary-tree',
    name: 'Binary Tree',
    desc: 'The fastest and simplest, with clear corridors along the top and left edges and a diagonal bias.',
    fn: binaryTree,
    rectOnly: true,
  },
  {
    id: 'recursive-division',
    name: 'Recursive Division',
    desc: 'Splits the area with walls, so the maze looks boxy with long straight walls.',
    fn: recursiveDivision,
    rectOnly: true,
  },
];

export function getAlgorithm(id) {
  return ALGORITHMS.find((a) => a.id === id) || ALGORITHMS[0];
}
