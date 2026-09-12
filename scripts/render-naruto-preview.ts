import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { NarutoPiece } from "../chess/appearance/NarutoPieces";
import { BOARD_THEME_STYLES } from "../chess/appearance/themes";

const cells = Array.from({ length: 16 }, (_, i) => {
  const dark = (i % 4 + Math.floor(i / 4)) % 2;
  const fill = dark ? BOARD_THEME_STYLES.naruto.darkSquareStyle.backgroundColor : BOARD_THEME_STYLES.naruto.lightSquareStyle.backgroundColor;
  return `<g transform="translate(${i % 4 * 64} ${Math.floor(i / 4) * 64})"><rect width="64" height="64" fill="${fill}" stroke="#a78046" stroke-width="1"/><circle cx="32" cy="32" r="20" fill="none" stroke="${dark ? "#dd6785" : "#986d25"}" opacity=".12"/></g>`;
}).join("");
const pieces = ([{ i: 1, kind: "R", black: true }, { i: 2, kind: "K", black: true }, { i: 5, kind: "B", black: true }, { i: 6, kind: "N", black: true }, { i: 9, kind: "P" }, { i: 10, kind: "B" }, { i: 13, kind: "Q" }, { i: 14, kind: "N" }] as const)
  .map(({ i, ...props }) => `<g transform="translate(${i % 4 * 64} ${Math.floor(i / 4) * 64})">${renderToStaticMarkup(createElement(NarutoPiece, props), { identifierPrefix: `piece-${i}-` }).replace('width="100%" height="100%"', 'width="64" height="64"')}</g>`).join("");
writeFileSync("public/chess/themes/naruto-preview.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 256 256"><title>Naruto Chess Set</title>${cells}${pieces}</svg>\n`);
