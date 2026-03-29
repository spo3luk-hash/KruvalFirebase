window.spravceTemat = {
    // Uložíme načtená data, abychom je nemuseli načítat opakovaně
    allKnownUsers: [],
    allKnownRoles: [],

    /**
     * Načte všechny uživatele a role z databáze a uloží je pro pozdější použití.
     * @param {firebase.firestore.Firestore} db - Instance Firestore databáze.
     */
    async nactiPotrebnaData(db) {
        if (this.allKnownUsers.length > 0 && this.allKnownRoles.length > 0) {
            return; // Data jsou již načtena
        }

        const [usersSnapshot, rolesSnapshot] = await Promise.all([
            db.collection('users').get(),
            db.collection('forum_role').get()
        ]);

        this.allKnownUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        this.allKnownRoles = rolesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    /**
     * Najde data uživatele podle jeho ID.
     * @param {string} userId - ID uživatele.
     * @returns {object|null} Data uživatele nebo null.
     */
    getUserData(userId) {
        return this.allKnownUsers.find(u => u.id === userId) || null;
    },

    /**
     * Získá názvy rolí podle jejich ID.
     * @param {string[]} roleIds - Pole ID rolí.
     * @returns {string} Čárkou oddělený seznam názvů rolí.
     */
    getRoleNames(roleIds) {
        if (!roleIds || roleIds.length === 0) return 'Žádná';
        return roleIds.map(roleId => {
            const role = this.allKnownRoles.find(r => r.id === roleId);
            return role ? role.nazev : '';
        }).join(', ');
    },

    /**
     * Načte všechna témata ze všech fór a vykreslí je do tabulky.
     * @param {firebase.firestore.Firestore} db - Instance Firestore databáze.
     * @param {HTMLElement} container - HTML element, do kterého se tabulka vykreslí.
     */
    async nactiAVykresliVsechnyTemata(db, container) {
        container.innerHTML = '<p>Načítám všechna témata, prosím počkejte...</p>';

        try {
            await this.nactiPotrebnaData(db);

            const kategorieSnapshot = await db.collection('forum_categories').get();
            let vsechnaTemata = [];

            for (const katDoc of kategorieSnapshot.docs) {
                const foraSnapshot = await katDoc.ref.collection('fora').get();
                for (const forumDoc of foraSnapshot.docs) {
                    const temataSnapshot = await forumDoc.ref.collection('temata').get();
                    temataSnapshot.forEach(temaDoc => {
                        vsechnaTemata.push({
                            id: temaDoc.id,
                            kategorieId: katDoc.id,
                            forumId: forumDoc.id,
                            ...temaDoc.data(),
                            kategorieNazev: katDoc.data().nazev,
                            forumNazev: forumDoc.data().nazev,
                        });
                    });
                }
            }

            if (vsechnaTemata.length === 0) {
                container.innerHTML = '<p>Nebyly nalezeny žádná témata.</p>';
                return;
            }
            
            // Seřadit témata od nejnovějšího po nejstarší
            vsechnaTemata.sort((a, b) => (b.cas?.seconds || 0) - (a.cas?.seconds || 0));

            this.vykresliTabulkuTemat(db, container, vsechnaTemata);

        } catch (error) {
            console.error("Chyba při načítání témat: ", error);
            container.innerHTML = '<p class="error-message">Při načítání témat došlo k chybě.</p>';
        }
    },

    /**
     * Vykreslí tabulku s tématy.
     * @param {firebase.firestore.Firestore} db - Instance Firestore databáze.
     * @param {HTMLElement} container - HTML element pro vykreslení.
     * @param {Array<object>} temata - Pole témat k vykreslení.
     */
    vykresliTabulkuTemat(db, container, temata) {
        let tableHtml = `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Název tématu</th>
                            <th>Autor</th>
                            <th>Role autora</th>
                            <th>Umístění</th>
                            <th>Datum vytvoření</th>
                            <th>Akce</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        temata.forEach(tema => {
            const autorData = this.getUserData(tema.autorId);
            const autorJmeno = autorData ? autorData.identitaNaForu : 'Neznámý autor';
            const autorRole = autorData ? this.getRoleNames(autorData.forumRole) : 'Neznámá';
            const datum = tema.cas ? new Date(tema.cas.seconds * 1000).toLocaleString('cs-CZ') : 'Datum neznámé';

            tableHtml += `
                <tr data-id="${tema.id}" data-kategorie-id="${tema.kategorieId}" data-forum-id="${tema.forumId}">
                    <td>${tema.nazev}</td>
                    <td>${autorJmeno}</td>
                    <td>${autorRole}</td>
                    <td>${tema.kategorieNazev} / ${tema.forumNazev}</td>
                    <td>${datum}</td>
                    <td>
                        <button class="delete-btn"><i class="fas fa-trash-alt"></i> Smazat</button>
                    </td>
                </tr>
            `;
        });

        tableHtml += '</tbody></table></div>';
        container.innerHTML = tableHtml;

        // Přidání event listenerů pro tlačítka "Smazat"
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const row = e.currentTarget.closest('tr');
                const temaId = row.dataset.id;
                const kategorieId = row.dataset.kategorieId;
                const forumId = row.dataset.forumId;
                const temaNazev = row.cells[0].textContent;

                try {
                    await window.showConfirmation({
                        title: `Smazat téma?`,
                        text: `Opravdu chcete smazat téma "${temaNazev}"? Tato akce je nevratná a smaže i všechny odpovědi v tématu.`,
                        requiredInput: temaNazev
                    });

                    await this.smazatTemaAUpravitStatistiky(db, kategorieId, forumId, temaId);
                    
                    zobrazitVlastniAlert('Téma bylo úspěšně smazáno.', 'success');
                    row.remove(); // Odebrat řádek z tabulky bez nutnosti nového načítání
                } catch (error) {
                    if (error !== 'Uživatel zrušil akci' && error !== 'Nesprávný vstup') {
                        console.error("Chyba při mazání tématu:", error);
                        zobrazitVlastniAlert('Během mazání tématu došlo k chybě.', 'error');
                    }
                }
            });
        });
    },
    
    /**
     * Smaže téma, všechny jeho příspěvky a atomicky upraví statistiky fóra a uživatelů.
     * @param {firebase.firestore.Firestore} db 
     * @param {string} kategorieId 
     * @param {string} forumId 
     * @param {string} threadId 
     */
    async smazatTemaAUpravitStatistiky(db, kategorieId, forumId, threadId) {
        const forumRef = db.collection('forum_categories').doc(kategorieId).collection('fora').doc(forumId);
        const threadRef = forumRef.collection('temata').doc(threadId);

        const threadDoc = await threadRef.get();
        if (!threadDoc.exists) throw new Error("Téma, které se snažíte smazat, neexistuje.");

        const threadData = threadDoc.data();
        const threadAuthorId = threadData.autorId;
        const repliesCount = threadData.odpovedi || 0;

        const prispevkySnapshot = await threadRef.collection('prispevky').get();
        
        const batch = db.batch();

        // Smazání všech dokumentů příspěvků a samotného tématu
        prispevkySnapshot.docs.forEach(doc => batch.delete(doc.ref));
        batch.delete(threadRef);

        // Aktualizace statistik fóra
        batch.update(forumRef, {
            pocetTemat: firebase.firestore.FieldValue.increment(-1),
            pocetPrispevku: firebase.firestore.FieldValue.increment(-(repliesCount + 1))
        });
       
        // Aktualizace statistik autora tématu
        const threadAuthorRef = db.collection('users').doc(threadAuthorId);
        batch.update(threadAuthorRef, { 
            'forumStats.pocetTemat': firebase.firestore.FieldValue.increment(-1) 
        });

        // Snížení počtu odpovědí pro všechny ostatní uživatele, kteří v tématu přispěli
        const odpovediAutori = new Map();
        // Přeskakujeme první příspěvek, protože to je příspěvek autora tématu
        prispevkySnapshot.docs.slice(1).forEach(doc => {
            const autorId = doc.data().autorId;
            if (autorId) {
                odpovediAutori.set(autorId, (odpovediAutori.get(autorId) || 0) + 1);
            }
        });

        for (const [autorId, pocet] of odpovediAutori.entries()) {
            const userReplyRef = db.collection('users').doc(autorId);
            batch.update(userReplyRef, { 
                'forumStats.pocetOdpovedi': firebase.firestore.FieldValue.increment(-pocet)
            });
        }

        await batch.commit();
    }
};