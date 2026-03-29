/**
 * Soubor: js/mazac-obsahu.js
 * Účel: Zajišťuje veškerou logiku pro bezpečné a potvrzené mazání obsahu fóra.
 */

document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();

    // --- MAZÁNÍ KATEGORIE ---
    document.addEventListener('deleteCategoryRequest', (event) => {
        const { categoryId, categoryName } = event.detail;
        showDeleteConfirmation(
            `Opravdu si přejete smazat kategorii "${categoryName}"?`,
            `Tato akce je extrémně destruktivní a trvale odstraní kategorii, VŠECHNA její fóra, VŠECHNA jejich témata a VŠECHNY jejich příspěvky. Tato akce je nevratná.`,
            () => executeCategoryDeletion(categoryId)
        );
    });

    async function executeCategoryDeletion(categoryId) {
        const categoryRef = db.collection('forum_categories').doc(categoryId);
        Kruval.forumAdmin.showModal('<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Probíhá mazání kategorie a veškerého jejího obsahu... Tento proces může chvíli trvat.</div>');

        try {
            // Krok 1: Smazat všechna fóra v kategorii
            const forumsSnapshot = await categoryRef.collection('fora').get();
            for (const forumDoc of forumsSnapshot.docs) {
                // Pro každé fórum musíme rekurzivně smazat jeho obsah
                await executeForumDeletion(categoryId, forumDoc.id, false); // `false` aby se nezobrazovalo více modalů
            }

            // Krok 2: Smazat samotnou kategorii
            await categoryRef.delete();

            Kruval.forumAdmin.closeModal();
            Kruval.forumAdmin.showAlert('Kategorie a veškerý její obsah byly úspěšně smazány.', 'success');

            // Vyslání signálu pro UI refresh
            const categoryDeletedEvent = new CustomEvent('categoryDeleted', {
                bubbles: true,
                detail: { categoryId: categoryId }
            });
            document.dispatchEvent(categoryDeletedEvent);

        } catch (error) {
            console.error("Chyba při mazání kategorie: ", error);
            Kruval.forumAdmin.showAlert('Došlo k chybě při mazání kategorie.', 'error');
            Kruval.forumAdmin.closeModal();
        }
    }


    // --- MAZÁNÍ FÓRA ---
    document.addEventListener('deleteForumRequest', (event) => {
        const { categoryId, forumId, forumName } = event.detail;
        showDeleteConfirmation(
            `Opravdu si přejete smazat fórum "${forumName}"?`,
            `Tato akce trvale odstraní fórum, všechna jeho témata a všechny jejich příspěvky. Tato akce je nevratná.`,
            () => executeForumDeletion(categoryId, forumId)
        );
    });

    async function executeForumDeletion(categoryId, forumId, showSpinner = true) {
        const forumRef = db.collection('forum_categories').doc(categoryId).collection('fora').doc(forumId);
        if (showSpinner) {
            Kruval.forumAdmin.showModal('<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Probíhá mazání fóra a veškerého jeho obsahu...</div>');
        }

        try {
            const threadsSnapshot = await forumRef.collection('temata').get();
            for (const threadDoc of threadsSnapshot.docs) {
                await executeThreadDeletion(categoryId, forumId, threadDoc.id, false);
            }
            await forumRef.delete();

            if (showSpinner) {
                 Kruval.forumAdmin.closeModal();
                 Kruval.forumAdmin.showAlert('Fórum a veškerý jeho obsah byly úspěšně smazány.', 'success');
                 const forumDeletedEvent = new CustomEvent('forumDeleted', { bubbles: true, detail: { forumId: forumId } });
                 document.dispatchEvent(forumDeletedEvent);
            }

        } catch (error) {
            console.error("Chyba při mazání fóra: ", error);
             if (showSpinner) {
                Kruval.forumAdmin.showAlert('Došlo k chybě při mazání fóra.', 'error');
                Kruval.forumAdmin.closeModal();
            } else {
                throw error; // Předání chyby vyšší úrovni (mazání kategorie)
            }
        }
    }

    // --- MAZÁNÍ TÉMATU ---
    document.addEventListener('deleteThreadRequest', (event) => {
        const { categoryId, forumId, threadId, threadName } = event.detail;
        showDeleteConfirmation(
            `Opravdu si přejete smazat téma "${threadName}"?`,
            `Tato akce trvale odstraní téma a VŠECHNY jeho příspěvky. Tato akce je nevratná.`,
            () => executeThreadDeletion(categoryId, forumId, threadId)
        );
    });

    async function executeThreadDeletion(categoryId, forumId, threadId, showSpinner = true) {
        const threadRef = db.collection('forum_categories').doc(categoryId).collection('fora').doc(forumId).collection('temata').doc(threadId);
        if(showSpinner) {
             Kruval.forumAdmin.showModal('<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Probíhá mazání tématu...</div>');
        }
        
        try {
            const postsSnapshot = await threadRef.collection('prispevky').get();
            for (const postDoc of postsSnapshot.docs) {
                await postDoc.ref.delete();
            }
            await threadRef.delete();
            
            if (showSpinner) {
                Kruval.forumAdmin.closeModal();
                Kruval.forumAdmin.showAlert('Téma a všechny jeho příspěvky byly úspěšně smazány.', 'success');
                const threadDeletedEvent = new CustomEvent('threadDeleted', { bubbles: true, detail: { threadId: threadId } });
                document.dispatchEvent(threadDeletedEvent);
            }
        } catch (error) {
            console.error("Chyba při mazání tématu: ", error);
            if (showSpinner) {
                Kruval.forumAdmin.showAlert('Došlo k chybě při mazání tématu.', 'error');
                Kruval.forumAdmin.closeModal();
            } else {
                throw error;
            }
        }
    }

    // --- MAZÁNÍ PŘÍSPĚVKU/ODPOVĚDI ---
    document.addEventListener('deletePostRequest', (event) => {
        const { categoryId, forumId, threadId, postId, isInitialPost } = event.detail;
        const threadNameElement = document.querySelector(`.thread-item[data-id="${threadId}"] .item-title`);
        const threadName = threadNameElement ? threadNameElement.textContent : 'tohoto tématu';

        if (isInitialPost) {
            showDeleteConfirmation(
                `Nelze smazat pouze úvodní příspěvek.`,
                `Přejete si místo toho smazat celé téma "${threadName}"? Tím smažete i všechny odpovědi.`,
                () => executeThreadDeletion(categoryId, forumId, threadId)
            );
        } else {
             showDeleteConfirmation(
                `Opravdu si přejete trvale smazat tento příspěvek?`,
                `Tato akce je nevratná.`,
                () => executePostDeletion(categoryId, forumId, threadId, postId)
            );
        }
    });

    async function executePostDeletion(categoryId, forumId, threadId, postId) {
        const threadRef = db.collection('forum_categories').doc(categoryId).collection('fora').doc(forumId).collection('temata').doc(threadId);
        const postRef = threadRef.collection('prispevky').doc(postId);

        try {
            await db.runTransaction(async (transaction) => {
                const threadDoc = await transaction.get(threadRef);
                if (!threadDoc.exists) throw "Téma, ke kterému příspěvek patří, již neexistuje.";
                
                const currentReplies = threadDoc.data().odpovedi || 0;
                transaction.update(threadRef, { odpovedi: Math.max(0, currentReplies - 1) });
                transaction.delete(postRef);
            });

            Kruval.forumAdmin.closeModal();
            Kruval.forumAdmin.showAlert('Příspěvek byl úspěšně smazán.', 'success');

            const postDeletedEvent = new CustomEvent('postDeleted', { bubbles: true, detail: { postId, threadId } });
            document.dispatchEvent(postDeletedEvent);

        } catch (error) {
            console.error("Chyba při mazání příspěvku: ", error);
            Kruval.forumAdmin.showAlert(typeof error === 'string' ? error : 'Došlo k chybě při mazání příspěvku.', 'error');
            Kruval.forumAdmin.closeModal();
        }
    }

    // --- Obecná funkce pro zobrazení modálního okna ---
    function showDeleteConfirmation(title, text, onConfirm) {
        const modalContent = `
            <h2><i class="fas fa-exclamation-triangle warning-icon"></i> ${title}</h2>
            <p>${text}</p>
            <div class="modal-actions">
                <button id="confirm-delete-btn" class="admin-button danger-button">Ano, smazat</button>
                <button id="cancel-delete-btn" class="admin-button-secondary">Zrušit</button>
            </div>
        `;
        Kruval.forumAdmin.showModal(modalContent);
        document.getElementById('confirm-delete-btn').addEventListener('click', onConfirm);
        document.getElementById('cancel-delete-btn').addEventListener('click', () => Kruval.forumAdmin.closeModal());
    }

});
