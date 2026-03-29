document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    const zverimexItemsListContainer = document.getElementById('zverimex-items-list-container');
    const addPetBtn = document.getElementById('add-pet-btn');
    const petModal = document.getElementById('pet-modal');
    const closePetModal = document.getElementById('close-pet-modal');
    const petForm = document.getElementById('pet-form');
    const petModalTitle = document.getElementById('pet-modal-title');
    const editPetId = document.getElementById('edit-pet-id');
    const petNameInput = document.getElementById('pet-name');
    const petTypeInput = document.getElementById('pet-type');
    const petDescriptionInput = document.getElementById('pet-description');
    const petImageInput = document.getElementById('pet-image');
    const petPriceInput = document.getElementById('pet-price');

    // Pole pro havrany
    const havranFields = document.getElementById('havran-fields');
    const petDeliveryValueInput = document.getElementById('pet-delivery-value');
    const petDeliveryUnitInput = document.getElementById('pet-delivery-unit');

    const shopCollectionRef = db.collection('obchody').doc('zverimex').collection('mazlicci');

    // Zobrazí/skryje pole pro havrany podle druhu
    const toggleHavranFields = () => {
        if (petTypeInput.value.toLowerCase() === 'havran') {
            havranFields.classList.remove('hidden');
        } else {
            havranFields.classList.add('hidden');
        }
    };

    petTypeInput.addEventListener('input', toggleHavranFields);

    const openPetModal = (pet = null) => {
        petForm.reset();
        havranFields.classList.add('hidden');
        if (pet) {
            petModalTitle.textContent = 'Upravit mazlíčka';
            editPetId.value = pet.id;
            petNameInput.value = pet.name;
            petTypeInput.value = pet.type;
            petDescriptionInput.value = pet.description;
            petImageInput.value = pet.imageUrl;
            petPriceInput.value = pet.price;

            if (pet.type.toLowerCase() === 'havran' && pet.schopnosti.dorucovaniZprav) {
                const deliveryTime = pet.schopnosti.dobaDoruceni; // v sekundách
                 if (deliveryTime) {
                    if (deliveryTime % 3600 === 0) {
                        petDeliveryValueInput.value = deliveryTime / 3600;
                        petDeliveryUnitInput.value = 'hours';
                    } else if (deliveryTime % 60 === 0) {
                        petDeliveryValueInput.value = deliveryTime / 60;
                        petDeliveryUnitInput.value = 'minutes';
                    } else {
                        petDeliveryValueInput.value = deliveryTime;
                        petDeliveryUnitInput.value = 'seconds';
                    }
                }
            }
        } else {
            petModalTitle.textContent = 'Přidat nového mazlíčka';
            editPetId.value = '';
        }
        toggleHavranFields();
        petModal.classList.remove('hidden');
    };

    const closePetModalHandler = () => {
        petModal.classList.add('hidden');
    };

    const formatDeliveryTime = (seconds) => {
        if (!seconds) return 'N/A';
        if (seconds >= 3600) {
            const hours = seconds / 3600;
            return `${hours} hodin(y)`;
        }
        if (seconds >= 60) {
            const minutes = seconds / 60;
            return `${minutes} minut(y)`;
        }
        return `${seconds} sekund(y)`;
    };

    const loadZverimexItems = async () => {
        try {
            const snapshot = await shopCollectionRef.orderBy('name').get();
            zverimexItemsListContainer.innerHTML = '<div class="table-header"><div>Položka</div><div>Cena</div><div>Doba doručení</div><div>Akce</div></div>';
            if (snapshot.empty) {
                zverimexItemsListContainer.innerHTML += '<p>Zverimex je prázdný.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const pet = doc.data();
                const deliveryTime = (pet.type.toLowerCase() === 'havran' && pet.schopnosti) ? formatDeliveryTime(pet.schopnosti.dobaDoruceni) : 'N/A';
                const petElement = document.createElement('div');
                petElement.classList.add('table-row');
                petElement.innerHTML = `
                    <div>${pet.name}</div>
                    <div>${pet.price} G</div>
                    <div>${deliveryTime}</div>
                    <div class="table-cell-actions">
                        <button class="action-btn edit-pet-btn" data-id="${doc.id}"><i class="fas fa-edit"></i> Upravit</button>
                        <button class="action-btn delete-pet-btn" data-id="${doc.id}"><i class="fas fa-trash"></i> Smazat</button>
                    </div>
                `;
                zverimexItemsListContainer.appendChild(petElement);
            });
        } catch (error) {
            console.error("Chyba při načítání položek zverimexu: ", error);
        }
    };

    petForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const petData = {
            name: petNameInput.value,
            type: petTypeInput.value,
            description: petDescriptionInput.value,
            imageUrl: petImageInput.value,
            price: parseInt(petPriceInput.value, 10),
            availability: 'skladem',
            schopnosti: {}
        };

        if (petData.type.toLowerCase() === 'havran') {
            let deliveryTimeInSeconds = 0;
            const deliveryValue = parseInt(petDeliveryValueInput.value, 10);
            const deliveryUnit = petDeliveryUnitInput.value;

            if (!isNaN(deliveryValue)) {
                if (deliveryUnit === 'hours') {
                    deliveryTimeInSeconds = deliveryValue * 3600;
                } else if (deliveryUnit === 'minutes') {
                    deliveryTimeInSeconds = deliveryValue * 60;
                } else {
                    deliveryTimeInSeconds = deliveryValue;
                }
            }

            petData.schopnosti = { 
                dorucovaniZprav: true, 
                pruzkum: false,
                dobaDoruceni: deliveryTimeInSeconds
            };
        }

        try {
            if (editPetId.value) {
                await shopCollectionRef.doc(editPetId.value).update(petData);
            } else {
                await shopCollectionRef.add(petData);
            }
            closePetModalHandler();
            loadZverimexItems();
        } catch (error) {
            console.error("Chyba při ukládání mazlíčka: ", error);
        }
    });

    zverimexItemsListContainer.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        const id = target.dataset.id;
        if (target.classList.contains('edit-pet-btn')) {
            const doc = await shopCollectionRef.doc(id).get();
            if(doc.exists) {
                const pet = { id: doc.id, ...doc.data() };
                openPetModal(pet);
            }
        } else if (target.classList.contains('delete-pet-btn')) {
            if (confirm('Opravdu chcete smazat tohoto mazlíčka?')) {
                await shopCollectionRef.doc(id).delete();
                loadZverimexItems();
            }
        }
    });

    addPetBtn.addEventListener('click', () => openPetModal());
    closePetModal.addEventListener('click', closePetModalHandler);

    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('hraci').doc(user.uid).get().then(doc => {
                if (doc.exists && doc.data().role === 'Admin') {
                    loadZverimexItems();
                } else {
                    window.location.href = '/vyber-postavy.html';
                }
            }).catch(error => {
                console.error("Chyba při ověřování role: ", error);
                window.location.href = '/vyber-postavy.html';
            });
        } else {
            window.location.href = '/index.html';
        }
    });
});