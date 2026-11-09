/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        halo: {
          bg: "#05070D",
          surface: "#0B111E",
          card: "rgba(255, 255, 255, 0.04)",
          border: "rgba(255, 255, 255, 0.10)",
          borderFocus: "rgba(56, 225, 255, 0.40)",
          cyan: "#38E1FF",
          cyanGlow: "rgba(56, 225, 255, 0.15)",
          nominal: "#22C55E",
          watch: "#F59E0B",
          alert: "#F97316",
          critical: "#EF4444",
        }
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      minHeight: {
        tap: "56px",
      },
      minWidth: {
        tap: "56px",
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'cyan-glow': '0 0 25px -5px rgba(56, 225, 255, 0.3)',
        'critical-glow': '0 0 30px -4px rgba(239, 68, 68, 0.5)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
