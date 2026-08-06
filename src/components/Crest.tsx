import { cn } from '@/lib/utils';

interface CrestProps {
  size?: number;
  className?: string;
}

export function Crest({ size = 40, className }: CrestProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      style={{ width: size, height: size, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
    >
      {/* Shield outline */}
      <path
        d="M50 2 L92 14 V50 C92 75 72 92 50 98 C28 92 8 75 8 50 V14 L50 2 Z"
        fill="rgb(24 24 24)"
        stroke="rgb(220 38 38)"
        strokeWidth="3"
      />
      {/* Inner shield */}
      <path
        d="M50 8 L86 18 V49 C86 70 69 85 50 90 C31 85 14 70 14 49 V18 L50 8 Z"
        fill="rgb(32 32 32)"
        stroke="rgb(220 38 38)"
        strokeWidth="1"
        strokeOpacity="0.3"
      />
      {/* Diagonal red stripe */}
      <path d="M14 35 L86 62 V70 L14 43 Z" fill="rgb(220 38 38)" fillOpacity="0.15" />
      {/* "AL" text */}
      <text
        x="50"
        y="42"
        textAnchor="middle"
        fill="rgb(220 38 38)"
        fontSize="22"
        fontWeight="900"
        fontFamily="Inter, sans-serif"
        letterSpacing="-1"
      >
        AL
      </text>
      {/* "IF" text */}
      <text
        x="50"
        y="66"
        textAnchor="middle"
        fill="rgb(229 229 229)"
        fontSize="18"
        fontWeight="800"
        fontFamily="Inter, sans-serif"
        letterSpacing="-0.5"
      >
        IF
      </text>
      {/* Bottom decorative line */}
      <line x1="25" y1="74" x2="75" y2="74" stroke="rgb(220 38 38)" strokeWidth="1.5" strokeOpacity="0.4" />
      <circle cx="50" cy="80" r="2" fill="rgb(220 38 38)" fillOpacity="0.6" />
    </svg>
  );
}
