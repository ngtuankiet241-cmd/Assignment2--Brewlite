# BrewLite Web

Next.js App Router frontend for BrewLite. The menu fetches products from the NestJS API; customers can choose size and topping, add drinks to a device-local cart, change quantities, and remove items.

## Run locally

Start the API and PostgreSQL database using the instructions in [`../api`](../api). Then run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The default API URL is `http://localhost:3001`; override it with `NEXT_PUBLIC_API_URL` in `.env.local` if needed.

## Cart behavior

- Sizes S, M, and L apply -5,000 VND, 0 VND, and +5,000 VND to the base price.
- Toppings are priced per portion, and their quantities are calculated per drink.
- Cart contents and selected options persist in the browser's local storage.
- Checkout and payment are not part of this cart UI yet.

## Validate

```bash
npm run lint
npm run build
```
