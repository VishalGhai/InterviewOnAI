/* Auth Module — Google OAuth via Supabase */

(function () {

    function showAuthError(error, internalCode) {
        const el = document.getElementById('authError');
        ErrorHandler.surface(error, {
            internalCode,
            context: 'auth.module',
            publicPrefix: 'AUTH',
            presenter: (message) => {
                if (el) {
                    el.textContent = message;
                    setTimeout(() => { el.textContent = ''; }, 5000);
                } else {
                    alert(message);
                }
            }
        });
    }

    // ─── Public API ─────────────────────────────────────────

    window.AuthManager = {
        async isLoggedIn() {
            if (!REQUIRE_LOGIN) return true;
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                return !!session;
            } catch (error) {
                ErrorHandler.capture(error, {
                    internalCode: 'AUTH-SESSION-001',
                    context: 'AuthManager.isLoggedIn',
                    publicPrefix: 'AUTH'
                });
                return false;
            }
        },

        async getUser() {
            if (!REQUIRE_LOGIN) return { email: TEST_EMAIL, user_metadata: { full_name: TEST_EMAIL.split('@')[0] } };
            try {
                const { data: { user } } = await supabaseClient.auth.getUser();
                return user;
            } catch (error) {
                ErrorHandler.capture(error, {
                    internalCode: 'AUTH-USER-001',
                    context: 'AuthManager.getUser',
                    publicPrefix: 'AUTH'
                });
                return null;
            }
        },

        async getUsername() {
            if (!REQUIRE_LOGIN) return TEST_EMAIL.split('@')[0];
            try {
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (!user) return '';
                return user.user_metadata?.full_name
                    || user.user_metadata?.name
                    || user.email?.split('@')[0]
                    || '';
            } catch (error) {
                ErrorHandler.capture(error, {
                    internalCode: 'AUTH-USERNAME-001',
                    context: 'AuthManager.getUsername',
                    publicPrefix: 'AUTH'
                });
                return '';
            }
        },

        async getAvatarUrl() {
            if (!REQUIRE_LOGIN) return null;
            try {
                const { data: { user } } = await supabaseClient.auth.getUser();
                return user?.user_metadata?.avatar_url || null;
            } catch (error) {
                ErrorHandler.capture(error, {
                    internalCode: 'AUTH-AVATAR-001',
                    context: 'AuthManager.getAvatarUrl',
                    publicPrefix: 'AUTH'
                });
                return null;
            }
        },

        async logout() {
            if (!REQUIRE_LOGIN) {
                window.location.href = 'index.html';
                return;
            }
            try {
                await supabaseClient.auth.signOut();
                window.location.href = 'login.html';
            } catch (error) {
                showAuthError(error, 'AUTH-LOGOUT-001');
            }
        },

        async requireAuth() {
            if (!REQUIRE_LOGIN) return true;
            const loggedIn = await this.isLoggedIn();
            if (!loggedIn) {
                window.location.href = 'login.html';
                return false;
            }
            return true;
        },

        async renderUserBadge() {
            try {
                const loggedIn = await this.isLoggedIn();
                if (!loggedIn) return;

                const username = await this.getUsername();
                const avatarUrl = await this.getAvatarUrl();

                const avatarHtml = avatarUrl
                    ? `<img class="user-avatar-img" src="${avatarUrl}" alt="${username}" referrerpolicy="no-referrer">`
                    : `<div class="user-avatar">${username.charAt(0).toUpperCase()}</div>`;

                const headerSlot = document.getElementById('headerUser');
                if (headerSlot) {
                    headerSlot.innerHTML = `
                        ${avatarHtml}
                        <span class="user-name">${username}</span>
                        <button class="logout-btn" id="logoutBtn">Logout</button>
                    `;
                    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
                    return;
                }

                const badge = document.createElement('div');
                badge.className = 'user-badge';

                const historyBtn = document.getElementById('historySidebar')
                    ? `<button class="history-toggle" id="historyToggle" aria-label="Interview history">
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                               <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                           </svg>
                           <span>History</span>
                       </button>`
                    : '';

                badge.innerHTML = `
                    ${avatarHtml}
                    <span class="user-name">${username}</span>
                    ${historyBtn}
                    <button class="logout-btn" id="logoutBtn">Logout</button>
                `;
                document.body.appendChild(badge);
                document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
            } catch (error) {
                showAuthError(error, 'AUTH-BADGE-001');
            }
        }
    };

    // ─── Login Page Logic ───────────────────────────────────

    const googleBtn = document.getElementById('googleSignInBtn');

    // Only run login logic on login.html
    if (!googleBtn) return;

    // Bypass login page entirely when flag is off
    if (!REQUIRE_LOGIN) {
        window.location.href = 'index.html';
        return;
    }

    // If already logged in, redirect to index
    (async () => {
        if (await AuthManager.isLoggedIn()) {
            window.location.href = 'index.html';
            return;
        }
    })();

    // ─── Google Sign-In Handler ─────────────────────────────

    googleBtn.addEventListener('click', async () => {
        googleBtn.disabled = true;
        googleBtn.textContent = 'Redirecting...';

        try {
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + window.location.pathname.replace('login.html', 'index.html')
                }
            });

            if (error) {
                throw error;
            }
        } catch (error) {
            googleBtn.disabled = false;
            googleBtn.innerHTML = `
                <svg class="google-icon" viewBox="0 0 24 24" width="20" height="20">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google`;
            showAuthError(error, 'AUTH-OAUTH-001');
        }
    });

})();
