const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuration - Using sandbox mode
const MERCHANT_ID = "4b90fe3f-360f-40c6-b092-3be91e41fc99"; // Your sandbox merchant ID
const CALLBACK_URL = `http://localhost:${PORT}/api/payment-verify`; // Localhost callback
const IS_SANDBOX = true; // Set to true for sandbox mode

// In-memory storage for transaction amounts, contracts, and comments
const transactionStore = {};
const contracts = [];
const escrowPayments = [];
const comments = [];
const contractVersions = [];

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the dashboard page
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Serve the contract creation page
app.get('/create-contract', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'create-contract.html'));
});

// Serve the contract viewing page
app.get('/contract', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contract.html'));
});

// API endpoint to create a new contract
app.post('/api/contracts', (req, res) => {
    try {
        const {
            title,
            type,
            party1Name,
            party2Name,
            party1Email,
            party2Email,
            startDate,
            endDate,
            text,
            paymentOption,
            paymentAmount,
            paymentDeadline,
            paymentDescription,
            payerParty,
            payeeParty
        } = req.body;
        
        // Validate required fields
        if (!title || !type || !party1Name || !party2Name || !startDate || !text || !payerParty || !payeeParty) {
            return res.status(400).json({ 
                success: false, 
                message: "لطفاً تمام فیلدهای الزامی را تکمیل کنید" 
            });
        }
        
        // Validate that payer and payee are different
        if (payerParty === payeeParty) {
            return res.status(400).json({ 
                success: false, 
                message: "طرف پرداخت‌کننده و دریافت‌کننده نمی‌توانند یکسان باشند" 
            });
        }
        
        // Create a new contract object
        const newContract = {
            id: generateRandomToken(),
            title,
            type,
            party1Name,
            party2Name,
            party1Email,
            party2Email,
            startDate,
            endDate,
            text,
            paymentOption,
            paymentAmount: paymentAmount ? parseInt(paymentAmount) : 0,
            paymentDeadline,
            paymentDescription,
            payerParty,
            payeeParty,
            status: 'draft',
            createdAt: new Date().toISOString(),
            linkToken: generateRandomToken()
        };
        
        // Add to contracts array
        contracts.push(newContract);
        
        // Create initial version (V1)
        const initialVersion = {
            id: generateRandomToken(),
            contractId: newContract.id,
            version: 1,
            text: text,
            createdAt: new Date().toISOString(),
            createdBy: 'system'
        };
        
        contractVersions.push(initialVersion);
        
        // Create escrow payment record if payment is required
        let escrowPayment = null;
        if (paymentOption !== 'none' && paymentAmount > 0) {
            escrowPayment = {
                id: generateRandomToken(),
                contractId: newContract.id,
                authority: '', // Will be set when payment is initiated
                amount: parseInt(paymentAmount),
                status: 'pending', // Initial status is pending
                createdAt: new Date().toISOString()
            };
            
            escrowPayments.push(escrowPayment);
        }
        
        // Generate links for payer and payee
        const linkPayer = `${req.protocol}://${req.get('host')}/contract?id=${newContract.linkToken}&party=payer`;
        const linkPayee = `${req.protocol}://${req.get('host')}/contract?id=${newContract.linkToken}&party=payee`;
        
        // Return the contract with the link tokens
        res.json({
            success: true,
            contract: newContract,
            escrowPayment: escrowPayment, // Include escrow payment info
            linkPayer,
            linkPayee
        });
    } catch (error) {
        console.error('Error creating contract:', error);
        res.status(500).json({
            success: false,
            message: "خطای داخلی سرور"
        });
    }
});

// API endpoint to get a contract by link token
app.get('/api/contracts/:linkToken', (req, res) => {
    try {
        const { linkToken } = req.params;
        
        // Find the contract by link token
        const contract = contracts.find(c => c.linkToken === linkToken);
        
        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "قرارداد یافت نشد"
            });
        }
        
        // Get all versions of this contract
        const versions = contractVersions.filter(v => v.contractId === contract.id);
        
        res.json({
            success: true,
            contract,
            versions
        });
    } catch (error) {
        console.error('Error fetching contract:', error);
        res.status(500).json({
            success: false,
            message: "خطای داخلی سرور"
        });
    }
});

