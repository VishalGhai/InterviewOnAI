const THEMES = [
    { name: 'Blue',   accent: '#2563eb', accentHover: '#1d4ed8', darkAccent: '#3b82f6', darkAccentHover: '#60a5fa' },
    { name: 'Purple', accent: '#7c3aed', accentHover: '#6d28d9', darkAccent: '#8b5cf6', darkAccentHover: '#a78bfa' },
    { name: 'Green',  accent: '#059669', accentHover: '#047857', darkAccent: '#10b981', darkAccentHover: '#34d399' },
    { name: 'Rose',   accent: '#e11d48', accentHover: '#be123c', darkAccent: '#f43f5e', darkAccentHover: '#fb7185' },
    { name: 'Amber',  accent: '#d97706', accentHover: '#b45309', darkAccent: '#f59e0b', darkAccentHover: '#fbbf24' }
];

function initTheme() {
    const savedDark = localStorage.getItem('theme-dark');
    const savedColor = localStorage.getItem('theme-color');

    // Apply dark mode
    if (savedDark === 'true' || (savedDark === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }

    // Apply accent color
    if (savedColor !== null) {
        applyAccentColor(parseInt(savedColor));
    }

    renderThemeToolbar();
}

function renderThemeToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'theme-toolbar';

    // Dark mode toggle
    const isDark = document.documentElement.classList.contains('dark');
    const darkBtn = document.createElement('button');
    darkBtn.className = 'theme-btn dark-toggle';
    darkBtn.textContent = isDark ? '☀️' : '🌙';
    darkBtn.title = 'Toggle dark/light mode';
    darkBtn.addEventListener('click', toggleDarkMode);

    // Color picker button
    const colorBtn = document.createElement('div');
    colorBtn.className = 'theme-color-wrapper';

    const colorTrigger = document.createElement('button');
    colorTrigger.className = 'theme-btn color-trigger';
    colorTrigger.textContent = '🎨';
    colorTrigger.title = 'Change theme color';

    const colorDropdown = document.createElement('div');
    colorDropdown.className = 'color-dropdown';

    const activeIndex = parseInt(localStorage.getItem('theme-color') || '0');

    THEMES.forEach((theme, i) => {
        const swatch = document.createElement('button');
        swatch.className = 'color-swatch' + (i === activeIndex ? ' active' : '');
        swatch.style.background = theme.accent;
        swatch.title = theme.name;
        swatch.addEventListener('click', () => {
            applyAccentColor(i);
            localStorage.setItem('theme-color', i);
            colorDropdown.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
        });
        colorDropdown.appendChild(swatch);
    });

    colorBtn.appendChild(colorTrigger);
    colorBtn.appendChild(colorDropdown);

    toolbar.appendChild(darkBtn);
    toolbar.appendChild(colorBtn);
    document.body.appendChild(toolbar);
}

function toggleDarkMode() {
    const html = document.documentElement;
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    localStorage.setItem('theme-dark', isDark);

    // Update toggle button text
    const btn = document.querySelector('.dark-toggle');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';

    // Re-apply accent for correct dark/light variant
    const savedColor = parseInt(localStorage.getItem('theme-color') || '0');
    applyAccentColor(savedColor);
}

function applyAccentColor(index) {
    const theme = THEMES[index] || THEMES[0];
    const isDark = document.documentElement.classList.contains('dark');
    document.documentElement.style.setProperty('--accent', isDark ? theme.darkAccent : theme.accent);
    document.documentElement.style.setProperty('--accent-hover', isDark ? theme.darkAccentHover : theme.accentHover);
}

// Run immediately (script is in <head> or top of <body>)
document.addEventListener('DOMContentLoaded', initTheme);
