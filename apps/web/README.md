# BrewLite Web

Next.js App Router frontend for BrewLite. The menu fetches products from the NestJS API; customers can choose size and topping, add drinks to a device-local cart, change quantities, and remove items.

## Run locally

Start the API and PostgreSQL database using the instructions in [`../api`](../api). Then run:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The template sets `NEXT_PUBLIC_API_URL=http://localhost:3001`; change it in `.env.local` if your API runs elsewhere. Next.js reads environment files from `apps/web`, so the repository root `.env` used by the backend is not loaded here. Restart `npm run dev` after changing environment variables.

## Sign-in behavior

Successful sign-in or registration opens `/menu`. The header then shows the customer's name and a sign-out action; on mobile these appear inside the navigation menu. The existing `token` and `user` storage keys are preserved so checkout and order history continue using the same session. Reloading keeps the session, and sign-out updates other open tabs. An expired token displays the guest navigation.

Incorrect credentials stay on `/login` and display the API error. Email matching ignores casing and surrounding spaces, including for existing accounts. Passwords retain their exact characters.

Checkout checks the token expiry before submitting. If the token is expired or the order/payment API returns 401, it clears the rejected sign-in session and offers a sign-in link while preserving the cart.

## Cart behavior

- Sizes S, M, and L apply -5,000 VND, 0 VND, and +5,000 VND to the base price.
- Toppings are priced per portion, and their quantities are calculated per drink.
- Cart contents and selected options persist in the browser's local storage.
- Continue to `/checkout` to enter pickup details, apply a promotion, and place the order.

Stored carts can outlive a catalog update or database reset. If order creation returns 404, checkout checks the current catalog and offers to remove unavailable items while keeping valid items. It preserves the cart if that check fails and links back to the cart and menu so customers can choose again.

## Checkout promotions

The order summary on `/checkout` includes a promotion code input and an Apply button. Validation calls `POST /promotions/validate` with the current cart subtotal. A valid code displays the discount and updated payable total; invalid, expired, or ineligible codes display the backend reason. Customers can remove a code or edit it to apply another.

Editing the code or changing the cart invalidates the previous quote and cancels pending validation. An entered code must be applied or cleared before placing the order. The order request includes the validated `promotionCode`, and the QR and confirmation screens display the amounts saved by the API.

Run the backend migrations before using promotions. The API seed includes `BREW10` (10% off orders from 50,000 VND, capped at 20,000 VND) and `BREW20K` (20,000 VND off orders from 100,000 VND).

## Loyalty points

Signed-in customers see their current points beside the cart in the home/menu header, on desktop and mobile. The balance comes from authenticated `GET /loyalty/me`, refreshes on focus, after checkout/payment updates, and periodically while the page is open. Click the points badge to refresh manually. There is no separate loyalty page.

Checkout includes **Sử dụng điểm thưởng**, a points input and **Dùng tối đa**. Each point discounts **100 VND**, after promotion discounts; the displayed rate comes from the API. The order request sends only `redeemedPoints`; the API computes the discount, validates the balance and debits points atomically with order creation. Retrying an identical request uses the same idempotency key, including after a debit whose payment response was lost.

Cancelled or expired orders restore redeemed points once. Points are earned once after payment confirmation at 1 point per 1,000 VND actually paid after all discounts, rounded down. An order reduced to zero settles locally without a SePay charge. Apply migration `20261116010000_loyalty_redemption` and regenerate the Prisma client before running the updated API. Membership tiers remain outside the current scope.

## Payment confirmation

The payment result page checks the order until it reaches a final state and offers **Kiểm tra lại thanh toán** for manual retry. Signed-in customers use authenticated `POST /payments/sepay/sync`: the backend looks up the invoice directly in SePay Sandbox, verifies the invoice, VND amount and approved payment, then uses the same transaction as IPN to mark the payment successful and award points once. Guests can read the existing order status.

Polling runs one request at a time, aborts on navigation, and stops after confirmation. Return URLs or browser-supplied status values never confirm payment. See [SePay confirmation and local IPN setup](../../docs/architecture/sepay-payments.md).

## Validate

```bash
npm test
npm run lint
npm run build
```
