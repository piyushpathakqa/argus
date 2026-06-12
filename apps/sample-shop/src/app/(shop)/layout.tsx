import type { ReactNode } from 'react';
import { Header } from '@/components/Header';

// Shared chrome for the authenticated storefront pages (/products, /cart).
// The login page lives outside this group so it renders without the nav/cart.
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="container">{children}</main>
    </>
  );
}
