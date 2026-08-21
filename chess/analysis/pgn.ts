import { Chess } from "chess.js";
import { addAnalysisMove, createEmptyAnalysisTree, updateNodeAnnotations, validateAnalysisTree } from "@/chess/analysis/tree";
import type { AnalysisNag, AnalysisNode, AnalysisTree } from "@/chess/analysis/types";

const MAX_PGN_LENGTH = 200_000;
const MAX_TOKENS = 20_000;
const RESULT_TOKENS = new Set(["1-0", "0-1", "1/2-1/2", "*"]);
const NAG_FROM_NUMBER: Record<string, AnalysisNag> = {
  "1": "!", "2": "?", "3": "!!", "4": "??", "5": "!?", "6": "?!"
};
const NUMBER_FROM_NAG: Record<AnalysisNag, string> = {
  "!": "1", "?": "2", "!!": "3", "??": "4", "!?": "5", "?!": "6"
};

export type ParsedPgn = {
  tree: AnalysisTree;
  headers: Record<string, string>;
  result: string;
};

function invalid(message: string): never {
  throw new Error(`Invalid PGN: ${message}`);
}

function parseHeaders(pgn: string) {
  const headers: Record<string, string> = {};
  const body = pgn.replace(/^\s*\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"\\])*)"\]\s*$/gm, (_match, key: string, value: string) => {
    if (Object.keys(headers).length >= 100 && !(key in headers)) invalid("there are too many header tags.");
    headers[key] = value.replace(/\\(["\\])/g, "$1").slice(0, 500);
    return "";
  });
  return { headers, body };
}

function tokenizeMovetext(body: string) {
  const tokens: string[] = [];
  let index = 0;
  while (index < body.length) {
    const character = body[index];
    if (/\s/.test(character)) { index += 1; continue; }
    if (character === "{") {
      const end = body.indexOf("}", index + 1);
      if (end === -1) invalid("a comment is missing its closing brace.");
      tokens.push(`{${body.slice(index + 1, end)}}`);
      index = end + 1;
      continue;
    }
    if (character === ";") {
      const end = body.indexOf("\n", index + 1);
      tokens.push(`{${body.slice(index + 1, end === -1 ? body.length : end)}}`);
      index = end === -1 ? body.length : end + 1;
      continue;
    }
    if (character === "(" || character === ")") {
      tokens.push(character);
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < body.length && !/[\s{}();]/.test(body[end])) end += 1;
    tokens.push(body.slice(index, end));
    index = end;
    if (tokens.length > MAX_TOKENS) invalid("the movetext is too large.");
  }
  return tokens;
}

function appendComment(tree: AnalysisTree, nodeId: string, comment: string) {
  const clean = comment.trim();
  if (!clean) return tree;
  const current = tree.nodes[nodeId].comment;
  return updateNodeAnnotations(tree, nodeId, { comment: `${current}${current ? "\n\n" : ""}${clean}`.slice(0, 5000) });
}

function appendNag(tree: AnalysisTree, nodeId: string, nag: AnalysisNag) {
  const current = tree.nodes[nodeId].nags;
  return current.includes(nag) ? tree : updateNodeAnnotations(tree, nodeId, { nags: [...current, nag] });
}

function splitSanNag(token: string) {
  const match = /^(.*?)(!!|\?\?|!\?|\?!|!|\?)$/.exec(token);
  return match ? { san: match[1], nag: match[2] as AnalysisNag } : { san: token, nag: null };
}

function stripMoveNumber(token: string) {
  const match = /^(?:\d+)\.(?:\.\.)?(.*)$/.exec(token);
  return match ? match[1] : token;
}

export function parsePgnToAnalysisTree(input: string): ParsedPgn {
  const pgn = String(input ?? "").trim();
  if (!pgn) invalid("enter PGN movetext.");
  if (pgn.length > MAX_PGN_LENGTH) invalid("the file is larger than 200 KB.");
  const { headers, body } = parseHeaders(pgn);
  const initialFen = headers.SetUp === "1" || headers.FEN ? headers.FEN : undefined;
  let tree: AnalysisTree;
  try {
    tree = createEmptyAnalysisTree(initialFen);
  } catch {
    invalid("the starting FEN is not legal.");
  }
  let currentId = tree.rootId;
  const variationStack: string[] = [];
  let result = RESULT_TOKENS.has(headers.Result) ? headers.Result : "*";

  for (const rawToken of tokenizeMovetext(body)) {
    if (rawToken.startsWith("{")) {
      tree = appendComment(tree, currentId, rawToken.slice(1, -1));
      continue;
    }
    if (rawToken === "(") {
      if (currentId === tree.rootId) invalid("a variation appears before its parent move.");
      variationStack.push(currentId);
      currentId = tree.nodes[currentId].parentId ?? tree.rootId;
      continue;
    }
    if (rawToken === ")") {
      const resumeId = variationStack.pop();
      if (!resumeId) invalid("the variation parentheses are unbalanced.");
      currentId = resumeId;
      continue;
    }
    if (RESULT_TOKENS.has(rawToken)) {
      result = rawToken;
      continue;
    }
    if (/^\$\d+$/.test(rawToken)) {
      const nag = NAG_FROM_NUMBER[rawToken.slice(1)];
      if (nag) tree = appendNag(tree, currentId, nag);
      continue;
    }
    if (["!", "?", "!!", "??", "!?", "?!"].includes(rawToken)) {
      tree = appendNag(tree, currentId, rawToken as AnalysisNag);
      continue;
    }

    const withoutMoveNumber = stripMoveNumber(rawToken);
    if (!withoutMoveNumber || /^\d+\.{1,3}$/.test(rawToken)) continue;
    const { san: rawSan, nag } = splitSanNag(withoutMoveNumber);
    const san = rawSan.replace(/^0-0-0/, "O-O-O").replace(/^0-0/, "O-O");
    if (!san) continue;
    const position = tree.nodes[currentId];
    const chess = new Chess(position.fen);
    let move;
    try {
      move = chess.move(san, { strict: false });
    } catch {
      invalid(`move “${rawSan}” is not legal after ply ${position.ply}.`);
    }
    if (!move) invalid(`move “${rawSan}” is not legal after ply ${position.ply}.`);
    const promotion = move.promotion && ["q", "r", "b", "n"].includes(move.promotion)
      ? move.promotion as "q" | "r" | "b" | "n"
      : undefined;
    const added = addAnalysisMove(tree, currentId, move.from, move.to, promotion, "analysis");
    tree = added.tree;
    currentId = added.nodeId;
    if (nag) tree = appendNag(tree, currentId, nag);
  }
  if (variationStack.length) invalid("the variation parentheses are unbalanced.");
  return { tree: validateAnalysisTree(tree), headers, result };
}

function escapeHeader(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ").slice(0, 500);
}

function movePrefix(node: AnalysisNode, lineStart: boolean) {
  const moveNumber = Math.ceil(node.ply / 2);
  if (node.ply % 2 === 1) return `${moveNumber}.`;
  return lineStart ? `${moveNumber}...` : "";
}

function commentToken(comment: string) {
  const clean = comment.replace(/[{}]/g, (value) => value === "{" ? "[" : "]").trim();
  return clean ? `{${clean}}` : "";
}

function exportContinuation(tree: AnalysisTree, parentId: string, lineStart: boolean): string[] {
  const parent = tree.nodes[parentId];
  const mainId = parent.mainChildId ?? parent.childrenIds[0];
  if (!mainId) return [];
  const main = tree.nodes[mainId];
  const prefix = movePrefix(main, lineStart);
  const tokens = [prefix, main.san ?? main.uci ?? ""].filter(Boolean);
  tokens.push(...main.nags.map((nag) => `$${NUMBER_FROM_NAG[nag]}`));
  const comment = commentToken(main.comment);
  if (comment) tokens.push(comment);
  for (const variationId of parent.childrenIds.filter((id) => id !== mainId)) {
    tokens.push("(", ...exportBranch(tree, variationId), ")");
  }
  tokens.push(...exportContinuation(tree, mainId, false));
  return tokens;
}

function exportBranch(tree: AnalysisTree, nodeId: string): string[] {
  const node = tree.nodes[nodeId];
  const prefix = movePrefix(node, true);
  const tokens = [prefix, node.san ?? node.uci ?? ""].filter(Boolean);
  tokens.push(...node.nags.map((nag) => `$${NUMBER_FROM_NAG[nag]}`));
  const comment = commentToken(node.comment);
  if (comment) tokens.push(comment);
  const mainId = node.mainChildId ?? node.childrenIds[0];
  if (mainId) {
    const main = tree.nodes[mainId];
    const mainPrefix = movePrefix(main, false);
    tokens.push(mainPrefix, main.san ?? main.uci ?? "");
    tokens.push(...main.nags.map((nag) => `$${NUMBER_FROM_NAG[nag]}`));
    const mainComment = commentToken(main.comment);
    if (mainComment) tokens.push(mainComment);
    for (const variationId of node.childrenIds.filter((id) => id !== mainId)) {
      tokens.push("(", ...exportBranch(tree, variationId), ")");
    }
    tokens.push(...exportContinuation(tree, mainId, false));
  }
  return tokens.filter(Boolean);
}

export function exportAnalysisTreeToPgn(treeInput: AnalysisTree, inputHeaders: Record<string, unknown> = {}) {
  const tree = validateAnalysisTree(treeInput);
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(inputHeaders)) {
    if (/^[A-Za-z0-9_]+$/.test(key) && typeof value === "string" && value.trim()) headers[key] = value.trim();
  }
  const standardFen = new Chess().fen();
  const initialFen = tree.nodes[tree.rootId].fen;
  if (initialFen !== standardFen) {
    headers.SetUp = "1";
    headers.FEN = initialFen;
  } else {
    delete headers.SetUp;
    delete headers.FEN;
  }
  if (!RESULT_TOKENS.has(headers.Result)) headers.Result = "*";
  const preferredOrder = ["Event", "Site", "Date", "Round", "White", "Black", "Result", "SetUp", "FEN"];
  const orderedKeys = [...preferredOrder.filter((key) => headers[key]), ...Object.keys(headers).filter((key) => !preferredOrder.includes(key)).sort()];
  const headerText = orderedKeys.map((key) => `[${key} "${escapeHeader(headers[key])}"]`).join("\n");
  const rootComment = commentToken(tree.nodes[tree.rootId].comment);
  const movetext = [rootComment, ...exportContinuation(tree, tree.rootId, true), headers.Result].filter(Boolean).join(" ")
    .replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  return `${headerText}\n\n${movetext}\n`;
}
