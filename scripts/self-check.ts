import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { FRAME_HEIGHT, FRAME_WIDTH, FRAMES, coverScale, isFrameId } from "../lib/frames";

assert.equal(coverScale(2000, 1000, 1080, 1350), 1.35);
assert.equal(coverScale(1000, 3000, 1080, 1350), 1.08);
assert.equal(isFrameId("classic"), true);
assert.equal(isFrameId("../classic"), false);

for (const frame of FRAMES) {
  const file = `public${frame.src}`;
  assert.ok(existsSync(file), `${file} missing`);
  const svg = readFileSync(file, "utf8");
  assert.match(svg, new RegExp(`width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}"`), `${file} needs explicit size`);
  assert.doesNotMatch(svg, /foreignObject|href=/, `${file} would taint or fail on canvas`);
}

console.log("self-check passed");
