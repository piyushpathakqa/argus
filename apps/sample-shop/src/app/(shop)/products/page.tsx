import { AddToCartButton } from '@/components/AddToCartButton';
import { PRODUCTS, formatPrice } from '@/lib/products';

// Server Component: the catalog is static, so this renders entirely on the
// server. Only the per-product "Add to cart" button is a client component.
export default function ProductsPage() {
  return (
    <section>
      <h1>Products</h1>
      <div className="product-grid" data-testid="product-list">
        {PRODUCTS.map((product) => (
          <article
            key={product.id}
            className="card product"
            data-testid={`product-card-${product.id}`}
          >
            <p className="name" data-testid="product-name">
              {product.name}
            </p>
            <p className="price" data-testid="product-price">
              {formatPrice(product.price)}
            </p>
            <p className="desc">{product.description}</p>
            <AddToCartButton product={product} />
          </article>
        ))}
      </div>
    </section>
  );
}
