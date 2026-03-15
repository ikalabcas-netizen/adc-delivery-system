/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ADC Brand — Cyan palette extracted from logo
        adc: {
          50:  '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',  // cyan-light — highlight, hover
          400: '#22d3ee',
          500: '#06b6d4',  // cyan — primary actions
          600: '#0891b2',  // cyan-dark — sidebar, filled button
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',  // navy — sidebar bg, heading text
          950: '#0a3444',
        },
        // Status colors for orders
        status: {
          pending:    '#d97706',  // amber-600
          assigned:   '#2563eb',  // blue-600
          in_transit: '#7c3aed',  // violet-600
          delivered:  '#16a34a',  // green-600
          failed:     '#dc2626',  // red-600
          cancelled:  '#6b7280',  // gray-500
        },
        // Surface / neutral
        surface: {
          page:   '#f8fafc',  // slate-50
          card:   '#ffffff',
          border: '#e2e8f0',  // slate-200
        },
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%':   { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in':        'fade-in 200ms cubic-bezier(0.4,0,0.2,1)',
        'slide-in-right': 'slide-in-right 300ms cubic-bezier(0.4,0,0.2,1)',
        'slide-up':       'slide-up 300ms cubic-bezier(0.4,0,0.2,1)',
      },
    },
  },
  plugins: [],
}

