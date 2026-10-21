import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "confetti-fall": {
          "0%": { transform: "translate3d(0,-10vh,0) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translate3d(var(--drift),105vh,0) rotate(720deg)", opacity: "0.9" },
        },
        float: {
          "0%,100%": { transform: "translateY(0) rotate(45deg)", opacity: "0.4" },
          "50%": { transform: "translateY(-14px) rotate(45deg)", opacity: "1" },
        },
        "fade-up": {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        wiggle: {
          "0%,90%,100%": { transform: "rotate(0deg)" },
          "93%": { transform: "rotate(-2deg)" },
          "96%": { transform: "rotate(2deg)" },
        },
        pop: {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "70%": { transform: "scale(1.04)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.96)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "confetti-fall": "confetti-fall 2.8s ease-in forwards",
        float: "float 4s ease-in-out infinite",
        "fade-up": "fade-up 600ms ease-out both",
        wiggle: "wiggle 4s ease-in-out infinite",
        pop: "pop 500ms ease-out both",
        "scale-in": "scale-in 450ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
