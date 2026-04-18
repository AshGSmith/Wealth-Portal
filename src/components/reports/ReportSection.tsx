import type { ReactNode } from 'react';

type ReportSectionProps = {
  title: string;
  children: ReactNode;
};

export default function ReportSection({ title, children }: ReportSectionProps) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
