document.addEventListener('DOMContentLoaded', function () {
    const db = firebase.firestore();
    const auth = firebase.auth();
    const forumContainer = document.getElementById('forum-container');
    const adminForumLink = document.getElementById('admin-forum-link');

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userDoc = await db.collection('hraci').doc(user.uid).get();
            if (userDoc.exists && userDoc.data().role === 'Admin') {
                if(adminForumLink) adminForumLink.style.display = 'block';
            }
        }
    });

    const mainCollection = 'forum_categories';

    async function seedDatabase() {
        const categoriesRef = db.collection(mainCollection);
        const snapshot = await categoriesRef.get();

        if (snapshot.empty) {
            console.log('Nasazuji počáteční data fóra do kolekce: ', mainCollection);
            const batch = db.batch();

            const cat1Ref = categoriesRef.doc();
            batch.set(cat1Ref, { nazev: 'Novinky a Oznámení', popis: 'Všechny důležité informace o hře a komunitě.', poradi: 1 });
            batch.set(cat1Ref.collection('fora').doc(), { nazev: 'Novinky a Aktualizace', popis: 'Nejnovější zprávy o vývoji hry.', poradi: 1, pocetTemat: 0, pocetPrispevku: 0 });
            batch.set(cat1Ref.collection('fora').doc(), { nazev: 'Oznámení od Adminů', popis: 'Oficiální oznámení od vedení hry.', poradi: 2, pocetTemat: 0, pocetPrispevku: 0 });

            const cat2Ref = categoriesRef.doc();
            batch.set(cat2Ref, { nazev: 'Herní Svět', popis: 'Diskuze o všem, co se týká herního světa Durmstrangu.', poradi: 2 });
            batch.set(cat2Ref.collection('fora').doc(), { nazev: 'Postavy a Rodokmeny', popis: 'Diskuze o vašich postavách a jejich rodech.', poradi: 1, pocetTemat: 0, pocetPrispevku: 0 });
            batch.set(cat2Ref.collection('fora').doc(), { nazev: 'Herní Lokace', popis: 'Debaty o různých místech ve hře.', poradi: 2, pocetTemat: 0, pocetPrispevku: 0 });
            batch.set(cat2Ref.collection('fora').doc(), { nazev: 'Kouzla a Magie', popis: 'Vše o kouzlech, lektvarech a magii obecně.', poradi: 3, pocetTemat: 0, pocetPrispevku: 0 });
            
            await batch.commit();
            console.log('Počáteční data nasazena.');
        }
    }

    async function loadForum() {
        forumContainer.innerHTML = '<h2 style="text-align: center;">Načítání fóra...</h2>';
        
        try {
            const categoriesRef = db.collection(mainCollection).orderBy('poradi');
            const categoriesSnapshot = await categoriesRef.get();

            if (categoriesSnapshot.empty) {
                forumContainer.innerHTML = '<h2 style="text-align: center;">Žádné kategorie fóra nebyly nalezeny.</h2>';
                return;
            }

            let allHtml = '';
            for (const categoryDoc of categoriesSnapshot.docs) {
                const category = categoryDoc.data();
                
                let categoryHtml = `
                    <div class="category">
                        <div class="category-header">
                            <h3>${category.nazev}</h3>
                            <p>${category.popis}</p>
                        </div>
                `;

                const forumsRef = categoryDoc.ref.collection('fora').orderBy('poradi');
                const forumsSnapshot = await forumsRef.get();

                if (!forumsSnapshot.empty) {
                    let forumsHtml = '<ul class="forum-list">';
                    for (const forumDoc of forumsSnapshot.docs) {
                        const forum = forumDoc.data();
                        const pocetOdpovedi = (forum.pocetPrispevku || 0) - (forum.pocetTemat || 0);
                        forumsHtml += `
                            <li class="forum-item">
                                <div class="forum-info">
                                    <a href="forum-view.html?cat=${categoryDoc.id}&forum=${forumDoc.id}">${forum.nazev}</a>
                                    <p>${forum.popis}</p>
                                </div>
                                <div class="forum-stats">
                                    <span>Témata: ${forum.pocetTemat || 0}</span>
                                    <span>Příspěvky: ${forum.pocetTemat || 0}</span>
                                    <span>Odpovědi: ${pocetOdpovedi >= 0 ? pocetOdpovedi : 0}</span>
                                </div>
                            </li>
                        `;
                    }
                    forumsHtml += '</ul>';
                    categoryHtml += forumsHtml;
                } else {
                    categoryHtml += '<p style="padding: 20px;">V této kategorii zatím nejsou žádná fóra.</p>';
                }

                categoryHtml += '</div>';
                allHtml += categoryHtml;
            }
            forumContainer.innerHTML = allHtml;

        } catch (error) {
            console.error("Chyba při načítání fóra: ", error);
            forumContainer.innerHTML = '<h2 style="text-align: center; color: #ff8a8a;">Při načítání fóra došlo k chybě.</h2>';
        }
    }
    
    seedDatabase().then(loadForum);
});
