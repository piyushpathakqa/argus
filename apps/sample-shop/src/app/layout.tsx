import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CartProvider } from '@/components/CartProvider';

export const metadata: Metadata = {
  title: 'Argus Shop',
  description: 'A tiny demo storefront used as the target app for the Argus QA agent.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
