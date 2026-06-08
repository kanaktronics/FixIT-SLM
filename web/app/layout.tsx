import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FIXIT — Expert Problem Solving',
  description: 'Ultra-practical guidance to help you understand, build, repair, troubleshoot, and improve things.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
