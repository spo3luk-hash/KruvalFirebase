
window.spravceUvodnichPrispevku = {
    userCache: {},

    async getUserData(db, userId) {
        if (!userId) return { identitaNaForu: 'Systém' }; // Pro témata bez autora (např. systémová)
        if (this.userCache[userId]) return this.userCache[userId];
        try {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            if (userDoc.exists) {
                this.userCache[userId] = userDoc.data();
                return userDoc.data();
            }
        } catch (error) {
            console.error(`Chyba při načítání dat uživatele ${userId}: `, error);
        }
        return { identitaNaForu: 'Neznámý Uživatel' }; 
    },

    nactiAVykresliUvodniPrispevky: async (db, container) => {
        container.innerHTML = '<p>Načítám úvodní příspěvky (témata)...</p>';
        const mainCollection = 'forum_categories';
        let allInitialPosts = [];

        try {
            const categoriesSnapshot = await db.collection(mainCollection).get();
            for (const categoryDoc of categoriesSnapshot.docs) {
                const forumsSnapshot = await categoryDoc.ref.collection('fora').get();
                for (const forumDoc of forumsSnapshot.docs) {
                    const threadsSnapshot = await forumDoc.ref.collection('temata').get();
                    for (const threadDoc of threadsSnapshot.docs) {
                        const firstPostSnapshot = await threadDoc.ref.collection('prispevky').orderBy('cas', 'asc').limit(1).get();
                        if (!firstPostSnapshot.empty) {
                            const firstPostDoc = firstPostSnapshot.docs[0];
                            const postData = firstPostDoc.data();
                            const threadData = threadDoc.data();
                            
                            // Zde je klíčová oprava: načteme data autora
                            const authorData = await window.spravceUvodnichPrispevku.getUserData(db, threadData.autorId);

                            allInitialPosts.push({
                                id: firstPostDoc.id,
                                text: postData.obsah,
                                autorIdentita: authorData.identitaNaForu || 'Neznámý autor', // Použijeme načtenou identitu
                                cas: postData.cas,
                                temaNazev: threadData.nazev,
                                odpovedi: threadData.odpovedi || 0,
                                kategorieId: categoryDoc.id,
                                forumId: forumDoc.id,
                                temaId: threadDoc.id
                            });
                        }
                    }
                }
            }
            window.spravceUvodnichPrispevku.vykresliKarty(db, container, allInitialPosts);
        } catch (error) {
            console.error("Chyba při načítání úvodních příspěvků: ", error);
            container.innerHTML = '<p class="error-message">Při načítání úvodních příspěvků došlo k chybě.</p>';
        }
    },

    vykresliKarty: (db, container, posts) => {
        container.innerHTML = '';
        if (posts.length === 0) {
            container.innerHTML = '<p>Nebyly nalezeny žádné úvodní příspěvky.</p>';
            return;
        }

        posts.sort((a, b) => (b.cas?.toDate() || 0) - (a.cas?.toDate() || 0));
        
        let html = `<div class="initial-posts-grid">`;

        posts.forEach(post => {
            const formattedDate = post.cas ? new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' }).format(post.cas.toDate()) : 'Neznámé datum';
            html += `
                <div class="initial-post-card">
                    <div class="initial-post-header">
                        <h4>${post.temaNazev}</h4>
                        <span><strong>Autor:</strong> ${post.autorIdentita}</span>
                    </div>
                    <div class="initial-post-body">
                        <p>${post.text.replace(/\n/g, '<br>')}</p>
                    </div>
                    <div class="initial-post-footer">
                        <span class="post-stats">Odpovědí: ${post.odpovedi} | ${formattedDate}</span>
                        <button class="delete-initial-post-btn admin-button-danger" 
                                data-kategorie-id="${post.kategorieId}" 
                                data-forum-id="${post.forumId}" 
                                data-tema-id="${post.temaId}" 
                                data-id="${post.id}">
                            <i class="fas fa-eraser"></i> Smazat Obsah
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
        
        container.querySelectorAll('.delete-initial-post-btn').forEach(btn => {
            btn.addEventListener('click', (e) => window.spravceUvodnichPrispevku.handleDeleteContentClick(e, db));
        });
    },

    handleDeleteContentClick: async (e, db) => {
        const { kategorieId, forumId, temaId, id } = e.currentTarget.dataset;
        try {
            await window.showConfirmation({ 
                title: 'Smazat obsah příspěvku?',
                text: 'Opravdu chcete smazat obsah tohoto úvodního příspěvku? Téma zůstane, ale jeho obsah bude nahrazen informací o smazání. Tato akce je nevratná.',
            });

            await window.spravceUvodnichPrispevku.smazatObsahPrispevku(db, kategorieId, forumId, temaId, id);
            zobrazitVlastniAlert('Obsah úvodního příspěvku byl smazán.', 'success');
            const container = document.getElementById('initial-posts-overview-container');
            if (container) {
                window.spravceUvodnichPrispevku.nactiAVykresliUvodniPrispevky(db, container);
            }

        } catch (error) {
             if (error !== 'Uživatel zrušil akci') {
                console.error("Chyba při mazání obsahu: ", error);
                zobrazitVlastniAlert(error.message || 'Během operace došlo k chybě.', 'error');
            }
        }
    },

    smazatObsahPrispevku: async (db, kategorieId, forumId, temaId, prispevekId) => {
        const postRef = db.collection('forum_categories').doc(kategorieId)
                          .collection('fora').doc(forumId)
                          .collection('temata').doc(temaId)
                          .collection('prispevky').doc(prispevekId);

        await postRef.update({
            obsah: '[Původní úvodní příspěvek byl smazán administrátorem.]',
            smazanoAdminem: true
        });
    }
};
