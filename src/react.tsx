import { useEffect, useRef } from 'react';
import { renderHashvatar, HashvatarOptions } from './index';

export interface HashvatarProps extends HashvatarOptions {
  /** CSS class on the <canvas> element */
  className?: string;
  /** Inline style */
  style?: React.CSSProperties;
}

/**
 * React component wrapper for hashvatar.
 *
 * @example
 * <Hashvatar hash="vitalik.eth" size={48} mode="dither" />
 * <Hashvatar hash="0xABC..." size={64} tones={['hotpink']} animated />
 */
export function Hashvatar({ className, style, ...options }: HashvatarProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const destroy = renderHashvatar(ref.current, options);
    return destroy;
  // Re-render whenever any option changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    options.hash,
    options.size,
    options.mode,
    options.animated,
    options.dotScale,
    JSON.stringify(options.tones),
  ]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ borderRadius: '50%', display: 'block', ...style }}
    />
  );
}