// API endpoint to get a contract by ID (for dashboard)
app.get('/api/contracts/id/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        // Find the contract by ID
        const contract = contracts.find(c => c.id === id);
        
        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "قرارداد یافت نشد"
            });
        }
        
        res.json({
            success: true,
            contract
        });
    } catch (error) {
        console.error('Error fetching contract:', error);
        res.status(500).json({
            success: false,
            message: "خطای داخلی سرور"
        });
    }
});

// API endpoint to get all contracts (for dashboard)
app.get('/api/contracts', (req, res) => {
    try {
        res.json({
            success: true,
            contracts
        });
    } catch (error) {
        console.error('Error fetching contracts:', error);
        res.status(500).json({
            success: false,
            message: "خطای داخلی سرور"
        });
    }
});

// API endpoint to sign a contract
app.post('/api/contracts/:linkToken/sign', (req, res) => {
    try {
        const { linkToken } = req.params;
        const { signerName, signerEmail, signature } = req.body;
        
        // Find the contract by link token
        const contractIndex = contracts.findIndex(c => c.linkToken === linkToken);
        
        if (contractIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "قرارداد یافت نشد"
            });
        }
        
        // Update the contract status
        contracts[contractIndex].status = 'signed';
        contracts[contractIndex].signedBy = signerName;
        contracts[contractIndex].signedAt = new Date().toISOString();
        contracts[contractIndex].signatureCode = generateRandomCode();
        contracts[contractIndex].signature = signature; // Store the signature data
        
        res.json({
            success: true,
            contract: contracts[contractIndex],
            signatureCode: contracts[contractIndex].signatureCode
        });
    } catch (error) {
        console.error('Error signing contract:', error);
        res.status(500).json({
            success: false,
            message: "خطای داخلی سرور"
        });
    }
});

// API endpoint to initiate payment for a contract
app.post('/api/contracts/:linkToken/payment', async (req, res) => {
    try {
        const { linkToken } = req.params;
        const { payerName, payerEmail, payerMobile, paymentDescription } = req.body;
        
        // Find the contract by link token
        const contract = contracts.find(c => c.linkToken === linkToken);
        
        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "قرارداد یافت نشد"
            });
        }
        
        // Check if payment is required
        if (contract.paymentOption === 'none' || contract.paymentAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "این قرارداد نیازی به پرداخت ندارد"
            });
        }
        
        // Prepare data for Zarinpal API
        const paymentData = {
            merchant_id: MERCHANT_ID,
            amount: contract.paymentAmount,
            description: `پرداخت قرارداد: ${contract.title}`,
            callback_url: `${CALLBACK_URL}?contractId=${contract.id}`,
            currency: "IRT",
            metadata: {
                mobile: payerMobile,
                email: payerEmail,
                contractId: contract.id
            }
        };
        
        // Choose the appropriate URL based on environment
        const zarinpalUrl = IS_SANDBOX 
            ? 'https://sandbox.zarinpal.com/pg/v4/payment/request.json'
            : 'https://payment.zarinpal.com/pg/v4/payment/request.json';
        
        console.log('Sending payment request to:', zarinpalUrl);
        console.log('Payment data:', paymentData);
        
        // Send request to Zarinpal
        const response = await axios.post(
            zarinpalUrl,
            paymentData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        const data = response.data;
        console.log('Zarinpal response:', data);
        
        if (data.data.code === 100) {
            // Store the amount with authority as key for verification
            transactionStore[data.data.authority] = contract.paymentAmount;
            console.log(`Stored transaction amount for authority ${data.data.authority}: ${contract.paymentAmount}`);
            
            // Find and update the escrow payment record
            const escrowPaymentIndex = escrowPayments.findIndex(p => p.contractId === contract.id);
            if (escrowPaymentIndex !== -1) {
                escrowPayments[escrowPaymentIndex].authority = data.data.authority;
                escrowPayments[escrowPaymentIndex].status = 'pending'; // Update status to pending
                escrowPayments[escrowPaymentIndex].payerName = payerName;
                escrowPayments[escrowPaymentIndex].payerEmail = payerEmail;
                escrowPayments[escrowPaymentIndex].payerMobile = payerMobile;
            }
            
            // Success - return payment URL
            const paymentUrl = IS_SANDBOX
                ? `https://sandbox.zarinpal.com/pg/StartPay/${data.data.authority}`
                : `https://payment.zarinpal.com/pg/StartPay/${data.data.authority}`;
                
            return res.json({
                success: true,
                payment_url: paymentUrl,
                payment_id: escrowPayments[escrowPaymentIndex].id
            });
        } else {
            // Error from Zarinpal - log the actual error
            console.error('Zarinpal error:', data.errors);
            return res.status(400).json({
                success: false,
                message: data.errors?.message || "خطا در ارتباط با درگاه پرداخت",
                errors: data.errors
            });
        }
    } catch (error) {
        console.error('Payment request error:', error);
        if (error.response) {
            // Log the detailed error from Zarinpal
            console.error('Error response data:', error.response.data);
            console.error('Error response status:', error.response.status);
            
            return res.status(error.response.status).json({
                success: false,
                message: error.response.data.errors?.message || "خطا در ارتباط با درگاه پرداخت",
                errors: error.response.data.errors
            });
        }
        return res.status(500).json({
            success: false,
            message: "خطای داخلی سرور"
        });
    }
});

