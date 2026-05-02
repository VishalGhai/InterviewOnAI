const TOPICS = [
    'Java', 'Python', 'JavaScript', 'TypeScript', 'SQL',
    'Spring Boot', 'React', 'Angular', 'Node.js', 'AWS',
    'Docker', 'Kubernetes', 'System Design', 'Data Structures',
    'REST APIs', 'GraphQL', 'MongoDB', 'PostgreSQL', 'Git', 'CI/CD'
];

function init() {
    checkApiKey();
    renderTopics();
    document.getElementById('startBtn').addEventListener('click', handleStart);
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

function handleStart() {
    const jd = document.getElementById('jdInput').value.trim();
    if (!jd) {
        document.getElementById('jdInput').focus();
        document.getElementById('jdInput').style.borderColor = '#ef4444';
        setTimeout(() => {
            document.getElementById('jdInput').style.borderColor = '';
        }, 2000);
        return;
    }

    const config = {
        context: jd,
        contextType: 'jd',
        questionCount: parseInt(document.getElementById('questionCount').value),
        difficulty: document.getElementById('difficulty').value
    };

    sessionStorage.setItem('interviewConfig', JSON.stringify(config));
    window.location.href = 'chat.html';
}

function handleTopicClick(topic) {
    const config = {
        context: `${topic} technical interview. Focus on core concepts, best practices, common interview questions, and real-world scenarios for ${topic}.`,
        contextType: 'topic',
        topicName: topic,
        questionCount: parseInt(document.getElementById('questionCount').value),
        difficulty: document.getElementById('difficulty').value
    };

    sessionStorage.setItem('interviewConfig', JSON.stringify(config));
    window.location.href = 'chat.html';
}

document.addEventListener('DOMContentLoaded', init);
