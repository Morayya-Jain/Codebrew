import StartGame from './game/main';

interface VendorFullscreenElement extends HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
}

document.addEventListener('DOMContentLoaded', () => {
    const game = StartGame('game-container');
    // Dev hook - exposes the Phaser Game instance so e2e scripts and the
    // browser console can poke at scenes/systems. Harmless in production.
    (window as unknown as { __wtcGame?: unknown }).__wtcGame = game;

    // Kiosk mode via ?kiosk=true URL param. Enables fullscreen, disables
    // right-click context menu, adds a body class so CSS can hide any
    // developer-facing UI.
    const params = new URLSearchParams(location.search);
    if (params.has('kiosk')) {
        document.documentElement.classList.add('kiosk-mode');
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        // Request fullscreen on the first user gesture (browsers block
        // programmatic fullscreen outside a user activation context).
        const requestFs = () => {
            const el = document.documentElement as VendorFullscreenElement;
            const fn = el.requestFullscreen ?? el.webkitRequestFullscreen ?? el.msRequestFullscreen;
            if (typeof fn === 'function') {
                fn.call(el).catch(() => { /* user dismissed */ });
            }
            document.removeEventListener('pointerdown', requestFs);
            document.removeEventListener('keydown', requestFs);
        };
        document.addEventListener('pointerdown', requestFs, { once: false });
        document.addEventListener('keydown', requestFs, { once: false });
    }
});
