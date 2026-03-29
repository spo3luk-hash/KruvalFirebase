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
    const shopId = 'krucanky-a-kanoury'; // Pevně dané ID obchodu

    function displayMessage(text, type = 'info') {
        messageArea.innerHTML = `<div class="alert alert-${type}">${text}</div>`;
    }

    async function loadCharacterData(user) {
        try {
            const userDoc = await db.collection('hraci').doc(user.uid).get();
            if (userDoc.exists) {
                activeCharacterId = userDoc.data().aktivniPostava;
                if (activeCharacterId) {
                    characterRef = db.collection('hraci').doc(user.uid).collection('postavy').doc(activeCharacterId);
                    const charDoc = await characterRef.get();
                    if (charDoc.exists) {
                        activeCharacterData = charDoc.data();
                        renderCharacterInfo();
                        await loadShopItems();
                        renderShopItems();
                    } else {
                        characterInfoContent.innerHTML = '<p>Aktivní postava nenalezena.</p>';
                    }
                } else {
                    window.location.href = 'vyber-postavy.html';
                }
            } else {
                 characterInfoContent.innerHTML = '<p>Hráč nenalezen.</p>';
            }
        } catch (error) {
            console.error("Chyba při načítání postavy: ", error);
            characterInfoContent.innerHTML = '<p>Při načítání postavy došlo k chybě.</p>';
        }
    }

    // OPRAVENÁ FUNKCE: Načítá data ze subkolekce, aby byla konzistentní s administrací.
    async function loadShopItems() {
        try {
            const itemsSnapshot = await db.collection('obchody').doc(shopId).collection('items').orderBy('name').get();
            if (itemsSnapshot.empty) {
                shopItems = [];
            } else {
                shopItems = itemsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    type: doc.data().type || 'ucebnice' // Zajistí výchozí typ
                }));
            }
        } catch (error) {
            console.error("Chyba při načítání položek obchodu: ", error);
            displayMessage("Nepodařilo se načíst zboží z obchodu.", "danger");
            shopItems = [];
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
        if (!shopItems || shopItems.length === 0) {
            shopItemsContainer.innerHTML = '<p>V obchodě momentálně není žádné zboží.</p>';
            return;
        }

        shopItemsContainer.innerHTML = shopItems.map(item => {
            // Používáme 'nazev' pro kontrolu vlastnictví, jak je ukládáno v inventáři
            const alreadyOwned = activeCharacterData.inventar && activeCharacterData.inventar.some(i => i.nazev === item.name);
            const canAfford = (activeCharacterData.peněženka?.galeony || 0) >= item.price;

            return `
                <div class="shop-item">
                    <div class="item-image-container">
                        <img src="${item.img || 'img/book_cover_generic.png'}" alt="${item.name}" class="item-image">
                    </div>
                    <div class="item-info">
                        <h3 class="item-name">${item.name}</h3>
                        <p class="item-description">${item.description || 'Popisek není k dispozici.'}</p>
                        <p class="item-price">Cena: ${item.price} G</p>
                        <button class="buy-button" data-item-id="${item.id}" ${alreadyOwned || !canAfford ? 'disabled' : ''}>
                            ${alreadyOwned ? 'Již vlastněno' : (canAfford ? 'Koupit' : 'Nedostatek peněz')}
                        </button>
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
            displayMessage('Nemáš dostatek galeonů na nákup tohoto předmětu.', 'danger');
            return;
        }

        event.target.disabled = true;
        event.target.textContent = 'Zpracovávám...';

        // Struktura ukládaná do inventáře postavy
        const newItemForInventory = {
            id: item.id, // Ukládáme ID dokumentu pro budoucí reference
            nazev: item.name,
            typ: item.type
        };

        try {
            await characterRef.update({
                'peněženka.galeony': firebase.firestore.FieldValue.increment(-item.price),
                inventar: firebase.firestore.FieldValue.arrayUnion(newItemForInventory)
            });
            
            displayMessage(`Úspěšně jsi zakoupil: ${item.name}!`, 'success');
            
            const charDoc = await characterRef.get();
            activeCharacterData = charDoc.data();
            renderCharacterInfo();
            renderShopItems();

        } catch (error) {
            console.error("Chyba při nákupu: ", error);
            displayMessage('Při nákupu došlo k chybě.', 'danger');
            const button = document.querySelector(`.buy-button[data-item-id="${itemId}"]`);
            if(button){
                button.disabled = false;
                 const canAfford = (activeCharacterData.peněženka?.galeony || 0) >= item.price;
                 button.textContent = canAfford ? 'Koupit' : 'Nedostatek peněz';
            }
        }
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            loadCharacterData(user);
        } else {
            window.location.href = 'index.html';
        }
    });
});