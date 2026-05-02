const PARAMS = ['accuracy', 'depth', 'clarity', 'relevance', 'practicalKnowledge'];
const PARAM_LABELS = {
    accuracy: 'Accuracy',
    depth: 'Depth',
    clarity: 'Clarity',
    relevance: 'Relevance',
    practicalKnowledge: 'Practical'
};

let allScores = [];

function initMetrics() {
    allScores = [];
    renderMetrics({ accuracy: 0, depth: 0, clarity: 0, relevance: 0, practicalKnowledge: 0 }, 0);
}

function addScore(score) {
    allScores.push(score);
    const cumulative = getCumulativeScores();
    const overall = getOverallScore();
    renderMetrics(cumulative, overall);
    return overall;
}

function getCumulativeScores() {
    if (allScores.length === 0) {
        return { accuracy: 0, depth: 0, clarity: 0, relevance: 0, practicalKnowledge: 0 };
    }

    const sums = {};
    for (const p of PARAMS) {
        sums[p] = allScores.reduce((acc, s) => acc + (s[p] || 0), 0) / allScores.length;
    }
    return sums;
}

function getOverallScore() {
    const cumulative = getCumulativeScores();
    const sum = PARAMS.reduce((acc, p) => acc + cumulative[p], 0);
    return Math.round(sum / PARAMS.length);
}

function renderMetrics(cumulative, overall) {
    // Update overall circle
    const circle = document.getElementById('overallCircle');
    const valueEl = document.getElementById('overallValue');
    const circumference = 263.9;
    const offset = circumference - (circumference * overall / 100);
    circle.style.strokeDashoffset = offset;
    circle.style.stroke = getColor(overall);
    valueEl.textContent = `${Math.round(overall)}%`;

    // Update individual params
    for (const p of PARAMS) {
        const item = document.querySelector(`[data-param="${p}"]`);
        if (!item) continue;

        const val = Math.round(cumulative[p] || 0);
        item.querySelector('.param-value').textContent = `${val}%`;

        const fill = item.querySelector('.param-fill');
        fill.style.width = `${val}%`;
        fill.classList.remove('low', 'mid', 'high');
        if (val < 40) fill.classList.add('low');
        else if (val < 70) fill.classList.add('mid');
        else fill.classList.add('high');
    }
}

function getColor(value) {
    if (value < 40) return '#ef4444';
    if (value < 70) return '#f59e0b';
    return '#22c55e';
}

function updateQuestionsAnswered(answered, total) {
    const el = document.getElementById('questionsAnswered');
    if (el) el.textContent = `${answered} of ${total} answered`;
}
