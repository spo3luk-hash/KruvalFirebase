
document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userDocRef = db.collection('hraci').doc(user.uid);
            const userDoc = await userDocRef.get();
            if (userDoc.exists && userDoc.data().role === 'Admin') {
                initializeApp();
            } else {
                window.location.href = 'index.html';
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    const initializeApp = () => {
        const masterItemsListContainer = document.getElementById('master-items-list-container');
        const addMasterItemBtn = document.getElementById('add-master-item-btn');

        // Modály a jejich prvky
        const itemModal = document.getElementById('master-item-modal');
        const itemModalTitle = document.getElementById('master-item-modal-title');
        const closeItemModalBtn = itemModal.querySelector('.close-button');
        const itemForm = document.getElementById('master-item-form');
        const itemIdInput = document.getElementById('master-item-id-input');
        const itemNameInput = document.getElementById('item-name-input');
        const itemCategorySelect = document.getElementById('item-category-select');
        const itemImageUrlInput = document.getElementById('item-image-url-input');
        const itemDescriptionInput = document.getElementById('item-description-input');

        const giveItemModal = document.getElementById('give-item-modal');
        const giveItemForm = document.getElementById('give-item-form');
        const closeGiveModalBtn = giveItemModal.querySelector('.close-button');
        const characterSelect = document.getElementById('character-select');
        let givingItemId = null;

        const itemEffectsModal = document.getElementById('item-effects-modal');
        const closeEffectsModalBtn = itemEffectsModal.querySelector('.close-button');
        const itemEffectsForm = document.getElementById('item-effects-form');
        const effectItemIdInput = document.getElementById('effect-item-id-input');
        const effectTypeSelect = document.getElementById('effect-type-select');
        const effectDetailsContainer = document.getElementById('effect-details-container');
        const effectMessageTextarea = document.getElementById('effect-message-textarea');
        const effectConsumeCheckbox = document.getElementById('effect-consume-checkbox');

        const loadMasterItems = () => {
            db.collection('items').orderBy('category').orderBy('name').onSnapshot(snapshot => {
                masterItemsListContainer.innerHTML = ''; // Vyčistit kontejner
                if (snapshot.empty) {
                    masterItemsListContainer.innerHTML = '<p>Zatím nebyly vytvořeny žádné předměty.</p>';
                    return;
                }

                const itemsByCategory = {};
                snapshot.forEach(doc => {
                    const item = { id: doc.id, ...doc.data() };
                    const category = item.category || 'Ostatní';
                    if (!itemsByCategory[category]) {
                        itemsByCategory[category] = [];
                    }
                    itemsByCategory[category].push(item);
                });

                // Seřadit kategorie podle názvu, 'Ostatní' dát na konec
                const sortedCategories = Object.keys(itemsByCategory).sort((a, b) => {
                    if (a === 'Ostatní') return 1;
                    if (b === 'Ostatní') return -1;
                    return a.localeCompare(b);
                });

                sortedCategories.forEach(category => {
                    const categorySection = document.createElement('section');
                    categorySection.className = 'item-category-section';

                    const categoryHeader = document.createElement('h3');
                    categoryHeader.textContent = category;
                    categorySection.appendChild(categoryHeader);

                    const table = document.createElement('table');
                    table.className = 'master-items-table';
                    table.innerHTML = `
                        <thead>
                            <tr>
                                <th>Předmět</th>
                                <th>Popis</th>
                                <th class="item-actions">Akce</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    `;
                    const tbody = table.querySelector('tbody');

                    itemsByCategory[category].forEach(item => {
                        const hasEffect = item.onUseEffect && item.onUseEffect.type !== 'none';
                        const tr = document.createElement('tr');
                        tr.dataset.itemId = item.id;
                        tr.innerHTML = `
                            <td class="item-name-cell">
                                <img src="${item.imageUrl || 'img/default-item.png'}" alt="${item.name}" class="item-thumbnail">
                                <span>${item.name}</span>
                            </td>
                            <td>${item.description || '–'}</td>
                            <td class="item-actions">
                                <button class="action-btn small edit-btn" title="Upravit"><i class="fas fa-edit"></i></button>
                                <button class="action-btn small give-btn" title="Dát postavě"><i class="fas fa-gift"></i></button>
                                <button class="action-btn small effects-btn ${hasEffect ? 'active' : ''}" title="Nastavit efekty"><i class="fas fa-magic"></i></button>
                                <button class="action-btn small danger delete-btn" title="Smazat"><i class="fas fa-trash"></i></button>
                            </td>
                        `;
                        tr.querySelector('.edit-btn').addEventListener('click', () => openModalForEdit(item.id, item));
                        tr.querySelector('.delete-btn').addEventListener('click', () => deleteItem(item.id, item.name));
                        tr.querySelector('.give-btn').addEventListener('click', () => openGiveItemModal(item.id, item.name));
                        tr.querySelector('.effects-btn').addEventListener('click', () => openEffectsModal(item.id, item));
                        tbody.appendChild(tr);
                    });

                    categorySection.appendChild(table);
                    masterItemsListContainer.appendChild(categorySection);
                });
            });
        };

        const openModalForNew = () => {
            itemForm.reset();
            itemIdInput.value = '';
            itemModalTitle.textContent = 'Vytvořit nový předmět';
            itemCategorySelect.value = 'Ostatní';
            itemModal.classList.remove('hidden');
        };

        const openModalForEdit = (id, item) => {
            itemForm.reset();
            itemIdInput.value = id;
            itemNameInput.value = item.name || '';
            itemCategorySelect.value = item.category || 'Ostatní';
            itemImageUrlInput.value = item.imageUrl || '';
            itemDescriptionInput.value = item.description || '';
            itemModalTitle.textContent = 'Upravit předmět';
            itemModal.classList.remove('hidden');
        };

        const openGiveItemModal = async (itemId, itemName) => {
            givingItemId = itemId;
            giveItemModal.querySelector('h3').textContent = `Dát předmět "${itemName}"`;
            characterSelect.innerHTML = '<option>Načítám postavy...</option>';
            try {
                const playersSnapshot = await db.collection('hraci').get();
                characterSelect.innerHTML = '';
                for (const playerDoc of playersSnapshot.docs) {
                    const playerData = playerDoc.data();
                    const charactersSnapshot = await playerDoc.ref.collection('postavy').get();
                    if (!charactersSnapshot.empty) {
                        const playerName = playerData.herniNick || playerData.displayName || playerDoc.id;
                        charactersSnapshot.forEach(charDoc => {
                            const char = charDoc.data();
                            const option = document.createElement('option');
                            option.value = charDoc.id;
                            option.dataset.playerId = playerDoc.id;
                            option.textContent = `${char.jmeno} (${playerName})`;
                            characterSelect.appendChild(option);
                        });
                    }
                }
                giveItemModal.classList.remove('hidden');
            } catch (error) {
                console.error("Chyba při načítání postav: ", error);
            }
        };

        const openEffectsModal = (id, item) => {
            itemEffectsForm.reset();
            effectItemIdInput.value = id;
            itemEffectsModal.querySelector('h3').textContent = `Efekty pro: ${item.name}`;
            if (item.onUseEffect) {
                effectTypeSelect.value = item.onUseEffect.type || 'none';
                effectMessageTextarea.value = item.onUseEffect.message || '';
                effectConsumeCheckbox.checked = item.onUseEffect.consumes !== false;
            } else {
                effectTypeSelect.value = 'none';
                effectConsumeCheckbox.checked = true;
            }
            toggleEffectDetails();
            itemEffectsModal.classList.remove('hidden');
        };

        const closeModal = () => {
            itemModal.classList.add('hidden');
            giveItemModal.classList.add('hidden');
            itemEffectsModal.classList.add('hidden');
        };

        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = itemIdInput.value;
            const categoryValue = itemCategorySelect.value;
            const data = {
                name: itemNameInput.value,
                category: categoryValue.startsWith('Oblečení') ? 'Oblečení' : categoryValue,
                type: categoryValue.startsWith('Oblečení') ? categoryValue.match(/\(([^)]+)\)/)[1].toLowerCase().replace(/\s+/g, '_') : null,
                imageUrl: itemImageUrlInput.value || '',
                description: itemDescriptionInput.value || '',
            };
            try {
                if (id) {
                    await db.collection('items').doc(id).set(data, { merge: true });
                } else {
                    await db.collection('items').add(data);
                }
                closeModal();
            } catch (error) {
                console.error("Chyba při ukládání předmětu: ", error);
            }
        });

        giveItemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const selectedOption = characterSelect.options[characterSelect.selectedIndex];
            const characterId = selectedOption.value;
            const playerId = selectedOption.dataset.playerId;
            const quantity = parseInt(document.getElementById('item-quantity').value, 10);
            if (!playerId || !characterId || !givingItemId || isNaN(quantity) || quantity < 1) return;

            const inventoryRef = db.collection('hraci').doc(playerId).collection('postavy').doc(characterId).collection('inventar');
            const existingItemQuery = await inventoryRef.where('masterId', '==', givingItemId).limit(1).get();
            try {
                if (!existingItemQuery.empty) {
                    const existingDoc = existingItemQuery.docs[0];
                    await existingDoc.ref.update({ mnozstvi: firebase.firestore.FieldValue.increment(quantity) });
                } else {
                    await inventoryRef.add({ masterId: givingItemId, mnozstvi: quantity });
                }
                closeModal();
            } catch (error) {
                console.error("Chyba při přidávání do inventáře: ", error);
            }
        });

        itemEffectsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = effectItemIdInput.value;
            const onUseEffect = {
                type: effectTypeSelect.value,
                message: effectMessageTextarea.value || null,
                consumes: effectConsumeCheckbox.checked,
            };
            try {
                await db.collection('items').doc(id).set({ onUseEffect }, { merge: true });
                closeModal();
            } catch (error) {
                console.error("Chyba při ukládání efektů: ", error);
            }
        });

        const deleteItem = async (id, name) => {
            if (confirm(`Opravdu chcete trvale smazat předmět \"${name}\"?`)) {
                try {
                    await db.collection('items').doc(id).delete();
                } catch (error) {
                    console.error("Chyba při mazání předmětu: ", error);
                }
            }
        };

        const toggleEffectDetails = () => {
            effectDetailsContainer.classList.toggle('hidden', effectTypeSelect.value !== 'chat_message');
        };

        // Event Listeners
        addMasterItemBtn.addEventListener('click', openModalForNew);
        closeItemModalBtn.addEventListener('click', closeModal);
        closeGiveModalBtn.addEventListener('click', closeModal);
        closeEffectsModalBtn.addEventListener('click', closeModal);
        effectTypeSelect.addEventListener('change', toggleEffectDetails);

        // Initial Load
        loadMasterItems();
    };
});
