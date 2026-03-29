document.addEventListener('DOMContentLoaded', async () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    const characterInfoContent = document.getElementById('character-info-content');
    const shopItemsContainer = document.getElementById('shop-items-container');
    const messageArea = document.getElementById('message-area');

    let activeCharacterId = null;
    let activeCharacterData = null;
    let characterRef = null;
    let shopItems = [];

    function displayMessage(text, type = 'info') {
        messageArea.innerHTML = `<div class="alert alert-${type}">${text}</div>`;
    }

    async function loadShopItems() {
        try {
            const snapshot = await db.collection('obchody').doc('zverimex').collection('mazlicci').get();
            shopItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Chyba při načítání nabídky zverimexu: ", error);
            shopItemsContainer.innerHTML = "<p>Chyba při načítání nabídky obchodu.</p>";
        }
    }

    async function loadCharacterData(user) {
        try {
            await loadShopItems();
            const userDoc = await db.collection('hraci').doc(user.uid).get();
            if (userDoc.exists) {
                activeCharacterId = userDoc.data().aktivniPostava;
                if (activeCharacterId) {
                    characterRef = db.collection('hraci').doc(user.uid).collection('postavy').doc(activeCharacterId);
                    const charDoc = await characterRef.get();
                    if (charDoc.exists) {
                        activeCharacterData = charDoc.data();
                        renderCharacterInfo();
                        renderShopItems();
                    } else {
                        characterInfoContent.innerHTML = '<p>Aktivní postava nenalezena.</p>';
                    }
                } else {
                    characterInfoContent.innerHTML = '<p>Nemáš vybranou aktivní postavu.</p>';
                }
            } else {
                 characterInfoContent.innerHTML = '<p>Hráč nenalezen.</p>';
            }
        } catch (error) {
            console.error("Chyba při načítání postavy: ", error);
            characterInfoContent.innerHTML = '<p>Při načítání postavy došlo k chybě.</p>';
        }
    }

    function renderCharacterInfo() {
        const wallet = activeCharacterData.peněženka || { galeony: 0 };
        characterInfoContent.innerHTML = `
            <ul>
                <li><strong>Jméno:</strong> ${activeCharacterData.jmeno}</li>
                <li><strong>Peníze:</strong> ${wallet.galeony} G</li>
            </ul>
        `;
    }

    function renderShopItems() {
        if (shopItems.length === 0) {
            shopItemsContainer.innerHTML = "<p>Zverimex je momentálně prázdný.</p>";
            return;
        }

        shopItemsContainer.innerHTML = shopItems.map(item => {
            const alreadyOwned = activeCharacterData.mazlicek;
            const canAfford = (activeCharacterData.peněženka?.galeony || 0) >= item.price;
            const isAvailable = item.availability === 'skladem';

            let buttonText = 'Koupit';
            let buttonDisabled = false;

            if (alreadyOwned) {
                buttonText = 'Již vlastníš mazlíčka';
                buttonDisabled = true;
            } else if (!isAvailable) {
                buttonText = 'Vyprodáno';
                buttonDisabled = true;
            } else if (!canAfford) {
                buttonText = 'Nedostatek peněz';
                buttonDisabled = true;
            }

            return `
                <div class="shop-item">
                    <div class="item-image-container">
                        <img src="${item.imageUrl || '/img/avatars/char_placeholder.png'}" alt="${item.name}" class="item-image">
                    </div>
                    <div class="item-info">
                        <h3 class="item-name">${item.name}</h3>
                        <p class="item-description">${item.description}</p>
                        <p class="item-price">Cena: ${item.price} G</p>
                        <button class="buy-button" data-item-id="${item.id}" ${buttonDisabled ? 'disabled' : ''}>${buttonText}</button>
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.buy-button').forEach(button => {
            button.addEventListener('click', handlePurchase);
        });
    }

    async function handlePurchase(event) {
        const itemId = event.target.dataset.itemId;
        const item = shopItems.find(i => i.id === itemId);

        if (!item) return;

        const currentGalleons = activeCharacterData.peněženka?.galeony || 0;
        if (currentGalleons < item.price) {
            displayMessage('Nemáš dostatek galeonů na nákup tohoto předmětu.', 'error');
            return;
        }

        event.target.disabled = true;

        try {
            const newGalleons = currentGalleons - item.price;
            
            // Zkopírujeme celý objekt z obchodu, abychom zachovali všechny jeho vlastnosti (včetně `schopnosti`)
            const petData = { ...item };

            // Nastavíme/přepíšeme specifické vlastnosti pro hráče
            petData.jmeno = `Můj ${item.name.toLowerCase()}`;
            petData.hlad = 100;
            petData.zizen = 100;
            petData.spokojenost = 100;
            
            // Odstraníme vlastnosti, které hráč nepotřebuje (cena, dostupnost)
            delete petData.price;
            delete petData.availability;
            delete petData.description;

            await characterRef.update({
                'peněženka.galeony': newGalleons,
                mazlicek: petData
            });
            
            displayMessage(`Úspěšně jsi zakoupil mazlíčka: ${item.name}! Pojmenuj si ho v profilu.`, 'success');
            
            const charDoc = await characterRef.get();
            activeCharacterData = charDoc.data();
            renderCharacterInfo();
            renderShopItems();

        } catch (error) {
            console.error("Chyba při nákupu: ", error);
            displayMessage('Při nákupu došlo k chybě.', 'error');
            event.target.disabled = false;
        }
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            loadCharacterData(user);
        } else {
            characterInfoContent.innerHTML = '<p>Pro vstup do obchodu se musíš přihlásit.</p>';
        }
    });
});