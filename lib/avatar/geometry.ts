export const AVATAR_CANVAS_WIDTH = 1024;
export const AVATAR_CANVAS_HEIGHT = 1024;
export const AVATAR_LOGICAL_WIDTH = 160;
export const AVATAR_LOGICAL_HEIGHT = 160;
export const AVATAR_LOGICAL_SCALE = AVATAR_CANVAS_WIDTH / AVATAR_LOGICAL_WIDTH;
export const AVATAR_ASPECT_RATIO = "1 / 1";

/**
 * Canonical production coordinates, in pixels on the 1024 x 1024 asset canvas.
 * The built-in SVG artwork uses the equivalent 160 x 160 logical coordinate grid.
 */
export const avatarGeometry = {
  canvasCenter: { x: 512, y: 512 },
  head: {
    center: { x: 512, y: 460.8 },
    radius: 275.2,
    bounds: { left: 236.8, top: 185.6, right: 787.2, bottom: 736 }
  },
  headIncludingEarsBounds: { left: 179.2, top: 185.6, right: 844.8, bottom: 736 },
  eyes: {
    lineY: 448,
    leftWhiteCenter: { x: 409.6, y: 448 },
    rightWhiteCenter: { x: 614.4, y: 448 },
    whiteRadius: { x: 51.2, y: 44.8 },
    leftPupilCenter: { x: 416, y: 454.4 },
    rightPupilCenter: { x: 608, y: 454.4 },
    pupilRadius: 25.6
  },
  mouth: {
    start: { x: 428.8, y: 582.4 },
    control: { x: 512, y: 672 },
    end: { x: 601.6, y: 582.4 },
    visualBottom: { x: 513.6, y: 627.2 }
  },
  chin: { x: 512, y: 736 },
  neckBounds: { left: 428.8, top: 646.4, right: 595.2, bottom: 819.2 },
  shoulders: {
    lineY: 844.8,
    leftOuter: { x: 198.4, y: 844.8 },
    rightOuter: { x: 825.6, y: 844.8 },
    leftInner: { x: 428.8, y: 684.8 },
    rightInner: { x: 595.2, y: 684.8 }
  },
  torsoBounds: { left: 198.4, top: 684.8, right: 825.6, bottom: 1024 },
  cornerClipRadius: 51.2
} as const;
