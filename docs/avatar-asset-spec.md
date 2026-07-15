# Avatar asset alignment standard

This document describes the fixed production coordinate system enforced by `AvatarRenderer`.

## Canonical canvas

- Production asset size: **1024 × 1024 pixels**
- Aspect ratio: **1:1**
- Internal built-in SVG grid: **160 × 160 logical units**
- Conversion: **1 logical unit = 6.4 production pixels**
- Origin: **(0, 0) at the top-left**
- Positive X: right
- Positive Y: down
- Canvas center: **(512, 512)**

Every uploaded layer must be a complete 1024 × 1024 canvas. Do not crop or trim an accessory to its visible bounds. Pixels outside the item remain transparent so the item retains its absolute position.

## Renderer CSS

The avatar wrapper is `position: relative`, square, `overflow: hidden`, with `border-radius: 5%`, a dark background, and an inset ring. The ring does not reduce the layer viewport. Each image layer uses:

```css
position: absolute;
inset: 0;
display: block;
width: 100%;
height: 100%;
object-fit: fill;
object-position: center;
```

There is no transform and the effective scale is 1 before the wrapper's uniform resize. Assets are not passed through Next Image and are not automatically cropped or optimized. A non-square source would be stretched, so the 1024 × 1024 requirement is mandatory.

## Exact geometry

All coordinates below are production pixels on the 1024 × 1024 canvas.

| Landmark | Coordinate or bounds |
| --- | --- |
| Canvas center | (512, 512) |
| Head center | (512, 460.8) |
| Head radius | 275.2 |
| Head bounds | L 236.8, T 185.6, R 787.2, B 736 |
| Head plus ears | L 179.2, T 185.6, R 844.8, B 736 |
| Eye line | Y 448 |
| Left eye white center | (409.6, 448) |
| Right eye white center | (614.4, 448) |
| Eye white radii | RX 51.2, RY 44.8 |
| Left pupil center | (416, 454.4) |
| Right pupil center | (608, 454.4) |
| Pupil radius | 25.6 |
| Left eyebrow path | Start (352, 371.2), quadratic control (416, 332.8), end (473.6, 371.2) |
| Right eyebrow path | Start (550.4, 371.2), quadratic control (614.4, 332.8), end (672, 371.2) |
| Mouth path | Start (428.8, 582.4), quadratic control (512, 672), end (601.6, 582.4) |
| Mouth curve visual bottom | (513.6, 627.2) |
| Chin | (512, 736) |
| Neck bounds | L 428.8, T 646.4, R 595.2, B 819.2 |
| Torso bounds | L 198.4, T 684.8, R 825.6, B 1024 |
| Inner shoulder points | (428.8, 684.8), (595.2, 684.8) |
| Outer shoulder line | Y 844.8; X 198.4 to 825.6 |

The mouth's visual bottom is calculated from the quadratic curve; the SVG control point is not itself on the curve.

## Layer order

| Category | Standard order |
| --- | ---: |
| Background | 0 |
| Aura or effect | 5 |
| Base face | 10 |
| Skin tone | 12 |
| Eyes | 20 |
| Eyebrows | 22 |
| Mouth | 24 |
| Hair | 30 |
| Facial hair | 32 |
| Clothing | 40 |
| Headwear | 50 |
| Glasses | 55 |
| Chess accessory | 60 |

An individual item may intentionally override its category order. The current Queen's Cape uses 41. A temporary studio preview is rendered at its category order plus 0.5.

## Rendered sizes and responsive behavior

| Renderer size | Maximum CSS size | Source-to-CSS scale |
| --- | ---: | ---: |
| `sm` | 48 × 48 px | 0.046875 |
| `md` | 80 × 80 px | 0.078125 |
| `lg` | 160 × 160 px | 0.15625 |
| `studio` | 288 × 288 px | 0.28125 |

`sm`, `md`, and `lg` remain fixed at all breakpoints. `studio` is 288 × 288 unless its parent content area is narrower, in which case `max-width: 100%` reduces both dimensions equally. The Avatar Studio changes from one column to a 320 px preview column at Tailwind's `xl` breakpoint (1280 px); inside that card, padding can constrain the preview to about 278 px. The dashboard uses a 320 px preview column from `lg` (1024 px), where the preview remains 288 px. Armory cards use `lg`; leaderboard avatars use `sm`. Tablet and mobile change page/card layout, not the avatar coordinate system. Device pixel ratio changes physical sampling only.

## Transparency and safe zones

- Keep the full canvas; unused pixels must have alpha 0.
- No uniform padding value is added by the renderer. Transparent padding is whatever space lies between the item and the 1024 px canvas edges.
- Everything outside the canvas is clipped.
- The wrapper clips the four corners with a 51.2 px radius. Avoid critical art in those corner arcs unless it is a full background/effect intended to be clipped.
- Face-critical art should align to the landmarks above. The current glasses geometry occupies X 320–704 and Y 390.4–512 before stroke. With its stroke, the visible bounds are approximately X 307.2–716.8 and Y 377.6–524.8.
- Background and aura layers may fill the entire canvas. Other categories should normally remain transparent outside their target region.

## PNG export settings

- PNG-24/PNG-32 with RGBA, 8 bits per channel
- Exactly 1024 × 1024 px, 1:1
- sRGB color space
- Transparent background with no matte
- Lossless compression
- Do not trim transparent pixels
- Do not resample after alignment
- Avoid indexed-color export for semi-transparent antialiased edges
- Use lowercase kebab-case filenames, for example `bishop-glasses-gold.png`

## Reference files

The alignment kit contains a master face/body template, a transparent coordinate overlay, a transparent sample glasses layer, and a complete layered preview. All four use the exact 1024 × 1024 production canvas.
