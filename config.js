// Set to false to skip login and use TEST_EMAIL as the authenticated user
const REQUIRE_LOGIN = false;
const TEST_EMAIL = 'test@interviewonai.com';

// API key priority: localStorage > injected value > placeholder
const _INJECTED_KEY = "YOUR_GEMINI_API_KEY_HERE";
const GEMINI_API_KEY = localStorage.getItem('gemini-api-key')
    || (_INJECTED_KEY !== "YOUR_GEMINI_API_KEY_HERE" ? _INJECTED_KEY : '');

// Razorpay publishable key (safe for client-side)
const RAZORPAY_KEY_ID = 'rzp_test_Spyzkhtdr5AwSH';
