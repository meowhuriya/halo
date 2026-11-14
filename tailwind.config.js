/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyan: {
          50:  "#EFF6FB",
          100: "#DCE9F5",
          200: "#B9D4EC",
          300: "#8FBCE2",
          400: "#73B3E7",
          500: "#4A8FD1",
          600: "#2E6FB2",
          700: "#205493",
          800: "#163E6E",
          900: "#112E52",
          950: "#0B1F3A",
        },
        halo: {
          bg: "#0B1628",
          surface: "#12213A",
          card: "rgba(255, 255, 255, 0.05)",
          border: "rgba(255, 255, 255, 0.14)",
          borderFocus: "rgba(115, 179, 231, 0.55)",
          cyan: "#73B3E7",
          cyanGlow: "rgba(115, 179, 231, 0.14)",
          nominal: "#22C55E",
          watch: "#F59E0B",
          alert: "#F97316",
          critical: "#EF4444",
        }
      },
      fontFamily: {
        sans: ['"Public Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'Consolas', 'ui-monospace', 'monospace'],
      },
      minHeight: {
        tap: "56px",
      },
      minWidth: {
        tap: "56px",
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'cyan-glow': '0 0 18px -6px rgba(115, 179, 231, 0.35)',
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
