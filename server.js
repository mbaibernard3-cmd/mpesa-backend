const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config(); // Loads environmental variables on Render securely

const app = express();

// Middleware configuration
app.use(express.json());
app.use(cors());

// --- CONFIGURATION MANAGEMENT ---
// Using Environment variables first, falling back to your verified keys
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || "XQ3fQsEBCAOLaMpiUie0tGLZg2aUsCccYXH23vFTbqcpZ8kf";
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || "9gMxGYVFHqsrt6cC1ph5xRgUeLcpmFrdI1J35NStp3DRbYmUctHpVhxhSLKkpA7A";
const BUSINESS_SHORT_CODE = process.env.MPESA_SHORTCODE || "174379"; 
const PASSKEY = process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"; 

// FIXED: Now points to your active web service "mpesa-backend-3"
const CALLBACK_URL = "https://mpesa-backend-3.onrender.com/api/mpesa-callback";

// --- MIDDLEWARE: GENERATE SAFARICOM ACCESS TOKEN ---
const generateToken = async (req, res, next) => {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    
    try {
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            {
                headers: {
                    Authorization: `Basic ${auth}`
                }
            }
        );
        req.mpesaToken = response.data.access_token;
        next();
    } catch (error) {
        console.error("Token Generation Failed:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to generate Safaricom access token" });
    }
};

// --- ROUTE: INITIATE STK PUSH ---
app.post('/api/stkpush', generateToken, async (req, res) => {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
        return res.status(400).json({ error: "Phone number and amount are required fields" });
    }

    // Generate accurate timestamp (Format: YYYYMMDDHHmmss)
    const date = new Date();
    const timestamp = date.getFullYear() +
        ('0' + (date.getMonth() + 1)).slice(-2) +
        ('0' + date.getDate()).slice(-2) +
        ('0' + date.getHours()).slice(-2) +
        ('0' + date.getMinutes()).slice(-2) +
        ('0' + date.getSeconds()).slice(-2);

    // Generate password hash as required by Daraja API specs
    const password = Buffer.from(`${BUSINESS_SHORT_CODE}${PASSKEY}${timestamp}`).toString('base64');

    const stkPayload = {
        BusinessShortCode: BUSINESS_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: BUSINESS_SHORT_CODE,
        PhoneNumber: phone,
        CallBackURL: CALLBACK_URL,
        AccountReference: "BernardoTech",
        TransactionDesc: "Payment for Tech Services"
    };

    try {
        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            stkPayload,
            {
                headers: {
                    Authorization: `Bearer ${req.mpesaToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log("STK Push successfully requested:", response.data);
        res.status(200).json(response.data);
    } catch (error) {
        console.error("STK Push Request Failed:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Safaricom API rejected the request payload" });
    }
});

// --- ROUTE: MPESA CALLBACK LISTENER ---
app.post('/api/mpesa-callback', (req, res) => {
    console.log("=== Incoming M-Pesa Callback Payment Notification ===");
    console.log(JSON.stringify(req.body, null, 2));
    
    res.status(200).json({ ResultCode: 0, ResultDesc: "Callback accepted successfully" });
});

// Root check endpoint to easily test in browser
app.get('/', (req, res) => {
    res.send("Bernardo Tech M-Pesa Backend is Live!");
});

// --- SERVER INITIALIZATION & PORT BINDING ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is actively running and listening on port ${PORT}`);
});
