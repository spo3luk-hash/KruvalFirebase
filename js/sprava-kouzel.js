document.addEventListener('DOMContentLoaded', function() {
    const spellsListContainer = document.getElementById('spells-list-container');
    const addSpellBtn = document.getElementById('add-spell-btn');
    const spellFormContainer = document.getElementById('spell-form-container');
    const cancelSpellEditBtn = document.getElementById('cancel-spell-edit');
    const spellForm = document.getElementById('spell-form');
    const spellFormTitle = document.getElementById('spell-form-title');

    if (spellsListContainer) {
        loadSpells();
    }

    addSpellBtn.addEventListener('click', () => {
        spellForm.reset();
        spellForm.querySelector('#spell-id').value = '';
        spellFormTitle.textContent = 'Nové kouzlo';
        spellFormContainer.classList.remove('hidden');
    });

    cancelSpellEditBtn.addEventListener('click', () => {
        spellFormContainer.classList.add('hidden');
    });

    spellForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const spellId = spellForm.querySelector('#spell-id').value;
        const spell = {
            jmeno: spellForm.querySelector('#spell-name').value,
            typ: spellForm.querySelector('#spell-type').value,
            rocnik: parseInt(spellForm.querySelector('#spell-year').value, 10),
            popis: spellForm.querySelector('#spell-description').value
        };

        try {
            if (spellId) {
                await firebase.firestore().collection('kouzla').doc(spellId).update(spell);
            } else {
                const newSpellRef = firebase.firestore().collection('kouzla').doc();
                spell.id = newSpellRef.id;
                await newSpellRef.set(spell);
            }
            spellFormContainer.classList.add('hidden');
            loadSpells();
        } catch (error) {
            console.error("Chyba při ukládání kouzla:", error);
        }
    });

    spellsListContainer.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const spellId = target.dataset.id;

        if (target.classList.contains('edit-btn')) {
            try {
                const doc = await firebase.firestore().collection('kouzla').doc(spellId).get();
                if (doc.exists) {
                    const spell = doc.data();
                    spellForm.querySelector('#spell-id').value = doc.id;
                    spellForm.querySelector('#spell-name').value = spell.jmeno;
                    spellForm.querySelector('#spell-type').value = spell.typ;
                    spellForm.querySelector('#spell-year').value = spell.rocnik;
                    spellForm.querySelector('#spell-description').value = spell.popis;

                    spellFormTitle.textContent = 'Upravit kouzlo';
                    spellFormContainer.classList.remove('hidden');
                }
            } catch (error) {
                console.error("Chyba při načítání kouzla pro úpravu:", error);
            }
        }

        if (target.classList.contains('delete-btn')) {
            window.openConfirmationModal('Smazat kouzlo', 'Opravdu si přejete smazat toto kouzlo?', async () => {
                try {
                    await firebase.firestore().collection('kouzla').doc(spellId).delete();
                    loadSpells();
                } catch (error) {
                    console.error("Chyba při mazání kouzla:", error);
                    window.openModal('Chyba', 'Nepodařilo se smazat kouzlo.');
                }
            });
        }
    });

    async function loadSpells() {
        try {
            const spellsSnapshot = await firebase.firestore().collection('kouzla').orderBy("jmeno").get();
            if (spellsSnapshot.empty) {
                spellsListContainer.innerHTML = '<p>Nenalezena žádná kouzla.</p>';
                return;
            }

            let tableHtml = '<table class="admin-table"><thead><tr><th>Jméno</th><th>Typ</th><th>Ročník</th><th>Akce</th></tr></thead><tbody>';
            spellsSnapshot.forEach(doc => {
                const spell = doc.data();
                tableHtml += `
                    <tr>
                        <td>${spell.jmeno}</td>
                        <td>${spell.typ}</td>
                        <td>${spell.rocnik}</td>
                        <td class="actions">
                            <button class="action-btn edit-btn" data-id="${doc.id}"><i class="fas fa-edit"></i> Upravit</button>
                            <button class="action-btn delete-btn" data-id="${doc.id}"><i class="fas fa-trash"></i> Smazat</button>
                        </td>
                    </tr>
                `;
            });
            tableHtml += '</tbody></table>';
            spellsListContainer.innerHTML = tableHtml;

        } catch (error) {
            console.error("Chyba při načítání kouzel:", error);
            spellsListContainer.innerHTML = '<p>Chyba při načítání dat. Zkuste to prosím znovu.</p>';
        }
    }
});
