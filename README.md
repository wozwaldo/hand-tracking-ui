# hand-tracking-ui

Make a fist to crumple a video. Webcam → MediaPipe hand landmarks → a 0–1 "fist score" → the score scrubs a video's `currentTime`.

Everything runs in the browser. No backend, no frames leave the machine.

## Stack

- React 19 + TypeScript + Vite
- `@mediapipe/tasks-vision` (HandLandmarker, WASM, loaded from CDN)
- Canvas 2D for the landmark overlay

## Run

```sh
pnpm install
pnpm dev      # http://localhost:5173, needs camera permission
pnpm build    # tsc -b && vite build → dist/
```

## Structure

```
src/
  App.tsx                     mounts CrumpleHero
  components/
    CrumpleHero.tsx           page layout, copy, "awaiting cam" state
    HandCrumple.tsx           the whole pipeline (camera, landmarker, score, scrub)
public/videos/crumple-scrub.mp4   the video that gets scrubbed
```

`CrumpleHero` treats `HandCrumple` as a black box; it only listens to the webcam `<video>`'s `playing` event to flip the UI from "awaiting cam" to live.

## How it works

All of this lives in `HandCrumple.tsx`, inside one `useEffect`.

### 1. Setup (once)

1. `getUserMedia({ video: true })` → webcam stream into the `.hc-cam` `<video>`.
2. `HandLandmarker.createFromOptions(...)` with `runningMode: "VIDEO"`, `numHands: 1`. WASM + model are fetched from CDN.
3. Grab the canvas 2D context once; it's reused every frame.

### 2. Per frame (`requestAnimationFrame` loop)

1. `landmarker.detectForVideo(video, performance.now())` → up to 21 normalized landmarks (`x, y ∈ [0, 1]`).
2. Draw the skeleton (`HAND_CONNECTIONS`) and points on the canvas. `x` is mirrored (`1 - x`) so the overlay matches the mirrored webcam feel.
3. Compute the fist score (below), smooth it, print it on the canvas.
4. `crumpleVideo.currentTime = smoothedScore * crumpleVideo.duration`.

### 3. Fist score

The idea: an open hand has fingertips far from the palm; a fist has them close. Measure that distance, normalize it so hand size / distance to camera doesn't matter, then map it to `[0, 1]`.

```ts
const palm = points[9];                                     // middle-finger MCP, roughly palm center
const tips = [points[8], points[12], points[16], points[20]]; // index, middle, ring, pinky tips

const avg = mean(tips.map(t => dist(t, palm)));             // how extended the fingers are
const ref = dist(points[0], palm);                          // wrist → palm, used as the scale unit
const ratio = avg / ref;                                    // scale-invariant

const score = (OPEN_RATIO - ratio) / (OPEN_RATIO - FIST_RATIO);
return clamp(score, 0, 1);
```

- `OPEN_RATIO = 0.87` — measured `ratio` for a fully open hand → score 0
- `FIST_RATIO = 0.28` — measured `ratio` for a closed fist → score 1
- Anything in between is linear; the clamp guards against outliers.

The thumb is ignored on purpose: it moves independently of the other fingers and adds noise.

Dividing by wrist→palm distance is what makes the metric work at any distance from the camera. Both numbers scale the same way, so the ratio stays put.

### 4. Smoothing

Raw per-frame scores jitter. An exponential moving average with `SMOOTHING = 0.2` damps it:

```ts
smoothed += (score - smoothed) * SMOOTHING;
```

Lower = smoother but laggier. 0.2 was a good tradeoff at ~30 fps.

### 5. Scrubbing the video

Setting `currentTime` on every frame is only smooth if the browser can seek instantly. The crumple video is encoded with every frame as a keyframe (all-intra), so a seek never has to decode from a previous keyframe. With a normally encoded video this would stutter badly.

## Tuning

- Hand not registering as fully open / closed? Print `ratio` instead of `score` and re-measure `OPEN_RATIO` / `FIST_RATIO` for your hand.
- Too twitchy or too laggy? Adjust `SMOOTHING`.
- Swap `public/videos/crumple-scrub.mp4` for any all-keyframe video to drive something else.
