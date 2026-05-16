const TOPICS = [
    'Java', 'Python', 'JavaScript', 'TypeScript', 'SQL',
    'Spring Boot', 'React', 'Angular', 'Node.js', 'AWS',
    'Docker', 'Kubernetes', 'System Design', 'Data Structures',
    'REST APIs', 'GraphQL', 'MongoDB', 'PostgreSQL', 'Git', 'CI/CD'
];

const FREE_TIER_QUESTION_COUNT = 5;

const TIER_PRICING = {
    'free': 0,
    '5': 4900,
    '10': 9900,
    '15': 14900,
    '20': 19900,
};

const TIER_DISPLAY = {
    '5': '₹49',
    '10': '₹99',
    '15': '₹149',
    '20': '₹199',
};

async function init() {
    checkApiKey();
    await checkFreeTierStatus();
    renderTopics();
    document.getElementById('startBtn').addEventListener('click', handleStart);
    setupDynamicButtonText();
}

function setupDynamicButtonText() {
    const select = document.getElementById('questionCount');
    const btn = document.getElementById('startBtn');

    select.addEventListener('change', () => {
        const val = select.value;
        if (val === 'free') {
            btn.textContent = 'Start Interview';
        } else {
            btn.textContent = `Pay ${TIER_DISPLAY[val]} & Start Interview`;
        }
    });
}

async function checkFreeTierStatus() {
    const isExhausted = await DatabaseService.isFreeTierExhausted();
    const questionSelect = document.getElementById('questionCount');
    const freeOption = questionSelect.querySelector('option[value="free"]');

    if (isExhausted && freeOption) {
        freeOption.textContent = 'Free Tier (Used)';
        freeOption.disabled = true;
        // Select first available option
        questionSelect.value = '5';
    }
}

function checkApiKey() {
    const overlay = document.getElementById('apikeyOverlay');
    const input = document.getElementById('apikeyInput');
    const saveBtn = document.getElementById('apikeySaveBtn');

    // Check if a valid key exists (from localStorage or injected config.js)
    if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
        overlay.style.display = 'none';
        return;
    }

    overlay.style.display = 'flex';

    saveBtn.addEventListener('click', () => {
        const val = input.value.trim();
        if (!val) {
            input.style.borderColor = '#ef4444';
            setTimeout(() => input.style.borderColor = '', 1500);
            return;
        }
        localStorage.setItem('gemini-api-key', val);
        overlay.style.display = 'none';
        window.location.reload();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveBtn.click();
    });
}

function renderTopics() {
    const grid = document.getElementById('topicsGrid');
    grid.innerHTML = TOPICS.map(topic =>
        `<button class="topic-btn" data-topic="${topic}">${topic}</button>`
    ).join('');

    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.topic-btn');
        if (btn) handleTopicClick(btn.dataset.topic);
    });
}

async function getQuestionCount() {
    const val = document.getElementById('questionCount').value;
    if (val === 'free') {
        const isExhausted = await DatabaseService.isFreeTierExhausted();
        if (isExhausted) {
            alert('Your free tier has been used. Please select a question count.');
            return null;
        }
        return FREE_TIER_QUESTION_COUNT;
    }
    return parseInt(val);
}

function isFreeTierSelected() {
    return document.getElementById('questionCount').value === 'free';
}

async function handleStart() {
    const jd = document.getElementById('jdInput').value.trim();
    if (!jd) {
        document.getElementById('jdInput').focus();
        document.getElementById('jdInput').style.borderColor = '#ef4444';
        setTimeout(() => {
            document.getElementById('jdInput').style.borderColor = '';
        }, 2000);
        return;
    }

    const questionCount = await getQuestionCount();
    if (!questionCount) return;

    const config = {
        context: jd,
        contextType: 'jd',
        questionCount,
        difficulty: document.getElementById('difficulty').value,
        isFreeTier: isFreeTierSelected()
    };

    await processPayment(config);
}

async function handleTopicClick(topic) {
    const questionCount = await getQuestionCount();
    if (!questionCount) return;

    const config = {
        context: `${topic} technical interview. Focus on core concepts, best practices, common interview questions, and real-world scenarios for ${topic}.`,
        contextType: 'topic',
        topicName: topic,
        questionCount,
        difficulty: document.getElementById('difficulty').value,
        isFreeTier: isFreeTierSelected()
    };

    await processPayment(config);
}

async function processPayment(config) {
    // Free tier — skip payment entirely
    if (config.isFreeTier) {
        sessionStorage.setItem('interviewConfig', JSON.stringify(config));
        window.location.href = 'chat.html';
        return;
    }

    const tier = String(config.questionCount);
    const amount = TIER_PRICING[tier];
    if (!amount) {
        alert('Invalid tier selected.');
        return;
    }

    const startBtn = document.getElementById('startBtn');
    const originalText = startBtn.textContent;
    startBtn.disabled = true;
    startBtn.textContent = 'Creating order…';

    try {
        // 1. Create Razorpay order via Edge Function
        const { order_id, payment_id } = await DatabaseService.createPaymentOrder(amount, tier);

        // 2. Get user info for Razorpay prefill
        const userName = await AuthManager.getUsername();
        const user = await AuthManager.getUser();
        const userEmail = user?.email || '';

        // 3. Open Razorpay Checkout
        startBtn.textContent = 'Waiting for payment…';

        const options = {
            key: RAZORPAY_KEY_ID,
            amount,
            currency: 'INR',
            name: 'InterviewOnAI',
            description: `${tier} Question Interview`,
            order_id,
            prefill: {
                name: userName,
                email: userEmail,
            },
            theme: {
                color: '#6366f1',
            },
            handler: async function (response) {
                // 4. Verify payment via Edge Function
                startBtn.textContent = 'Verifying payment…';
                try {
                    const result = await DatabaseService.verifyPayment(
                        response.razorpay_order_id,
                        response.razorpay_payment_id,
                        response.razorpay_signature,
                        payment_id,
                    );

                    if (result.verified) {
                        config.paymentId = payment_id;
                        sessionStorage.setItem('interviewConfig', JSON.stringify(config));
                        window.location.href = 'chat.html';
                    } else {
                        alert('Payment verification failed. Please try again.');
                        startBtn.disabled = false;
                        startBtn.textContent = originalText;
                    }
                } catch (err) {
                    console.error('Payment verification error:', err);
                    alert('Payment verification failed. Please contact support.');
                    startBtn.disabled = false;
                    startBtn.textContent = originalText;
                }
            },
            modal: {
                ondismiss: function () {
                    startBtn.disabled = false;
                    startBtn.textContent = originalText;
                },
            },
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response) {
            console.error('Payment failed:', response.error);
            alert(`Payment failed: ${response.error.description}`);
            startBtn.disabled = false;
            startBtn.textContent = originalText;
        });
        rzp.open();

    } catch (err) {
        console.error('Order creation error:', err);
        alert('Failed to create payment order. Please try again.');
        startBtn.disabled = false;
        startBtn.textContent = originalText;
    }
}

document.addEventListener('DOMContentLoaded', init);
