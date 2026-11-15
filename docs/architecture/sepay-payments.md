# SePay payment confirmation

BrewLite confirms payments from authenticated SePay IPN notifications or a server-side order lookup. A redirect to `/payment/result` alone does not update payment status.

## IPN

In SePay Sandbox, open **Cổng thanh toán → Cấu hình → IPN** and configure:

- URL: `https://<public-api-host>/payments/sepay/webhook-ipn`.
- Auth type: `SECRET_KEY`.
- Secret: the same value as the API's `SEPAY_IPN_SECRET_KEY`. This is separate from the merchant `SEPAY_SECRET_KEY` used to sign checkout forms and authenticate REST requests.

The IPN endpoint verifies `X-Secret-Key`, the paid order and approved transaction, and the amount and currency before updating the order. Successful delivery and duplicate delivery return HTTP **200**.

The legacy URL `/payments/ipn` is an alias of the same authenticated IPN handler, so existing merchant configurations continue to work.

SePay cannot reach `http://localhost:3001` from the internet. Local testing needs a public HTTPS tunnel to port 3001 for IPN delivery; changing `FRONTEND_URL` only changes the customer's return page. Restart the API after changing environment variables.

## Recovering a missed IPN

While viewing the payment result, a signed-in customer calls `POST /payments/sepay/sync` with only `{ "orderId": "..." }`. The API verifies order ownership, then queries the SePay Sandbox order details using the merchant credentials. An order is confirmed only when its invoice number, VND total and approved payment transaction all match the local order and payment.

Reconciliation reuses the IPN settlement transaction, including order locking, stock reservation checks and exactly-once loyalty earning. The transaction UUID returned by the REST API is recognized when a later IPN also includes a shorter `transaction_id`. Concurrent reconciliation and IPN delivery cannot award points twice.

An unavailable provider leaves the payment unconfirmed and allows retry. Cancelled or expired orders are not reopened automatically. Guests only read local order status and cannot trigger reconciliation.

The current payment integration uses SePay Sandbox. Merchant credentials remain on the API server.

## References

- [SePay IPN configuration](https://developer.sepay.vn/vi/cong-thanh-toan/IPN)
- [SePay order details API](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/chi-tiet-don-hang)
- [SePay Sandbox endpoints](https://developer.sepay.vn/vi/cong-thanh-toan/sandbox)
