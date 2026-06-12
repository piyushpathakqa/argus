# @argus/sample-shop

A tiny **Next.js (App Router)** storefront that serves as the **target app** for Argus. The
agent generates Playwright tests against it, and in M3 we deliberately "drift" its
`data-testid`s to demo self-healing. It is intentionally small and deterministic — a test
fixture, not a product.

## Flow

`/login` → `/products` → `/cart` (with a live cart badge in the header).

- **Login** (`/login`): server-action auth gate. Demo credentials are `demo` / `demo`; wrong
  credentials show an inline error. A session cookie unlocks the rest of the app.
- **Products** (`/products`): static catalog rendered as a Server Component. Each card has an
  "Add to cart" button.
- **Cart** (`/cart`): client component showing line items, quantities, a total, remove/clear
  controls, and an empty state.
- **Gate**: `src/middleware.ts` redirects unauthenticated visitors to `/login`.

State is in-memory (React context for the cart, a cookie for the session). No database.

## Run it

```bash
pnpm --filter @argus/sample-shop dev     # http://localhost:3100
pnpm --filter @argus/sample-shop build   # production build
```

## Stable test hooks

Key elements carry stable `data-testid`s — these are the contract Argus's generated tests rely
on, and the ones we mutate to stage the self-healing demo:

| Area | `data-testid`s |
|------|----------------|
| Login | `login-form`, `login-username`, `login-password`, `login-submit`, `login-error` |
| Header | `site-header`, `nav-products`, `nav-cart`, `cart-count` |
| Products | `product-list`, `product-card-<id>`, `product-name`, `product-price`, `add-to-cart-<id>` |
| Cart | `cart-items`, `cart-item-<id>`, `cart-item-qty`, `cart-total`, `remove-<id>`, `clear-cart`, `checkout`, `cart-empty` |

Product ids: `tee`, `mug`, `cap`, `stickers` (see `src/lib/products.ts`).
