'use client';

import Link from 'next/link';
import { useCart } from './CartProvider';

/**
 * Top nav with a live cart badge. The badge count is one of the key elements
 * Argus asserts on, so its data-testid (`cart-count`) must stay stable.
 */
export function Header() {
  const { count } = useCart();

  return (
    <header className="header" data-testid="site-header">
      <Link href="/products" className="brand" data-testid="brand">
        👁 Argus Shop
      </Link>
      <nav>
        <Link href="/products" data-testid="nav-products">
          Products
        </Link>
        <Link href="/cart" className="cart-link" data-testid="nav-cart">
          Cart
          <span className="cart-badge" data-testid="cart-count">
            {count}
          </span>
        </Link>
      </nav>
    </header>
  );
}
