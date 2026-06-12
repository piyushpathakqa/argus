'use client';

import { useCart } from './CartProvider';
import type { Product } from '@/lib/products';

/**
 * Adds a product to the cart. Rendered inside the server-rendered product list,
 * which is why the interactive bit is split into its own client component.
 */
export function AddToCartButton({ product }: { product: Product }) {
  const { add } = useCart();

  return (
    <button
      type="button"
      onClick={() => add(product)}
      data-testid={`add-to-cart-${product.id}`}
    >
      Add to cart
    </button>
  );
}
