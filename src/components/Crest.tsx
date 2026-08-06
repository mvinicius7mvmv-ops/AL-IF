import { cn } from '@/lib/utils';

interface CrestProps {
  size?: number;
  className?: string;
}

export function Crest({ size = 40, className }: CrestProps) {
  return (
    <img
      src="/assets/images/al-if-crest-transparent.png"
      alt="Escudo AL-IF FC"
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', className)}
      style={{
        width: size,
        height: size,
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
      }}
    />
  );
}
