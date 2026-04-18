import type { ComponentPropsWithoutRef, ElementType, ReactNode, CSSProperties } from 'react';

type TileLayout = 'stacked' | 'inline';
type TileSize = 'sm' | 'md' | 'lg';
type TileSurface = 'surface' | 'subtle';
type TileAlign = 'left' | 'center';

type TileOwnProps = {
  title: ReactNode;
  value: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  footer?: ReactNode;
  layout?: TileLayout;
  size?: TileSize;
  surface?: TileSurface;
  align?: TileAlign;
  interactive?: boolean;
  inlineStackOnMobile?: boolean;
  className?: string;
  titleClassName?: string;
  valueClassName?: string;
  subtitleClassName?: string;
  footerClassName?: string;
  titleStyle?: CSSProperties;
  valueStyle?: CSSProperties;
  subtitleStyle?: CSSProperties;
};

type TileProps<T extends ElementType> = TileOwnProps &
  Omit<ComponentPropsWithoutRef<T>, keyof TileOwnProps | 'as'> & {
    as?: T;
  };

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const paddingBySize: Record<TileSize, string> = {
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

const valueByLayoutAndSize: Record<TileLayout, Record<TileSize, string>> = {
  stacked: {
    sm: 'text-[clamp(0.95rem,3.8vw,1.125rem)]',
    md: 'text-[clamp(1.125rem,4.4vw,1.5rem)]',
    lg: 'text-[clamp(1.75rem,7vw,3rem)]',
  },
  inline: {
    sm: 'text-[clamp(0.9rem,3.2vw,1rem)]',
    md: 'text-[clamp(0.95rem,3vw,1.125rem)]',
    lg: 'text-[clamp(1rem,3.4vw,1.25rem)]',
  },
};

export default function Tile<T extends ElementType = 'div'>({
  as,
  title,
  value,
  subtitle,
  leading,
  trailing,
  footer,
  layout = 'stacked',
  size = 'md',
  surface = 'surface',
  align = 'left',
  interactive = false,
  inlineStackOnMobile = true,
  className,
  titleClassName,
  valueClassName,
  subtitleClassName,
  footerClassName,
  titleStyle,
  valueStyle,
  subtitleStyle,
  ...props
}: TileProps<T>) {
  const Component = (as ?? 'div') as ElementType;
  const isInline = layout === 'inline';

  return (
    <Component
      className={cx(
        'min-w-0 rounded-xl border',
        paddingBySize[size],
        surface === 'surface' ? 'bg-[var(--surface)] border-[var(--border)]' : 'bg-[var(--surface-hover)] border-transparent',
        interactive && 'transition-colors hover:bg-[var(--surface-hover)] active:scale-[0.99]',
        className,
      )}
      {...props}
    >
      {isInline ? (
        <>
          <div className={cx(
            'flex min-h-full',
            inlineStackOnMobile ? 'flex-col gap-3 sm:flex-row sm:items-start sm:gap-4' : 'items-start gap-2.5 sm:gap-3',
          )}>
            {leading && <div className="shrink-0">{leading}</div>}

            <div className={cx('min-w-0 flex-1', inlineStackOnMobile ? '' : 'self-center')}>
              <p
                className={cx(
                  'text-xs font-medium tracking-[0.01em] text-[var(--muted)] [overflow-wrap:anywhere]',
                  titleClassName,
                )}
                style={titleStyle}
              >
                {title}
              </p>
              {subtitle && (
                <div
                  className={cx(
                    'mt-1 text-xs text-[var(--muted)] [overflow-wrap:anywhere]',
                    subtitleClassName,
                  )}
                  style={subtitleStyle}
                >
                  {subtitle}
                </div>
              )}
            </div>

            <div className={cx(
              'flex min-w-0 self-center',
              inlineStackOnMobile
                ? 'justify-between gap-2 sm:w-auto sm:justify-start sm:gap-3'
                : 'ml-auto gap-1.5 sm:gap-2',
            )}>
              <div className={cx(
                'min-w-0',
                inlineStackOnMobile ? 'flex-1 text-left sm:flex-none sm:text-right' : 'text-right',
              )}>
                <div
                  className={cx(
                    'font-semibold leading-tight tracking-tight text-[var(--foreground)] tabular-nums [overflow-wrap:anywhere]',
                    valueByLayoutAndSize.inline[size],
                    valueClassName,
                  )}
                  style={valueStyle}
                >
                  {value}
                </div>
              </div>
              {trailing && <div className="shrink-0">{trailing}</div>}
            </div>
          </div>

          {footer && (
            <div className={cx('mt-3 min-w-0', footerClassName)}>
              {footer}
            </div>
          )}
        </>
      ) : (
        <>
          {(leading || trailing) && (
            <div className="mb-3 flex items-start justify-between gap-3">
              {leading ? <div className="shrink-0">{leading}</div> : <div />}
              {trailing && <div className="shrink-0">{trailing}</div>}
            </div>
          )}

          <div className={cx('min-w-0', align === 'center' ? 'text-center' : 'text-left')}>
            <p
              className={cx(
                'text-xs font-medium tracking-[0.01em] text-[var(--muted)] [overflow-wrap:anywhere]',
                titleClassName,
              )}
              style={titleStyle}
            >
              {title}
            </p>

            <div
              className={cx(
                'mt-2 font-semibold leading-tight tracking-tight text-[var(--foreground)] tabular-nums [overflow-wrap:anywhere]',
                valueByLayoutAndSize.stacked[size],
                valueClassName,
              )}
              style={valueStyle}
            >
              {value}
            </div>

            {subtitle && (
              <div
                className={cx(
                  'mt-2 text-xs text-[var(--muted)] [overflow-wrap:anywhere]',
                  subtitleClassName,
                )}
                style={subtitleStyle}
              >
                {subtitle}
              </div>
            )}
          </div>

          {footer && (
            <div className={cx('mt-3 min-w-0', footerClassName)}>
              {footer}
            </div>
          )}
        </>
      )}
    </Component>
  );
}
