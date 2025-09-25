# ZarinPal-Minimal

<img src="Example" alt="Alt text" width="300"/>

A minimal, developer-friendly Node.js integration scaffold for the **ZarinPal** payment gateway.  
This repository shows how to:

- Initialize a ZarinPal client (official or lightweight REST fetch approach).
- Request a payment.
- Redirect the user to the payment page.
- Verify the transaction on return.
- Keep the codebase lean and easy to extend.

---

## Features

- Minimal dependencies
- Clear separation of payment request vs. verify logic
- Environment-based configuration
- Ready-to-clone starter for bigger projects (Express, Fastify, or serverless)
- Includes a `node install.js` helper script to automate dependency installation and environment bootstrap

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/mhadiniknam/ZarinPal-Minimal.git
cd ZarinPal-Minimal
```

### 2. Install (choose one)

Standard:
```bash
npm install
```

Using the provided Node installer script:
```bash
node install.js
```

Optional flags:
```bash
node install.js --force        # Re-run install even if node_modules exists
node install.js --production   # Install with --omit=dev
node install.js --ci           # Fail fast and use a clean install style
```

### 3. Set Environment Variables

Create a `.env` file (the installer can create a template for you):

```
# Your ZarinPal merchant ID (sandbox or live)
ZARINPAL_MERCHANT_ID=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX

you don't need the Merchant ID in the SandBox mode

# Callback URL exposed to ZarinPal (must be reachable publicly in production)
ZARINPAL_CALLBACK_URL=https://your-domain.com/payment/callback

# true for sandbox mode, false for live
ZARINPAL_SANDBOX=true # Recommed

# Optional amount defaults
ZARINPAL_DEFAULT_AMOUNT=10000
```

## 4. Start the server
```bash
node server.js
```

---

## Basic Payment Flow (Conceptual)

1. User clicks "Pay".
2. Your server calls ZarinPal "PaymentRequest" with merchant ID, amount, and callback URL.
3. You redirect user to ZarinPal payment page if status == 100.
4. After payment, ZarinPal redirects back with `Authority` and `Status`.
5. You call "PaymentVerification" to finalize and confirm (status 100 or 101 typical success codes).
6. Store transaction details and show success/failure page.

---

## Minimal Example (Using Fetch)

Below is a pure `fetch` style (no extra SDK) illustrative snippet. Adapt for your actual code files.

```js
import fetch from "node-fetch"; // (If using node < 18 or no global fetch)
import dotenv from "dotenv";
dotenv.config();

const {
  ZARINPAL_MERCHANT_ID,
  ZARINPAL_CALLBACK_URL,
  ZARINPAL_SANDBOX,
} = process.env;

const ZARINPAL_BASE = ZARINPAL_SANDBOX === "true"
  ? "https://sandbox.zarinpal.com/pg/rest/WebGate"
  : "https://www.zarinpal.com/pg/rest/WebGate";

export async function requestPayment({ amount, description = "Test Payment", email = "", mobile = "" }) {
  const body = {
    MerchantID: ZARINPAL_MERCHANT_ID,
    Amount: amount,
    Description: description,
    Email: email,
    Mobile: mobile,
    CallbackURL: ZARINPAL_CALLBACK_URL
  };

  const res = await fetch(`${ZARINPAL_BASE}/PaymentRequest.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r => r.json());

  if (res.Status === 100) {
    const gateway = ZARINPAL_SANDBOX === "true"
      ? `https://sandbox.zarinpal.com/pg/StartPay/${res.Authority}`
      : `https://www.zarinpal.com/pg/StartPay/${res.Authority}`;
    return { ok: true, authority: res.Authority, gateway };
  }
  return { ok: false, error: res.Status, raw: res };
}

export async function verifyPayment({ authority, amount }) {
  const body = {
    MerchantID: ZARINPAL_MERCHANT_ID,
    Authority: authority,
    Amount: amount
  };

  const res = await fetch(`${ZARINPAL_BASE}/PaymentVerification.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r => r.json());

  if (res.Status === 100 || res.Status === 101) {
    return { ok: true, refId: res.RefID, status: res.Status };
  }
  return { ok: false, status: res.Status, raw: res };
}
```

---

## Example Express Route (Optional)

```js
import express from "express";
import { requestPayment, verifyPayment } from "./zarinpal.js";

const app = express();

app.get("/pay", async (req, res) => {
  const { ok, gateway, error } = await requestPayment({ amount: 10000, description: "Order #123" });
  if (!ok) return res.status(500).send("Payment init failed: " + error);
  res.redirect(gateway);
});

app.get("/payment/callback", async (req, res) => {
  const { Authority, Status } = req.query;
  if (Status !== "OK") return res.send("Payment canceled.");
  const result = await verifyPayment({ authority: Authority, amount: 10000 });
  if (result.ok) {
    res.send("Payment success. RefID: " + result.refId);
  } else {
    res.send("Payment verification failed: " + result.status);
  }
});

app.listen(3000, () => console.log("Server on :3000"));
```

---

## Scripts

- `install.js` – Node-based installer & bootstrap (installs dependencies, creates `.env` template if missing).
- (You can add) `examples/requestPayment.js` – Demonstrates initiating a payment.
- (You can add) `examples/verifyPayment.js` – Demonstrates verification logic.

---

## Recommended Project Structure

```
ZarinPal-Minimal/
  install.js
  package.json
  .env.example
  src/
    zarinpal.js
    server.js
  examples/
    requestPayment.js
    verifyPayment.js
  README.md
```

---

## `.env.example`

```
ZARINPAL_MERCHANT_ID=
ZARINPAL_CALLBACK_URL=http://localhost:3000/payment/callback
ZARINPAL_SANDBOX=true
ZARINPAL_DEFAULT_AMOUNT=10000
```

---

## Security Notes

- Never commit real merchant IDs or secrets.
- Use HTTPS in production for callback URLs.
- Validate amounts and order references before verifying.
- Log and store `RefID` for reconciliation.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Status != 100 in PaymentRequest | Invalid merchant ID or parameters | Re-check env values |
| Verification returns non-100 | Payment not completed or already verified | Display friendly error, log status |
| Sandbox works, live fails | Live merchant not activated | Contact ZarinPal support |
| Callback not hit | Inaccessible callback URL | Use a public tunnel (ngrok) or deploy |

---

## Future Enhancements

- TypeScript types
- Built-in retry / network resilience
- Webhook-based confirmation (if supported)
- Automated tests (Jest / Vitest)

---

## License

MIT (adjust if you prefer another license).

---

## Contributing

Open issues / PRs with improvements or clarifications. Please keep scope minimal to maintain focus.

---
