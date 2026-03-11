// client/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nju: {
          purple: '#5B2D8E',
          'purple-light': '#7B4DB8',
          'purple-dark': '#3D1F66',
          gold: '#D4AF37',
        },
        cell: {
          corner: {
            start: '#4CAF50',
            hospital: '#F44336',
            ding: '#FFC107',
            waiting: '#2196F3',
          },
          event: '#FF9800',
          chance: '#9C27B0',
        },
        resource: {
          money: '#FFD700',
          gpa: '#4CAF50',
          exploration: '#FF5722',
        },
      },
      fontFamily: {
        display: ['"Noto Sans SC"', 'sans-serif'],
        body: ['"Noto Sans SC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'dice-roll': 'diceRoll 1.5s ease-out',
        'piece-move': 'pieceMove 0.3s ease-out',
        'card-flip': 'cardFlip 0.6s ease-out',
        'float-text': 'floatText 1.5s ease-out forwards',
      },
      keyframes: {
        diceRoll: {
          '0%': { transform: 'rotateX(0deg) rotateY(0deg)' },
          '100%': { transform: 'rotateX(720deg) rotateY(720deg)' },
        },
        pieceMove: {
          '0%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
          '100%': { transform: 'translateY(0)' },
        },
        cardFlip: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(180deg)' },
        },
        floatText: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-60px)' },
        },
      },
    },
  },
  plugins: [],
}
