document.addEventListener('DOMContentLoaded', async () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    // Všechny DOM elementy zůstávají stejné
    const petManagementContainer = document.getElementById('pet-management-container');
    const noPetMessage = document.getElementById('no-pet-message');
    const petDetailsContainer = document.getElementById('pet-details-container');
    const petNameDisplay = document.getElementById('pet-name-display');
    const petImage = document.getElementById('pet-image');
    const hungerBar = document.getElementById('hunger-bar');
    const thirstBar = document.getElementById('thirst-bar');
    const happinessBar = document.getElementById('happiness-bar');
    const feedBtn = document.getElementById('feed-pet-btn');
    const waterBtn = document.getElementById('water-pet-btn');
    const petBtn = document.getElementById('pet-pet-btn');
    const renameInput = document.getElementById('new-pet-name');
    const renameBtn = document.getElementById('rename-pet-btn');
    const havranMessaging = document.getElementById('havran-messaging');
    const openHavranModalBtn = document.getElementById('open-havran-modal-btn');
    const havranStatusContainer = document.getElementById('havran-status-container');
    const havranStatusText = document.getElementById('havran-status-text');

    let activeCharacterRef = null;
    let petData = null;
    let unsubscribeHavranStatus = null;
    let statusUpdateInterval = null;

    auth.onAuthStateChanged(async user => {
        if (user) {
            const userDoc = await db.collection('hraci').doc(user.uid).get();
            if (userDoc.exists && userDoc.data().aktivniPostava) {
                activeCharacterRef = db.collection('hraci').doc(user.uid).collection('postavy').doc(userDoc.data().aktivniPostava);
                await loadPetData();
            } else {
                showNoPetMessage();
            }
        } else {
            window.location.href = '/index.html';
        }
    });

    async function loadPetData() {
        if (!activeCharacterRef) return;

        // 1. Zkusit načíst z podkolekce (nový systém)
        const mazlicciSnapshot = await activeCharacterRef.collection('mazlicci').get();
        if (!mazlicciSnapshot.empty) {
            petData = mazlicciSnapshot.docs[0].data();
            petData.id = mazlicciSnapshot.docs[0].id; // Uložíme ID dokumentu mazlíčka
            petData.source = 'collection'; // Zdroj dat je kolekce
            renderPet();
            return;
        }

        // 2. Pokud se nenašlo, zkusit načíst z pole v dokumentu postavy (starý systém)
        const charDoc = await activeCharacterRef.get();
        if (charDoc.exists && charDoc.data().mazlicek) {
            petData = charDoc.data().mazlicek;
            petData.source = 'field'; // Zdroj dat je pole
            renderPet();
            return;
        }
        
        // 3. Pokud se nenašlo nikde, zobrazit zprávu
        showNoPetMessage();
    }

    function renderPet() {
        if (!petData) {
            showNoPetMessage();
            return;
        }
        
        // Výchozí hodnoty, pokud by chyběly
        if (petData.hlad === undefined) petData.hlad = 100;
        if (petData.zizen === undefined) petData.zizen = 100;
        if (petData.spokojenost === undefined) petData.spokojenost = 100;

        renderPetDetails();
        petDetailsContainer.style.display = 'grid';
        noPetMessage.style.display = 'none';
        setInterval(updateNeeds, 3600000);

        if (petData.type && petData.type.toLowerCase() === 'havran') {
            listenToHavranStatus();
        }
    }

    function renderPetDetails() {
        if (!petData) return;
        if (petNameDisplay) petNameDisplay.textContent = petData.jmeno || 'Můj mazlíček';
        if (petImage) petImage.src = petData.imageUrl || '/img/avatars/char_placeholder.png';
        updateBars();
        
        if (havranMessaging) {
            if (petData.type && petData.type.toLowerCase() === 'havran') {
                havranMessaging.style.display = 'block';
            } else {
                havranMessaging.style.display = 'none';
            }
        }
    }

    async function savePetData() {
        if (!activeCharacterRef || !petData) return;

        const dataToSave = { ...petData };
        delete dataToSave.source; // Odstraníme pomocný klíč
        
        if (petData.source === 'collection') {
            delete dataToSave.id; // ID se neukládá do dat, je to název dokumentu
            await activeCharacterRef.collection('mazlicci').doc(petData.id).set(dataToSave, { merge: true });
        } else {
            await activeCharacterRef.update({ mazlicek: dataToSave });
        }
    }

    // Funkce pro aktualizaci potřeb, nyní volá univerzální savePetData
    async function updateNeeds() {
        if (!petData) return;
        petData.hlad = Math.max(0, (petData.hlad || 100) - 1);
        petData.zizen = Math.max(0, (petData.zizen || 100) - 2);
        petData.spokojenost = Math.max(0, (petData.spokojenost || 100) - 1);
        await savePetData();
        updateBars();
    }

    // Listenery pro tlačítka krmení, napájení a hlazení
    if (feedBtn) feedBtn.addEventListener('click', async () => {
        if (!petData) return;
        petData.hlad = Math.min(100, petData.hlad + 20);
        await savePetData();
        updateBars();
    });

    if (waterBtn) waterBtn.addEventListener('click', async () => {
        if (!petData) return;
        petData.zizen = Math.min(100, petData.zizen + 25);
        await savePetData();
        updateBars();
    });

    if (petBtn) petBtn.addEventListener('click', async () => {
        if (!petData) return;
        petData.spokojenost = Math.min(100, petData.spokojenost + 15);
        await savePetData();
        updateBars();
    });

    // Listener pro přejmenování
    if (renameBtn) renameBtn.addEventListener('click', async () => {
        if (!petData) return;
        const newName = renameInput.value.trim();
        if (newName) {
            petData.jmeno = newName;
            await savePetData();
            renderPetDetails();
            renameInput.value = '';
        }
    });

    // Funkce pro zobrazení, že mazlíček není
    function showNoPetMessage() {
        if (petDetailsContainer) petDetailsContainer.style.display = 'none';
        if (noPetMessage) noPetMessage.style.display = 'block';
        if (havranMessaging) havranMessaging.style.display = 'none';
    }

    // Všechny ostatní funkce (updateBars, havraní pošta) zůstávají stejné...
    function updateBars() {
        if (!petData) return;
        if (hungerBar) hungerBar.style.width = `${petData.hlad}%`;
        if (thirstBar) thirstBar.style.width = `${petData.zizen}%`;
        if (happinessBar) happinessBar.style.width = `${petData.spokojenost}%`;
    }

    function listenToHavranStatus() {
        if (unsubscribeHavranStatus) unsubscribeHavranStatus();
        if (statusUpdateInterval) clearInterval(statusUpdateInterval);

        unsubscribeHavranStatus = db.collection('posta')
            .where('odesilatelPath', '==', activeCharacterRef.path)
            .where('typ', '==', 'havrani_posta')
            .orderBy('casOdeslani', 'desc')
            .limit(1)
            .onSnapshot(snapshot => {
                updateHavranStatus(snapshot.empty ? null : snapshot.docs[0].data());
            });
    }

    function updateHavranStatus(message) {
        if (statusUpdateInterval) clearInterval(statusUpdateInterval);

        if (!message) {
            havranStatusContainer.style.display = 'none';
            openHavranModalBtn.disabled = false;
            openHavranModalBtn.textContent = 'Napsat novou zprávu';
            return;
        }

        const deliveryTime = message.casDoruceni.toDate().getTime();
        const now = Date.now();

        if (now >= deliveryTime) {
            havranStatusContainer.style.display = 'block';
            havranStatusText.textContent = 'Poslední zpráva byla doručena.';
            openHavranModalBtn.disabled = false;
            openHavranModalBtn.textContent = 'Napsat novou zprávu';
            return;
        }

        havranStatusContainer.style.display = 'block';
        openHavranModalBtn.disabled = true;
        openHavranModalBtn.textContent = 'Havran je na cestě';

        const updateCountdown = () => {
            const remaining = deliveryTime - Date.now();
            if (remaining > 0) {
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                havranStatusText.textContent = `Havran doručuje zprávu. Zbývající čas: ${minutes}m ${seconds}s.`;
            } else {
                havranStatusText.textContent = 'Zpráva byla doručena.';
                openHavranModalBtn.disabled = false;
                openHavranModalBtn.textContent = 'Napsat novou zprávu';
                clearInterval(statusUpdateInterval);
            }
        };
        updateCountdown();
        statusUpdateInterval = setInterval(updateCountdown, 1000);
    }
    
    // Kód pro otevírání modálního okna pošty
    if (openHavranModalBtn) {
        openHavranModalBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('modal-havran.html');
                if (!response.ok) throw new Error('Nepodařilo se načíst obsah modálního okna.');
                const modalContent = await response.text();
                window.openModal('Havraní pošta', modalContent, () => {
                    const oldScript = document.getElementById('modal-havran-script');
                    if (oldScript) oldScript.remove();
                });
                const script = document.createElement('script');
                script.id = 'modal-havran-script';
                script.src = '/js/modal-havran.js';
                script.defer = true;
                document.body.appendChild(script);
            } catch (error) {
                console.error('Chyba při otevírání modálního okna:', error);
                alert('Došlo k chybě, zkuste to prosím znovu.');
            }
        });
    }
});