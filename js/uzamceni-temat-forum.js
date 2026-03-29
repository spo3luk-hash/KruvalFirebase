/**
 * uzamceni-temat-forum.js
 * Tento soubor obsahuje veškerou logiku pro zamykání a odemykání témat v rámci fóra.
 * Je navržen jako samostatný modul, který je inicializován z thread-view.js.
 */

window.Kruval = window.Kruval || {};
window.Kruval.forumLocking = (function() {

    let db;
    let currentUser;
    let currentThreadData;
    let threadId;

    const controlsContainer = document.getElementById('thread-controls-container');

    /**
     * Inicializuje modul pro zamykání témat.
     * @param {object} firestoreDb - Instance databáze Firestore.
     * @param {object} user - Objekt aktuálně přihlášeného uživatele.
     * @param {object} threadData - Data aktuálního tématu.
     * @param {string} tId - ID aktuálního tématu.
     */
    function initialize(firestoreDb, user, threadData, tId) {
        db = firestoreDb;
        currentUser = user;
        currentThreadData = threadData;
        threadId = tId;

        render();
    }

    /**
     * Vykreslí ovládací prvky pro zamykání na základě stavu tématu a role uživatele.
     */
    function render() {
        if (!controlsContainer) return;
        // controlsContainer.innerHTML = ''; // Preventivní zakomentování

        if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'superadmin')) {
            renderLockButton();
        }

        renderLockStatus();
    }

    /**
     * Vykreslí tlačítko pro zamknutí/odemknutí tématu.
     */
    function renderLockButton() {
        const isLocked = currentThreadData.zamceno === true;
        const button = document.createElement('button');
        button.id = 'lock-thread-btn';
        button.className = 'forum-button custom-button';
        button.textContent = isLocked ? 'Odemknout téma' : 'Zamknout téma';
        button.addEventListener('click', toggleLockState);
        controlsContainer.appendChild(button);
    }

    /**
     * Vykreslí ikonku zámku a zprávu, pokud je téma uzamčeno.
     */
    function renderLockStatus() {
        const titleElement = document.getElementById('thread-title');
        const replyContainer = document.getElementById('reply-container');

        if (currentThreadData.zamceno === true) {
            if (titleElement && !titleElement.querySelector('.lock-icon')) {
                titleElement.innerHTML += ' <span class="lock-icon">&#128274;</span>';
            }
            if (replyContainer) {
                replyContainer.innerHTML = '<p class="locked-thread-message">Toto téma je uzamčeno. Nelze přidávat nové odpovědi.</p>';
            }
        } 
    }

    /**
     * Přepne stav uzamčení tématu v databázi.
     */
    async function toggleLockState() {
        const newLockState = !(currentThreadData.zamceno === true);
        const lockButton = document.getElementById('lock-thread-btn');
        if (lockButton) lockButton.disabled = true;

        try {
            const threadRef = db.collection('forum_categories').doc(new URLSearchParams(window.location.search).get('cat'))
                                .collection('fora').doc(new URLSearchParams(window.location.search).get('forum'))
                                .collection('temata').doc(threadId);

            await threadRef.update({
                zamceno: newLockState
            });
            window.location.reload();
        } catch (error) {
            console.error("Chyba při změně stavu uzamčení:", error);
            if(window.Kruval.forumAdmin) {
                Kruval.forumAdmin.showAlert('Došlo k chybě při komunikaci s databází.', 'error');
            }
            if (lockButton) lockButton.disabled = false;
        }
    }

    return {
        initialize: initialize
    };

})();