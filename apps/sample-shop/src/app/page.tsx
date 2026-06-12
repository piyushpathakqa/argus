import { redirect } from 'next/navigation';

// The storefront entry point. The middleware decides whether the visitor is
// sent on to /products or bounced to /login, so this just forwards.
export default function Home() {
  redirect('/products');
}
