import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';

type ReportLinkCardProps = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  background: string;
};

export default function ReportLinkCard({
  href,
  title,
  description,
  icon: Icon,
  color,
  background,
}: ReportLinkCardProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background }}
      >
        <Icon size={16} style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
          {description}
        </p>
      </div>
      <ChevronRight size={16} className="shrink-0" style={{ color: 'var(--muted)' }} />
    </Link>
  );
}
