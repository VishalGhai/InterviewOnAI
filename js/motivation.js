const MILESTONES = [
    {
        threshold: 25,
        emoji: '🚀',
        title: 'Getting Started!',
        message: 'You\'re building momentum. Keep pushing forward!'
    },
    {
        threshold: 50,
        emoji: '💪',
        title: 'Halfway There!',
        message: 'Great progress! You\'re showing solid knowledge.'
    },
    {
        threshold: 75,
        emoji: '🔥',
        title: 'Almost There!',
        message: 'Impressive performance! You\'re on fire!'
    },
    {
        threshold: 100,
        emoji: '🏆',
        title: 'Perfect Score!',
        message: 'Outstanding! You\'ve mastered this interview!'
    }
];

const triggeredMilestones = new Set();

function checkMilestones(overallScore) {
    for (const milestone of MILESTONES) {
        if (overallScore >= milestone.threshold && !triggeredMilestones.has(milestone.threshold)) {
            triggeredMilestones.add(milestone.threshold);
            showMotivationPopup(milestone);
            return;
        }
    }
}

function showMotivationPopup(milestone) {
    const overlay = document.getElementById('motivationOverlay');
    const emoji = document.getElementById('motivationEmoji');
    const title = document.getElementById('motivationTitle');
    const message = document.getElementById('motivationMessage');

    emoji.textContent = milestone.emoji;
    title.textContent = milestone.title;
    message.textContent = milestone.message;

    spawnConfetti(milestone.threshold);

    overlay.classList.add('active');

    const dismiss = () => {
        overlay.classList.remove('active');
        overlay.removeEventListener('click', dismiss);
        clearConfetti();
    };

    overlay.addEventListener('click', dismiss);
    setTimeout(dismiss, 3000);
}

function spawnConfetti(intensity) {
    const container = document.getElementById('confettiContainer');
    container.innerHTML = '';

    const count = Math.floor(intensity / 25) * 15;
    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

    for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.classList.add('confetti-piece');
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = `${1 + Math.random() * 2}s`;
        piece.style.animationDelay = `${Math.random() * 0.5}s`;
        piece.style.width = `${5 + Math.random() * 6}px`;
        piece.style.height = `${5 + Math.random() * 6}px`;
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        container.appendChild(piece);
    }
}

function clearConfetti() {
    const container = document.getElementById('confettiContainer');
    if (container) container.innerHTML = '';
}

function resetMilestones() {
    triggeredMilestones.clear();
}
