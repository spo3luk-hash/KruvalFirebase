
document.addEventListener('DOMContentLoaded', function () {
    const db = firebase.firestore();
    const auth = firebase.auth();
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('cat');
    const forumId = params.get('forum');

    const forumNameElement = document.getElementById('forum-name');
    const threadListContainer = document.getElementById('thread-list-container');
    const newThreadBtn = document.getElementById('new-thread-btn');

    if (!categoryId || !forumId) {
        forumNameElement.textContent = 'Chyba';
        threadListContainer.innerHTML = '<h2>Chybí ID kategorie nebo fóra.</h2>';
        newThreadBtn.style.display = 'none'; // Skryjeme tlačítko, pokud chybí parametry
        return;
    }

    // Zkontrolujeme stav přihlášení
    auth.onAuthStateChanged(user => {
        if (user) {
            newThreadBtn.style.display = 'block'; // Zobrazíme tlačítko, pokud je uživatel přihlášen
        } else {
            newThreadBtn.style.display = 'none'; // Skryjeme tlačítko, pokud uživatel není přihlášen
        }
    });

    newThreadBtn.addEventListener('click', () => {
        window.location.href = `create-thread.html?cat=${categoryId}&forum=${forumId}`;
    });

    async function getUserData(userId) {
        try {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            return userDoc.exists ? userDoc.data() : { identitaNaForu: 'Neznámý autor' };
        } catch (error) {
            console.error("Chyba při načítání dat uživatele: ", error);
            return { identitaNaForu: 'Neznámý autor' };
        }
    }

    async function loadForumDetails() {
        threadListContainer.innerHTML = '<h2>Načítání...</h2>';

        try {
            const forumRef = db.collection('forum_categories').doc(categoryId).collection('fora').doc(forumId);
            const forumDoc = await forumRef.get();

            if (forumDoc.exists) {
                forumNameElement.textContent = forumDoc.data().nazev;
                
                const threadsRef = forumDoc.ref.collection('temata').orderBy('posledniPrispevek', 'desc');
                const threadsSnapshot = await threadsRef.get();

                if (threadsSnapshot.empty) {
                    threadListContainer.innerHTML = '<div class="thread-item"><p>V tomto fóru zatím nejsou žádná témata.</p></div>';
                } else {
                    let html = '<ul class="thread-list">';
                    for (const threadDoc of threadsSnapshot.docs) {
                        const thread = threadDoc.data();
                        const authorData = await getUserData(thread.autorId);
                        const authorName = authorData.identitaNaForu || authorData.jmeno || 'Neznámý autor'; // Změna zde

                        html += `
                            <li class="thread-item">
                                <div class="thread-info">
                                    <a href="thread-view.html?cat=${categoryId}&forum=${forumId}&thread=${threadDoc.id}">${thread.nazev}</a>
                                    <p>Autor: ${authorName}</p>
                                </div>
                                <div class="thread-stats">
                                    <span>Odpovědi: ${thread.odpovedi || 0}</span>
                                    <span>Poslední aktivita: ${thread.posledniPrispevek ? thread.posledniPrispevek.toDate().toLocaleString('cs-CZ') : 'N/A'}</span>
                                </div>
                            </li>
                        `;
                    }
                    html += '</ul>';
                    threadListContainer.innerHTML = html;
                }

            } else {
                forumNameElement.textContent = 'Fórum nenalezeno';
                threadListContainer.innerHTML = '<h2>Fórum nenalezeno.</h2>';
            }

        } catch (error) {
            console.error("Chyba při načítání fóra: ", error);
            forumNameElement.textContent = 'Chyba při načítání';
            threadListContainer.innerHTML = '<h2>Při načítání témat došlo k chybě.</h2>';
        }
    }

    loadForumDetails();
});