// API endpoint to verify payment (callback from Zarinpal)
app.get('/api/payment-verify', async (req, res) => {
    try {
        const { Authority, Status, contractId } = req.query;
        
        console.log('Payment verification callback:', { Authority, Status, contractId });
        
        // Check if payment was successful
        if (Status !== 'OK') {
            // Redirect to dashboard instead of contract page
            return res.status(400).send(`
                <html dir="rtl">
                <head>
                    <title>پرداخت ناموفق</title>
                    <meta http-equiv="refresh" content="5;url=/dashboard" />
                    <style>
                        body { font-family: 'Vazirmatn', sans-serif; text-align: center; padding: 50px; background-color: #f5f7ff; }
                        .container { max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 10px; background-color: #f8d7da; }
                        h1 { color: #721c24; }
                        p { margin: 20px 0; }
                        a { display: inline-block; background-color: #6c5ce7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
                        .sandbox-notice { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
                        .redirect-message { margin-top: 20px; color: #6c757d; font-size: 14px; }
                    </style>
                    <link href="https://cdn.jsdelivr.net/npm/vazirmatn@33.0.0/Vazirmatn-font-face.css" rel="stylesheet">
                </head>
                <body>
                    <div class="container">
                        <div class="sandbox-notice">حالت آزمایشی (سندباکس) - این یک تراکنش آزمایشی است</div>
                        <h1>پرداخت ناموفق</h1>
                        <p>تراکنش شما لغو شد یا با خطا مواجه شد.</p>
                        <a href="/dashboard">بازگشت به داشبورد</a>
                        <p class="redirect-message">شما به طور خودکار به داشبورد هدایت خواهید شد...</p>
                    </div>
                </body>
                </html>
            `);
        }
        
        // Retrieve the amount from our transaction store
        const amount = transactionStore[Authority];
        if (!amount) {
            console.error(`Amount not found for authority: ${Authority}`);
            // Redirect to dashboard instead of contract page
            return res.status(400).send(`
                <html dir="rtl">
                <head>
                    <title>خطا در تایید پرداخت</title>
                    <meta http-equiv="refresh" content="5;url=/dashboard" />
                    <style>
                        body { font-family: 'Vazirmatn', sans-serif; text-align: center; padding: 50px; background-color: #f5f7ff; }
                        .container { max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 10px; background-color: #f8d7da; }
                        h1 { color: #721c24; }
                        p { margin: 20px 0; }
                        a { display: inline-block; background-color: #6c5ce7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
                        .sandbox-notice { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
                        .redirect-message { margin-top: 20px; color: #6c757d; font-size: 14px; }
                    </style>
                    <link href="https://cdn.jsdelivr.net/npm/vazirmatn@33.0.0/Vazirmatn-font-face.css" rel="stylesheet">
                </head>
                <body>
                    <div class="container">
                        <div class="sandbox-notice">حالت آزمایشی (سندباکس) - این یک تراکنش آزمایشی است</div>
                        <h1>خطا در تایید پرداخت</h1>
                        <p>اطلاعات تراکنش یافت نشد. لطفا دوباره تلاش کنید.</p>
                        <a href="/dashboard">بازگشت به داشبورد</a>
                        <p class="redirect-message">شما به طور خودکار به داشبورد هدایت خواهید شد...</p>
                    </div>
                </body>
                </html>
            `);
        }
        
        // Verify the payment with Zarinpal
        const verifyData = {
            merchant_id: MERCHANT_ID,
            amount: amount, // Use the retrieved amount
            authority: Authority
        };
        
        // Choose the appropriate URL based on environment
        const zarinpalVerifyUrl = IS_SANDBOX 
            ? 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json'
            : 'https://payment.zarinpal.com/pg/v4/payment/verify.json';
        
        console.log('Sending verification request to:', zarinpalVerifyUrl);
        console.log('Verification data:', verifyData);
        
        const response = await axios.post(
            zarinpalVerifyUrl,
            verifyData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        const data = response.data;
        console.log('Zarinpal verification response:', data);
        
        // Clean up the transaction store
        delete transactionStore[Authority];
        console.log(`Removed transaction for authority: ${Authority}`);
        
        // Update the escrow payment record
        const escrowPaymentIndex = escrowPayments.findIndex(p => p.authority === Authority);
        if (escrowPaymentIndex !== -1) {
            escrowPayments[escrowPaymentIndex].status = 'paid';
            escrowPayments[escrowPaymentIndex].refId = data.data.ref_id;
            escrowPayments[escrowPaymentIndex].paidAt = new Date().toISOString();
        }
        
        // Update the contract status
        const contractIndex = contracts.findIndex(c => c.id === contractId);
        if (contractIndex !== -1) {
            contracts[contractIndex].status = 'paid';
            contracts[contractIndex].paidAt = new Date().toISOString();
            contracts[contractIndex].refId = data.data.ref_id;
        }
        
        if (data.data.code === 100) {
            // Payment verified successfully
            // Redirect to dashboard instead of contract page
            return res.send(`
                <html dir="rtl">
                <head>
                    <title>پرداخت موفق</title>
                    <meta http-equiv="refresh" content="5;url=/dashboard" />
                    <style>
                        body { font-family: 'Vazirmatn', sans-serif; text-align: center; padding: 50px; background-color: #f5f7ff; }
                        .container { max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 10px; background-color: #d4edda; }
                        h1 { color: #155724; }
                        p { margin: 20px 0; }
                        .ref-id { font-weight: bold; font-size: 18px; color: #0c5460; }
                        a { display: inline-block; background-color: #6c5ce7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                        .sandbox-notice { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
                        .redirect-message { margin-top: 20px; color: #6c757d; font-size: 14px; }
                    </style>
                    <link href="https://cdn.jsdelivr.net/npm/vazirmatn@33.0.0/Vazirmatn-font-face.css" rel="stylesheet">
                </head>
                <body>
                    <div class="container">
                        <div class="sandbox-notice">حالت آزمایشی (سندباکس) - این یک تراکنش آزمایشی است</div>
                        <h1>پرداخت موفق</h1>
                        <p>پرداخت شما با موفقیت انجام شد.</p>
                        <p>کد پیگیری: <span class="ref-id">${data.data.ref_id}</span></p>
                        <p>مبلغ تا زمان اجرای کامل قرارداد به صورت امانی نزد سیستم نگهداری می‌شود.</p>
                        <a href="/dashboard">بازگشت به داشبورد</a>
                        <p class="redirect-message">شما به طور خودکار به داشبورد هدایت خواهید شد...</p>
                    </div>
                </body>
                </html>
            `);
        } else if (data.data.code === 101) {
            // Payment already verified
            // Redirect to dashboard instead of contract page
            return res.send(`
                <html dir="rtl">
                <head>
                    <title>پرداخت تکراری</title>
                    <meta http-equiv="refresh" content="5;url=/dashboard" />
                    <style>
                        body { font-family: 'Vazirmatn', sans-serif; text-align: center; padding: 50px; background-color: #f5f7ff; }
                        .container { max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 10px; background-color: #d1ecf1; }
                        h1 { color: #0c5460; }
                        p { margin: 20px 0; }
                        a { display: inline-block; background-color: #6c5ce7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                        .sandbox-notice { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
                        .redirect-message { margin-top: 20px; color: #6c757d; font-size: 14px; }
                    </style>
                    <link href="https://cdn.jsdelivr.net/npm/vazirmatn@33.0.0/Vazirmatn-font-face.css" rel="stylesheet">
                </head>
                <body>
                    <div class="container">
                        <div class="sandbox-notice">حالت آزمایشی (سندباکس) - این یک تراکنش آزمایشی است</div>
                        <h1>پرداخت تکراری</h1>
                        <p>این تراکنش قبلاً با موفقیت تایید شده است.</p>
                        <a href="/dashboard">بازگشت به داشبورد</a>
                        <p class="redirect-message">شما به طور خودکار به داشبورد هدایت خواهید شد...</p>
                    </div>
                </body>
                </html>
            `);
        } else {
            // Verification failed
            // Redirect to dashboard instead of contract page
            return res.status(400).send(`
                <html dir="rtl">
                <head>
                    <title>خطا در تایید پرداخت</title>
                    <meta http-equiv="refresh" content="5;url=/dashboard" />
                    <style>
                        body { font-family: 'Vazirmatn', sans-serif; text-align: center; padding: 50px; background-color: #f5f7ff; }
                        .container { max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 10px; background-color: #f8d7da; }
                        h1 { color: #721c24; }
                        p { margin: 20px 0; }
                        a { display: inline-block; background-color: #6c5ce7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                        .sandbox-notice { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
                        .redirect-message { margin-top: 20px; color: #6c757d; font-size: 14px; }
                    </style>
                    <link href="https://cdn.jsdelivr.net/npm/vazirmatn@33.0.0/Vazirmatn-font-face.css" rel="stylesheet">
                </head>
                <body>
                    <div class="container">
                        <div class="sandbox-notice">حالت آزمایشی (سندباکس) - این یک تراکنش آزمایشی است</div>
                        <h1>خطا در تایید پرداخت</h1>
                        <p>خطای تایید پرداخت: ${data.errors?.message || "خطای ناشناخته"}</p>
                        <a href="/dashboard">بازگشت به داشبورد</a>
                        <p class="redirect-message">شما به طور خودکار به داشبورد هدایت خواهید شد...</p>
                    </div>
                </body>
                </html>
            `);
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        if (error.response) {
            console.error('Error response data:', error.response.data);
            console.error('Error response status:', error.response.status);
        }
        // Redirect to dashboard instead of contract page
        return res.status(500).send(`
            <html dir="rtl">
            <head>
                <title>خطای سرور</title>
                <meta http-equiv="refresh" content="5;url=/dashboard" />
                <style>
                    body { font-family: 'Vazirmatn', sans-serif; text-align: center; padding: 50px; background-color: #f5f7ff; }
                    .container { max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 10px; background-color: #f8d7da; }
                    h1 { color: #721c24; }
                    p { margin: 20px 0; }
                    a { display: inline-block; background-color: #6c5ce7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                    .sandbox-notice { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
                    .redirect-message { margin-top: 20px; color: #6c757d; font-size: 14px; }
                </style>
                <link href="https://cdn.jsdelivr.net/npm/vazirmatn@33.0.0/Vazirmatn-font-face.css" rel="stylesheet">
            </head>
            <body>
                <div class="container">
                    <div class="sandbox-notice">حالت آزمایشی (سندباکس) - این یک تراکنش آزمایشی است</div>
                    <h1>خطای سرور</h1>
                    <p>خطای داخلی در تایید پرداخت. لطفا با پشتیبانی تماس بگیرید.</p>
                    <a href="/dashboard">بازگشت به داشبورد</a>
                    <p class="redirect-message">شما به طور خودکار به داشبورد هدایت خواهید شد...</p>
                </div>
            </body>
            </html>
        `);
    }
});

// API endpoint to get all escrow payments (for dashboard)
app.get('/api/escrow-payments', (req, res) => {
    try {
        res.json({
            success: true,
            payments: escrowPayments
        });
    } catch (error) {
        console.error('Error fetching escrow payments:', error);
        res.status(500).json({
            success: false,
            message: "خطای داخلی سرور"
        });
    }
});

// API endpoint to release escrow payment
app.post('/api/escrow/:paymentId/release', (req, res) => {
    try {
        const { paymentId } = req.params;
        
        // Find the escrow payment
        const paymentIndex = escrowPayments.findIndex(p => p.id === paymentId);
        
        if (paymentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "پرداخت یافت نشد"
            });
        }
        
        // Check if payment is in paid status
        if (escrowPayments[paymentIndex].status !== 'paid') {
            return res.status(400).json({
                success: false,
                message: "این پرداخت قابل آزادسازی نیست"
            });
        }
        
        // Update the payment status
        escrowPayments[paymentIndex].status = 'released';
        escrowPayments[paymentIndex].releasedAt = new Date().toISOString();
        
        // Update the contract status
        const contractIndex = contracts.findIndex(c => c.id === escrowPayments[paymentIndex].contractId);
        if (contractIndex !== -1) {
            contracts[contractIndex].status = 'completed';
            contracts[contractIndex].completedAt = new Date().toISOString();
        }
        
        res.json({
            success: true,
            payment: escrowPayments[paymentIndex]
        });
    } catch (error) {
        console.error('Error releasing escrow payment:', error);
        res.status(500).json({
            success: false,
            message: "خطای داخلی سرور"
        });
    }
});

