/**
 * ankety-forum.js
 * Tento soubor obsahuje logiku pro zobrazení anket a hlasování.
 * Je navržen jako samostatný modul, který je inicializován z thread-view.js.
 */

window.Kruval = window.Kruval || {};
window.Kruval.pollSystem = (function() {

    let db;
    let currentUser;
    let threadRef;
    let threadData;
    let pollContainer;

    /**
     * Inicializuje modul pro zobrazení a interakci s anketou.
     * @param {object} firestoreDb - Instance databáze Firestore.
     * @param {object} user - Objekt aktuálně přihlášeného uživatele.
     * @param {object} tRef - Reference na dokument tématu v databázi.
     * @param {object} tData - Data načteného tématu.
     * @param {HTMLElement} container - HTML element, do kterého se má anketa vykreslit.
     */
    async function initialize(firestoreDb, user, tRef, tData, container) {
        db = firestoreDb;
        currentUser = user;
        threadRef = tRef;
        threadData = tData;
        pollContainer = container;

        if (!currentUser) return; // Uživatel musí být přihlášen pro zobrazení/hlasování

        await loadAndRenderPoll();
    }

    /**
     * Načte data ankety a rozhodne, zda zobrazit hlasování nebo výsledky.
     */
    async function loadAndRenderPoll() {
        try {
            const optionsSnapshot = await threadRef.collection('moznosti').get();
            const votesSnapshot = await threadRef.collection('hlasy').doc(currentUser.uid).get();

            const options = [];
            optionsSnapshot.forEach(doc => {
                options.push({ id: doc.id, ...doc.data() });
            });

            const totalVotes = options.reduce((sum, opt) => sum + opt.pocetHlasu, 0);

            if (votesSnapshot.exists) {
                // Uživatel již hlasoval, zobrazit výsledky
                renderResults(options, totalVotes);
            } else {
                // Uživatel ještě nehlasoval, zobrazit formulář pro hlasování
                renderVotingForm(options, totalVotes);
            }
        } catch (error) {
            console.error("Chyba při načítání ankety: ", error);
            pollContainer.innerHTML = `<p class="error-message">Při načítání ankety došlo k chybě.</p>`;
        }
    }

    /**
     * Vykreslí formulář pro hlasování v anketě.
     * @param {Array} options - Pole objektů s možnostmi ankety.
     * @param {number} totalVotes - Celkový počet hlasů v anketě.
     */
    function renderVotingForm(options, totalVotes) {
        let optionsHtml = options.map(opt => `
            <li class="poll-option">
                <label>
                    <input type="radio" name="poll-option" value="${opt.id}">
                    ${opt.text}
                </label>
            </li>
        `).join('');

        pollContainer.innerHTML = `
            <div class="poll-wrapper">
                <h3 class="poll-question">${threadData.otazka}</h3>
                <form id="poll-vote-form">
                    <ul class="poll-options-list">${optionsHtml}</ul>
                    <button type="submit" class="poll-vote-button">Hlasovat</button>
                </form>
                <div class="poll-footer">Celkem hlasů: ${totalVotes}</div>
            </div>
        `;

        document.getElementById('poll-vote-form').addEventListener('submit', handleVoteSubmit);
    }

    /**
     * Vykreslí výsledky ankety.
     * @param {Array} options - Pole objektů s možnostmi ankety.
     * @param {number} totalVotes - Celkový počet hlasů v anketě.
     */
    function renderResults(options, totalVotes) {
        let resultsHtml = options.map(opt => {
            const percentage = (totalVotes > 0) ? ((opt.pocetHlasu / totalVotes) * 100).toFixed(1) : 0;
            return `
                <li class="poll-result-item">
                    <div class="result-info">
                        <span class="result-text">${opt.text} (${opt.pocetHlasu})</span>
                        <span class="result-percentage">${percentage}%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fg" style="width: ${percentage}%;"></div>
                    </div>
                </li>
            `;
        }).join('');

        pollContainer.innerHTML = `
            <div class="poll-wrapper">
                <h3 class="poll-question">${threadData.otazka}</h3>
                <ul class="poll-results-list">${resultsHtml}</ul>
                <div class="poll-footer">Celkem hlasů: ${totalVotes}</div>
            </div>
        `;
    }

    /**
     * Zpracuje odeslání hlasu.
     * @param {Event} e - Událost odeslání formuláře.
     */
    async function handleVoteSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const selectedOption = form.querySelector('input[name="poll-option"]:checked');
        
        if (!selectedOption) {
            alert('Musíte vybrat jednu z možností.');
            return;
        }

        const optionId = selectedOption.value;
        form.querySelector('button').disabled = true;

        try {
            const voteRef = threadRef.collection('hlasy').doc(currentUser.uid);
            const optionRef = threadRef.collection('moznosti').doc(optionId);

            await db.runTransaction(async (transaction) => {
                const userVoteDoc = await transaction.get(voteRef);
                if (userVoteDoc.exists) {
                    throw new Error("Uživatel již v této anketě hlasoval.");
                }

                transaction.set(voteRef, { optionId: optionId, cas: firebase.firestore.FieldValue.serverTimestamp() });
                transaction.update(optionRef, { pocetHlasu: firebase.firestore.FieldValue.increment(1) });
            });
            
            // Po úspěšném hlasování znovu načteme anketu, aby se zobrazily výsledky
            await loadAndRenderPoll();

        } catch (error) {
            console.error("Chyba při hlasování: ", error);
            alert(error.message || "Při odesílání hlasu došlo k chybě.");
            form.querySelector('button').disabled = false;
        }
    }

    return {
        initialize: initialize
    };

})();
