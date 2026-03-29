document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();
    const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();

    const params = new URLSearchParams(window.location.search);
    const shopId = params.get('id');

    const shopNameHeader = document.getElementById('shop-name-header');
    const shopDescription = document.getElementById('shop-description');
    const itemsContainer = document.getElementById('items-container');
    const itemDetailModal = document.getElementById('item-detail-modal');
    const itemModalName = document.getElementById('item-modal-name');
    const itemModalImage = document.getElementById('item-modal-image');
    const itemModalDescription = document.getElementById('item-modal-description');
    const itemModalPrice = document.getElementById('item-modal-price');
    const buyItemBtn = document.getElementById('buy-item-btn');
    const closeModalBtn = itemDetailModal.querySelector('.close-button');
    const quantityInput = document.getElementById('item-quantity-input');

    let currentCharacterId = null;
    let currentUserId = null;
    let currentItemForPurchase = null;

    if (!shopId) {
        handleError('Obchod nenalezen', 'V URL chybí identifikátor obchodu.');
        return;
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            getCharacterIdAndLoadData();
        } else {
            handleError('Přístup odepřen', 'Pro zobrazení obchodu se musíte přihlásit. <a href="index.html">Přihlásit se</a>');
        }
    });

    const getCharacterIdAndLoadData = async () => {
        let charId = sessionStorage.getItem('selectedCharacterId');
        if (charId) {
            currentCharacterId = charId;
            loadShopData();
        } else {
             handleError('Není vybrána postava', 'Před vstupem do obchodu si musíte vybrat postavu. <a href="vyber-postavy.html">Přejít na výběr postavy</a>');
        }
    };

    const handleError = (title, message) => {
        shopNameHeader.textContent = title;
        itemsContainer.innerHTML = `<p class="error-message">${message}</p>`;
        shopDescription.innerHTML = '';
    };

    const loadShopData = async () => {
        try {
            const shopDoc = await db.collection('obchody_nove').doc(shopId).get();
            if (!shopDoc.exists) {
                handleError('Obchod neexistuje', 'Tento obchod zřejmě již byl zrušen.');
                return;
            }
            const shopData = shopDoc.data();
            shopNameHeader.textContent = shopData.name;
            shopDescription.textContent = shopData.description;

            const itemsSnapshot = await db.collection('obchody_nove').doc(shopId).collection('items').get();
            itemsContainer.innerHTML = '';
            if (itemsSnapshot.empty) {
                itemsContainer.innerHTML = '<p>Tento obchod momentálně nenabízí žádné zboží.</p>';
                return;
            }

            for (const itemDoc of itemsSnapshot.docs) {
                const shopItemData = itemDoc.data();
                // OPRAVA: Sjednocení na kolekci 'items'
                const masterItemDoc = await db.collection('items').doc(shopItemData.masterItemId).get();
                if (masterItemDoc.exists) {
                    const masterItemData = masterItemDoc.data();
                    const itemCard = document.createElement('div');
                    itemCard.className = 'item-card';
                    const displayItem = {
                        name: masterItemData.name, // Používá se 'name'
                        imageUrl: masterItemData.imageUrl,
                        description: masterItemData.description, // Používá se 'description'
                        price: shopItemData.price,
                        masterItemId: shopItemData.masterItemId
                    };
                    itemCard.addEventListener('click', () => openItemModal(displayItem));
                    itemCard.innerHTML = `
                        <img src="${displayItem.imageUrl || 'img/default-item.png'}" alt="${displayItem.name}" class="item-image">
                        <div class="item-info">
                            <h3>${displayItem.name}</h3>
                            <div class="item-footer">
                                <span class="item-price"><i class="fas fa-coins"></i> ${displayItem.price} G</span>
                            </div>
                        </div>
                    `;
                    itemsContainer.appendChild(itemCard);
                }
            }
        } catch (error) {
            console.error("Chyba při načítání dat obchodu: ", error);
            handleError('Chyba obchodu', 'Nepodařilo se načíst data obchodu.');
        }
    };

    const openItemModal = (item) => {
        currentItemForPurchase = item;
        itemModalName.textContent = item.name;
        itemModalImage.src = item.imageUrl || 'img/default-item.png';
        itemModalDescription.textContent = item.description || 'Popis není k dispozici.';
        itemModalPrice.innerHTML = `<i class="fas fa-coins"></i> ${item.price} G (za kus)`;
        quantityInput.value = 1;
        itemDetailModal.classList.remove('hidden');
    };

    const closeItemModal = () => {
        itemDetailModal.classList.add('hidden');
        currentItemForPurchase = null;
    };
    closeModalBtn.addEventListener('click', closeItemModal);

    buyItemBtn.addEventListener('click', async () => {
        if (!currentItemForPurchase || !currentCharacterId || !currentUserId) {
            alert('Chyba: Chybí potřebné údaje pro nákup.');
            return;
        }

        const quantity = parseInt(quantityInput.value, 10);
        if (isNaN(quantity) || quantity <= 0) {
            alert('Zadejte prosím platné množství (kladné číslo).');
            return;
        }

        buyItemBtn.disabled = true;
        buyItemBtn.textContent = 'Zpracovávám...';

        const pricePerItem = currentItemForPurchase.price;
        const totalPrice = pricePerItem * quantity;
        const masterItemId = currentItemForPurchase.masterItemId;
        const itemName = currentItemForPurchase.name;

        const characterRef = db.collection('hraci').doc(currentUserId).collection('postavy').doc(currentCharacterId);
        const inventoryCollectionRef = characterRef.collection('inventar');

        try {
            const existingItemQuery = inventoryCollectionRef.where('masterId', '==', masterItemId).limit(1);
            const querySnapshot = await existingItemQuery.get();
            const existingItemDocRef = querySnapshot.docs.length > 0 ? querySnapshot.docs[0].ref : null;

            await db.runTransaction(async (transaction) => {
                // --- FÁZE 1: ČTENÍ ---
                const characterDoc = await transaction.get(characterRef);
                let existingItemDoc = null;
                if (existingItemDocRef) {
                    existingItemDoc = await transaction.get(existingItemDocRef);
                }

                // --- FÁZE 2: VALIDACE ---
                if (!characterDoc.exists) {
                    throw new Error("Postava nenalezena.");
                }
                const characterData = characterDoc.data();
                const currentGalleons = characterData.peněženka?.galeony || 0;

                if (currentGalleons < totalPrice) {
                    throw new Error("Nedostatek zlaťáků.");
                }
                
                // --- FÁZE 3: ZÁPISY ---
                const newGalleons = currentGalleons - totalPrice;
                transaction.update(characterRef, { 'peněženka.galeony': newGalleons });

                if (existingItemDoc && existingItemDoc.exists) {
                    const newQuantity = (existingItemDoc.data().mnozstvi || 0) + quantity;
                    transaction.update(existingItemDocRef, { mnozstvi: newQuantity });
                } else {
                    const newItemRef = inventoryCollectionRef.doc();
                    transaction.set(newItemRef, {
                        masterId: masterItemId,
                        mnozstvi: quantity,
                        pridano: serverTimestamp
                    });
                }
            });

            alert(`Úspěšně jste zakoupili ${quantity}x ${itemName}!`);
            closeItemModal();
            renderCharacterInfo();

        } catch (error) {
            console.error("Chyba při nákupu: ", error);
            alert(`Při nákupu nastala chyba: ${error.message}`);
        } finally {
            buyItemBtn.disabled = false;
            buyItemBtn.textContent = 'Koupit';
        }
    });

    const renderCharacterInfo = async () => {
        try {
            const charDoc = await db.collection('hraci').doc(currentUserId).collection('postavy').doc(currentCharacterId).get();
            if (charDoc.exists) {
                const charData = charDoc.data();
                const goldDisplay = document.querySelector('.character-gold-display');
                if(goldDisplay) goldDisplay.textContent = `${charData.peněženka?.galeony || 0}`;
            }
        } catch(e) { console.error("Nepodařilo se aktualizovat info o postavě", e); }
    }
});