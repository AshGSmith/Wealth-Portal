function safeFileName(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'report';
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => resolve());
  });
}

export async function downloadReportNodeAsPdf(node: HTMLElement | null, title: string): Promise<void> {
  if (!node) {
    throw new Error('Report content is not available for export.');
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const exportShell = document.createElement('div');
  exportShell.style.position = 'fixed';
  exportShell.style.left = '-10000px';
  exportShell.style.top = '0';
  exportShell.style.width = `${Math.max(node.scrollWidth, 960)}px`;
  exportShell.style.padding = '24px';
  exportShell.style.background = '#f8fafc';
  exportShell.style.color = '#0f172a';
  exportShell.style.zIndex = '-1';
  exportShell.style.fontFamily = 'var(--font-geist-sans), system-ui, sans-serif';

  const clonedReport = node.cloneNode(true) as HTMLElement;
  clonedReport.querySelectorAll('a,button').forEach(element => element.remove());

  const exportHeader = document.createElement('div');
  exportHeader.style.marginBottom = '12px';
  exportHeader.style.padding = '16px';
  exportHeader.style.border = '1px solid #e2e8f0';
  exportHeader.style.borderRadius = '16px';
  exportHeader.style.background = '#ffffff';

  const exportTitle = document.createElement('h1');
  exportTitle.textContent = title;
  exportTitle.style.margin = '0';
  exportTitle.style.fontSize = '24px';
  exportTitle.style.fontWeight = '600';
  exportTitle.style.lineHeight = '1.2';
  exportTitle.style.color = '#0f172a';

  exportHeader.appendChild(exportTitle);
  exportShell.appendChild(exportHeader);
  exportShell.appendChild(clonedReport);
  document.body.appendChild(exportShell);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await nextFrame();

    const canvas = await html2canvas(exportShell, {
      backgroundColor: '#f8fafc',
      scale: Math.max(2, Math.min(window.devicePixelRatio || 1, 3)),
      useCORS: true,
      logging: false,
      windowWidth: exportShell.scrollWidth,
    });

    const imageData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'pt',
      format: 'a4',
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageWidth = pageWidth;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;

    let heightLeft = imageHeight;
    let position = 0;

    pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imageHeight;
      pdf.addPage();
      pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    pdf.save(`${safeFileName(title)}.pdf`);
  } finally {
    exportShell.remove();
  }
}
