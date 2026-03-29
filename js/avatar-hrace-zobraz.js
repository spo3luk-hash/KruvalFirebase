
/**
 * @file avatar-hrace-zobraz.js
 * @description Obsahuje JEDINOU funkci pro načtení a zobrazení avataru a rámečku hráče napříč aplikací.
 */

/**
 * Načte data hráče (avatar, rámeček) z jeho dokumentu v kolekci 'hraci' a zobrazí je.
 * Tato funkce je navržena tak, aby byla flexibilní a fungovala jak s <img> elementy,
 * tak s <div> elementy, které používají background-image a CSS třídy pro rámečky.
 *
 * @param {string} userId UID přihlášeného uživatele z Firebase Auth.
 * @param {HTMLElement} avatarElement Element pro zobrazení avataru (může být <img> nebo <div>).
 * @param {HTMLElement} frameElement Element pro zobrazení rámečku (může být <img> nebo <div>).
 * @param {string} [initials] Nepovinné. Iniciály nebo jméno, které se zobrazí, pokud není k dispozici avatar.
 */
async function zobrazAvatarHrace(userId, avatarElement, frameElement, initials = '?') {
    const db = firebase.firestore();

    if (!userId || !avatarElement || !frameElement) {
        console.error("Funkci zobrazAvatarHrace chybí potřebné argumenty (userId, avatarElement, frameElement).");
        return;
    }

    try {
        const userDoc = await db.collection('hraci').doc(userId).get(); // ZMĚNA: čtení z 'hraci'

        let avatarUrl = null;
        let frameCssClass = null;
        let displayName = '';

        if (userDoc.exists) {
            const userData = userDoc.data();
            avatarUrl = userData.avatarUrl;
            frameCssClass = userData.frameCssClass;
            displayName = userData.herniNick || ''; // ZMĚNA: čtení 'herniNick'
        } else {
            console.warn(`Hráč s UID ${userId} nenalezen v kolekci 'hraci'. Zobrazuji výchozí stav.`);
        }
        
        // --- Zobrazení Avatara ---
        if (avatarElement.tagName.toLowerCase() === 'img') {
             avatarElement.src = avatarUrl || '';
        } else { 
            if (avatarUrl) {
                avatarElement.style.backgroundImage = `url('${avatarUrl}')`;
                const initialEl = avatarElement.querySelector('span');
                if(initialEl) initialEl.style.display = 'none';
            } else {
                avatarElement.style.backgroundImage = 'none';
                const initialEl = avatarElement.querySelector('span');
                if(initialEl) {
                    initialEl.textContent = (displayName.charAt(0) || initials).toUpperCase();
                    initialEl.style.display = 'flex';
                }
            }
        }

        // --- Zobrazení Rámečku ---
        const finalFrameClass = frameCssClass || 'frame-0';

        if (frameElement.tagName.toLowerCase() === 'img') {
            console.warn('Zobrazování rámečků přes <img> již není podporováno. Použijte <div> s CSS třídami.');
            frameElement.src = ''; 
        } else { 
             frameElement.className = 'avatar-frame'; // Reset
             frameElement.classList.add(finalFrameClass);
        }

    } catch (error) {
        console.error(`Došlo k chybě při načítání dat pro hráče ${userId}:`, error);
    }
}
