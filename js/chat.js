let session = {
    context: '',
    contextType: '',
    topicName: '',
    questionCount: 10,
    difficulty: 'easy-medium',
    isFreeTier: false,
    interviewId: null,
    questions: [],
    answers: [],
    scores: [],
    currentQuestion: 0,
    isProcessing: false,
    excludedTopics: [],
    currentBotMsgEl: null
};

function showChatError(error, internalCode, context, options = {}) {
    const details = ErrorHandler.capture(error, {
        internalCode,
        context,
        publicPrefix: 'CHAT'
    });
    if (!options.silent) {
        addMessage(ErrorHandler.userMessage(details.publicCode), 'error');
    }
    return details;
}

async function initChat() {
    try {
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
        session.isFreeTier = config.isFreeTier || false;

        const topicEl = document.getElementById('sessionTopic');
        topicEl.textContent = session.contextType === 'topic'
            ? `${session.topicName} Interview`
            : 'Job Description Interview';

        updateProgress();
        initMetrics();
        setupInputHandlers();

        const interview = await DatabaseService.createInterview({
            mode: session.contextType,
            topic: session.contextType === 'topic' ? session.topicName : 'Job Description',
            jdText: session.contextType === 'jd' ? session.context : null,
            difficulty: session.difficulty,
            totalQuestions: session.questionCount
        });

        if (interview) {
            session.interviewId = interview.id;
        }

        if (session.contextType === 'jd') {
            loadKeywords(session.context);
        }

        askNextQuestion();
    } catch (error) {
        showChatError(error, 'CHAT-INIT-001', 'chat.initChat');
        setInputEnabled(false);
    }
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
        showChatError(err, 'CHAT-QUESTION-GEN-001', 'chat.askNextQuestion');
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

        // Save question + answer + scores to database
        if (session.interviewId) {
            const questionOverall = Math.round(
                (score.accuracy + score.depth + score.clarity + score.relevance + score.practicalKnowledge) / 5
            );
            await DatabaseService.saveQuestion(session.interviewId, {
                questionNumber: session.currentQuestion + 1,
                questionText: currentQ,
                answerText: answer,
                feedback: score.feedback,
                scores: { ...score, overall: questionOverall }
            });
        }

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
        showChatError(err, 'CHAT-ANSWER-EVAL-001', 'chat.handleSubmit');
        setInputEnabled(true);
        session.isProcessing = false;
    }
}

async function endSession() {
    try {
        setInputEnabled(false);

        const overallScore = getOverallScore();
        const cumulativeScores = getCumulativeScores();

        const grade = overallScore >= 90 ? 'A+' : overallScore >= 80 ? 'A' :
            overallScore >= 70 ? 'B' : overallScore >= 60 ? 'C' :
            overallScore >= 50 ? 'D' : 'F';

        if (session.interviewId) {
            await DatabaseService.completeInterview(session.interviewId, {
                overall: overallScore,
                accuracy: Math.round(cumulativeScores.accuracy),
                depth: Math.round(cumulativeScores.depth),
                clarity: Math.round(cumulativeScores.clarity),
                relevance: Math.round(cumulativeScores.relevance),
                practical: Math.round(cumulativeScores.practicalKnowledge)
            }, grade);
        }

        if (session.isFreeTier) {
            await DatabaseService.markFreeTierExhausted();
        }

        const reportData = {
            interviewId: session.interviewId,
            context: session.context,
            contextType: session.contextType,
            topicName: session.topicName,
            difficulty: session.difficulty,
            questions: session.questions,
            answers: session.answers,
            scores: session.scores,
            overallScore,
            cumulativeScores
        };
        sessionStorage.setItem('interviewReport', JSON.stringify(reportData));

        addMessage(
            `Interview complete! You answered ${session.scores.length} questions.\n\n` +
            `<a href="report.html">View your full report card →</a>`,
            'complete'
        );
    } catch (error) {
        showChatError(error, 'CHAT-END-001', 'chat.endSession');
    }
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
        showChatError(err, 'CHAT-QUESTION-RELOAD-001', 'chat.reloadCurrentQuestion');
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
    } catch (error) {
        ErrorHandler.capture(error, {
            internalCode: 'CHAT-KEYWORDS-001',
            context: 'chat.loadKeywords',
            publicPrefix: 'CHAT'
        });
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

// ─── Inactivity & Tab-Switch Detection ──────────────────

let inactivityTimer = null;
const INACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 minutes

function isSessionComplete() {
    return session.currentQuestion >= session.questionCount;
}

function getPendingInfo() {
    const answered = session.scores.length;
    const total = session.questionCount;
    const pending = total - answered;
    return { answered, total, pending };
}

function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (isSessionComplete()) return;

    inactivityTimer = setTimeout(() => {
        if (!isSessionComplete()) showExitPrompt('inactivity');
    }, INACTIVITY_TIMEOUT);
}

function showExitPrompt(reason) {
    // Don't show if already showing or session is done
    if (document.getElementById('exitModal') || isSessionComplete()) return;

    const { answered, total, pending } = getPendingInfo();
    const tierNote = session.isFreeTier ? '' : ' that you configured for this session';

    const reasonMsg = reason === 'tab-switch'
        ? `It looks like you switched away from the interview.`
        : `You've been inactive for a while.`;

    const modal = document.createElement('div');
    modal.id = 'exitModal';
    modal.className = 'exit-modal-overlay';
    modal.innerHTML = `
        <div class="exit-modal">
            <div class="exit-modal-icon">⏸️</div>
            <h3>Interview Paused</h3>
            <p>${reasonMsg}</p>
            <p class="exit-modal-detail">
                You have <strong>${total} questions${tierNote}</strong>, but only
                <strong>${answered}</strong> answered so far.
                <strong>${pending} question${pending !== 1 ? 's' : ''} remaining</strong> — 
                would you like to continue or end the interview?
            </p>
            <div class="exit-modal-actions">
                <button class="btn-primary exit-continue" id="exitContinue">Continue Interview</button>
                <button class="exit-end" id="exitEnd">End Interview</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('exitContinue').addEventListener('click', () => {
        modal.remove();
        resetInactivityTimer();
        document.getElementById('answerInput').focus();
    });

    document.getElementById('exitEnd').addEventListener('click', () => {
        modal.remove();
        endSession();
    });
}

function initInactivityDetection() {
    // Reset timer on user activity
    ['keydown', 'mousedown', 'touchstart', 'scroll'].forEach(evt => {
        document.addEventListener(evt, resetInactivityTimer, { passive: true });
    });

    // Tab visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && !isSessionComplete()) {
            showExitPrompt('tab-switch');
        } else {
            resetInactivityTimer();
        }
    });

    // Browser/tab close
    window.addEventListener('beforeunload', (e) => {
        if (!isSessionComplete() && session.scores.length > 0) {
            e.preventDefault();
        }
    });

    resetInactivityTimer();
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        initChat();
        initInactivityDetection();
    } catch (error) {
        showChatError(error, 'CHAT-BOOTSTRAP-001', 'chat.DOMContentLoaded');
    }
});
