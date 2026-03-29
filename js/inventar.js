document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    auth.onAuthStateChanged(user => {
        if (user) {
            const characterId = sessionStorage.getItem('selectedCharacterId');
            if (characterId) {
                inventoryApp.init(db, user.uid, characterId);
            } else {
                console.error("Není vybrána žádná postava.");
                document.getElementById('inventory-owner').textContent = "Chyba: Postava nenalezena";
            }
        } else {
            console.error("Uživatel není přihlášen.");
            window.location.href = '/index.html';
        }
    });
});

const inventoryApp = (() => {
    let db;
    let userId;
    let characterId;
    let characterRef;

    let equippedItems = {};
    let inventoryItems = [];
    let selectedItem = null;

    const init = (firestore, uid, charId) => {
        db = firestore;
        userId = uid;
        characterId = charId;
        characterRef = db.collection('hraci').doc(userId).collection('postavy').doc(characterId);
        
        setupListeners();
        document.getElementById('equip-item-btn').addEventListener('click', () => handleEquipUnequip());
        document.getElementById('drop-item-btn').addEventListener('click', dropSelectedItem);
    };

    const setupListeners = () => {
        characterRef.onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                document.getElementById('inventory-owner').textContent = data.jmeno || 'Neznámá postava';
                document.getElementById('character-gold').textContent = data.zlato || 0;
                equippedItems = data.equippedItems || {};
                renderEquippedItems();
                renderBackpack();
            }
        });

        characterRef.collection('inventar').onSnapshot(async snapshot => {
            const promises = snapshot.docs.map(async itemDoc => {
                const itemData = itemDoc.data();
                if (itemData.typ && itemData.typ === 'hulka') {
                    return { id: itemDoc.id, ...itemData }; 
                }
                const masterItemDoc = await db.collection('items').doc(itemData.masterId).get();
                if (masterItemDoc.exists) {
                    return { id: itemDoc.id, masterId: itemData.masterId, ...masterItemDoc.data(), mnozstvi: itemData.mnozstvi };
                }
                return null;
            });
            
            inventoryItems = (await Promise.all(promises)).filter(Boolean);
            renderEquippedItems();
            renderBackpack();
        });
    };

    const getSlotFromItemType = (type) => {
        if (!type) return null;
        const mapping = {
            'hlava': 'head',
            'tělo': 'body',
            'nohy': 'legs',
            'chodidla': 'feet',
            'pravá ruka': 'main-hand',
            'levá ruka': 'off-hand',
            'hulka': 'wand'
        };
        return mapping[type.toLowerCase()] || null;
    };

    const renderEquippedItems = () => {
        document.querySelectorAll('.equip-slot').forEach(slot => {
            slot.innerHTML = '';
            slot.classList.remove('occupied');
        });

        for (const [slotKey, itemId] of Object.entries(equippedItems)) {
            if (itemId) {
                const item = inventoryItems.find(i => i.id === itemId);
                if (item) {
                    const slotId = `equip-${slotKey.replace('_', '-')}`;
                    const slotElement = document.getElementById(slotId);
                    if (slotElement) {
                        const itemDiv = createItemIcon(item);
                        itemDiv.addEventListener('click', (e) => {
                            e.stopPropagation();
                            unequipItem(slotKey);
                        });
                        itemDiv.addEventListener('mouseenter', () => displayItemDetails(item, true));
                        slotElement.innerHTML = '';
                        slotElement.appendChild(itemDiv);
                        slotElement.classList.add('occupied');
                    }
                }
            }
        }
    };

    const renderBackpack = () => {
        const grid = document.getElementById('inventory-grid');
        grid.innerHTML = '';
        const equippedIds = Object.values(equippedItems);

        inventoryItems.filter(item => !equippedIds.includes(item.id)).forEach(item => {
            const itemDiv = createItemIcon(item);
            itemDiv.addEventListener('click', () => selectItem(item, itemDiv));
            itemDiv.addEventListener('mouseenter', () => displayItemDetails(item, false));
            grid.appendChild(itemDiv);
        });

        const totalSlots = 40;
        const emptySlotsCount = totalSlots - grid.children.length;
        for (let i = 0; i < emptySlotsCount; i++) {
            const emptySlot = document.createElement('div');
            emptySlot.className = 'inventory-slot';
            grid.appendChild(emptySlot);
        }
    };

    const createItemIcon = (item) => {
        const slot = document.createElement('div');
        slot.className = 'inventory-slot';
        slot.dataset.itemId = item.id;

        const img = document.createElement('img');
        img.alt = item.name || item.nazev;
        img.className = 'inventory-item-image';
        if (item.typ === 'hulka') {
            img.src = 'img/icons/wand.png';
        } else {
            img.src = item.imageUrl || 'img/avatars/char_placeholder.png';
        }
        slot.appendChild(img);

        if (item.mnozstvi > 1) {
            const count = document.createElement('div');
            count.className = 'inventory-item-count';
            count.textContent = item.mnozstvi;
            slot.appendChild(count);
        }
        return slot;
    };
    
    const selectItem = (item, element) => {
        if (selectedItem && selectedItem.element) {
            selectedItem.element.classList.remove('selected');
        }
        selectedItem = { ...item, element }; 
        element.classList.add('selected');
        displayItemDetails(item, false);
    };

    const displayItemDetails = (item, isEquipped) => {
        const name = item.name || item.nazev;
        document.getElementById('item-name-detail').textContent = name;
        
        if (item.typ === 'hulka') {
            document.getElementById('item-image-detail').src = 'img/icons/wand.png';
            document.getElementById('item-description-detail').innerHTML = 
                `Dřevo: ${item.drevo}<br>
                 Jádro: ${item.jadro}<br>
                 Délka: ${item.delka} palců<br>
                 Pružnost: ${item.pruznost}`;
        } else {
            document.getElementById('item-image-detail').src = item.imageUrl || 'img/avatars/char_placeholder.png';
            document.getElementById('item-description-detail').textContent = item.description || 'Žádný popis.';
        }

        const equipBtn = document.getElementById('equip-item-btn');
        const isEquippable = !!getSlotFromItemType(item.typ);
        
        equipBtn.classList.toggle('hidden', !isEquippable);
        if (isEquippable) {
            equipBtn.textContent = isEquipped ? 'Sundat' : 'Nasadit';
        }

        document.getElementById('drop-item-btn').classList.remove('hidden');
    };

    const handleEquipUnequip = async () => {
        if (!selectedItem) return;
        
        const slot = getSlotFromItemType(selectedItem.typ);
        if (!slot) return;

        const isEquipped = Object.values(equippedItems).includes(selectedItem.id);

        if (isEquipped) {
            await unequipItem(slot);
        } else {
            await equipItem(selectedItem, slot);
        }
    };

    const equipItem = async (item, slot) => {
        const updates = { [`equippedItems.${slot}`]: item.id };
        try {
            await characterRef.update(updates);
            clearSelection();
        } catch (error) {
            console.error("Chyba při nasazování předmětu: ", error);
        }
    };

    const unequipItem = async (slotKey) => {
        const updates = { [`equippedItems.${slotKey}`]: firebase.firestore.FieldValue.delete() };
        try {
            await characterRef.update(updates);
            clearSelection();
        } catch (error) {
            console.error("Chyba při sundavání předmětu: ", error);
        }
    };
    
    const dropSelectedItem = async () => {
        if (!selectedItem) return;

        if (confirm(`Opravdu chcete zahodit ${selectedItem.name || selectedItem.nazev}?`)) {
            try {
                await characterRef.collection('inventar').doc(selectedItem.id).delete();
                clearSelection();
            } catch (error) {
                console.error("Chyba při zahazování předmětu: ", error);
            }
        }
    };
    
    const clearSelection = () => {
        if (selectedItem && selectedItem.element) {
            selectedItem.element.classList.remove('selected');
        }
        selectedItem = null;
        document.getElementById('item-name-detail').textContent = 'Vyber předmět';
        document.getElementById('item-image-detail').src = 'img/avatars/char_placeholder.png';
        document.getElementById('item-description-detail').textContent = 'Zde se zobrazí popis předmětu.';
        document.getElementById('equip-item-btn').classList.add('hidden');
        document.getElementById('drop-item-btn').classList.add('hidden');
    }

    return { init };
})();
