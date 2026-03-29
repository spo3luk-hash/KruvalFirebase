document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userDoc = await db.collection('hraci').doc(user.uid).get();
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
        // --- Reference na DOM elementy ---
        const templateListContainer = document.getElementById('template-list-container');
        const editorTitle = document.getElementById('editor-title');
        const templateEditor = document.getElementById('template-editor').parentElement; // Odkaz na sekci, ne jen formulář
        const templateIdInput = document.getElementById('template-id');
        const templateNameInput = document.getElementById('template-name');
        const templateSubjectInput = document.getElementById('template-subject');
        const templateContentInput = document.getElementById('template-content');
        const templateSenderSelect = document.getElementById('template-sender');
        const templateSignatureInput = document.getElementById('template-signature');
        const saveTemplateBtn = document.getElementById('save-template-btn');
        const clearEditorBtn = document.getElementById('clear-editor-btn');

        const massSendTool = document.getElementById('mass-send-tool');
        const massSendTemplateName = document.getElementById('mass-send-template-name');
        const recipientListContainer = document.getElementById('recipient-list-container');
        const selectAllBtn = document.getElementById('select-all-btn');
        const deselectAllBtn = document.getElementById('deselect-all-btn');
        const sendMassMailBtn = document.getElementById('send-mass-mail-btn');
        const cancelMassSendBtn = document.getElementById('cancel-mass-send-btn');
        
        let currentTemplateForMassSend = null;

        // --- FUNKCE PRO SPRÁVU ŠABLON (CRUD) ---

        const loadTemplates = async () => {
            templateListContainer.innerHTML = '<p>Načítám šablony...</p>';
            try {
                const snapshot = await db.collection('sablony').orderBy('interniNazev').get();
                if (snapshot.empty) {
                    templateListContainer.innerHTML = '<p>Zatím nebyly vytvořeny žádné šablony.</p>';
                    return;
                }

                let html = snapshot.docs.map(doc => {
                    const template = doc.data();
                    return `
                        <div class="template-item" data-id="${doc.id}">
                            <span class="template-name">${template.interniNazev}</span>
                            <div class="template-actions">
                                <button class="action-btn use-btn"><i class="fas fa-paper-plane"></i> Použít</button>
                                <button class="action-btn edit-btn"><i class="fas fa-edit"></i> Upravit</button>
                                <button class="action-btn danger delete-btn"><i class="fas fa-trash"></i> Smazat</button>
                            </div>
                        </div>
                    `;
                }).join('');
                templateListContainer.innerHTML = html;

            } catch (error) {
                console.error("Chyba při načítání šablon: ", error);
                templateListContainer.innerHTML = '<p class="error-message">Nepodařilo se načíst šablony.</p>';
            }
        };

        const clearEditor = () => {
            editorTitle.textContent = 'Vytvořit novou šablonu';
            templateIdInput.value = '';
            templateNameInput.value = '';
            templateSubjectInput.value = '';
            templateContentInput.value = '';
            templateSignatureInput.value = '';
            templateSenderSelect.selectedIndex = 0;
            saveTemplateBtn.innerHTML = '<i class="fas fa-save"></i> Uložit šablonu';
            clearEditorBtn.classList.add('hidden');
            if (window.initCustomSelect) {
                document.querySelectorAll('.custom-select').forEach(sel => window.initCustomSelect(sel));
            }
        };

        saveTemplateBtn.addEventListener('click', async () => {
            const templateId = templateIdInput.value;
            const data = {
                interniNazev: templateNameInput.value.trim(),
                predmet: templateSubjectInput.value.trim(),
                obsah: templateContentInput.value.trim(),
                odesilatel: templateSenderSelect.value,
                podpis: templateSignatureInput.value.trim() || null,
            };

            if (!data.interniNazev || !data.predmet || !data.obsah) {
                alert('Interní název, předmět a obsah šablony jsou povinná pole.');
                return;
            }

            saveTemplateBtn.disabled = true;

            try {
                if (templateId) {
                    await db.collection('sablony').doc(templateId).update(data);
                    alert('Šablona byla úspěšně aktualizována.');
                } else {
                    await db.collection('sablony').add(data);
                    alert('Nová šablona byla úspěšně uložena.');
                }
                clearEditor();
                await loadTemplates();
            } catch (error) {
                console.error("Chyba při ukládání šablony: ", error);
                alert('Došlo k chybě při ukládání šablony.');
            } finally {
                saveTemplateBtn.disabled = false;
            }
        });

        clearEditorBtn.addEventListener('click', clearEditor);

        // --- FUNKCE PRO HROMADNÉ ROZESÍLÁNÍ ---

        const setupMassSendTool = async (templateId) => {
            try {
                const doc = await db.collection('sablony').doc(templateId).get();
                if (!doc.exists) {
                    alert('Tato šablona již neexistuje.');
                    return;
                }
                currentTemplateForMassSend = { id: doc.id, ...doc.data() };

                templateEditor.classList.add('hidden');
                massSendTool.classList.remove('hidden');
                massSendTemplateName.textContent = currentTemplateForMassSend.interniNazev;

                await loadCharactersForMassSend();
                window.scrollTo({ top: massSendTool.offsetTop, behavior: 'smooth' });

            } catch (error) {
                console.error("Chyba při přípravě hromadného rozeslání: ", error);
                alert('Nepodařilo se připravit nástroj pro rozeslání.');
            }
        };

        const loadCharactersForMassSend = async () => {
            recipientListContainer.innerHTML = '<p>Načítám všechny postavy v herním světě...</p>';
            let allCharacters = [];
            try {
                const playersSnapshot = await db.collection('hraci').get();
                for (const playerDoc of playersSnapshot.docs) {
                    const charactersSnapshot = await playerDoc.ref.collection('postavy').get();
                    charactersSnapshot.forEach(charDoc => {
                        allCharacters.push({
                            path: charDoc.ref.path,
                            name: charDoc.data().jmeno,
                            playerName: playerDoc.data().herniNick || 'Neznámý hráč'
                        });
                    });
                }
                
                allCharacters.sort((a, b) => a.name.localeCompare(b.name));

                if(allCharacters.length === 0) {
                    recipientListContainer.innerHTML = '<p>Nebyly nalezeny žádné postavy.</p>';
                    return;
                }

                let html = allCharacters.map(char => `
                    <label class="character-item">
                        <input type="checkbox" class="recipient-checkbox" value="${char.path}" data-character-name="${char.name}">
                        ${char.name} <span class="player-name">(${char.playerName})</span>
                    </label>
                `).join('');
                recipientListContainer.innerHTML = html;

            } catch (error) {
                console.error("Chyba při načítání postav: ", error);
                recipientListContainer.innerHTML = '<p class="error-message">Nepodařilo se načíst postavy.</p>';
            }
        };
        
        const closeMassSendTool = () => {
            massSendTool.classList.add('hidden');
            templateEditor.classList.remove('hidden');
            currentTemplateForMassSend = null;
            recipientListContainer.innerHTML = '';
        };

        selectAllBtn.addEventListener('click', () => {
            recipientListContainer.querySelectorAll('.recipient-checkbox').forEach(cb => cb.checked = true);
        });

        deselectAllBtn.addEventListener('click', () => {
            recipientListContainer.querySelectorAll('.recipient-checkbox').forEach(cb => cb.checked = false);
        });
        
        cancelMassSendBtn.addEventListener('click', closeMassSendTool);
        
        sendMassMailBtn.addEventListener('click', async () => {
            if (!currentTemplateForMassSend) return;

            const selectedRecipients = Array.from(recipientListContainer.querySelectorAll('.recipient-checkbox:checked'))
                .map(cb => ({ path: cb.value, name: cb.dataset.characterName }));

            if (selectedRecipients.length === 0) {
                alert('Musíte vybrat alespoň jednoho příjemce.');
                return;
            }

            const total = selectedRecipients.length;
            if (!confirm(`Opravdu chcete rozeslat oběžník "${currentTemplateForMassSend.interniNazev}" ${total} postavám? Tato akce je nevratná.`)) {
                return;
            }

            sendMassMailBtn.disabled = true;
            sendMassMailBtn.innerHTML = `<i class="fas fa-sync-alt fa-spin"></i> Rozesílám (0/${total})...`;

            try {
                const BATCH_SIZE = 499; // Bezpečnější limit
                let batches = [];
                for (let i = 0; i < total; i += BATCH_SIZE) {
                    batches.push(selectedRecipients.slice(i, i + BATCH_SIZE));
                }

                let sentCount = 0;
                for (const batchRecipients of batches) {
                    const batch = db.batch();
                    batchRecipients.forEach(recipient => {
                        const mailRef = db.collection('posta').doc();
                        const personalizedContent = currentTemplateForMassSend.obsah.replace(/{JMENO_POSTAVY}/g, recipient.name);

                        batch.set(mailRef, {
                            prijemcePath: recipient.path,
                            odesilatel: currentTemplateForMassSend.odesilatel,
                            predmet: currentTemplateForMassSend.predmet,
                            obsah: personalizedContent,
                            podpis: currentTemplateForMassSend.podpis || null,
                            pecet: null, // Zatím nepodporováno v šablonách
                            casOdeslani: firebase.firestore.FieldValue.serverTimestamp(),
                            precteno: false,
                            typ: 'specialni_svitek' 
                        });
                    });
                    await batch.commit();
                    sentCount += batchRecipients.length;
                    sendMassMailBtn.innerHTML = `<i class="fas fa-sync-alt fa-spin"></i> Rozesílám (${sentCount}/${total})...`;
                }

                alert(`Oběžník byl úspěšně rozeslán ${total} postavám.`);
                closeMassSendTool();

            } catch (error) {
                console.error("Chyba při hromadném rozesílání: ", error);
                alert('Došlo k závažné chybě při rozesílání. Některé zprávy nemusely být odeslány.');
            } finally {
                sendMassMailBtn.disabled = false;
                sendMassMailBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Rozeslat oběžník';
            }
        });

        // --- HLAVNÍ EVENT LISTENER PRO AKCE V SEZNAMU ---

        templateListContainer.addEventListener('click', async (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            const templateItem = target.closest('.template-item');
            const templateId = templateItem.dataset.id;

            if (target.classList.contains('edit-btn')) {
                try {
                    const doc = await db.collection('sablony').doc(templateId).get();
                    if (doc.exists) {
                        const data = doc.data();
                        editorTitle.textContent = `Upravit šablonu: ${data.interniNazev}`;
                        templateIdInput.value = doc.id;
                        templateNameInput.value = data.interniNazev;
                        templateSubjectInput.value = data.predmet;
                        templateContentInput.value = data.obsah;
                        templateSignatureInput.value = data.podpis || '';
                        templateSenderSelect.value = data.odesilatel;
                        saveTemplateBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Aktualizovat šablonu';
                        clearEditorBtn.classList.remove('hidden');
                        if (window.initCustomSelect) {
                           document.querySelectorAll('.custom-select').forEach(sel => window.initCustomSelect(sel));
                        }
                        window.scrollTo({ top: templateEditor.offsetTop, behavior: 'smooth' });
                    }
                } catch (error) {
                    console.error("Chyba při načítání šablony pro úpravu: ", error);
                }
            } else if (target.classList.contains('delete-btn')) {
                if (confirm('Opravdu si přejete trvale smazat tuto šablonu?')) {
                    try {
                        await db.collection('sablony').doc(templateId).delete();
                        alert('Šablona byla smazána.');
                        await loadTemplates();
                        clearEditor(); // Vyčistit editor, pokud byla smazána právě upravovaná šablona
                    } catch (error) {
                        console.error("Chyba při mazání šablony: ", error);
                        alert('Nepodařilo se smazat šablonu.');
                    }
                }
            } else if (target.classList.contains('use-btn')) {
                await setupMassSendTool(templateId);
            }
        });

        // --- PRVOTNÍ INICIALIZACE ---
        loadTemplates(); 
        if (window.initCustomSelect) {
            document.querySelectorAll('.custom-select').forEach(sel => window.initCustomSelect(sel));
        }
    };
});