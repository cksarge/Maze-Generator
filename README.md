# Maze Generator

Generate, print and play mazes in your browser at **https://mazegenerator.carterscoding.com/**

## Features

- **Any size**: from tiny to millions of cells. The only limit is your device; the site shows the
  estimated memory use and warns you before very large mazes.
- **Shapes**: square, hexagonal, triangular or circular cells. Mazes can be rectangles, hexagons,
  triangles, circles, rings, hearts, stars, diamonds, crosses, hourglasses, arrows, or **any shape from an
  image you upload** (dark areas become the maze, with an adjustable threshold).
- **Difficulty 1–10**: controls loops (easy mazes have extra ways through), how long and twisty the dead
  ends are, and how far apart the start and finish are.
- **11 algorithms**: Growing Tree, Recursive Backtracker, Prim's, Kruskal's, Wilson's, Aldous-Broder,
  Hunt-and-Kill, Eller's, Sidewinder, Binary Tree and Recursive Division.
- **Printing**: maze only, solution only, or both on two pages, on US Letter, Legal, Tabloid, A3, A4 or
  A5, with an optional title and name/date line. Printed as vector graphics, so lines stay sharp.
  Choose "Save as PDF" in the print dialog for a PDF.
- **Play**: race from start to finish against the clock using the arrow keys/WASD (Q E Z C for diagonals)
  or by dragging with a mouse or finger. Optional fog of war. Best times are saved in your browser.
- **Share and download**: every maze comes from a seed, so a share link recreates the exact same maze.
  Download as SVG or PNG.
- **Play-only and challenge links**: the Share menu can copy a link that opens just the maze and a
  timer, with no settings, stats or solution tools. `share=1` lets players give up to see the
  solution; `share=2` (challenge) doesn't. The maze stays hidden and the timer starts when the player
  presses Start. These links can be scrambled into a single `?c=` code so the settings can't be read
  from the address bar. Since the site has no server this is obfuscation, not real encryption.

## Running locally

It's a static site with no build step and no dependencies. ES modules need to be served over HTTP:

```sh
python3 -m http.server 8080
# then open http://localhost:8080
```

Run the tests (Node 18+):

```sh
npm test
```

## Project layout

```
index.html            page structure
css/                  styles and print styles
js/main.js            app wiring
js/generate.js        generation pipeline (grid → algorithm → loops → start/finish → solution)
js/worker.js          runs generation off the main thread
js/grids/             square, hex, triangle and circular grids plus shape masks
js/algorithms/        maze generation algorithms
js/solver.js          shortest path, dead ends, braiding
js/render/            canvas view, SVG output
js/play.js            play mode
js/print.js           print layout
tests/                unit tests (node --test)
```

All grids share one graph model (cells with neighbor slots), so every general algorithm works on every
shape. The row-based algorithms (Eller's, Sidewinder, Binary Tree, Recursive Division) need a plain
rectangle of square cells.

## Deployment

GitHub Pages serves the `main` branch from the repository root. The `CNAME` file points it at
`mazegenerator.carterscoding.com`.

## License

MIT
