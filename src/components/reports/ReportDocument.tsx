import { forwardRef, type ReactNode } from 'react';

type ReportDocumentProps = {
  title: string;
  subtitle?: string;
  reportDate?: string;
  children: ReactNode;
  className?: string;
};

function defaultReportDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const ReportDocument = forwardRef<HTMLDivElement, ReportDocumentProps>(function ReportDocument({
  title,
  subtitle,
  reportDate,
  children,
  className,
}, ref) {
  return (
    <div ref={ref} className={cx('space-y-3 print:space-y-2.5', className)}>
      <div
        className="hidden rounded-2xl border px-4 py-3.5 print:block"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {subtitle}
            </p>
          ) : null}
          <p className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
            Report date: {reportDate ?? defaultReportDate()}
          </p>
        </div>
      </div>

      {(subtitle || reportDate) && (
        <div
          className="rounded-xl border px-3 py-2 print:border-black/20"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
            {subtitle ? (
              <p style={{ color: 'var(--muted)' }}>{subtitle}</p>
            ) : (
              <div />
            )}
            <p className="tabular-nums" style={{ color: 'var(--muted)' }}>
              Report date: {reportDate ?? defaultReportDate()}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3 print:space-y-2.5">
        {children}
      </div>
    </div>
  );
});

export default ReportDocument;
