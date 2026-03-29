/**
 * sledovani-temat-forum.js
 * Tento soubor obsahuje logiku pro funkci sledování témat.
 * Je navržen jako samostatný modul, který je inicializován z thread-view.js.
 */

window.Kruval = window.Kruval || {};
window.Kruval.threadFollowing = (function() {

    let db;
    let currentUserData;
    let threadData;
    let threadRef;
    let isFollowing = false;

    const controlsContainer = document.getElementById('thread-controls-container');
    const sledovaniStavElement = document.getElementById('sledovani-stav');

    /**
     * Inicializuje modul pro sledování témat.
     * @param {object} firestoreDb - Instance databáze Firestore.
     * @param {object} userData - Objekt s daty aktuálně přihlášeného uživatele.
     * @param {object} tData - Data aktuálního tématu.
     * @param {object} tRef - Reference na dokument tématu ve Firestore.
     */
    function initialize(firestoreDb, userData, tData, tRef) {
        db = firestoreDb;
        currentUserData = userData;
        threadData = tData;
        threadRef = tRef;

        setupFollowing();
    }

    /**
     * Zjistí, zda uživatel již sleduje téma a vykreslí tlačítko.
     */
    async function setupFollowing() {
        if (!currentUserData || !currentUserData.identitaNaForu) {
            return; 
        }

        const followers = threadData.seznamSledujicichIdentit || [];
        isFollowing = followers.includes(currentUserData.identitaNaForu);
        renderFollowButton();
    }
    
    /**
     * Vykreslí tlačítko pro sledování/zrušení sledování.
     */
    function renderFollowButton() {
        if (!controlsContainer || !sledovaniStavElement) return;
        
        // Odstraníme staré tlačítko, pokud existuje
        const oldButton = document.getElementById('sledovat-tema-btn');
        if(oldButton) oldButton.remove();

        const followButton = document.createElement('button');
        followButton.id = 'sledovat-tema-btn';
        followButton.className = 'forum-button custom-button';
        controlsContainer.appendChild(followButton);

        if (isFollowing) {
            followButton.textContent = 'Zrušit sledování';
            sledovaniStavElement.textContent = 'Téma je sledováno';
            sledovaniStavElement.className = 'status-sledovano';
        } else {
            followButton.textContent = 'Sledovat téma';
            sledovaniStavElement.textContent = 'Téma není sledováno';
            sledovaniStavElement.className = 'status-nesledovano';
        }
        followButton.disabled = false;
        sledovaniStavElement.style.display = 'block';
        followButton.addEventListener('click', toggleFollow);
    }

    /**
     * Přepne stav sledování tématu v databázi.
     */
    async function toggleFollow() {
        if (!currentUserData || !currentUserData.identitaNaForu) return;

        const followButton = document.getElementById('sledovat-tema-btn');
        if (followButton) followButton.disabled = true;

        const updateData = isFollowing
            ? { seznamSledujicichIdentit: firebase.firestore.FieldValue.arrayRemove(currentUserData.identitaNaForu) }
            : { seznamSledujicichIdentit: firebase.firestore.FieldValue.arrayUnion(currentUserData.identitaNaForu) };

        try {
            await threadRef.update(updateData);
            isFollowing = !isFollowing;
            // Aktualizace dat tématu po úspěšném přepnutí
            const updatedDoc = await threadRef.get();
            if (updatedDoc.exists) {
                threadData = updatedDoc.data();
            }
            renderFollowButton();
        } catch (error) {
            console.error("Chyba při aktualizaci sledování: ", error);
            if (followButton) followButton.disabled = false;
        }
    }

    return {
        initialize: initialize
    };

})();