/**
 * Soubor: js/editor-kategorii.js
 * Účel: Zajišťuje logiku pro úpravu názvu a popisu existujících kategorií.
 * Tento modul je plně autonomní a komunikuje s ostatními částmi aplikace
 * výhradně prostřednictvím custom událostí.
 */

document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();

    // Naslouchá žádosti o úpravu kategorie.
    document.addEventListener('editCategoryRequest', async (event) => {
        const { categoryId } = event.detail;
        if (!categoryId) return;

        try {
            // 1. Načtení aktuálních dat kategorie z DB
            const categoryRef = db.collection('forum_categories').doc(categoryId);
            const categoryDoc = await categoryRef.get();
            if (!categoryDoc.exists) {
                Kruval.forumAdmin.showAlert('Tato kategorie již neexistuje.', 'error');
                return;
            }
            const categoryData = categoryDoc.data();

            // 2. Zobrazení modálního okna s předvyplněným formulářem
            showEditCategoryModal(categoryId, categoryData);

        } catch (error) {
            console.error("Chyba při přípravě úpravy kategorie: ", error);
            Kruval.forumAdmin.showAlert('Došlo k chybě při načítání dat kategorie.', 'error');
        }
    });

    /**
     * Zobrazí modální okno pro úpravu kategorie.
     * @param {string} categoryId - ID upravované kategorie.
     * @param {object} data - Aktuální data kategorie (nazev, popis).
     */
    function showEditCategoryModal(categoryId, data) {
        const modalContent = `
            <h2>Upravit kategorii</h2>
            <form id="edit-category-form">
                <div class="form-group">
                    <label for="category-name">Název kategorie</label>
                    <input type="text" id="category-name" value="${data.nazev || ''}" required>
                </div>
                <div class="form-group">
                    <label for="category-description">Popis</label>
                    <textarea id="category-description" rows="3">${data.popis || ''}</textarea>
                </div>
                <div class="modal-actions">
                    <button type="submit" class="admin-button">Uložit změny</button>
                    <button type="button" class="admin-button-secondary" id="cancel-category-edit">Zrušit</button>
                </div>
            </form>
        `;

        Kruval.forumAdmin.showModal(modalContent);
        document.getElementById('edit-category-form').addEventListener('submit', (e) => handleEditCategorySubmit(e, categoryId));
        document.getElementById('cancel-category-edit').addEventListener('click', () => Kruval.forumAdmin.closeModal());
        document.getElementById('category-name').focus();
    }

    /**
     * Zpracuje odeslání formuláře pro úpravu kategorie.
     * @param {Event} event - Událost odeslání formuláře.
     * @param {string} categoryId - ID upravované kategorie.
     */
    async function handleEditCategorySubmit(event, categoryId) {
        event.preventDefault();
        const newName = document.getElementById('category-name').value;
        const newDescription = document.getElementById('category-description').value;

        if (!newName.trim()) {
            Kruval.forumAdmin.showAlert('Název kategorie nesmí být prázdný.', 'error');
            return;
        }

        try {
            // 3. Aktualizace dat v databázi
            const categoryRef = db.collection('forum_categories').doc(categoryId);
            await categoryRef.update({
                nazev: newName,
                popis: newDescription
            });

            Kruval.forumAdmin.closeModal();
            Kruval.forumAdmin.showAlert('Kategorie byla úspěšně aktualizována.', 'success');
            
            // 4. Vyslání signálu o úspěšné aktualizaci pro UI refresh
            const categoryUpdatedEvent = new CustomEvent('categoryUpdated', {
                bubbles: true,
                detail: { 
                    categoryId: categoryId, 
                    newName: newName, 
                    newDescription: newDescription 
                }
            });
            document.dispatchEvent(categoryUpdatedEvent);

        } catch (error) {
            console.error("Chyba při aktualizaci kategorie: ", error);
            Kruval.forumAdmin.showAlert('Došlo k chybě při ukládání změn.', 'error');
        }
    }
});
