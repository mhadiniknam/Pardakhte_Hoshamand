# پرداخت هوشمند (Smart Payment)

A smart contract management system with secure payment integration for creating, signing, and managing digital contracts with escrow payments.

![Project Screenshot](https://github.com/mhadiniknam/Pardakhte_Hoshamand/blob/main/Screenshot.png)

## Features

- **Contract Creation**: Create custom contracts or use templates
- **Digital Signatures**: Securely sign contracts online
- **Escrow Payments**: Hold payments safely until contract conditions are met
- **Contract Versioning**: Track changes and updates to contracts
- **Comments & Discussion**: Discuss contract terms with other parties
- **Dashboard Interface**: Manage all contracts in one place

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript, Bootstrap 5
- **Backend**: Node.js, Express.js
- **Payment Gateway**: ZarinPal API integration
- **Deployment**: Vercel

## Quick Start

### Prerequisites
- Node.js (version 18 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mhadiniknam/Pardakhte_Hoshamand.git
   cd Pardakhte_Hoshamand
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory with the following content:
   ```
   PORT=3000
   ZARINPAL_MERCHANT_ID=your-merchant-id
   ZARINPAL_CALLBACK_URL=http://localhost:3000/api/payment-verify
   ZARINPAL_SANDBOX=true
   ```

4. Run the application:
   ```bash
   npm start
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Deploying to Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy the project:
   ```bash
   vercel
   ```

4. Set environment variables on Vercel dashboard:
   - ZARINPAL_MERCHANT_ID
   - ZARINPAL_CALLBACK_URL
   - ZARINPAL_SANDBOX

### Environment Variables

| Variable | Description |
| --- | --- |
| `PORT` | The port number the server will run on (default: 3000) |
| `ZARINPAL_MERCHANT_ID` | Your ZarinPal merchant ID |
| `ZARINPAL_CALLBACK_URL` | The callback URL for ZarinPal payment verification |
| `ZARINPAL_SANDBOX` | Whether to use ZarinPal's sandbox environment (true/false) |

## How It Works

### Contract Creation Process

1. Select a contract template or create a custom contract
2. Fill in the contract details (parties, terms, payment details)
3. Generate unique links for all parties
4. Share links with relevant parties

### Signing Process

1. Parties receive unique contract links
2. They review the contract terms
3. They sign the contract digitally
4. The system records the signature with timestamp

### Payment Process

1. The paying party submits payment through ZarinPal
2. Funds are held in escrow
3. Once conditions are met, funds are released to the receiving party
4. All payment transactions are recorded in the system

## API Documentation

### Contract Endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/contracts` | GET | Get all contracts |
| `/api/contracts` | POST | Create a new contract |
| `/api/contracts/:linkToken` | GET | Get contract by link token |
| `/api/contracts/:linkToken/sign` | POST | Sign a contract |
| `/api/contracts/:linkToken/payment` | POST | Initiate payment for a contract |

### Payment Endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/payment-verify` | GET | Verify a payment (ZarinPal callback) |
| `/api/escrow-payments` | GET | Get all escrow payments |
| `/api/escrow/:paymentId/release` | POST | Release an escrow payment |

### Comment Endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/contracts/:linkToken/comments` | GET | Get comments for a contract |
| `/api/contracts/:linkToken/comments` | POST | Add a comment to a contract |

## License

This project is licensed under the ISC License.

## Author

- [@mhadiniknam](https://github.com/mhadiniknam)

## Acknowledgments

- [ZarinPal](https://www.zarinpal.com/) for payment gateway integration
- [Bootstrap](https://getbootstrap.com/) for UI components
- [Vazirmatn](https://github.com/rastikerdar/vazir-font) for Persian font