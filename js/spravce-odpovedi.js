
window.spravceOdpovedi = {
    nactiAVykresliOdpovedi: async (db, container) => {
        container.innerHTML = '<p>Načítám všechny odpovědi napříč fórem...</p>';
        const mainCollection = 'forum_categories';
        let allReplies = [];

        try {
            const categoriesSnapshot = await db.collection(mainCollection).get();
            if (categoriesSnapshot.empty) {
                container.innerHTML = '<p>Nebyly nalezeny žádné kategorie fóra.</p>';
                return;
            }

            for (const categoryDoc of categoriesSnapshot.docs) {
                const forumsSnapshot = await categoryDoc.ref.collection('fora').get();
                for (const forumDoc of forumsSnapshot.docs) {
                    const threadsSnapshot = await forumDoc.ref.collection('temata').get();
                    for (const threadDoc of threadsSnapshot.docs) {
                        const repliesSnapshot = await threadDoc.ref.collection('prispevky').orderBy('cas', 'desc').get();
                        for (const replyDoc of repliesSnapshot.docs) {
                            const replyData = replyDoc.data();
                            const authorData = await window.spravceOdpovedi.getUserData(db, replyData.autorId);
                            
                            allReplies.push({
                                id: replyDoc.id,
                                text: replyData.obsah || '[Chybí text odpovědi]',
                                autorIdentita: authorData.identitaNaForu || 'Neznámý autor',
                                cas: replyData.cas,
                                temaNazev: threadDoc.data().nazev || 'Neznámé téma',
                                kategorieNazev: categoryDoc.data().nazev || 'Neznámá kategorie',
                                kategorieId: categoryDoc.id,
                                forumId: forumDoc.id,
                                temaId: threadDoc.id
                            });
                        }
                    }
                }
            }
            
            window.spravceOdpovedi.vykresliKartyOdpovedi(db, container, allReplies);

        } catch (error) {
            console.error("Chyba při načítání odpovědí: ", error);
            container.innerHTML = `<p class="error-message">Při načítání odpovědí došlo k chybě.</p>`;
        }
    },
    
    userCache: {},
    async getUserData(db, userId) {
        if (this.userCache[userId]) return this.userCache[userId];
        try {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            if (userDoc.exists) {
                this.userCache[userId] = userDoc.data();
                return userDoc.data();
            }
        } catch (error) {
            console.error("Chyba při načítání dat uživatele: ", error);
        }
        return { identitaNaForu: 'Neznámý Uživatel' }; 
    },

    vykresliKartyOdpovedi: (db, container, replies) => {
        if (replies.length === 0) {
            container.innerHTML = '<p>Nebyly nalezeny žádné odpovědi.</p>';
            return;
        }

        replies.sort((a, b) => (b.cas?.toDate() || 0) - (a.cas?.toDate() || 0));
        let html = '<div class="replies-grid">';
        replies.forEach(reply => {
            const formattedDate = reply.cas ? new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' }).format(reply.cas.toDate()) : 'Neznámé datum';
            html += `
                <div class="reply-card">
                    <div class="reply-card-header">
                        <p><strong>V tématu:</strong> ${reply.temaNazev}</p>
                        <span><strong>Autor:</strong> ${reply.autorIdentita}</span>
                    </div>
                    <div class="reply-card-body"><p>${reply.text.replace(/\n/g, '<br>')}</p></div>
                    <div class="reply-card-footer">
                        <span class="reply-timestamp">${formattedDate}</span>
                        <button class="delete-reply-btn admin-button-danger" 
                                data-kategorie-id="${reply.kategorieId}" 
                                data-forum-id="${reply.forumId}" 
                                data-tema-id="${reply.temaId}" 
                                data-id="${reply.id}">
                            <i class="fas fa-trash-alt"></i> Smazat
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
        
        container.querySelectorAll('.delete-reply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => window.spravceOdpovedi.handleDeleteReplyClick(e, db, container));
        });
    },

    handleDeleteReplyClick: async (e, db, container) => {
        const { kategorieId, forumId, temaId, id } = e.currentTarget.dataset;
        try {
            await window.showConfirmation({ 
                title: 'Smazat Příspěvek?', 
                text: 'Opravdu chcete nevratně smazat tento příspěvek?'
            });

            await window.spravceOdpovedi.smazatPrispevek(db, kategorieId, forumId, temaId, id);
            zobrazitVlastniAlert('Příspěvek byl úspěšně smazán a statistiky aktualizovány.', 'success');
            window.spravceOdpovedi.nactiAVykresliOdpovedi(db, container);

        } catch (error) {
             if (error !== 'Uživatel zrušil akci') {
                console.error("Chyba při mazání příspěvku: ", error);
                zobrazitVlastniAlert(error.message || 'Během mazání došlo k chybě.', 'error');
            }
        }
    },

    smazatPrispevek: async (db, kategorieId, forumId, temaId, prispevekId) => {
        const forumRef = db.collection('forum_categories').doc(kategorieId).collection('fora').doc(forumId);
        const threadRef = forumRef.collection('temata').doc(temaId);
        const replyRef = threadRef.collection('prispevky').doc(prispevekId);

        const replyDoc = await replyRef.get();
        if (!replyDoc.exists) {
            throw new Error("Příspěvek, který chcete smazat, nebyl nalezen.");
        }
        const autorId = replyDoc.data().autorId;

        await db.runTransaction(async (transaction) => {
            const forumDoc = await transaction.get(forumRef);
            const threadDoc = await transaction.get(threadRef);

            if (!forumDoc.exists || !threadDoc.exists) {
                throw new Error("Fórum nebo téma neexistuje.");
            }

            transaction.update(forumRef, { pocetPrispevku: firebase.firestore.FieldValue.increment(-1) });
            transaction.update(threadRef, { odpovedi: firebase.firestore.FieldValue.increment(-1) });

            if (autorId) {
                const userRef = db.collection('users').doc(autorId);
                transaction.update(userRef, { 'forumStats.pocetOdpovedi': firebase.firestore.FieldValue.increment(-1) });
            }
            
            transaction.delete(replyRef);
        });
    }
};