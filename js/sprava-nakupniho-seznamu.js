document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    let allMasterItems = []; // Uchováme si seznam master itemů pro select

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

    const initializeApp = async () => {
        await loadAllMasterItems(); // Načteme všechny dostupné předměty

        const seznamyListContainer = document.getElementById('seznamy-list-container');
        const addSeznamBtn = document.getElementById('add-seznam-btn');

        // Modál a jeho prvky
        const modal = document.getElementById('seznam-modal');
        const modalTitle = document.getElementById('seznam-modal-title');
        const closeModalBtn = modal.querySelector('.close-button');
        const seznamForm = document.getElementById('seznam-form');
        const seznamIdInput = document.getElementById('seznam-id-input');
        const seznamNameInput = document.getElementById('seznam-name-input');
        const seznamDescriptionInput = document.getElementById('seznam-description-input');
        const polozkyContainer = document.getElementById('polozky-container');
        const addPolozkaBtn = document.getElementById('add-polozka-btn');

        const loadSeznamy = () => {
            db.collection('sablony_seznamu').orderBy('nazev').onSnapshot(snapshot => {
                seznamyListContainer.innerHTML = '';
                if (snapshot.empty) {
                    seznamyListContainer.innerHTML = '<p>Zatím nebyly vytvořeny žádné šablony nákupních seznamů.</p>';
                    return;
                }
                const table = document.createElement('table');
                table.className = 'master-items-table'; // Použijeme stejnou třídu pro konzistentní vzhled
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>Název šablony</th>
                            <th>Popis</th>
                            <th class="item-actions">Akce</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                `;
                const tbody = table.querySelector('tbody');
                snapshot.forEach(doc => {
                    const seznam = { id: doc.id, ...doc.data() };
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${seznam.nazev}</td>
                        <td>${seznam.popis || '–'}</td>
                        <td class="item-actions">
                            <button class="action-btn small edit-btn" title="Upravit"><i class="fas fa-edit"></i></button>
                            <button class="action-btn small danger delete-btn" title="Smazat"><i class="fas fa-trash"></i></button>
                        </td>
                    `;
                    tr.querySelector('.edit-btn').addEventListener('click', () => openModalForEdit(seznam));
                    tr.querySelector('.delete-btn').addEventListener('click', () => deleteSeznam(seznam.id, seznam.nazev));
                    tbody.appendChild(tr);
                });
                seznamyListContainer.appendChild(table);
            });
        };

        const openModalForNew = () => {
            seznamForm.reset();
            seznamIdInput.value = '';
            polozkyContainer.innerHTML = '';
            modalTitle.textContent = 'Vytvořit novou šablonu';
            modal.classList.remove('hidden');
            addPolozkaRow(); // Přidáme hned první řádek pro novou šablonu
        };

        const openModalForEdit = (seznam) => {
            seznamForm.reset();
            seznamIdInput.value = seznam.id;
            seznamNameInput.value = seznam.nazev;
            seznamDescriptionInput.value = seznam.popis || '';
            polozkyContainer.innerHTML = '';
            if (seznam.polozky && seznam.polozky.length > 0) {
                seznam.polozky.forEach(polozka => addPolozkaRow(polozka.masterId));
            } else {
                addPolozkaRow(); // Pokud nejsou položky, přidáme prázdný řádek
            }
            modalTitle.textContent = `Upravit šablonu: ${seznam.nazev}`;
            modal.classList.remove('hidden');
        };

        const closeModal = () => {
            modal.classList.add('hidden');
        };

        seznamForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = seznamIdInput.value;
            const polozky = [];
            const polozkaRows = polozkyContainer.querySelectorAll('.polozka-row');
            polozkaRows.forEach(row => {
                const select = row.querySelector('select');
                if (select && select.value) {
                    polozky.push({ masterId: select.value });
                }
            });

            const data = {
                nazev: seznamNameInput.value,
                popis: seznamDescriptionInput.value,
                polozky: polozky
            };

            try {
                if (id) {
                    await db.collection('sablony_seznamu').doc(id).set(data, { merge: true });
                } else {
                    await db.collection('sablony_seznamu').add(data);
                }
                closeModal();
            } catch (error) {
                console.error("Chyba při ukládání šablony: ", error);
            }
        });

        const deleteSeznam = async (id, nazev) => {
            if (confirm(`Opravdu chcete smazat šablonu \"${nazev}\"?`)) {
                try {
                    await db.collection('sablony_seznamu').doc(id).delete();
                } catch (error) {
                    console.error("Chyba při mazání šablony: ", error);
                }
            }
        };

        async function loadAllMasterItems() {
            try {
                const snapshot = await db.collection('items').orderBy('name').get();
                allMasterItems = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
            } catch (error) {
                console.error("Nepodařilo se načíst master itemy: ", error);
            }
        }

        function addPolozkaRow(selectedMasterId = '') {
            const row = document.createElement('div');
            row.className = 'polozka-row form-group'; // Přidáme třídu pro layout
            
            const selectWrapper = document.createElement('div');
            selectWrapper.className = 'custom-select';

            const select = document.createElement('select');
            select.innerHTML = '<option value="">-- Vyberte předmět --</option>';
            allMasterItems.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.name;
                if (item.id === selectedMasterId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            selectWrapper.appendChild(select)

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'action-btn small danger';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.onclick = () => row.remove();

            row.appendChild(selectWrapper);
            row.appendChild(deleteBtn);
            polozkyContainer.appendChild(row);

            // Re-inicializace custom selectu pro nový řádek
            if (typeof initCustomSelects === 'function') {
                initCustomSelects();
            }
        }

        // Event Listeners
        addSeznamBtn.addEventListener('click', openModalForNew);
        closeModalBtn.addEventListener('click', closeModal);
        addPolozkaBtn.addEventListener('click', () => addPolozkaRow());

        // Initial Load
        loadSeznamy();
    };
});