// API endpoint to get comments for a contract
app.get('/api/contracts/:linkToken/comments', (req, res) => {
    try {
        const { linkToken } = req.params;
        
        // Find the contract by link token
        const contract = contracts.find(c => c.linkToken === linkToken);
        
        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "قرارداد یافت نشد"
            });
        }
        
        // Get comments for this contract
        const contractComments = comments.filter(c => c.contractId === contract.id);
        
        res.json({
            success: true,
            comments: contractComments
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({
            success: false,
            message: "خطای داخلی سرور"
        });
    }
});

// API endpoint to add a comment to a contract
app.post('/api/contracts/:linkToken/comments', (req, res) => {
    try {
        const { linkToken } = req.params;
        const { text, type, authorName, parentId } = req.body;
        
        // Validate required fields
        if (!text || !type || !authorName) {
            return res.status(400).json({
                success: false,
                message: "لطفاً تمام فیلدهای الزامی را تکمیل کنید"
            });
        }
        
        // Find the contract by link token
        const contract = contracts.find(c => c.linkToken === linkToken);
        
        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "قرارداد یافت نشد"
            });
        }
        
        // Create a new comment object
        const newComment = {
            id: generateRandomToken(),
            contractId: contract.id,
            text,
            type,
            authorName,
            parentId: parentId || null,
            createdAt: new Date().toISOString()
        };
        
        // Add to comments array
        comments.push(newComment);
        
        res.json({
            success: true,
            comment: newComment
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({
            success: false,
            message: "خطای داخلی سرور"
        });
    }
});

