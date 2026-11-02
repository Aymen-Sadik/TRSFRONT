import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B1F2A',
        'ink-light': '#12313F',
        teal: {
          DEFAULT: '#0F8B8D',
          bright: '#14A6A8',
        },
        paper: '#F7F5F1',
        slate: {
          DEFAULT: '#3D4852',
          muted: '#7C8A94',
        },
        amber: '#E8A33D',
        success: '#2FA36B',
        danger: '#D9534F',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.4)' },
        },
      },
      animation: {
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config