document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();

    const urlParams = new URLSearchParams(window.location.search);
    const characterId = urlParams.get('id');
    const hracId = urlParams.get('hracId'); // Keep this for now, for direct path

    const loadingContainer = document.getElementById('profil-loading');
    const profileContainer = document.getElementById('profil-container');
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const avatarRect = document.getElementById('character-avatar-rect');
    const avatarInitial = document.getElementById('character-avatar-initial');
    const characterNameEl = document.getElementById('character-name');
    const characterTitleEl = document.getElementById('character-title');
    const characterAgeEl = document.getElementById('character-age');
    const characterRoleEl = document.getElementById('character-role');
    const characterOriginEl = document.getElementById('character-origin');
    const characterDescriptionEl = document.getElementById('character-description');
    const petBlock = document.getElementById('character-pet');
    const petImageEl = document.getElementById('pet-image');
    const petNameEl = document.getElementById('pet-name');
    const achievementsPane = document.getElementById('achievements');
    const inventoryGridEl = document.getElementById('inventory-grid');
    const openInventoryBtn = document.getElementById('open-inventory-btn');


    const switchTab = (tabId) => {
        tabLinks.forEach(link => link.classList.toggle('active', link.dataset.tab === tabId));
        tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === tabId));
    };

    tabLinks.forEach(link => {
        link.addEventListener('click', () => switchTab(link.dataset.tab));
    });

    openInventoryBtn.addEventListener('click', () => {
        if (characterId) {
            sessionStorage.setItem('selectedCharacterId', characterId);
            window.location.href = `inventar.html`;
        }
    });

    const calculateAge = (birthYear) => {
        if (!birthYear) return 'Neznámý';
        const currentYear = new Date().getFullYear();
        return currentYear - birthYear;
    };

    const renderAchievements = async (characterDocRef) => {
        try {
            const ziskaneOdznakySnapshot = await characterDocRef.collection('ziskaneOdznaky').orderBy('datumZiskani', 'desc').get();
            if (ziskaneOdznakySnapshot.empty) {
                achievementsPane.innerHTML = '<div class="placeholder-content"><h2>Síň úspěchů</h2><p>Tato postava zatím nezískala žádné odznaky.</p></div>';
                return;
            }
            const odznakyPromises = ziskaneOdznakySnapshot.docs.map(doc => {
                const odznakRefId = doc.data().odznakId;
                if (!odznakRefId) return Promise.resolve(null);
                return db.collection('odznaky').doc(odznakRefId).get();
            });
            const odznakyDocs = await Promise.all(odznakyPromises);
            let achievementsHTML = '<h2>Síň úspěchů</h2><div class="achievements-grid">';
            odznakyDocs.forEach(odznakDoc => {
                if (odznakDoc && odznakDoc.exists) {
                    const odznakData = odznakDoc.data();
                    achievementsHTML += `
                        <div class="achievement-card" title="${odznakData.popis || ''}">
                            <img src="${odznakData.obrazek || '/img/badges/default.png'}" alt="${odznakData.nazev}">
                            <h3>${odznakData.nazev}</h3>
                        </div>
                    `;
                }
            });
            achievementsHTML += '</div>';
            achievementsPane.innerHTML = achievementsHTML;
        } catch (error) {
            console.error("Chyba při načítání úspěchů: ", error);
            achievementsPane.innerHTML = '<div class="placeholder-content"><h2>Síň úspěchů</h2><p>Při načítání úspěchů došlo k chybě.</p></div>';
        }
    };
    const renderInventory = async (characterDocRef) => {
        if (!inventoryGridEl) return;
        inventoryGridEl.innerHTML = '<p>Načítám inventář...</p>';

        try {
            const inventorySnapshot = await characterDocRef.collection('inventar').get();
            if (inventorySnapshot.empty) {
                inventoryGridEl.innerHTML = '<p>Inventář je prázdný.</p>';
                return;
            }
            
            inventoryGridEl.innerHTML = '';

            for (const inventoryDoc of inventorySnapshot.docs) {
                const inventoryItem = inventoryDoc.data();
                if (!inventoryItem.masterId) continue;

                const masterItemRef = db.collection('items').doc(inventoryItem.masterId);
                const masterItemDoc = await masterItemRef.get();

                if (masterItemDoc.exists) {
                    const masterItemData = masterItemDoc.data();
                    
                    const slotEl = document.createElement('div');
                    slotEl.className = 'inventory-slot';
                    
                    let title = `${masterItemData.name}\n${masterItemData.description || ''}`;
                    slotEl.title = title;
                    
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'inventory-item-image-container';

                    const imgEl = document.createElement('img');
                    imgEl.src = masterItemData.imageUrl || 'img/default-item.png';
                    imgEl.alt = masterItemData.name;
                    imgEl.className = 'inventory-item-image';
                    imgContainer.appendChild(imgEl);

                    const countEl = document.createElement('div');
                    countEl.className = 'inventory-item-count';
                    countEl.textContent = inventoryItem.mnozstvi;
                    imgContainer.appendChild(countEl);

                    slotEl.appendChild(imgContainer);
                    inventoryGridEl.appendChild(slotEl);
                }
            }
        } catch (error) {
            console.error("Chyba při načítání inventáře: ", error);
            inventoryGridEl.innerHTML = '<p>Došlo k chybě při načítání inventáře.</p>';
        }
    };

    const renderCharacterProfile = (charData, characterDocRef) => {
        if (charData.avatar) {
            avatarRect.style.backgroundImage = `url('${charData.avatar}')`;
            avatarInitial.style.display = 'none';
        } else {
            avatarRect.style.backgroundImage = 'none';
            avatarInitial.textContent = charData.jmeno ? charData.jmeno.charAt(0).toUpperCase() : '?';
            avatarInitial.style.display = 'flex';
        }
        characterNameEl.textContent = charData.jmeno || 'Bezejmenná postava';
        characterTitleEl.textContent = charData.titul || 'Dobrodruh';
        const puvodTextMap = { cistokrevny: "Čistokrevný", smiseny: "Smíšený původ", mudlovsky: "Z mudlovské rodiny" };
        characterAgeEl.textContent = calculateAge(charData.rokNarozeni);
        characterRoleEl.textContent = charData.herniRole || 'Nováček';
        characterOriginEl.textContent = puvodTextMap[charData.puvod] || 'Neznámý';
        characterDescriptionEl.textContent = charData.verejnyPopis || 'Tato postava zatím nemá žádný popis.';
        if (charData.mazlicek && charData.mazlicek.typ === 'havran') {
            petImageEl.src = '/img/pets/raven.jpg';
            petNameEl.textContent = charData.mazlicek.jmeno || 'Havran';
            petBlock.style.display = 'block';
        }
        loadingContainer.style.display = 'none';
        profileContainer.style.display = 'block';

        renderAchievements(characterDocRef);
        renderInventory(characterDocRef);
    };

    const findAndRenderCharacter = async (charId) => {
        // If we have both IDs, get the document directly.
        if (hracId) {
            const directRef = db.collection('hraci').doc(hracId).collection('postavy').doc(charId);
            const doc = await directRef.get();
            if (doc.exists) {
                renderCharacterProfile(doc.data(), doc.ref);
                return;
            }
        }

        // Fallback to collectionGroup query if direct path fails or hracId is missing.
        try {
            const snapshot = await db.collectionGroup('postavy').where('id', '==', charId).limit(1).get();
            if (snapshot.empty) {
                loadingContainer.innerHTML = `<p class="error-message">Postava s ID \"${charId}\" nebyla nalezena.</p>`;
                return;
            }
            const characterDoc = snapshot.docs[0];
            const characterData = characterDoc.data();
            renderCharacterProfile(characterData, characterDoc.ref);
        } catch (err) {
            console.error("Chyba při načítání profilu postavy: ", err);
            loadingContainer.innerHTML = `<p class="error-message">Došlo k chybě při načítání dat. Zkuste to prosím později.</p>`;
        }
    };

    if (!characterId) {
        loadingContainer.innerHTML = '<p class="error-message">V URL adrese chybí ID postavy.</p>';
        return;
    }

    findAndRenderCharacter(characterId);
});