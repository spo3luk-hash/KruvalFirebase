document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    // === Reference na DOM prvky ===
    const openNastenkaBtn = document.getElementById('open-nastenka-btn');
    const closeNastenkaBtn = document.getElementById('close-nastenka-btn');
    const nastenkaModal = document.getElementById('nastenka-modal');
    const zakazkyContainer = document.getElementById('dostupne-zakazky-container');

    let currentUser = null;
    let characterId = null;
    let characterData = null;

    // === Inicializace po přihlášení ===
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            characterId = sessionStorage.getItem('selectedCharacterId');
            if (characterId) {
                db.collection('hraci').doc(user.uid).collection('postavy').doc(characterId).get()
                    .then(doc => {
                        if (doc.exists) characterData = { id: doc.id, ...doc.data() };
                    });
            }
        } 
    });

    // === Event Listeners pro modální okno ===
    openNastenkaBtn.addEventListener('click', () => {
        nastenkaModal.classList.remove('hidden');
        loadZakazky();
    });

    closeNastenkaBtn.addEventListener('click', () => {
        nastenkaModal.classList.add('hidden');
    });

    window.addEventListener('click', (event) => {
        if (event.target === nastenkaModal) {
            nastenkaModal.classList.add('hidden');
        }
    });

    // === Logika načítání a zobrazení zakázek ===
    function loadZakazky() {
        zakazkyContainer.innerHTML = '<p>Prohledávám nástěnku...</p>';

        db.collection('zakazky').where('stav', 'in', ['vypsana', 'probiha']).orderBy('stav').orderBy('casVytvoreni', 'desc').onSnapshot(snapshot => {
            if (snapshot.empty) {
                zakazkyContainer.innerHTML = '<p>Na nástěnce nejsou momentálně žádné nové zakázky.</p>';
                return;
            }

            zakazkyContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const zakazka = { id: doc.id, ...doc.data() };
                renderZakazka(zakazka);
            });
        }, error => {
            console.error("Chyba při načítání zakázek: ", error);
            zakazkyContainer.innerHTML = '<p class="error">Nepodařilo se načíst zakázky z nástěnky.</p>';
        });
    }

    function renderZakazka(zakazka) {
        const zakazkaElement = document.createElement('div');
        zakazkaElement.classList.add('zakazka-item');

        const mojeUcast = zakazka.zapsaniHraci?.find(hrac => hrac.idPostavy === characterId);

        let buttonHtml = '';
        if (zakazka.stav === 'probiha') {
            if (mojeUcast && mojeUcast.stavUcasti === 'zapsany') {
                buttonHtml = `<button class="btn-primary btn-potvrdit-ucast" data-zakazka-id="${zakazka.id}">Potvrdit účast</button>`;
            } else if (mojeUcast) {
                buttonHtml = '<button class="btn-secondary" disabled>Účast potvrzena</button>';
            } else {
                 buttonHtml = '<button class="btn-secondary" disabled>Probíhá</button>';
            }
        } else if (zakazka.stav === 'vypsana') {
            if (mojeUcast) {
                buttonHtml = '<button class="btn-secondary" disabled>Již zapsán/a</button>';
            } else if (zakazka.zapsaniHraci?.length >= zakazka.kapacita) {
                buttonHtml = '<button class="btn-secondary" disabled>Kapacita naplněna</button>';
            } else {
                buttonHtml = `<button class="btn-primary btn-zapsat" data-zakazka-id="${zakazka.id}">Zapsat se</button>`;
            }
        }

        zakazkaElement.innerHTML = `
            <div class="zakazka-details">
                <h4>${zakazka.nazev} (${zakazka.stav})</h4>
                <p><strong>Zadavatel:</strong> ${zakazka.zadavatel}</p>
                <p><strong>Odměna:</strong> ${zakazka.odmenaGaleony} galeonů</p>
                <p><em>${zakazka.popis}</em></p>
            </div>
            <div class="zakazka-actions">
                ${buttonHtml}
            </div>
        `;

        zakazkyContainer.appendChild(zakazkaElement);

        zakazkaElement.querySelector('.btn-zapsat')?.addEventListener('click', handleZapsatSe);
        zakazkaElement.querySelector('.btn-potvrdit-ucast')?.addEventListener('click', handlePotvrditUcast);
    }

    // === Logika pro zapsání postavy ===
    async function handleZapsatSe(event) {
        if (!characterId || !characterData || !currentUser) return alert("Nejprve se musíš přihlásit a vybrat postavu.");
        
        const zakazkaId = event.target.dataset.zakazkaId;
        const zakazkaRef = db.collection('zakazky').doc(zakazkaId);

        event.target.disabled = true;

        try {
            const hracInfo = {
                uid: currentUser.uid, // <-- OPRAVENO: Přidáno UID hráče
                idPostavy: characterId,
                jmenoPostavy: characterData.jmeno,
                stavUcasti: 'zapsany'
            };
            await zakazkaRef.update({ zapsaniHraci: firebase.firestore.FieldValue.arrayUnion(hracInfo) });
        } catch (error) {
            console.error("Chyba při zapisování na zakázku: ", error);
            alert(`Při zapisování došlo k chybě: ${error.message}`);
        }
    }

    // === Logika pro potvrzení účasti ===
    async function handlePotvrditUcast(event) {
        const zakazkaId = event.target.dataset.zakazkaId;
        const zakazkaRef = db.collection('zakazky').doc(zakazkaId);

        event.target.disabled = true;

        try {
            await db.runTransaction(async (transaction) => {
                const zakazkaDoc = await transaction.get(zakazkaRef);
                if (!zakazkaDoc.exists) throw new Error("Zakázka již neexistuje.");

                const zakazkaData = zakazkaDoc.data();
                const hracIndex = zakazkaData.zapsaniHraci.findIndex(hrac => hrac.idPostavy === characterId);

                if (hracIndex === -1) throw new Error("Tvoje postava není na tuto zakázku zapsaná.");

                // Aktualizujeme pole přímo
                zakazkaData.zapsaniHraci[hracIndex].stavUcasti = 'ucastnen';
                transaction.update(zakazkaRef, { zapsaniHraci: zakazkaData.zapsaniHraci });
            });
        } catch (error) {
            console.error("Chyba při potvrzování účasti: ", error);
            alert(`Při potvrzování účasti došlo k chybě: ${error.message}`);
        }
    }
});
