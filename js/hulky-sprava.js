document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    // Elementy stránky
    const adminCheckDiv = document.getElementById('admin-check');
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');

    const addWandForm = document.getElementById('add-wand-form');
    const generateRandomWandsBtn = document.getElementById('generate-random-wands-btn');
    const wandList = document.getElementById('wand-list');
    const characterWandsList = document.getElementById('character-wands-list');

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const idTokenResult = await user.getIdTokenResult();
                if (idTokenResult.claims.admin === true) {
                    loadingMessage.classList.add('hidden');
                    adminCheckDiv.classList.remove('hidden');
                    loadWands();
                    loadCharacterWands();
                } else {
                    loadingMessage.classList.add('hidden');
                    errorMessage.classList.remove('hidden');
                }
            } catch (error) {
                console.error("Chyba při ověřování administrátora: ", error);
                loadingMessage.classList.add('hidden');
                errorMessage.classList.remove('hidden');
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    // Přidání hůlky
    addWandForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const wood = document.getElementById('wand-wood').value;
        const core = document.getElementById('wand-core').value;
        const length = parseFloat(document.getElementById('wand-length').value);
        const flexibility = document.getElementById('wand-flexibility').value;

        try {
            await db.collection('hulky').add({
                drevo: wood,
                jadro: core,
                delka: length,
                pruznost: flexibility,
                vlastnik: null
            });
            addWandForm.reset();
            loadWands();
        } catch (error) {
            console.error("Chyba při přidávání hůlky: ", error);
        }
    });

    // Generování náhodných hůlek
    generateRandomWandsBtn.addEventListener('click', async () => {
        try {
            const wands = wandGenerator.generate(10);
            const batch = db.batch();

            wands.forEach(wand => {
                const wandRef = db.collection('hulky').doc(); 
                batch.set(wandRef, wand);
            });

            await batch.commit();
            loadWands(); // Znovu načteme seznam hůlek
        } catch (error) {
            console.error("Chyba při generování a ukládání náhodných hůlek: ", error);
        }
    });

    // Načtení dostupných hůlek
    async function loadWands() {
        wandList.innerHTML = '';
        const snapshot = await db.collection('hulky').where('vlastnik', '==', null).get();
        snapshot.forEach(doc => {
            const wand = doc.data();
            const row = `
                <tr>
                    <td>${wand.drevo}</td>
                    <td>${wand.jadro}</td>
                    <td>${wand.delka}</td>
                    <td>${wand.pruznost}</td>
                    <td>
                        <button class="action-btn edit-btn" data-id="${doc.id}">Upravit</button>
                        <button class="action-btn delete-btn" data-id="${doc.id}">Smazat</button>
                    </td>
                </tr>
            `;
            wandList.innerHTML += row;
        });
    }

    // Načtení hůlek postav
    async function loadCharacterWands() {
        characterWandsList.innerHTML = '';
        const playersSnapshot = await db.collection('hraci').get();
        
        for (const playerDoc of playersSnapshot.docs) {
            const player = playerDoc.data();
            const playerId = playerDoc.id;
            const charactersSnapshot = await db.collection('hraci').doc(playerId).collection('postavy').get();

            for (const characterDoc of charactersSnapshot.docs) {
                const character = characterDoc.data();
                const characterId = characterDoc.id;
                const inventorySnapshot = await db.collection('hraci').doc(playerId).collection('postavy').doc(characterId).collection('inventar').where('typ', '==', 'hulka').get();

                if (!inventorySnapshot.empty) {
                    inventorySnapshot.forEach(wandDoc => {
                        const wand = wandDoc.data();
                        const row = `
                            <tr>
                                <td>${character.jmeno} (Hráč: ${player.herniNick || 'Neznámý'})</td>
                                <td>${wand.nazev}</td>
                                <td>
                                    <button class="action-btn delete-btn" data-player-id="${playerId}" data-character-id="${characterId}" data-wand-id="${wandDoc.id}">Odebrat</button>
                                </td>
                            </tr>
                        `;
                        characterWandsList.innerHTML += row;
                    });
                } else {
                     const row = `
                        <tr>
                            <td>${character.jmeno} (Hráč: ${player.herniNick || 'Neznámý'})</td>
                            <td>Žádná hůlka</td>
                            <td>
                                <button class="action-btn assign-btn" data-player-id="${playerId}" data-character-id="${characterId}">Přidat hůlku</button>
                            </td>
                        </tr>
                    `;
                    characterWandsList.innerHTML += row;
                }
            }
        }
    }

    // Delegace událostí pro tlačítka v seznamech
    document.addEventListener('click', async (e) => {
        const target = e.target;
        const wandId = target.dataset.id;
        const playerId = target.dataset.playerId;
        const characterId = target.dataset.characterId;
        const wandDocId = target.dataset.wandId;

        // Smazání dostupné hůlky
        if (target.classList.contains('delete-btn') && wandId) {
            if (confirm('Opravdu chcete smazat tuto hůlku?')) {
                await db.collection('hulky').doc(wandId).delete();
                loadWands();
            }
        }

        // Odebrání hůlky postavě
        if (target.classList.contains('delete-btn') && playerId && characterId && wandDocId) {
             if (confirm('Opravdu chcete odebrat hůlku této postavě?')) {
                await db.collection('hraci').doc(playerId).collection('postavy').doc(characterId).collection('inventar').doc(wandDocId).delete();
                loadCharacterWands();
                loadWands();
            }
        }

        // Přidání hůlky postavě (zobrazí dialog pro výběr)
        if (target.classList.contains('assign-btn')) {
            // Zde by se implementoval dialog pro výběr a přidání hůlky
            alert('Funkce pro přidání hůlky postavě bude brzy implementována.');
        }
        
        // Úprava hůlky
        if (target.classList.contains('edit-btn')) {
            // Zde by se implementoval dialog pro úpravu
            alert('Funkce pro úpravu hůlky bude brzy implementována.');
        }
    });
});
