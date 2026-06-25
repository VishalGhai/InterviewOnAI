(function () {
    const PUBLIC_ERROR_TEXT = 'Sorry, we will back soon';
    const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let lastSurfaceTs = 0;
    let lastSurfaceCode = '';

    function generateCode(prefix = 'ERR') {
        let suffix = '';
        for (let i = 0; i < 6; i++) {
            suffix += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
        }
        return `${prefix}${suffix}`;
    }

    function userMessage(publicCode) {
        return `${PUBLIC_ERROR_TEXT} (${publicCode})`;
    }

    function toError(input) {
        if (input instanceof Error) return input;
        if (typeof input === 'string') return new Error(input);
        return new Error('Unknown error');
    }

    function capture(error, options = {}) {
        const err = toError(error);
        const internalCode = options.internalCode || err.internalCode || 'APP-UNCLASSIFIED';
        const publicCode = options.publicCode || generateCode(options.publicPrefix || 'ERR');
        const context = options.context || 'application';

        console.error(`[APP_ERROR] ${internalCode} (${publicCode}) @ ${context}: ${err.message}`, {
            stack: err.stack,
            extra: options.extra || null,
        });

        return {
            internalCode,
            publicCode,
            context,
            error: err,
            message: userMessage(publicCode),
        };
    }

    function surface(error, options = {}) {
        const details = capture(error, options);
        const now = Date.now();
        const shouldSuppressDuplicate = now - lastSurfaceTs < 1200 && details.publicCode === lastSurfaceCode;

        if (!shouldSuppressDuplicate) {
            const targetId = options.targetId || null;
            if (targetId) {
                const el = document.getElementById(targetId);
                if (el) {
                    el.textContent = details.message;
                } else {
                    alert(details.message);
                }
            } else if (typeof options.presenter === 'function') {
                options.presenter(details.message, details);
            } else {
                alert(details.message);
            }

            lastSurfaceTs = now;
            lastSurfaceCode = details.publicCode;
        }

        return details;
    }

    function guardAsync(fn, options = {}) {
        return async function guarded(...args) {
            try {
                return await fn.apply(this, args);
            } catch (error) {
                surface(error, options);
                return undefined;
            }
        };
    }

    window.ErrorHandler = {
        PUBLIC_ERROR_TEXT,
        generateCode,
        userMessage,
        capture,
        surface,
        guardAsync,
    };

    window.addEventListener('error', (event) => {
        surface(event.error || event.message || 'Unhandled runtime error', {
            internalCode: 'APP-WINDOW-ERROR',
            context: 'window.error',
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        surface(event.reason || 'Unhandled promise rejection', {
            internalCode: 'APP-UNHANDLED-REJECTION',
            context: 'window.unhandledrejection',
        });
    });
})();
