import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { PaperPiece } from "../chess/appearance/PaperPieces";

// Generate the catalog thumbnail from the same original SVG artwork as the board.
const cells = Array.from({ length: 16 }, (_, i) => `<rect x="${i % 4 * 64}" y="${Math.floor(i / 4) * 64}" width="64" height="64" fill="${(i % 4 + Math.floor(i / 4)) % 2 ? "#b49b7a" : "#f2eadb"}"/>`).join("");
const pieces = ([{ i: 1, kind: "R", black: true }, { i: 2, kind: "K", black: true }, { i: 5, kind: "P", black: true }, { i: 6, kind: "N", black: true }, { i: 9, kind: "B" }, { i: 10, kind: "P" }, { i: 13, kind: "Q" }, { i: 14, kind: "N" }] as const)
  .map(({ i, ...props }) => `<g transform="translate(${i % 4 * 64} ${Math.floor(i / 4) * 64})">${renderToStaticMarkup(createElement(PaperPiece, props)).replace('width="100%" height="100%"', 'width="64" height="64"')}</g>`).join("");
mkdirSync("public/chess/themes", { recursive: true });
writeFileSync("public/chess/themes/paper-preview.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 256 256"><title>Paper Chess Set</title>${cells}${pieces}</svg>\n`);
