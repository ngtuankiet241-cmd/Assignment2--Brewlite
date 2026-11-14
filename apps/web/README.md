# BrewLite Web

Next.js App Router frontend for BrewLite. The menu fetches products from the NestJS API; customers can choose size and topping, add drinks to a device-local cart, change quantities, and remove items.

## Run locally

Start the API and PostgreSQL database using the instructions in [`../api`](../api). Then run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The default API URL is `http://localhost:3001`; override it with `NEXT_PUBLIC_API_URL` in `.env.local` if needed.

## Sign-in behavior

Successful sign-in or registration opens `/menu`. The header then shows the customer's name and a sign-out action; on mobile these appear inside the navigation menu. The existing `token` and `user` storage keys are preserved so checkout and order history continue using the same session. Reloading keeps the session, and sign-out updates other open tabs. An expired token displays the guest navigation.

Incorrect credentials stay on `/login` and display the API error. Email matching ignores casing and surrounding spaces, including for existing accounts. Passwords retain their exact characters.

## Cart behavior

- Sizes S, M, and L apply -5,000 VND, 0 VND, and +5,000 VND to the base price.
- Toppings are priced per portion, and their quantities are calculated per drink.
- Cart contents and selected options persist in the browser's local storage.
- Continue to `/checkout` to enter pickup details, apply a promotion, and place the order.

## Checkout promotions

The order summary on `/checkout` includes a promotion code input and an Apply button. Validation calls `POST /promotions/validate` with the current cart subtotal. A valid code displays the discount and updated payable total; invalid, expired, or ineligible codes display the backend reason. Customers can remove a code or edit it to apply another.

Editing the code or changing the cart invalidates the previous quote and cancels pending validation. An entered code must be applied or cleared before placing the order. The order request includes the validated `promotionCode`, and the QR and confirmation screens display the amounts saved by the API.

Run the backend migrations before using promotions. The API seed includes `BREW10` (10% off orders from 50,000 VND, capped at 20,000 VND) and `BREW20K` (20,000 VND off orders from 100,000 VND).

## Validate

```bash
npm test
npm run lint
npm run build
```
