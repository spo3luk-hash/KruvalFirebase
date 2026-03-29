/**
 * Soubor: js/editor-temat.js
 * Účel: Zajišťuje logiku pro úpravu názvu existujících témat.
 * Komunikuje s aplikací výhradně prostřednictvím custom událostí.
 */

document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();

    // Naslouchá žádosti o úpravu tématu.
    document.addEventListener('editThreadRequest', async (event) => {
        const { categoryId, forumId, threadId } = event.detail;
        if (!categoryId || !forumId || !threadId) return;

        try {
            // 1. Načtení aktuálních dat tématu z DB
            const threadRef = db.collection('forum_categories').doc(categoryId)
                              .collection('fora').doc(forumId)
                              .collection('temata').doc(threadId);
                              
            const threadDoc = await threadRef.get();
            if (!threadDoc.exists) {
                Kruval.forumAdmin.showAlert('Toto téma již neexistuje.', 'error');
                return;
            }
            const threadData = threadDoc.data();

            // 2. Zobrazení modálního okna s formulářem
            showEditThreadModal(categoryId, forumId, threadId, threadData);

        } catch (error) {
            console.error("Chyba při přípravě úpravy tématu: ", error);
            Kruval.forumAdmin.showAlert('Došlo k chybě při načítání dat tématu.', 'error');
        }
    });

    /**
     * Zobrazí modální okno pro úpravu tématu.
     * @param {string} categoryId
     * @param {string} forumId
     * @param {string} threadId
     * @param {object} data - Aktuální data tématu (nazev).
     */
    function showEditThreadModal(categoryId, forumId, threadId, data) {
        const modalContent = `
            <h2>Upravit téma</h2>
            <form id="edit-thread-form">
                <div class="form-group">
                    <label for="thread-name">Název tématu</label>
                    <input type="text" id="thread-name" value="${data.nazev || ''}" required>
                </div>
                <div class="modal-actions">
                    <button type="submit" class="admin-button">Uložit změny</button>
                    <button type="button" class="admin-button-secondary" id="cancel-thread-edit">Zrušit</button>
                </div>
            </form>
        `;

        Kruval.forumAdmin.showModal(modalContent);
        document.getElementById('edit-thread-form').addEventListener('submit', (e) => handleEditThreadSubmit(e, categoryId, forumId, threadId));
        document.getElementById('cancel-thread-edit').addEventListener('click', () => Kruval.forumAdmin.closeModal());
        document.getElementById('thread-name').focus();
    }

    /**
     * Zpracuje odeslání formuláře pro úpravu tématu.
     * @param {Event} event
     * @param {string} categoryId
     * @param {string} forumId
     * @param {string} threadId
     */
    async function handleEditThreadSubmit(event, categoryId, forumId, threadId) {
        event.preventDefault();
        const newName = document.getElementById('thread-name').value;

        if (!newName.trim()) {
            Kruval.forumAdmin.showAlert('Název tématu nesmí být prázdný.', 'error');
            return;
        }

        try {
            // 3. Aktualizace dat v databázi
            const threadRef = db.collection('forum_categories').doc(categoryId)
                              .collection('fora').doc(forumId)
                              .collection('temata').doc(threadId);
                              
            await threadRef.update({
                nazev: newName
            });

            Kruval.forumAdmin.closeModal();
            Kruval.forumAdmin.showAlert('Téma bylo úspěšně aktualizováno.', 'success');
            
            // 4. Vyslání signálu o úspěšné aktualizaci pro UI refresh
            const threadUpdatedEvent = new CustomEvent('threadUpdated', {
                bubbles: true,
                detail: { 
                    threadId: threadId, 
                    newName: newName
                }
            });
            document.dispatchEvent(threadUpdatedEvent);

        } catch (error) {
            console.error("Chyba při aktualizaci tématu: ", error);
            Kruval.forumAdmin.showAlert('Došlo k chybě při ukládání změn.', 'error');
        }
    }
});
