const TOPICS = [
    'Java', 'Python', 'JavaScript', 'TypeScript', 'SQL',
    'Spring Boot', 'React', 'Angular', 'Node.js', 'AWS',
    'Docker', 'Kubernetes', 'System Design', 'Data Structures',
    'REST APIs', 'GraphQL', 'MongoDB', 'PostgreSQL', 'Git', 'CI/CD'
];

const FREE_TIER_QUESTION_COUNT = 5;

async function init() {
    checkApiKey();
    await checkFreeTierStatus();
    renderTopics();
    document.getElementById('startBtn').addEventListener('click', handleStart);
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

    sessionStorage.setItem('interviewConfig', JSON.stringify(config));
    window.location.href = 'chat.html';
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

    sessionStorage.setItem('interviewConfig', JSON.stringify(config));
    window.location.href = 'chat.html';
}

document.addEventListener('DOMContentLoaded', init);
