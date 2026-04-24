/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        akyra: {
          black: "#000000",
          red: "#E63946",
          white: "#FFFFFF",
          secondary: "#666666",
          surface: "#0A0A0A",
          border: "#1A1A1A",
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["SF Mono", "Fira Code", "monospace"],
      },
      animation: {
        "breathe": "breathe 4s ease-in-out infinite",
        "pulse-red": "pulse-red 2s infinite",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { opacity: "0.3", transform: "scale(0.98)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-red": {
          "0%": { boxShadow: "0 0 0 0 rgba(230, 57, 70, 0.7)" },
          "70%": { boxShadow: "0 0 0 10px rgba(230, 57, 70, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(230, 57, 70, 0)" },
        }
      }
    },
  },
  plugins: [],
}
