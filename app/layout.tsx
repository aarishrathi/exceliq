import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ExcelIQ — Workbook Intelligence Platform',
  description: 'AI-powered QC, semantic diff, and audit log for corporate Excel workbooks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
