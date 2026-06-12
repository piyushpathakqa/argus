/**
 * Static product catalog. Deterministic by design — this app is a test target,
 * not a real store, so the data never changes between runs.
 */

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

export const PRODUCTS: Product[] = [
  {
    id: 'tee',
    name: 'Argus Tee',
    price: 25,
    description: 'A soft cotton tee with the all-seeing Argus logo.',
  },
  {
    id: 'mug',
    name: 'Flaky Test Mug',
    price: 15,
    description: 'For the coffee you drink while a test retries for the third time.',
  },
  {
    id: 'cap',
    name: 'Green Build Cap',
    price: 20,
    description: 'Wear it only when CI is passing. House rules.',
  },
  {
    id: 'stickers',
    name: 'Sticker Pack',
    price: 8,
    description: 'Six vinyl stickers. Self-healing not included, but on brand.',
  },
];

/** Look up a product by id; returns undefined if not in the catalog. */
export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** Format a number as a USD price string. */
export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
