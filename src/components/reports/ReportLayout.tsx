'use client';

import { useRef } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import ReportDocument from '@/components/reports/ReportDocument';
import ReportDownloadButton from '@/components/reports/ReportDownloadButton';
import { downloadReportNodeAsPdf } from '@/components/reports/reportExport';
import type { ReactNode } from 'react';

type ReportLayoutProps = {
  title: string;
  subtitle?: string;
  reportDate?: string;
  backHref?: string;
  children: ReactNode;
};

export default function ReportLayout({
  title,
  subtitle,
  reportDate,
  backHref = '/reports',
  children,
}: ReportLayoutProps) {
  const reportRef = useRef<HTMLDivElement | null>(null);

  async function handleDownloadPdf() {
    await downloadReportNodeAsPdf(reportRef.current, title);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3 print:max-w-none print:space-y-2.5">
      <PageHeader
        title={title}
        subtitle={subtitle}
        backHref={backHref}
        actions={<ReportDownloadButton onClick={handleDownloadPdf} />}
      />

      <ReportDocument ref={reportRef} title={title} subtitle={subtitle} reportDate={reportDate}>
        {children}
      </ReportDocument>
    </div>
  );
}
