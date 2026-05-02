const PARAM_NAMES = {
    accuracy: 'Accuracy',
    depth: 'Depth',
    clarity: 'Clarity',
    relevance: 'Relevance',
    practicalKnowledge: 'Practical Knowledge'
};

const PARAMS_ORDER = ['accuracy', 'depth', 'clarity', 'relevance', 'practicalKnowledge'];

function initReport() {
    const dataStr = sessionStorage.getItem('interviewReport');
    if (!dataStr) {
        window.location.href = 'index.html';
        return;
    }

    const data = JSON.parse(dataStr);
    renderReport(data);
}

function renderReport(data) {
    // Subtitle
    const subtitle = data.contextType === 'topic'
        ? `${data.topicName} Interview · ${data.scores.length} Questions · ${capitalize(data.difficulty)}`
        : `Job Description Interview · ${data.scores.length} Questions · ${capitalize(data.difficulty)}`;
    document.getElementById('reportSubtitle').textContent = subtitle;

    // Overall grade
    const overall = data.overallScore;
    const letter = getLetterGrade(overall);
    const color = getGradeColor(overall);

    document.getElementById('gradeLetter').textContent = letter;
    document.getElementById('gradeLetter').style.color = color;
    document.getElementById('gradePct').textContent = `${overall}%`;

    requestAnimationFrame(() => {
        const circumference = 263.9;
        const offset = circumference - (circumference * overall / 100);
        const fill = document.getElementById('gradeFill');
        fill.style.strokeDashoffset = offset;
        fill.style.stroke = color;
    });

    // Breakdown
    renderBreakdown(data.cumulativeScores);

    // Strengths & Improvements
    renderInsights(data.cumulativeScores);

    // Questions accordion
    renderQuestions(data);
}

function renderBreakdown(scores) {
    const grid = document.getElementById('breakdownGrid');
    grid.innerHTML = PARAMS_ORDER.map(p => {
        const val = Math.round(scores[p] || 0);
        const cls = val < 40 ? 'low' : val < 70 ? 'mid' : 'high';
        return `
            <div class="breakdown-item">
                <span class="breakdown-label">${PARAM_NAMES[p]}</span>
                <div class="breakdown-bar-wrap">
                    <div class="breakdown-bar ${cls}" data-width="${val}"></div>
                </div>
                <span class="breakdown-value">${val}%</span>
            </div>`;
    }).join('');

    // Animate bars
    requestAnimationFrame(() => {
        grid.querySelectorAll('.breakdown-bar').forEach(bar => {
            bar.style.width = bar.dataset.width + '%';
        });
    });
}

function renderInsights(scores) {
    const sorted = PARAMS_ORDER.map(p => ({ key: p, val: scores[p] || 0 }))
        .sort((a, b) => b.val - a.val);

    const strengths = sorted.slice(0, 2);
    const improvements = sorted.slice(-2).reverse();

    const strengthsEl = document.getElementById('strengthsList');
    strengthsEl.innerHTML = strengths.map(s =>
        `<div class="insight-item"><strong>${PARAM_NAMES[s.key]}</strong> (${Math.round(s.val)}%) — ${getStrengthTip(s.key)}</div>`
    ).join('');

    const improvementsEl = document.getElementById('improvementsList');
    improvementsEl.innerHTML = improvements.map(s =>
        `<div class="insight-item"><strong>${PARAM_NAMES[s.key]}</strong> (${Math.round(s.val)}%) — ${getImprovementTip(s.key)}</div>`
    ).join('');
}

function renderQuestions(data) {
    const container = document.getElementById('questionsAccordion');
    container.innerHTML = data.questions.map((q, i) => {
        const score = data.scores[i];
        if (!score) return '';
        const avg = Math.round(
            (score.accuracy + score.depth + score.clarity + score.relevance + score.practicalKnowledge) / 5
        );
        const cls = avg < 40 ? 'low' : avg < 70 ? 'mid' : 'high';
        const answer = data.answers[i] || 'No answer';

        return `
            <div class="q-item" data-index="${i}">
                <div class="q-header" onclick="toggleQuestion(${i})">
                    <span><span class="q-number">Q${i + 1}</span>${truncate(q, 60)}</span>
                    <span style="display:flex;align-items:center;gap:0.5rem">
                        <span class="q-score-badge ${cls}">${avg}%</span>
                        <span class="q-arrow">▼</span>
                    </span>
                </div>
                <div class="q-body" id="qBody${i}">
                    <div class="q-label">Question</div>
                    <div class="q-text">${escapeHtml(q)}</div>
                    <div class="q-label">Your Answer</div>
                    <div class="q-text">${escapeHtml(answer)}</div>
                    <div class="q-label">Scores</div>
                    <div class="q-mini-scores">
                        ${PARAMS_ORDER.map(p =>
                            `<span class="q-mini-score">${PARAM_NAMES[p]}: ${score[p]}%</span>`
                        ).join('')}
                    </div>
                    <div class="q-label">Feedback</div>
                    <div class="q-text">${escapeHtml(score.feedback || '')}</div>
                </div>
            </div>`;
    }).join('');
}

function toggleQuestion(index) {
    const item = document.querySelector(`.q-item[data-index="${index}"]`);
    const body = document.getElementById(`qBody${index}`);
    item.classList.toggle('open');
    body.classList.toggle('open');
}

function getLetterGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
}

function getGradeColor(score) {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
}

function getStrengthTip(param) {
    const tips = {
        accuracy: 'Your answers are factually correct and precise.',
        depth: 'You provide thorough, detailed explanations.',
        clarity: 'Your responses are well-structured and easy to follow.',
        relevance: 'You stay focused on the question asked.',
        practicalKnowledge: 'You demonstrate strong real-world experience.'
    };
    return tips[param] || '';
}

function getImprovementTip(param) {
    const tips = {
        accuracy: 'Review core concepts and verify facts before answering.',
        depth: 'Try to explain the "why" behind your answers with more detail.',
        clarity: 'Structure your answers with clear points and logical flow.',
        relevance: 'Read the question carefully and address it directly first.',
        practicalKnowledge: 'Include real-world examples and scenarios from experience.'
    };
    return tips[param] || '';
}

function capitalize(str) {
    return str.replace(/-/g, ' → ').replace(/\b\w/g, c => c.toUpperCase());
}

function truncate(str, len) {
    return str.length > len ? str.substring(0, len) + '…' : str;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', initReport);
