import type { Config } from "tailwindcss";

/**
 * Zewin design tokens.
 * One strong accent (Zewin teal) on a white / light-gray canvas.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf8",
          100: "#d0f7eb",
          200: "#a4eed9",
          300: "#6ddec3",
          400: "#35c5a7",
          500: "#14a98d",
          600: "#0a8873",
          700: "#0b6d5e",
          800: "#0d574c",
          900: "#0e4840",
          950: "#022925",
        },
        ink: {
          DEFAULT: "#0f1a1f",
          soft: "#3b4a52",
          muted: "#6b7a82",
          faint: "#9aa7ae",
        },
        line: {
          DEFAULT: "#e4e9ec",
          strong: "#cfd8dd",
        },
        canvas: "#f5f7f8",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        field: "10px",
        card: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,26,31,0.04), 0 1px 3px rgba(15,26,31,0.06)",
        pop: "0 10px 30px -10px rgba(15,26,31,0.25), 0 4px 10px -6px rgba(15,26,31,0.12)",
        focus: "0 0 0 4px rgba(20,169,141,0.18)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": {
          from: { opacity: "0", transform: "translateY(6px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "slide-in": { from: { transform: "translateX(var(--drawer-from, -100%))" }, to: { transform: "translateX(0)" } },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "pop-in": "pop-in 180ms cubic-bezier(.2,.8,.2,1)",
        "slide-in": "slide-in 220ms cubic-bezier(.2,.8,.2,1)",
        "toast-in": "toast-in 200ms ease-out",
        shimmer: "shimmer 1.4s infinite",
      },
    },
  },
  plugins: [],
};
export default config;
