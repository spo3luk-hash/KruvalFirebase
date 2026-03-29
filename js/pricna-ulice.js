document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    // Definice aktuální lokace
    const currentLocation = {
        id: 'pricna-ulice',
        title: 'Průchod do Příčné ulice',
        description: 'Stojíš v klenutém průchodu z hrubě tesaného, tmavého kamene. Vzduch je chladný a voní ozónem a prastarou magií. Z kamenné klenby nad tebou tiše sálá modravé, pulzující světlo run. Před tebou se v mlžném oparu rýsuje tepna syrové magie, kterou je Příčná ulice.',
        actions: [
            { text: 'Vstoupit na Příčnou ulici', target: '/pricnaulice-obchody.html' },
            { text: 'Navštívit Děravý kotel', target: '/deravy-kotel.html' },
            { text: 'Odejít do světa mudlů', target: '/index.html' } 
        ]
    };

    let currentUser = null;

    // Sledování stavu přihlášení
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            const characterId = sessionStorage.getItem('selectedCharacterId');
            if (!characterId) {
                alert("Pro vstup do herního světa si nejprve musíte vybrat postavu.");
                window.location.href = '/vyber-postavy.html';
                return;
            }
            
            // Načtení všech dat pomocí listenerů
            loadPlayerData(user.uid);
            attachCharacterListener(user.uid, characterId);
            renderStaticLocation();
            loadPlayersInLocation(currentLocation.id);

        } else {
            window.location.href = '/index.html';
        }
    });

    // Načtení dat o hráči (jednorázové)
    async function loadPlayerData(userId) {
        try {
            const playerDoc = await db.collection('hraci').doc(userId).get();
            if (playerDoc.exists) {
                displayAccountInfo(playerDoc.data());
            }
        } catch (error) {
            console.error("Chyba při načítání dat hráče: ", error);
        }
    }

    // Připojení listeneru pro data postavy (včetně inventáře)
    function attachCharacterListener(userId, charId) {
        const charRef = db.collection('hraci').doc(userId).collection('postavy').doc(charId);
        charRef.onSnapshot(doc => {
            if (doc.exists) {
                const charData = doc.data();
                displayCharacterInfo(charData);
                // Předání pole inventáře k zobrazení
                displayInventory(charData.inventar || []);
            } else {
                alert("Vybraná postava nebyla nalezena.");
                window.location.href = '/vyber-postavy.html';
            }
        }, error => {
            console.error("Chyba při načítání postavy: ", error);
        });
    }

    // Zobrazení informací o účtu
    function displayAccountInfo(playerData) {
        const accountDetailsEl = document.getElementById('player-account-details');
        if (!accountDetailsEl) return;
        accountDetailsEl.innerHTML = `<p><strong>Nick:</strong> ${playerData.herniNick || '?'}</p><p><strong>Email:</strong> ${currentUser.email}</p><p><strong>Role:</strong> ${playerData.role || 'hrac'}</p>`;
    }

    // Zobrazení informací o postavě
    function displayCharacterInfo(charData) {
        const characterInfoEl = document.getElementById('character-info');
        if (!characterInfoEl) return;
        const level = Math.floor((charData.xpBody || 0) / 100) + 1;

        characterInfoEl.innerHTML = `
            <p><strong>Jméno:</strong> ${charData.jmeno} [Lvl. ${level}]</p>
            <p><strong>Role:</strong> ${charData.herniRole || 'Nováček'}</p><hr>
            <p><strong>Lokace:</strong> ${currentLocation.title}</p><hr>
            <p><strong>XP:</strong> ${charData.xpBody || 0}</p><hr>
            <div class="penize">
                <strong><i class="fas fa-coins"></i> Peníze</strong>
                <div class="currency-values">
                    <span data-currency="G">G: ${charData.peněženka?.galeony || 0}</span>
                    <span data-currency="S">S: ${charData.peněženka?.srpce || 0}</span>
                    <span data-currency="K">Svr: ${charData.peněženka?.svrcky || 0}</span>
                </div>
            </div>`;
    }

    // Zobrazení inventáře z pole
    function displayInventory(inventoryItems) {
        const inventoryListEl = document.getElementById('inventory-list');
        if (!inventoryListEl) return;

        if (!inventoryItems || inventoryItems.length === 0) {
            inventoryListEl.innerHTML = '<li>Tvůj inventář je prázdný.</li>';
            return;
        }

        inventoryListEl.innerHTML = '';
        inventoryItems.forEach(item => {
            const el = document.createElement('li');
            // Zobrazí název a množství, pokud existuje, jinak jen název (pro klíč)
            el.textContent = item.mnozstvi ? `${item.nazev} (x${item.mnozstvi})` : item.nazev;
            inventoryListEl.appendChild(el);
        });
    }

    // Načítání ostatních hráčů v lokaci
    function loadPlayersInLocation(locationName) {
        const onlineUsersListEl = document.getElementById('online-users-list');
        if (!onlineUsersListEl) return;
        onlineUsersListEl.innerHTML = '<li>Prohledávám okolí...</li>';

        db.collectionGroup('postavy').where('aktualniSvet', '==', locationName)
          .onSnapshot(snapshot => {
            onlineUsersListEl.innerHTML = snapshot.empty ? '<li>Nikdo, koho bys znal, tu není.</li>' : '';
            snapshot.forEach(doc => {
                const char = doc.data();
                const el = document.createElement('li');
                el.innerHTML = `<span>${char.jmeno || '?'}</span> <span class="text-muted">(${char.vlastnikNick || '?'})</span>`;
                onlineUsersListEl.appendChild(el);
            });
        }, error => {
            console.error("Chyba při načítání online hráčů: ", error);
            onlineUsersListEl.innerHTML = '<li class="error">Načítání selhalo.</li>';
        });
    }

    // Vykreslení statického obsahu lokace
    function renderStaticLocation() {
        const pageHeader = document.querySelector('.page-header');
        const actionsContainer = document.querySelector('.action-buttons');
        if (!pageHeader || !actionsContainer) return;

        pageHeader.querySelector('h1').textContent = currentLocation.title;
        pageHeader.querySelector('p').textContent = currentLocation.description;
        actionsContainer.innerHTML = '';
        currentLocation.actions.forEach(action => {
            const link = document.createElement('a');
            link.href = action.target;
            link.textContent = action.text;
            link.classList.add('btn-primary');
            actionsContainer.appendChild(link);
        });
    } 
});
