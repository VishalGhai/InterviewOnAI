let session = {
    context: '',
    contextType: '',
    topicName: '',
    questionCount: 10,
    difficulty: 'easy-medium',
    questions: [],
    answers: [],
    scores: [],
    currentQuestion: 0,
    isProcessing: false,
    excludedTopics: [],
    currentBotMsgEl: null
};

function initChat() {
    const configStr = sessionStorage.getItem('interviewConfig');
    if (!configStr) {
        window.location.href = 'index.html';
        return;
    }

    const config = JSON.parse(configStr);
    session.context = config.context;
    session.contextType = config.contextType;
    session.topicName = config.topicName || '';
    session.questionCount = config.questionCount;
    session.difficulty = config.difficulty;

    // Set header info
    const topicEl = document.getElementById('sessionTopic');
    topicEl.textContent = session.contextType === 'topic'
        ? `${session.topicName} Interview`
        : 'Job Description Interview';

    updateProgress();
    initMetrics();
    setupInputHandlers();

    // Extract keywords for JD mode (non-blocking)
    if (session.contextType === 'jd') {
        loadKeywords(session.context);
    }

    askNextQuestion();
}

function setupInputHandlers() {
    const input = document.getElementById('answerInput');
    const btn = document.getElementById('submitBtn');

    btn.addEventListener('click', handleSubmit);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
}

function updateProgress() {
    const answered = session.scores.length;
    const total = session.questionCount;
    const pct = total > 0 ? (answered / total) * 100 : 0;

    document.getElementById('progressBar').style.width = `${pct}%`;
    document.getElementById('progressText').textContent = `Question ${Math.min(answered + 1, total)} / ${total}`;
    updateQuestionsAnswered(answered, total);
}

async function askNextQuestion() {
    if (session.currentQuestion >= session.questionCount) {
        endSession();
        return;
    }

    session.isProcessing = true;
    setInputEnabled(false);
    showTyping();

    try {
        const question = await generateQuestion(
            session.context,
            session.difficulty,
            session.currentQuestion + 1,
            session.questionCount,
            session.questions,
            session.excludedTopics
        );

        removeTyping();
        session.questions.push(question);
        const msgEl = addMessage(question, 'bot');
        session.currentBotMsgEl = msgEl;
        setInputEnabled(true);
        document.getElementById('answerInput').focus();
    } catch (err) {
        removeTyping();
        addMessage(`Error: ${err.message}. Please check your API key and try again.`, 'error');
        setInputEnabled(false);
    } finally {
        session.isProcessing = false;
    }
}

async function handleSubmit() {
    if (session.isProcessing) return;

    const input = document.getElementById('answerInput');
    const answer = input.value.trim();

    if (!answer) {
        input.style.borderColor = '#ef4444';
        setTimeout(() => input.style.borderColor = '', 1500);
        return;
    }

    // Display user answer
    addMessage(answer, 'user');
    session.answers.push(answer);
    input.value = '';
    input.style.height = 'auto';

    session.isProcessing = true;
    setInputEnabled(false);
    showTyping();

    try {
        const currentQ = session.questions[session.currentQuestion];
        const score = await evaluateAnswer(currentQ, answer, session.currentQuestion + 1);

        removeTyping();
        session.scores.push(score);

        // Show brief feedback in chat
        addMessage(`${score.feedback}`, 'feedback');

        // Update sidebar metrics
        const overall = addScore(score);
        session.currentQuestion++;
        updateProgress();

        // Check motivation milestones
        checkMilestones(overall);

        // Small delay before next question for readability
        setTimeout(() => {
            if (session.currentQuestion < session.questionCount) {
                askNextQuestion();
            } else {
                endSession();
            }
        }, 1000);
    } catch (err) {
        removeTyping();
        addMessage(`Error evaluating answer: ${err.message}`, 'error');
        setInputEnabled(true);
        session.isProcessing = false;
    }
}

function endSession() {
    setInputEnabled(false);

    // Store session data for report
    const reportData = {
        context: session.context,
        contextType: session.contextType,
        topicName: session.topicName,
        difficulty: session.difficulty,
        questions: session.questions,
        answers: session.answers,
        scores: session.scores,
        overallScore: getOverallScore(),
        cumulativeScores: getCumulativeScores()
    };
    sessionStorage.setItem('interviewReport', JSON.stringify(reportData));

    addMessage(
        `Interview complete! You answered ${session.scores.length} questions.\n\n` +
        `<a href="report.html">View your full report card →</a>`,
        'complete'
    );
}

function addMessage(text, type) {
    const container = document.getElementById('messages');
    const msg = document.createElement('div');
    msg.classList.add('message', type);

    if (type === 'complete') {
        msg.innerHTML = text;
    } else {
        msg.textContent = text;
    }

    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
}

async function reloadCurrentQuestion() {
    // Only reload if user hasn't answered the current question yet
    if (session.isProcessing) return;
    if (session.currentQuestion >= session.questionCount) return;
    if (session.questions.length <= session.currentQuestion) return;

    // Remove the last unanswered question from state and DOM
    session.questions.pop();
    if (session.currentBotMsgEl) {
        session.currentBotMsgEl.remove();
        session.currentBotMsgEl = null;
    }

    // Re-fetch with updated exclusions
    session.isProcessing = true;
    setInputEnabled(false);
    showTyping();

    try {
        const question = await generateQuestion(
            session.context,
            session.difficulty,
            session.currentQuestion + 1,
            session.questionCount,
            session.questions,
            session.excludedTopics
        );

        removeTyping();
        session.questions.push(question);
        const msgEl = addMessage(question, 'bot');
        session.currentBotMsgEl = msgEl;
        setInputEnabled(true);
        document.getElementById('answerInput').focus();
    } catch (err) {
        removeTyping();
        addMessage(`Error: ${err.message}. Please check your API key and try again.`, 'error');
        setInputEnabled(false);
    } finally {
        session.isProcessing = false;
    }
}

async function loadKeywords(jobDescription) {
    const section = document.getElementById('keywordSection');
    const chipsEl = document.getElementById('keywordChips');
    const loadingEl = document.getElementById('keywordLoading');

    section.style.display = '';
    loadingEl.style.display = '';
    chipsEl.innerHTML = '';

    try {
        const keywords = await extractKeywords(jobDescription);
        loadingEl.style.display = 'none';

        keywords.forEach(keyword => {
            const chip = document.createElement('button');
            chip.classList.add('keyword-chip');
            chip.textContent = keyword;
            chip.addEventListener('click', () => {
                chip.classList.toggle('excluded');
                if (chip.classList.contains('excluded')) {
                    session.excludedTopics.push(keyword);
                } else {
                    session.excludedTopics = session.excludedTopics.filter(t => t !== keyword);
                }
                reloadCurrentQuestion();
            });
            chipsEl.appendChild(chip);
        });

        if (keywords.length === 0) {
            loadingEl.textContent = 'No keywords found';
            loadingEl.style.display = '';
        }
    } catch {
        loadingEl.textContent = 'Could not extract keywords';
    }
}

function showTyping() {
    const container = document.getElementById('messages');
    const typing = document.createElement('div');
    typing.classList.add('typing');
    typing.id = 'typingIndicator';
    typing.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
}

function removeTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
}

function setInputEnabled(enabled) {
    document.getElementById('answerInput').disabled = !enabled;
    document.getElementById('submitBtn').disabled = !enabled;
}

document.addEventListener('DOMContentLoaded', initChat);
