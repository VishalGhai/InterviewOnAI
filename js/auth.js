/* Auth Module — Supabase-backed authentication */

(function () {

    // ─── Public API ─────────────────────────────────────────

    window.AuthManager = {
        async isLoggedIn() {
            const { data: { session } } = await supabaseClient.auth.getSession();
            return !!session;
        },

        async getUser() {
            const { data: { user } } = await supabaseClient.auth.getUser();
            return user;
        },

        async getUsername() {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return '';
            return user.user_metadata?.username || user.email?.split('@')[0] || '';
        },

        async logout() {
            await supabaseClient.auth.signOut();
            window.location.href = 'login.html';
        },

        /** Guard: redirect to login if not authenticated */
        async requireAuth() {
            const loggedIn = await this.isLoggedIn();
            if (!loggedIn) {
                window.location.href = 'login.html';
                return false;
            }
            return true;
        },

        /** Render user badge + logout on authenticated pages */
        async renderUserBadge() {
            const loggedIn = await this.isLoggedIn();
            if (!loggedIn) return;

            const username = await this.getUsername();
            const badge = document.createElement('div');
            badge.className = 'user-badge';
            badge.innerHTML = `
                <div class="user-avatar">${username.charAt(0).toUpperCase()}</div>
                <span class="user-name">${username}</span>
                <button class="logout-btn" id="logoutBtn">Logout</button>
            `;
            document.body.appendChild(badge);
            document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        }
    };

    // ─── Login Page Logic ───────────────────────────────────

    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    // Only run login logic on login.html
    if (!loginForm) return;

    // If already logged in, redirect to index
    (async () => {
        if (await AuthManager.isLoggedIn()) {
            window.location.href = 'index.html';
            return;
        }
    })();

    // Toggle between login/signup forms
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

    function showError(elementId, message) {
        const el = document.getElementById(elementId);
        el.textContent = message;
        setTimeout(() => { el.textContent = ''; }, 4000);
    }

    function setButtonLoading(btn, loading) {
        btn.disabled = loading;
        btn.textContent = loading ? 'Please wait...' : btn.dataset.label;
    }

    // Store original button labels
    document.querySelectorAll('.auth-btn').forEach(btn => {
        btn.dataset.label = btn.textContent;
    });

    // ─── Login Handler ──────────────────────────────────────

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('loginUser').value.trim().toLowerCase();
        const password = document.getElementById('loginPass').value;
        const submitBtn = loginForm.querySelector('.auth-btn');

        if (!username || !password) {
            showError('loginError', 'Please fill in all fields');
            return;
        }

        setButtonLoading(submitBtn, true);

        // Supabase Auth uses email — we construct email from username
        const email = `${username}@interviewonai.app`;

        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            setButtonLoading(submitBtn, false);
            showError('loginError', 'Invalid username or password');
            document.getElementById('loginPass').classList.add('error');
            setTimeout(() => document.getElementById('loginPass').classList.remove('error'), 2000);
            return;
        }

        window.location.href = 'index.html';
    });

    // ─── Signup Handler ─────────────────────────────────────

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('signupUser').value.trim().toLowerCase();
        const password = document.getElementById('signupPass').value;
        const confirmPassword = document.getElementById('signupConfirm').value;
        const submitBtn = signupForm.querySelector('.auth-btn');

        if (!username || !password || !confirmPassword) {
            showError('signupError', 'Please fill in all fields');
            return;
        }

        if (username.length < 3) {
            showError('signupError', 'Username must be at least 3 characters');
            return;
        }

        if (!/^[a-z0-9_]+$/.test(username)) {
            showError('signupError', 'Username: only lowercase letters, numbers, underscores');
            return;
        }

        if (password.length < 6) {
            showError('signupError', 'Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            showError('signupError', 'Passwords do not match');
            document.getElementById('signupConfirm').classList.add('error');
            setTimeout(() => document.getElementById('signupConfirm').classList.remove('error'), 2000);
            return;
        }

        setButtonLoading(submitBtn, true);

        const email = `${username}@interviewonai.app`;

        const { error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: { username, display_name: username }
            }
        });

        if (error) {
            setButtonLoading(submitBtn, false);
            if (error.message.includes('already registered')) {
                showError('signupError', 'Username already taken');
            } else {
                showError('signupError', error.message);
            }
            return;
        }

        window.location.href = 'index.html';
    });

})();
