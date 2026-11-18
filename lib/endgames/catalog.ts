export type EndgameTopic = {
  id: string;
  title: string;
  group: "Common endgames" | "Convert the win";
  level: "Foundation" | "Developing" | "Challenge";
  plan: string;
  watchFor: string;
};

// These are skills, not a pool of positions. Each attempt is procedurally generated.
export const ENDGAME_TOPICS: readonly EndgameTopic[] = [
  { id: "queen-mate", title: "King & queen checkmate", group: "Common endgames", level: "Foundation", plan: "Use your queen to shrink the king's space. Bring your king closer, then deliver mate at the edge.", watchFor: "Leave the king a legal move until you are ready to checkmate. A trapped king that is not in check is stalemate." },
  { id: "rook-mate", title: "King & rook checkmate", group: "Common endgames", level: "Developing", plan: "Cut off the king with your rook. Use your own king to help drive it to the edge.", watchFor: "Keep the rook out of the enemy king's reach. Your king must help with the final mate." },
  { id: "ladder-mate", title: "The two-rook ladder", group: "Common endgames", level: "Foundation", plan: "One rook cuts off a rank while the other gives check. Swap their jobs to push the king back.", watchFor: "If the king approaches a rook, move that rook safely to the far side before continuing." },
  { id: "bishop-pair", title: "Two bishops work together", group: "Common endgames", level: "Challenge", plan: "Cover both colors with your bishops. Bring your king forward and herd the defender toward a corner.", watchFor: "Bishops cannot finish this alone. Use your king to take away escape squares." },
  { id: "king-and-pawn", title: "King before pawn", group: "Common endgames", level: "Developing", plan: "Lead with your king. Occupy the key squares in front of your pawn and use opposition to win space.", watchFor: "Pushing the pawn too soon can let the enemy king block it. After promotion, finish with checkmate." },
  { id: "outside-passer", title: "The outside passed pawn", group: "Common endgames", level: "Developing", plan: "Your outside passed pawn is far from the kings. Use its promotion threat to distract the defender and invade with your king.", watchFor: "Watch both sides of the board. Do not let the enemy pawns race through while you chase material." },
  { id: "rook-escort", title: "Escort a passed pawn", group: "Common endgames", level: "Developing", plan: "Your rook supports the pawn from behind. Turn the advanced pawn into a queen, then convert your advantage.", watchFor: "The defending rook can still give checks. Keep the new queen safe and look for a useful exchange." },
  { id: "connected-passers", title: "Connected passed pawns", group: "Common endgames", level: "Developing", plan: "Your neighboring passed pawns support one another. Calculate which pawn to advance, then promote and checkmate.", watchFor: "The defender may attack a pawn as you advance. Check pawn captures before every push." },
  { id: "extra-queen", title: "A whole queen ahead", group: "Convert the win", level: "Foundation", plan: "You have an extra queen. Coordinate queen and rook, look for safe exchanges, and build a mating attack.", watchFor: "Winning material is not the finish line. Protect your king from back-rank checks and keep your queen safe." },
  { id: "extra-rook", title: "Turn an extra rook into a win", group: "Convert the win", level: "Developing", plan: "Activate your rook, restrict the enemy king, and bring your own king into the endgame.", watchFor: "Avoid trading away all your pawns without a plan. Keep checking whether the enemy king can attack your rook." },
  { id: "extra-bishop", title: "An extra bishop and a passer", group: "Convert the win", level: "Developing", plan: "Use your bishop and king to support the outside passed pawn. Promote it, then finish the game.", watchFor: "A bishop alone cannot mate. Keep at least one pawn safe so it can become your winning queen." },
  { id: "black-queen", title: "Convert with Black", group: "Convert the win", level: "Challenge", plan: "You are Black, with a queen against a rook. Use checks and double attacks to improve your position.", watchFor: "Do not rush into a rook fork or back-rank mate. Your advantage still needs careful calculation." },
];
