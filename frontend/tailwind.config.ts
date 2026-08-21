import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f1013",
        surface: "#16171c",
        "surface-card": "#1c1e24",
        "surface-border": "#282a33",
        pink: {
          DEFAULT: "#FF007F",
          50: "#FFF0F6",
          100: "#FFD6E7",
          200: "#FFADD2",
          300: "#FF7AB6",
          400: "#FF479A",
          500: "#FF007F",
          600: "#E60072",
          700: "#BF005F",
          800: "#99004C",
          900: "#730039",
          glow: "#FF007F40",
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'pink-glow': '0 0 25px rgba(255, 0, 127, 0.45)',
        'pink-glow-sm': '0 0 12px rgba(255, 0, 127, 0.3)',
        'pink-glow-lg': '0 0 45px rgba(255, 0, 127, 0.65)',
        'amber-glow': '0 0 20px rgba(255, 184, 0, 0.4)',
        'cyan-glow': '0 0 20px rgba(0, 240, 255, 0.4)',
        'danger-glow': '0 0 25px rgba(255, 42, 85, 0.5)',
      },
      animation: {
        'radar-sweep': 'sweep 4s linear infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'strobe-fast': 'strobe 0.8s ease-in-out infinite',
      },
      keyframes: {
        sweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.8', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.03)' },
        },
        strobe: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
