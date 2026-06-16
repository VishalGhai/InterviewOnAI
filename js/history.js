/* Interview History Sidebar */

(function () {
    const sidebar = document.getElementById('historySidebar');
    const overlay = document.getElementById('historyOverlay');
    const closeBtn = document.getElementById('historyClose');
    const listEl = document.getElementById('historyList');

    if (!sidebar) return;

    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('open');
        loadHistory();
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
    }

    // Bind toggle via event delegation (button is rendered dynamically by auth.js)
    document.addEventListener('click', (e) => {
        const toggle = e.target.closest('#historyToggle');
        if (toggle) openSidebar();
    });

    closeBtn.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);

    async function loadHistory() {
        try {
            listEl.innerHTML = '<div class="history-loading">Loading...</div>';

            const interviews = await DatabaseService.getInterviewHistory();

            if (!interviews || interviews.length === 0) {
                listEl.innerHTML = '<div class="history-empty">No interviews yet.<br>Start one to see your history here!</div>';
                return;
            }

            listEl.innerHTML = interviews.map(item => {
                const date = new Date(item.started_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                });
                const score = item.overall_score != null ? `${item.overall_score}%` : '—';
                const grade = item.grade || '';
                const badgeClass = item.status === 'completed' ? 'completed' : 'in-progress';
                const badgeText = item.status === 'completed' ? 'Done' : 'In Progress';
                const icon = item.mode === 'topic' ? '📚' : '📋';
                const isClickable = item.status === 'completed';

                return `
                    <a class="history-item" ${isClickable ? `href="report.html?id=${item.id}"` : ''}
                       style="${isClickable ? '' : 'opacity:0.6;cursor:default;'}">
                        <div class="history-item-topic">${icon} ${item.topic}</div>
                        <div class="history-item-meta">
                            <span>${date}</span>
                            <span>${item.total_questions} Qs · ${capitalize(item.difficulty)}</span>
                            <span class="history-item-score">${score} ${grade}</span>
                            <span class="history-item-badge ${badgeClass}">${badgeText}</span>
                        </div>
                    </a>
                `;
            }).join('');
        } catch (error) {
            const details = ErrorHandler.capture(error, {
                internalCode: 'HISTORY-LOAD-001',
                context: 'history.loadHistory',
                publicPrefix: 'HIS'
            });
            listEl.innerHTML = `<div class="history-empty">${ErrorHandler.userMessage(details.publicCode)}</div>`;
        }
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
})();
