// === GLOBAL AVATAR LOGIC - CENTRALIZED ===
// Verze 2.0: Funkce je nyní chytřejší a flexibilnější.

/**
 * DEPRECATED: Tato mapa je zastaralá a bude odstraněna, jakmile všechny části systému
 * přejdou na nový způsob renderování s přímým předáváním SVG.
 */
const frameDefinitions = {
    'frame-svg-1': '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"></circle></svg>',
    'frame-svg-2': '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="48"></circle></svg>',
    'frame-svg-3': '<svg viewBox="0 0 100 100"><circle class="outer-circle" cx="50" cy="50" r="47"></circle><circle class="inner-circle" cx="50" cy="50" r="42"></circle></svg>',
};

/**
 * Vykreslí kompletní avatar hráče: obrázek/iniciálu A dynamicky generovaný SVG rámeček.
 * Funkce je nyní schopna přijmout SVG kód přímo, nebo se vrátit ke staré metodě.
 * 
 * @param {HTMLElement} container - Hlavní kontejner pro avatar (např. div.avatar-container).
 * @param {object} playerData - Objekt s daty o hráči ({ avatar, ramecek, herniNick, ramecekSvg }).
 */
function renderAvatar(container, playerData) {
    if (!container || !playerData) return;

    // Získáváme všechny potřebné vlastnosti, včetně nového ramecekSvg
    const { avatar, ramecek, herniNick, ramecekSvg } = playerData;
    const imageEl = container.querySelector('.avatar-image');
    const frameEl = container.querySelector('.avatar-frame');

    if (!imageEl || !frameEl) {
        console.error("renderAvatar selhal: Požadované elementy (.avatar-image, .avatar-frame) nenalezeny.");
        return;
    }

    // 1. Vyčistíme starý obsah
    frameEl.innerHTML = '';
    if(container.dataset.frameId) delete container.dataset.frameId;

    // 2. Vložíme SVG kód rámečku (NOVÁ, CHYTŘEJŠÍ LOGIKA)
    let finalSvg = '';

    // Priorita č. 1: Použijeme přímo předaný SVG kód
    if (ramecekSvg) {
        finalSvg = `<svg viewBox='0 0 256 256'>${ramecekSvg}</svg>`;
    } 
    // Priorita č. 2 (záložní): Použijeme starou, hardcodovanou mapu
    else if (ramecek && frameDefinitions[ramecek]) {
        finalSvg = frameDefinitions[ramecek];
    }

    if (finalSvg) {
        frameEl.innerHTML = finalSvg;
        // Nastavíme ID pro případné specifické stylování
        if (ramecek) container.dataset.frameId = ramecek;
    }

    // 3. Zpracujeme obrázek avatara nebo iniciálu (beze změny)
    const initial = (herniNick || '?').charAt(0).toUpperCase();
    const hasUrl = avatar && typeof avatar === 'string' && avatar.startsWith('http');

    imageEl.innerHTML = ''; 
    if (hasUrl) {
        imageEl.style.backgroundImage = `url(${avatar})`;
    } else {
        imageEl.style.backgroundImage = 'none';
        imageEl.innerHTML = `<span class="avatar-initial">${initial}</span>`;
    }
}
