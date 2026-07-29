import { cn } from '@/lib/utils';

interface CrestProps {
  size?: number;
  className?: string;
}

export function Crest({ size = 40, className }: CrestProps) {
  return (
    <img
      src="/assets/images/1000338901.jpg"
      alt="Escudo AL-IF FC"
      width={size}
      height={size}
      className={cn('object-contain rounded-md', className)}
      style={{ width: size, height: size }}
    />
  );
}
