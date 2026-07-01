function initTheme() {
    try {
        // Customization is intentionally disabled: keep a single fixed theme.
        document.documentElement.classList.remove('dark');
        localStorage.removeItem('theme-dark');
        localStorage.removeItem('theme-color');
    } catch (error) {
        ErrorHandler.capture(error, {
            internalCode: 'THEME-INIT-001',
            context: 'theme.initTheme',
            publicPrefix: 'THEME'
        });
    }
}

// Run immediately (script is in <head> or top of <body>)
document.addEventListener('DOMContentLoaded', initTheme);