// API endpoint to create a new version of a contract
app.post('/api/contracts/:linkToken/versions', (req, res) => {
    try {
        const { linkToken } = req.params;
        const { text, authorName } = req.body;
        
        // Validate required fields
        if (!text || !authorName) {
            return res.status(400).json({
                success: false,
                message: "لطفاً تمام فیلدهای الزامی را تکمیل کنید"
            });
        }
        
        // Find the contract by link token
        const contract = contracts.find(c => c.linkToken === linkToken);
        
        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "قرارداد یافت نشد"
            });
        }
        
        // Get the latest version number
        const latestVersion = contractVersions
            .filter(v => v.contractId === contract.id)
            .sort((a, b) => b.version - a.version)[0];
        
        const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1;
        
        // Create a new version object
        const newVersion = {
            id: generateRandomToken(),
            contractId: contract.id,
            version: newVersionNumber,
            text: text,
            createdAt: new Date().toISOString(),
            createdBy: authorName
        };
        
        // Add to versions array
        contractVersions.push(newVersion);
        
        // Update the contract text
        contract.text = text;
        contract.updatedAt = new Date().toISOString();
        
        res.json({
            success: true,
            version: newVersion,
            contract: contract
        });
    } catch (error) {
        console.error('Error creating contract version:', error);
        res.status(500).json({
            success: false,
            message: "خطای داخلی سرور"
        });
    }
});

// Generate random token
function generateRandomToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 16; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

// Generate random code
function generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Sandbox mode: ${IS_SANDBOX ? 'Enabled' : 'Disabled'}`);
    console.log(`Callback URL: ${CALLBACK_URL}`);
});