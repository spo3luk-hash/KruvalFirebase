document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    // Sekce
    const shopsListSection = document.getElementById('shops-list-section');
    const shopManagementSection = document.getElementById('shop-management-section');
    const otherShopsSection = document.getElementById('other-shops-section');

    // Tlačítka
    const addShopBtn = document.getElementById('add-shop-btn');
    const manageZverimexBtn = document.getElementById('manage-zverimex-btn');
    const backToListBtn = document.getElementById('back-to-list-btn');
    const saveShopDetailsBtn = document.getElementById('save-shop-details-btn');
    const addItemBtn = document.getElementById('add-item-btn');

    // Kontejnery
    const shopsListContainer = document.getElementById('shops-list-container');
    const itemsListContainer = document.getElementById('items-list-container');

    // Názvy
    const managingShopName = document.getElementById('managing-shop-name');

    // Modální okna
    const shopModal = document.getElementById('shop-modal');
    const addItemMasterModal = document.getElementById('add-item-from-master-modal');
    const shopModalTitle = document.getElementById('shop-modal-title');

    // Formuláře
    const shopForm = document.getElementById('shop-form');
    
    // Vstupní pole
    const shopNameInput = document.getElementById('shop-name-input');
    const shopDescriptionInput = document.getElementById('shop-description-input');

    let currentShopId = null;

    // Ověření uživatele
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('hraci').doc(user.uid).get().then(doc => {
                if (doc.exists && doc.data().role === 'Admin') {
                    // Uživatel je administrátor, může pokračovat
                    initializeApp();
                } else {
                    // Uživatel není administrátor, přesměrovat
                    window.location.href = '/vyber-postavy.html';
                }
            }).catch(error => {
                console.error("Chyba při ověřování role: ", error);
                window.location.href = '/vyber-postavy.html';
            });
        } else {
            // Uživatel není přihlášen, přesměrovat na přihlášení
            window.location.href = '/index.html';
        }
    });

    const initializeApp = () => {
        // Zobrazit/Skrýt sekce
        const showShopsList = () => {
            shopsListSection.classList.remove('hidden');
            otherShopsSection.classList.remove('hidden');
            shopManagementSection.classList.add('hidden');
            currentShopId = null;
            loadShops();
        };

        const showShopManagement = (shopId) => {
            shopsListSection.classList.add('hidden');
            otherShopsSection.classList.add('hidden');
            shopManagementSection.classList.remove('hidden');
            currentShopId = shopId;
            loadShopManagementData(shopId);
        };

        // Načítání dat
        const loadShops = async () => {
            try {
                const snapshot = await db.collection('obchody_nove').orderBy('name').get();
                shopsListContainer.innerHTML = '<div class="table-header"><div>Název</div><div>Akce</div></div>';
                if (snapshot.empty) {
                    shopsListContainer.innerHTML += '<p>Zatím nebyly vytvořeny žádné obecné obchody.</p>';
                    return;
                }
                snapshot.forEach(doc => {
                    const shop = doc.data();
                    const shopElement = document.createElement('div');
                    shopElement.classList.add('table-row');
                    shopElement.innerHTML = `
                        <div>${shop.name}</div>
                        <div class="table-cell-actions">
                            <button class="action-btn edit-btn" data-id="${doc.id}"><i class="fas fa-edit"></i> Spravovat</button>
                            <button class="action-btn delete-btn" data-id="${doc.id}"><i class="fas fa-trash"></i> Smazat</button>
                        </div>
                    `;
                    shopsListContainer.appendChild(shopElement);
                });
            } catch (error) {
                console.error("Chyba při načítání obchodů: ", error);
            }
        };

        const loadShopManagementData = async (shopId) => {
            const shopRef = db.collection('obchody_nove').doc(shopId);
            const shopDoc = await shopRef.get();
            if (shopDoc.exists) {
                const shop = shopDoc.data();
                managingShopName.textContent = `Správa obchodu: ${shop.name}`;
                document.getElementById('edit-shop-name').value = shop.name;
                document.getElementById('edit-shop-description').value = shop.description;
                loadShopItems(shopId);
            }
        };

        const loadShopItems = (shopId) => {
            itemsListContainer.innerHTML = '<p>Načítám položky...</p>';
            const itemsRef = db.collection('obchody_nove').doc(shopId).collection('items');

            itemsRef.onSnapshot(async (snapshot) => {
                if (snapshot.empty) {
                    itemsListContainer.innerHTML = '<p>Tento obchod zatím neobsahuje žádné položky.</p>';
                    return;
                }

                const masterItemsSnapshot = await db.collection('items').get();
                const masterItems = new Map(masterItemsSnapshot.docs.map(doc => [doc.id, doc.data()]));

                let html = '<div class="table-header"><div>Položka</div><div>Cena</div><div>Akce</div></div>';
                let validItemsFound = false;

                for (const doc of snapshot.docs) {
                    const itemData = doc.data();
                    if (masterItems.has(itemData.masterItemId)) {
                        const masterItem = masterItems.get(itemData.masterItemId);
                        validItemsFound = true;
                        html += `
                            <div class="table-row">
                                <div>${masterItem.name}</div>
                                <div>${itemData.price} G</div>
                                <div class="table-cell-actions">
                                    <button class="action-btn delete-item-btn" data-id="${doc.id}"><i class="fas fa-trash"></i> Odebrat</button>
                                </div>
                            </div>
                        `;
                    }
                }
                
                if (!validItemsFound) {
                    itemsListContainer.innerHTML = '<p>V tomto obchodě nejsou žádné platné položky k zobrazení.</p>';
                    return;
                }

                itemsListContainer.innerHTML = html;
            });
        };

        // Modální okna
        const openModal = (modal) => modal.classList.remove('hidden');
        const closeModal = (modal) => modal.classList.add('hidden');

        // Založení nového obchodu
        addShopBtn.addEventListener('click', () => {
            shopForm.reset();
            openModal(shopModal);
        });
        shopModal.querySelector('.close-button').addEventListener('click', () => closeModal(shopModal));
        shopForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await db.collection('obchody_nove').add({ name: shopNameInput.value, description: shopDescriptionInput.value });
            closeModal(shopModal);
            loadShops();
        });

        // Uložení detailů obchodu
        saveShopDetailsBtn.addEventListener('click', async () => {
            const name = document.getElementById('edit-shop-name').value;
            const description = document.getElementById('edit-shop-description').value;
            await db.collection('obchody_nove').doc(currentShopId).update({ name, description });
            alert('Detaily obchodu byly aktualizovány.');
            managingShopName.textContent = `Správa obchodu: ${name}`;
        });

        // Správa položek
        addItemBtn.addEventListener('click', () => openMasterItemSelectionModal());

        const openMasterItemSelectionModal = async () => {
            const container = document.getElementById('master-item-selection-container');
            container.innerHTML = '<p>Načítám knihovnu předmětů...</p>';
            openModal(addItemMasterModal);

            const masterSnapshot = await db.collection('items').orderBy('name').get();
            const shopItemsSnapshot = await db.collection('obchody_nove').doc(currentShopId).collection('items').get();
            const existingMasterIds = new Set(shopItemsSnapshot.docs.map(doc => doc.data().masterItemId));

            if(masterSnapshot.empty) {
                container.innerHTML = '<p>V knihovně nejsou žádné předměty. Vytvořte je ve <a href="sprava-predmetu.html">Správě předmětů</a>.</p>';
                return;
            }

            let html = '<div class="table-header"><div>Předmět</div><div>Akce</div></div>';
            let availableItems = 0;
            masterSnapshot.forEach(doc => {
                if (!existingMasterIds.has(doc.id)) {
                    const item = doc.data();
                    html += `
                        <div class="table-row">
                            <div>${item.name}</div>
                            <div class="table-cell-actions">
                                <button class="action-btn add-to-shop-btn" data-id="${doc.id}">Přidat</button>
                            </div>
                        </div>
                    `;
                    availableItems++;
                }
            });

            if (availableItems === 0) {
                container.innerHTML = '<p>Všechny dostupné předměty z knihovny jsou již v tomto obchodě.</p>';
            } else {
                container.innerHTML = html;
            }
        };

        addItemMasterModal.querySelector('.close-button').addEventListener('click', () => closeModal(addItemMasterModal));

        document.getElementById('master-item-selection-container').addEventListener('click', async (e) => {
            if (e.target.classList.contains('add-to-shop-btn')) {
                const masterItemId = e.target.dataset.id;
                const price = prompt('Zadejte prodejní cenu v galeonech:');
                if (price !== null && !isNaN(price) && price.trim() !== '') {
                    await db.collection('obchody_nove').doc(currentShopId).collection('items').add({
                        masterItemId: masterItemId,
                        price: parseInt(price, 10)
                    });
                    e.target.closest('.table-row').remove();
                } else if (price !== null) {
                    alert('Zadejte platné číslo.');
                }
            }
        });
        
        itemsListContainer.addEventListener('click', async (e) => {
            if (e.target.closest('.delete-item-btn')) {
                const itemId = e.target.closest('.delete-item-btn').dataset.id;
                if (confirm('Opravdu chcete odebrat tuto položku z obchodu?')) {
                    await db.collection('obchody_nove').doc(currentShopId).collection('items').doc(itemId).delete();
                }
            }
        });

        shopsListContainer.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            const id = target.dataset.id;
            if (target.classList.contains('edit-btn')) {
                showShopManagement(id);
            } else if (target.classList.contains('delete-btn')) {
                if (confirm('Opravdu chcete smazat tento obchod a všechny jeho položky?')) {
                    deleteShop(id);
                }
            }
        });

        const deleteShop = async (shopId) => {
            const itemsSnapshot = await db.collection('obchody_nove').doc(shopId).collection('items').get();
            const batch = db.batch();
            itemsSnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            await db.collection('obchody_nove').doc(shopId).delete();
            showShopsList();
        };

        manageZverimexBtn.addEventListener('click', () => {
            window.location.href = 'sprava-zverimex.html';
        });

        backToListBtn.addEventListener('click', showShopsList);

        showShopsList();
    };
});