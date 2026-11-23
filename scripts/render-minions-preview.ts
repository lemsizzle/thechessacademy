import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { MinionsPiece } from "../chess/appearance/MinionsPieces";
import { BOARD_THEME_STYLES } from "../chess/appearance/themes";

function cell(x: number, y: number) {
  const dark = (x + y) % 2;
  const fill = (dark ? BOARD_THEME_STYLES.minions.darkSquareStyle : BOARD_THEME_STYLES.minions.lightSquareStyle).backgroundColor;
  return `<g transform="translate(${x * 64} ${y * 64})"><rect width="64" height="64" fill="${fill}"/><path d="M0 0H64V2H2V64H0Z" fill="${dark ? "#526a87" : "#fff0b7"}"/><path d="M62 2H64V64H2V62H62Z" fill="${dark ? "#20354f" : "#d9bd63"}"/><path d="M8 8H16V16H8ZM40 24H48V32H40ZM24 48H32V56H24Z" fill="#fff" opacity=".04"/></g>`;
}
function piece(kind: Parameters<typeof MinionsPiece>[0]["kind"], black: boolean, x: number, y: number) {
  const svg = renderToStaticMarkup(createElement(MinionsPiece, { kind, black })).replace('width="100%" height="100%"', 'width="64" height="64"');
  return `<g transform="translate(${x * 64} ${y * 64})">${svg}</g>`;
}
const cells = Array.from({length: 16}, (_, i) => cell(i % 4, Math.floor(i / 4))).join("");
const pieces = ([{i:1,kind:"R",black:true},{i:2,kind:"K",black:true},{i:5,kind:"B",black:true},{i:6,kind:"N",black:true},{i:9,kind:"P",black:false},{i:10,kind:"B",black:false},{i:13,kind:"Q",black:false},{i:14,kind:"N",black:false}] as const).map(({i,kind,black}) => piece(kind,black,i%4,Math.floor(i/4))).join("");
writeFileSync("public/chess/themes/minions-preview.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 256 256"><title>Minions Chess Set</title>${cells}${pieces}</svg>\n`);

mkdirSync("work/minions-chess-set", {recursive:true});
const kinds = ["K","Q","B","N","R","P"] as const;
const atlas = [true,false].map((black,y) => kinds.map((kind,x) => cell(x,y) + piece(kind,black,x,y)).join("")).join("");
writeFileSync("work/minions-chess-set/pieces.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="384" viewBox="0 0 384 128">${atlas}</svg>`);
const order = ["R","N","B","Q","K","B","N","R"] as const;
const board = Array.from({length:64}, (_,i) => {
  const x=i%8,y=Math.floor(i/8);
  const kind = y===0 || y===7 ? order[x] : y===1 || y===6 ? "P" : null;
  return cell(x,y) + (kind ? piece(kind,y<2,x,y) : "");
}).join("");
writeFileSync("work/minions-chess-set/board.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 512 512">${board}</svg>`);

