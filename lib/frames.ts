export const FRAME_WIDTH = 1080;
export const FRAME_HEIGHT = 1440;

export const FRAMES = [
  // { id: "classic", name: "Classic", src: "/frames/classic.svg" },
  // { id: "polaroid", name: "Polaroid", src: "/frames/polaroid.svg" },
  // { id: "party", name: "Party", src: "/frames/party.svg" },
  { id: "party-1", name: "Lesgow🎉", src: "/frames/Colorful Let’s Party Photo Frame (1).webp" },
  { id: "party-2", name: "Partieh🥳", src: "/frames/Kawaii Let’s Party Photo Frame (1).webp" },
  { id: "nature", name: "Alam🍃", src: "/frames/Good Vibes Nature Frame (1).webp" },
  { id: "sport", name: "Sipaling sehat💪", src: "/frames/Vibrant Sports Collage Frame.webp" },
  { id: "japan", name: "Nihonjin desuka?🇯🇵", src: "/frames/Japanese Festival Sakura Frame.webp" },
  { id: "console", name: "Console👾", src: "/frames/Neon Terminal Party Frame.webp" },
  { id: "pemecut", name: "Pengendali eiay🤖", src: "/frames/Frame 5.png" },
] as const;

export function isFrameId(value: string): value is (typeof FRAMES)[number]["id"] {
  return FRAMES.some((frame) => frame.id === value);
}

export function coverScale(imageWidth: number, imageHeight: number, boxWidth: number, boxHeight: number) {
  return Math.max(boxWidth / imageWidth, boxHeight / imageHeight);
}
