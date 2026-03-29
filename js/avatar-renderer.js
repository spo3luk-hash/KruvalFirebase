/**
 * Avatar Renderer
 * Tento skript poskytuje globální funkce pro vykreslování avatarů a jejich rámečků.
 * Je navržen tak, aby byl volán z jiných skriptů, které potřebují zobrazit avatara postavy.
 */

// Definice dostupných SVG rámečků
const SVG_FRAMES_RENDERER = [
    { id: 'frame-default', name: 'Žádný' },
    { id: 'frame-svg-1', name: 'Zlatý Kruh', svg: '<circle cx="128" cy="128" r="124"/>' },
    { id: 'frame-svg-2', name: 'Stříbrný Kruh', svg: '<circle cx="128" cy="128" r="124"/>' },
    { id: 'frame-svg-3', name: 'Dvojitý Kruh', svg: '<circle class="outer-circle" cx="128" cy="128" r="124"/><circle class="inner-circle" cx="128" cy="128" r="118"/>' },
    { id: 'frame-svg-4', name: 'Runový Kruh', svg: '<circle class="runic-circle" cx="128" cy="128" r="122"/>' },
    { id: 'frame-svg-5', name: 'Magická Záře', svg: '<circle cx="128" cy="128" r="124"/>' },
    { id: 'frame-svg-6', name: 'Kovaný Kov',
      svg: `
        <defs>
          <linearGradient id="forged-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#999;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#555;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#999;stop-opacity:1" />
          </linearGradient>
        </defs>
        <circle cx="128" cy="128" r="120"/>
      `
    },
    { id: 'frame-svg-7', name: 'Přerušovaný Kruh', svg: '<circle cx="128" cy="128" r="123"/>' },
    { id: 'frame-svg-8', name: 'Ledový Kruh', svg: '<circle cx="128" cy="128" r="122"/>' },
];

/**
 * Vykreslí SVG rámeček avataru do všech kontejnerů na stránce.
 * Hledá elementy s třídou .avatar-container a atributem data-frame-id.
 */
function renderAvatarFrames() {
    document.querySelectorAll('.avatar-container').forEach(container => {
        const frameId = container.getAttribute('data-frame-id');
        const frameContainer = container.querySelector('.avatar-frame-container');
        
        if (frameId && frameContainer) {
            const selectedFrame = SVG_FRAMES_RENDERER.find(f => f.id === frameId);
            if (selectedFrame && selectedFrame.svg) {
                frameContainer.innerHTML = `<div class="avatar-frame" data-frame="${selectedFrame.id}"><svg viewBox="0 0 256 256">${selectedFrame.svg}</svg></div>`;
            } else {
                frameContainer.innerHTML = ''; // Vyčistit, pokud rámeček neexistuje
            }
        }
    });
}

/**
 * Vykreslí samotný avatar postavy (obrázek nebo iniciálu) na základě dat postavy.
 * Podporuje nový formát `avatarSettings` (s přiblížením a pozicí) i starý formát `avatar`.
 * @param {HTMLElement} container - Element, který obsahuje jak obrázek/iniciálu, tak i případný rámeček. Např. `.char-avatar-preview`
 * @param {object} characterData - Objekt s daty postavy z Firestore.
 */
function renderCharacterAvatar(container, characterData) {
    if (!container || !characterData) return;

    // Najdeme elementy pro obrázek a pro iniciálu uvnitř kontejneru.
    // Podporujeme více různých selektorů pro flexibilitu napříč různými HTML strukturami.
    const imageElement = container.querySelector('.avatar-image, .char-avatar-preview, .public-preview-avatar, .post-author-avatar');
    const initialElement = container.querySelector('.avatar-initial, .char-avatar-initial, .public-preview-initial');

    if (!imageElement) {
        console.warn('Avatar Renderer: Nepodařilo se najít element pro obrázek v kontejneru:', container);
        return;
    }

    const hasSettings = characterData.avatarSettings && characterData.avatarSettings.url;
    const hasLegacyAvatar = characterData.avatar;
    const charName = characterData.jmeno || '?';

    // Priorita 1: Nová `avatarSettings`
    if (hasSettings) {
        imageElement.style.backgroundImage = `url('${characterData.avatarSettings.url}')`;
        imageElement.style.backgroundSize = `${characterData.avatarSettings.zoom * 100}%`;
        imageElement.style.backgroundPosition = `${characterData.avatarSettings.position.x * 100}% ${characterData.avatarSettings.position.y * 100}%`;
        if (initialElement) initialElement.style.display = 'none';
    }
    // Priorita 2: Staré pole `avatar`
    else if (hasLegacyAvatar) {
        imageElement.style.backgroundImage = `url('${characterData.avatar}')`;
        imageElement.style.backgroundSize = 'cover';
        imageElement.style.backgroundPosition = 'center';
        if (initialElement) initialElement.style.display = 'none';
    }
    // Priorita 3: Zobrazit iniciálu
    else {
        imageElement.style.backgroundImage = 'none';
        if (initialElement) {
            initialElement.textContent = charName.charAt(0).toUpperCase();
            initialElement.style.display = 'flex';
            initialElement.style.alignItems = 'center';
            initialElement.style.justifyContent = 'center';
        }
    }
}

// Zpřístupnění funkcí globálně, aby je mohly volat ostatní skripty
window.renderAvatarFrames = renderAvatarFrames;
window.renderCharacterAvatar = renderCharacterAvatar;
