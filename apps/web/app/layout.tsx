import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Job Execution Platform',
  description: 'Distributed job execution system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
