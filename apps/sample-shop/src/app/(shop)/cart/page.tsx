'use client';

import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import { formatPrice } from '@/lib/products';

// Client Component: reads live cart state. Shows line items, a total, and
// remove controls. Empty state has its own testid so tests can assert both paths.
export default function CartPage() {
  const { lines, total, remove, clear } = useCart();

  if (lines.length === 0) {
    return (
      <section>
        <h1>Your cart</h1>
        <p className="muted" data-testid="cart-empty">
          Your cart is empty. <Link href="/products">Browse products</Link>.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1>Your cart</h1>
      <div data-testid="cart-items">
        {lines.map((line) => (
          <div
            key={line.product.id}
            className="cart-row"
            data-testid={`cart-item-${line.product.id}`}
          >
            <div className="meta">
              <span data-testid="cart-item-name">{line.product.name}</span>
              <span className="muted">
                {formatPrice(line.product.price)} ×{' '}
                <span data-testid="cart-item-qty">{line.qty}</span>
              </span>
            </div>
            <div>
              <span className="muted" data-testid="cart-item-subtotal">
                {formatPrice(line.product.price * line.qty)}
              </span>
              <button
                type="button"
                className="danger"
                style={{ marginLeft: 12 }}
                onClick={() => remove(line.product.id)}
                data-testid={`remove-${line.product.id}`}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-total">
        <span>Total</span>
        <span data-testid="cart-total">{formatPrice(total)}</span>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
        <button type="button" className="secondary" onClick={clear} data-testid="clear-cart">
          Clear cart
        </button>
        <button type="button" data-testid="checkout">
          Checkout
        </button>
      </div>
    </section>
  );
}
