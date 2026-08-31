# Adventure scene artwork

Scene artwork lives in this directory and is referenced from `adventure/content.ts` with a public path such as:

```ts
backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp"
```

Author scene art at **16:9** when possible. The scene component uses `object-fit: contain`; if an asset has another aspect ratio, its hotspot coordinate layer is automatically inset to the actual displayed pixels so percentage coordinates still align with the art rather than the letterbox bars.

Hotspot `x`, `y`, `width`, and `height` values are percentages of the artwork. In development, open `/student/adventure?scenePreview=1`, use **Story Debug** to jump to a scene, then choose **Edit hotspots**. Move over the art to inspect percentages or drag a rectangle and copy/log its coordinates.

`pawnhaven-arrival.webp` is the active generated scene and is shared by the arrival and Marge exterior story beats. It is a full Scene 1 redesign with three separated interaction targets: Marge on the left, the physically anchored Black King banner overhead, and the family home in the right mid-distance. The production WebP is 309,566 bytes at 1672 × 941, about 87% smaller than the previous active PNG. Versions 1–3 and the SVG with the matching base name remain as comparison and lightweight placeholder/reference assets. The other current SVGs are placeholders and can be replaced progressively without changing the scene controller.

A missing or failed image automatically shows a styled scene fallback while preserving dialogue, avatar rendering, and hotspot actions. The development-only **Test fallback** control exercises that state.
