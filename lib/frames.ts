export const FRAME_WIDTH = 1080;
export const FRAME_HEIGHT = 1440;

export const FRAMES = [
  // { id: "classic", name: "Classic", src: "/frames/classic.svg" },
  // { id: "polaroid", name: "Polaroid", src: "/frames/polaroid.svg" },
  // { id: "party", name: "Party", src: "/frames/party.svg" },
  { id: "party", name: "Let's Party", src: "/frames/Frame 1.png" },
  { id: "elegant", name: "Ready!", src: "/frames/Frame 2.png" },
  { id: "retro", name: "Retro", src: "/frames/Frame 3.png" },
] as const;

export function isFrameId(value: string): value is (typeof FRAMES)[number]["id"] {
  return FRAMES.some((frame) => frame.id === value);
}

export function coverScale(imageWidth: number, imageHeight: number, boxWidth: number, boxHeight: number) {
  return Math.max(boxWidth / imageWidth, boxHeight / imageHeight);
}
