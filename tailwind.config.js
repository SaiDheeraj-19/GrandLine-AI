/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-color)',
        surface: 'var(--surface-color)',
        'on-surface': 'var(--on-surface)',
        primary: 'var(--primary)',
        'on-primary': 'var(--on-primary)',
        "on-tertiary": "#68000a",
        "inverse-on-surface": "#2c303c",
        "on-secondary-container": "#00344e",
        "on-primary-container": "#765900",
        "on-secondary-fixed": "#001e2f",
        "on-tertiary-fixed": "#410004",
        "tertiary-fixed": "#ffdad7",
        "surface-container-lowest": "var(--bg-color)",
        "primary-fixed-dim": "#edc157",
        "surface-container-highest": "#313441",
        "on-primary-fixed": "#251a00",
        "primary-container": "var(--primary)",
        "outline-variant": "#4e4636",
        "surface-container": "var(--surface-color)",
        "inverse-primary": "#785a00",
        "on-secondary": "#00344d",
        "primary-fixed": "#ffdf9b",
        "tertiary-fixed-dim": "#ffb3ad",
        "secondary-fixed-dim": "#89ceff",
        "error-container": "#93000a",
        "secondary-fixed": "#c9e6ff",
        "secondary": "#89ceff",
        "secondary-container": "#00a2e6",
        "on-tertiary-fixed-variant": "#930013",
        "surface-container-low": "var(--surface-color)",
        "inverse-surface": "#dfe2f2",
        "on-tertiary-container": "#b81923",
        "on-error": "#690005",
        "tertiary": "#fff0ef",
        "surface-dim": "var(--bg-color)",
        "on-surface-variant": "#d1c5b1",
        "tertiary-container": "#ffcbc7",
        "surface-tint": "#edc157",
        "on-error-container": "#ffdad6",
        "error": "#ffb4ab",
        "on-background": "var(--on-surface)",
        "outline": "#9a8f7d",
        "surface-variant": "#313441",
        "on-secondary-fixed-variant": "#004c6e",
        "surface-container-high": "var(--surface-color)",
        "surface-bright": "#353945",
        "on-primary-fixed-variant": "#5b4300"
      },
      borderRadius: {
        "DEFAULT": "0rem",
        "lg": "0rem",
        "xl": "0rem",
        "full": "9999px"
      },
      fontFamily: {
        "headline": ["Space Grotesk", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "label": ["Manrope", "sans-serif"]
      },
      keyframes: {
        'scan-up': {
          '0%': { top: '100%' },
          '100%': { top: '0%' }
        }
      },
      animation: {
        'scan-up': 'scan-up 10s linear infinite'
      }
    },
  },
  plugins: [],
};
