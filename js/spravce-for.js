/**
 * Soubor: js/spravce-for.js
 * Účel: Komplexní správa fór (vytváření, úpravy, mazání).
 * Tento modul je navržen tak, aby byl plně nezávislý a reagoval na
 * externí události pro maximální modularitu a minimální zásahy
 * do ostatních částí systému.
 */

document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();

    /**
     * Naslouchá žádosti o zobrazení modálního okna pro vytvoření fóra.
     * Očekává v detailu události vlastnost `categoryId`.
     */
    document.addEventListener('showCreateForumModalRequest', (event) => {
        const { categoryId } = event.detail;
        if (categoryId) {
            showCreateForumModal(categoryId);
        }
    });

    /**
     * Zobrazí modální okno s formulářem pro vytvoření nového fóra.
     * @param {string} categoryId - ID kategorie, do které bude fórum patřit.
     */
    function showCreateForumModal(categoryId) {
        const modalContent = `
            <h2>Vytvořit nové fórum</h2>
            <form id="create-forum-form">
                <div class="form-group">
                    <label for="forum-name">Název fóra</label>
                    <input type="text" id="forum-name" required>
                </div>
                <div class="form-group">
                    <label for="forum-description">Popis fóra</label>
                    <textarea id="forum-description" rows="3"></textarea>
                </div>
                <div class="modal-actions">
                    <button type="submit" class="admin-button">Vytvořit</button>
                    <button type="button" class="admin-button-secondary" id="cancel-forum-creation">Zrušit</button>
                </div>
            </form>
        `;

        Kruval.forumAdmin.showModal(modalContent);
        document.getElementById('create-forum-form').addEventListener('submit', (e) => handleCreateForumSubmit(e, categoryId));
        document.getElementById('cancel-forum-creation').addEventListener('click', () => Kruval.forumAdmin.closeModal());
        document.getElementById('forum-name').focus();
    }

    /**
     * Zpracuje odeslání formuláře pro vytvoření fóra.
     * @param {Event} event - Událost odeslání formuláře.
     * @param {string} categoryId - ID kategorie pro nové fórum.
     */
    async function handleCreateForumSubmit(event, categoryId) {
        event.preventDefault();
        const name = document.getElementById('forum-name').value;
        const description = document.getElementById('forum-description').value;

        if (!name.trim()) {
            Kruval.forumAdmin.showAlert('Název fóra nesmí být prázdný.', 'error');
            return;
        }

        try {
            const forumsRef = db.collection('forum_categories').doc(categoryId).collection('fora');
            // Zjistíme nejvyšší `poradi` pro automatické seřazení
            const lastForumSnapshot = await forumsRef.orderBy('poradi', 'desc').limit(1).get();
            const nextOrder = lastForumSnapshot.empty ? 1 : lastForumSnapshot.docs[0].data().poradi + 1;

            await forumsRef.add({
                nazev: name,
                popis: description,
                poradi: nextOrder,
                temataPocet: 0,
                prispevkyPocet: 0
            });

            Kruval.forumAdmin.closeModal();
            Kruval.forumAdmin.showAlert('Fórum bylo úspěšně vytvořeno.', 'success');
            
            // Informujeme zbytek aplikace, že se má daná kategorie obnovit
            const forumCreatedEvent = new CustomEvent('forumCreated', {
                bubbles: true,
                detail: { categoryId: categoryId }
            });
            document.dispatchEvent(forumCreatedEvent);

        } catch (error) {
            console.error("Chyba při vytváření fóra: ", error);
            Kruval.forumAdmin.showAlert('Došlo k chybě při vytváření fóra.', 'error');
        }
    }
});
