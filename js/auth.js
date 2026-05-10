/* Auth module — localStorage-based username/password auth */

(function () {
    const USERS_KEY = 'interviewai-users';
    const SESSION_KEY = 'interviewai-session';

    // --- Helpers ---

    function getUsers() {
        try {
            return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
        } catch { return {}; }
    }

    function saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    // Simple hash (not cryptographic — acceptable for client-only demo)
    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // --- Public API (attached to window) ---

    window.AuthManager = {
        isLoggedIn() {
            return !!sessionStorage.getItem(SESSION_KEY);
        },

        getUsername() {
            return sessionStorage.getItem(SESSION_KEY) || '';
        },

        logout() {
            sessionStorage.removeItem(SESSION_KEY);
            window.location.href = 'login.html';
        },

        /** Guard: redirect to login if not authenticated */
        requireAuth() {
            if (!this.isLoggedIn()) {
                window.location.href = 'login.html';
                return false;
            }
            return true;
        },

        /** Render user badge + logout on authenticated pages */
        renderUserBadge() {
            if (!this.isLoggedIn()) return;
            const username = this.getUsername();
            const badge = document.createElement('div');
            badge.className = 'user-badge';
            badge.innerHTML = `
                <div class="user-avatar">${username.charAt(0)}</div>
                <span class="user-name">${username}</span>
                <button class="logout-btn" id="logoutBtn">Logout</button>
            `;
            document.body.appendChild(badge);
            document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        }
    };

    // --- Login page logic ---

    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    // Only run on login.html
    if (!loginForm) return;

    // If already logged in, go to index
    if (AuthManager.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    // Toggle forms
    document.getElementById('showSignup').addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        signupForm.querySelector('input').focus();
    });

    document.getElementById('showLogin').addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        loginForm.querySelector('input').focus();
    });

    // Password visibility toggles
    document.querySelectorAll('.toggle-pass').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.textContent = isPassword ? '🙈' : '👁';
        });
    });

    function showError(id, msg) {
        const el = document.getElementById(id);
        el.textContent = msg;
        setTimeout(() => { el.textContent = ''; }, 4000);
    }

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUser').value.trim().toLowerCase();
        const password = document.getElementById('loginPass').value;

        if (!username || !password) {
            showError('loginError', 'Please fill in all fields');
            return;
        }

        const users = getUsers();
        const hash = await hashPassword(password);

        if (!users[username] || users[username] !== hash) {
            showError('loginError', 'Invalid username or password');
            document.getElementById('loginPass').classList.add('error');
            setTimeout(() => document.getElementById('loginPass').classList.remove('error'), 2000);
            return;
        }

        sessionStorage.setItem(SESSION_KEY, username);
        window.location.href = 'index.html';
    });

    // Signup
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('signupUser').value.trim().toLowerCase();
        const password = document.getElementById('signupPass').value;
        const confirm = document.getElementById('signupConfirm').value;

        if (!username || !password || !confirm) {
            showError('signupError', 'Please fill in all fields');
            return;
        }

        if (username.length < 3) {
            showError('signupError', 'Username must be at least 3 characters');
            return;
        }

        if (password.length < 6) {
            showError('signupError', 'Password must be at least 6 characters');
            return;
        }

        if (password !== confirm) {
            showError('signupError', 'Passwords do not match');
            document.getElementById('signupConfirm').classList.add('error');
            setTimeout(() => document.getElementById('signupConfirm').classList.remove('error'), 2000);
            return;
        }

        const users = getUsers();

        if (users[username]) {
            showError('signupError', 'Username already taken');
            return;
        }

        const hash = await hashPassword(password);
        users[username] = hash;
        saveUsers(users);

        sessionStorage.setItem(SESSION_KEY, username);
        window.location.href = 'index.html';
    });
})();
