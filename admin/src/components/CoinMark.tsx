import { cn } from '../lib/cn';

/** Gold-rimmed rupee coin — the "Cash Raja" mark. */
export function CoinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden="true">
      <defs>
        <linearGradient id="coin-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F5C518" />
          <stop offset="1" stopColor="#B8860B" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="#1E1B4B" />
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="url(#coin-gold)" strokeWidth="2.5" />
      <text
        x="16"
        y="21.5"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontSize="15"
        fontWeight="bold"
        fill="url(#coin-gold)"
      >
        ₹
      </text>
    </svg>
  );
}
