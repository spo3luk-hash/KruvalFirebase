document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    // -- Prvky UI --
    const form = document.getElementById('chat-form');
    const formTitle = document.getElementById('form-title');
    const chatIdInput = document.getElementById('chat-id');
    const chatNameInput = document.getElementById('chat-name');
    const chatDescriptionInput = document.getElementById('chat-description');
    const chatBackgroundInput = document.getElementById('chat-background');
    const hiddenChatId = document.getElementById('chat-id-hidden');
    const saveBtn = document.getElementById('save-chat-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const chatListContainer = document.getElementById('chat-list-container');

    let isEditing = false;

    // -- Ověření admina --
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('hraci').doc(user.uid).get().then(doc => {
                if (!doc.exists || !doc.data().admin) {
                    document.body.innerHTML = '<h1>Přístup odepřen</h1><p>Tato stránka je pouze pro administrátory.</p>';
                }
            });
        } else {
            window.location.href = '/index.html';
        }
    });

    // -- Načtení a zobrazení chatů --
    db.collection('chat_mistnosti').orderBy('name', 'asc').onSnapshot(snapshot => {
        if (snapshot.empty) {
            chatListContainer.innerHTML = '<p>Zatím neexistují žádné chatovací místnosti.</p>';
            return;
        }

        let html = '<ul class="item-list">';
        snapshot.forEach(doc => {
            const chat = doc.data();
            html += `
                <li class="list-item">
                    <div class="item-info">
                        <strong>${chat.name}</strong>
                        <small>(ID: ${doc.id})</small>
                        <p>${chat.description || 'Bez popisu'}</p>
                    </div>
                    <div class="item-actions">
                        <a href="/chat.html?id=${doc.id}" target="_blank" class="btn-secondary btn-small"><i class="fas fa-eye"></i> Vstoupit</a>
                        <button class="btn-secondary btn-small edit-btn" data-id="${doc.id}"><i class="fas fa-pencil-alt"></i> Upravit</button>
                        <button class="btn-danger btn-small delete-btn" data-id="${doc.id}"><i class="fas fa-trash-alt"></i> Smazat</button>
                    </div>
                </li>
            `;
        });
        html += '</ul>';
        chatListContainer.innerHTML = html;

    }, err => {
        console.error("Chyba při načítání chatů: ", err);
        chatListContainer.innerHTML = '<p class="error">Nepodařilo se načíst místnosti.</p>';
    });

    // -- Zpracování formuláře --
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = chatNameInput.value.trim();
        const description = chatDescriptionInput.value.trim();
        const backgroundUrl = chatBackgroundInput.value.trim();
        let docId = isEditing ? hiddenChatId.value : chatIdInput.value.trim().toLowerCase().replace(/\s+/g, '-');
        
        if (!docId || !name) {
            alert('ID a Název místnosti jsou povinné.');
            return;
        }

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Ukládám...';

            await db.collection('chat_mistnosti').doc(docId).set({
                name: name,
                description: description,
                backgroundUrl: backgroundUrl,
                isLocked: false // Výchozí hodnota
            }, { merge: true });

            alert(`Místnost "${name}" byla úspěšně ${isEditing ? 'upravena' : 'vytvořena'}!`);
            resetForm();

        } catch (error) {
            console.error('Chyba při ukládání místnosti: ', error);
            alert('Došlo k chybě. Zkontrolujte konzoli pro více detailů.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Uložit místnost';
        }
    });

    // -- Přepnutí do režimu úprav a mazání (delegování událostí) --
    chatListContainer.addEventListener('click', async (e) => {
        const target = e.target;

        // Mazání
        if (target.closest('.delete-btn')) {
            const docId = target.closest('.delete-btn').dataset.id;
            if (confirm(`Opravdu chcete trvale smazat místnost s ID: ${docId}? Tato akce je nevratná.`)) {
                if(confirm(`Jste si naprosto jistí? Všechny zprávy v této místnosti budou ztraceny.`)){
                     try {
                        await db.collection('chat_mistnosti').doc(docId).delete();
                        alert('Místnost byla smazána.');
                    } catch (error) {
                        console.error('Chyba při mazání místnosti: ', error);
                        alert('Nepodařilo se smazat místnost.');
                    }
                }
            }
        }

        // Úpravy
        if (target.closest('.edit-btn')) {
            const docId = target.closest('.edit-btn').dataset.id;
            const doc = await db.collection('chat_mistnosti').doc(docId).get();
            if (doc.exists) {
                const chat = doc.data();
                isEditing = true;

                formTitle.textContent = `Upravit místnost: ${chat.name}`;
                saveBtn.textContent = 'Uložit změny';
                cancelEditBtn.classList.remove('hidden');

                chatIdInput.disabled = true;
                chatIdInput.value = docId;
                hiddenChatId.value = docId;
                chatNameInput.value = chat.name;
                chatDescriptionInput.value = chat.description || '';
                chatBackgroundInput.value = chat.backgroundUrl || '';
                
                window.scrollTo(0, 0);
            }
        }
    });

    // -- Zrušení úprav --
    cancelEditBtn.addEventListener('click', () => {
        resetForm();
    });

    function resetForm() {
        isEditing = false;
        form.reset();
        formTitle.textContent = 'Vytvořit novou místnost';
        saveBtn.textContent = 'Uložit místnost';
        cancelEditBtn.classList.add('hidden');
        chatIdInput.disabled = false;
        hiddenChatId.value = '';
    }
});
