/**
 * Soubor: js/editor-for.js
 * Účel: Zajišťuje logiku pro úpravu názvu a popisu existujících fór.
 * Tento modul je plně autonomní a komunikuje s ostatními částmi aplikace
 * výhradně prostřednictvím custom událostí.
 */

document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();

    // Naslouchá žádosti o úpravu fóra.
    document.addEventListener('editForumRequest', async (event) => {
        const { categoryId, forumId } = event.detail;
        if (!categoryId || !forumId) return;

        try {
            // 1. Načtení aktuálních dat fóra z DB
            const forumRef = db.collection('forum_categories').doc(categoryId).collection('fora').doc(forumId);
            const forumDoc = await forumRef.get();
            if (!forumDoc.exists) {
                Kruval.forumAdmin.showAlert('Toto fórum již neexistuje.', 'error');
                return;
            }
            const forumData = forumDoc.data();

            // 2. Zobrazení modálního okna s předvyplněným formulářem
            showEditForumModal(categoryId, forumId, forumData);

        } catch (error) {
            console.error("Chyba při přípravě úpravy fóra: ", error);
            Kruval.forumAdmin.showAlert('Došlo k chybě při načítání dat fóra.', 'error');
        }
    });

    /**
     * Zobrazí modální okno pro úpravu fóra.
     * @param {string} categoryId - ID kategorie fóra.
     * @param {string} forumId - ID upravovaného fóra.
     * @param {object} data - Aktuální data fóra (nazev, popis).
     */
    function showEditForumModal(categoryId, forumId, data) {
        const modalContent = `
            <h2>Upravit fórum</h2>
            <form id="edit-forum-form">
                <div class="form-group">
                    <label for="forum-name">Název fóra</label>
                    <input type="text" id="forum-name" value="${data.nazev || ''}" required>
                </div>
                <div class="form-group">
                    <label for="forum-description">Popis</label>
                    <textarea id="forum-description" rows="3">${data.popis || ''}</textarea>
                </div>
                <div class="modal-actions">
                    <button type="submit" class="admin-button">Uložit změny</button>
                    <button type="button" class="admin-button-secondary" id="cancel-forum-edit">Zrušit</button>
                </div>
            </form>
        `;

        Kruval.forumAdmin.showModal(modalContent);
        document.getElementById('edit-forum-form').addEventListener('submit', (e) => handleEditForumSubmit(e, categoryId, forumId));
        document.getElementById('cancel-forum-edit').addEventListener('click', () => Kruval.forumAdmin.closeModal());
        document.getElementById('forum-name').focus();
    }

    /**
     * Zpracuje odeslání formuláře pro úpravu fóra.
     * @param {Event} event - Událost odeslání formuláře.
     * @param {string} categoryId - ID kategorie fóra.
     * @param {string} forumId - ID upravovaného fóra.
     */
    async function handleEditForumSubmit(event, categoryId, forumId) {
        event.preventDefault();
        const newName = document.getElementById('forum-name').value;
        const newDescription = document.getElementById('forum-description').value;

        if (!newName.trim()) {
            Kruval.forumAdmin.showAlert('Název fóra nesmí být prázdný.', 'error');
            return;
        }

        try {
            // 3. Aktualizace dat v databázi
            const forumRef = db.collection('forum_categories').doc(categoryId).collection('fora').doc(forumId);
            await forumRef.update({
                nazev: newName,
                popis: newDescription
            });

            Kruval.forumAdmin.closeModal();
            Kruval.forumAdmin.showAlert('Fórum bylo úspěšně aktualizováno.', 'success');
            
            // 4. Vyslání signálu o úspěšné aktualizaci pro UI refresh
            const forumUpdatedEvent = new CustomEvent('forumUpdated', {
                bubbles: true,
                detail: { 
                    forumId: forumId, 
                    newName: newName, 
                    newDescription: newDescription 
                }
            });
            document.dispatchEvent(forumUpdatedEvent);

        } catch (error) {
            console.error("Chyba při aktualizaci fóra: ", error);
            Kruval.forumAdmin.showAlert('Došlo k chybě při ukládání změn.', 'error');
        }
    }
});
