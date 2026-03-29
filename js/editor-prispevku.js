/**
 * Soubor: js/editor-prispevku.js
 * Účel: Zajišťuje logiku pro úpravu obsahu existujících příspěvků a odpovědí.
 * Komunikuje s aplikací výhradně prostřednictvím custom událostí.
 */

document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();

    // Naslouchá žádosti o úpravu příspěvku/odpovědi.
    document.addEventListener('editPostRequest', async (event) => {
        const { categoryId, forumId, threadId, postId } = event.detail;
        if (!categoryId || !forumId || !threadId || !postId) return;

        try {
            // 1. Načtení aktuálního obsahu příspěvku z DB
            const postRef = db.collection('forum_categories').doc(categoryId)
                              .collection('fora').doc(forumId)
                              .collection('temata').doc(threadId)
                              .collection('prispevky').doc(postId);
                              
            const postDoc = await postRef.get();
            if (!postDoc.exists) {
                Kruval.forumAdmin.showAlert('Tento příspěvek již neexistuje.', 'error');
                return;
            }
            const postData = postDoc.data();

            // 2. Zobrazení modálního okna s editorem
            showEditPostModal(categoryId, forumId, threadId, postId, postData);

        } catch (error) {
            console.error("Chyba při přípravě úpravy příspěvku: ", error);
            Kruval.forumAdmin.showAlert('Došlo k chybě při načítání dat příspěvku.', 'error');
        }
    });

    /**
     * Zobrazí modální okno pro úpravu příspěvku.
     * @param {string} categoryId
     * @param {string} forumId
     * @param {string} threadId
     * @param {string} postId
     * @param {object} data - Aktuální data příspěvku (obsah).
     */
    function showEditPostModal(categoryId, forumId, threadId, postId, data) {
        const modalContent = `
            <h2>Upravit příspěvek</h2>
            <form id="edit-post-form">
                <div class="form-group">
                    <label for="post-content">Obsah příspěvku</label>
                    <textarea id="post-content" rows="8">${data.obsah || ''}</textarea>
                </div>
                <div class="modal-actions">
                    <button type="submit" class="admin-button">Uložit změny</button>
                    <button type="button" class="admin-button-secondary" id="cancel-post-edit">Zrušit</button>
                </div>
            </form>
        `;

        Kruval.forumAdmin.showModal(modalContent);
        document.getElementById('edit-post-form').addEventListener('submit', (e) => handleEditPostSubmit(e, categoryId, forumId, threadId, postId));
        document.getElementById('cancel-post-edit').addEventListener('click', () => Kruval.forumAdmin.closeModal());
        document.getElementById('post-content').focus();
    }

    /**
     * Zpracuje odeslání formuláře pro úpravu příspěvku.
     * @param {Event} event
     * @param {string} categoryId
     * @param {string} forumId
     * @param {string} threadId
     * @param {string} postId
     */
    async function handleEditPostSubmit(event, categoryId, forumId, threadId, postId) {
        event.preventDefault();
        const newContent = document.getElementById('post-content').value;

        if (!newContent.trim()) {
            Kruval.forumAdmin.showAlert('Obsah příspěvku nesmí být prázdný.', 'error');
            return;
        }

        try {
            // 3. Aktualizace dat v databázi
            const postRef = db.collection('forum_categories').doc(categoryId)
                              .collection('fora').doc(forumId)
                              .collection('temata').doc(threadId)
                              .collection('prispevky').doc(postId);
                              
            await postRef.update({
                obsah: newContent
            });

            Kruval.forumAdmin.closeModal();
            Kruval.forumAdmin.showAlert('Příspěvek byl úspěšně aktualizován.', 'success');
            
            // 4. Vyslání signálu o úspěšné aktualizaci pro UI refresh
            const postUpdatedEvent = new CustomEvent('postUpdated', {
                bubbles: true,
                detail: { 
                    postId: postId, 
                    newContent: newContent
                }
            });
            document.dispatchEvent(postUpdatedEvent);

        } catch (error) {
            console.error("Chyba při aktualizaci příspěvku: ", error);
            Kruval.forumAdmin.showAlert('Došlo k chybě při ukládání změn.', 'error');
        }
    }
});
