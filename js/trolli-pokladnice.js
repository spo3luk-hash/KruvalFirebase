document.addEventListener('DOMContentLoaded', function () {
    const db = firebase.firestore();
    const auth = firebase.auth();

    const selectedCharacterId = sessionStorage.getItem('selectedCharacterId');

    // --- HTML Elementy ---
    const narrativeTextEl = document.getElementById('narrative-text');
    const actionButtonsEl = document.getElementById('action-buttons');
    const dynamicContentContainerEl = document.getElementById('dynamic-content-container');
    const vaultsListContainerEl = document.getElementById('vaults-list-container');
    const vaultsListEl = document.getElementById('vaults-list');
    const vaultInterfaceEl = document.getElementById('vault-interface');
    const walletBalanceEl = document.getElementById('wallet-balance');
    const vaultBalanceEl = document.getElementById('vault-balance');
    const depositForm = document.querySelector('#transfer-transactions .transaction-form:first-child');
    const withdrawForm = document.querySelector('#transfer-transactions .transaction-form:last-child');
    const playerInventoryListEl = document.getElementById('player-inventory-list');
    const vaultInventoryListEl = document.getElementById('vault-inventory-list');
    const backToTellerBtn = document.getElementById('back-to-teller-btn');
    const backToVaultsListBtn = document.getElementById('back-to-vaults-list-btn');

    let currentUserUid = null;
    let characterRef = null;
    let characterData = {};
    let allVaults = [];
    let isInitialLoad = true;

    // --- Utility Functions ---
    const toKnuts = (g, s, k) => ((g || 0) * 17 * 29) + ((s || 0) * 29) + (k || 0);
    const fromKnuts = (totalKnuts) => {
        const galleons = Math.floor(totalKnuts / (17 * 29));
        let remainder = totalKnuts % (17 * 29);
        const sickles = Math.floor(remainder / 29);
        const knuts = remainder % 29;
        return { galeony: galleons, srpce: sickles, svrcky: knuts };
    };
    const findVaultKey = () => (characterData.inventar || []).find(item => item.typ === 'klic_trezoru');

    // --- ŘÍZENÍ STAVU A ZOBRAZENÍ ---
    function showView(view) {
        dynamicContentContainerEl.classList.add('hidden');
        vaultsListContainerEl.classList.add('hidden');
        vaultInterfaceEl.classList.add('hidden');
        if (view === 'narrative') dynamicContentContainerEl.classList.remove('hidden');
        else if (view === 'vaultsList') vaultsListContainerEl.classList.remove('hidden');
        else if (view === 'vaultInterface') vaultInterfaceEl.classList.remove('hidden');
    }

    // --- AUTENTIZACE A INICIALIZACE ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserUid = user.uid;
            if (!selectedCharacterId) {
                alert("Nejprve si musíte vybrat postavu!");
                window.location.href = 'vyber-postavy.html';
                return;
            }
            characterRef = db.collection('hraci').doc(currentUserUid).collection('postavy').doc(selectedCharacterId);
            attachSnapshotListener();
        } else {
            window.location.href = 'index.html';
        }
    });

    function attachSnapshotListener() {
        characterRef.onSnapshot(doc => {
            if (doc.exists) {
                characterData = doc.data();
                ensureDataStructure(characterData);
                updateFinancialUI();
                updateInventoryUI();
                if (isInitialLoad) {
                    renderScene('ENTRY');
                    isInitialLoad = false;
                }
            } else {
                alert("Vybraná postava nebyla nalezena.");
                window.location.href = 'vyber-postavy.html';
            }
        }, error => console.error("Chyba snapshot listeneru: ", error));
    }

    // --- SCÉNÁŘ A RENDER ---
    const scenes = {
        'ENTRY': {
            text: [
                'Po vstupu do banky se nacházíš v rozsáhlém komplexu, kde vidíš spoustu neohrabaných horských Trollů. Co tu chceš?',
                'Ledový vzduch páchne sírou. Obrovští trollové s nezájmem sledují příchozí. Co tě sem přivádí?'
            ],
            buttons: [
                { text: 'Přistoupit k přepážce', action: () => renderScene('APPROACH_TELLER') },
                { text: 'Odejít z banky', action: () => window.location.href = 'pricnaulice-obchody.html' }
            ]
        },
        'APPROACH_TELLER': {
            text: [
                'Vysoký troll si tě přeměřuje pohledem a podivně mručí. Zdá se, že čeká, co řekneš.',
                'Troll za přepážkou zvedne obočí. Jeho pohled je stejně chladný jako kámen kolem. "Další?" zabručí.'
            ],
            buttons: [
                { text: 'Chci ke svému trezoru', action: () => checkVaultStatus() },
                { text: 'Jen se rozhlížím', action: () => renderScene('ENTRY') }
            ]
        },
        'ACCESS_GRANTED': {
            text: 'Troll si všimne klíče v tvé ruce, líně mávne rukou k zadní části sálu. "V pořádku. Můžeš projít."',
            buttons: [{ text: 'Prohlédnout seznam trezorů', action: () => showVaultsList() }]
        },
        'NO_VAULT_ACCOUNT': {
            text: 'Troll nahlédne do své knihy a zavrtí hlavou. "Nemáš tu trezor. Chceš si založit nový? Stojí to 5 galeonů."',
            buttons: [
                { text: 'Ano, založit trezor', action: () => createVaultAccount() },
                { text: 'Ne, děkuji', action: () => renderScene('APPROACH_TELLER') }
            ]
        },
        'VAULT_CREATED': {
            text: (newVaultNumber) => `Troll vezme tvých 5 galeonů. "Dobrá." Zapíše něco do své knihy. "Tvůj trezor má číslo ${newVaultNumber}. Tady máš klíč. Neztrať ho."`, 
            buttons: [
                { text: 'Vzít si klíč a vrátit se k přepážce', action: () => renderScene('APPROACH_TELLER') }
            ]
        },
        'INSUFFICIENT_FUNDS': {
            text: 'Troll se ušklíbne. "Nemáš dost peněz na zaplacení poplatku. Vrať se, až budeš mít 5 galeonů."',
            buttons: [
                { text: 'Rozumím', action: () => renderScene('APPROACH_TELLER') }
            ]
        }
    };

    function renderScene(sceneName, context = null) {
        showView('narrative');
        const scene = scenes[sceneName];
        let sceneText = Array.isArray(scene.text) ? scene.text[Math.floor(Math.random() * scene.text.length)] : scene.text;
        if (typeof sceneText === 'function') sceneText = sceneText(context);

        narrativeTextEl.innerHTML = '';
        actionButtonsEl.innerHTML = '';

        let i = 0;
        function typeWriter() {
            if (i < sceneText.length) {
                narrativeTextEl.innerHTML += sceneText.charAt(i);
                i++;
                setTimeout(typeWriter, 25);
            } else {
                renderButtonsAndInputs(scene);
            }
        }
        typeWriter();
    }

    function renderButtonsAndInputs(scene) {
        setTimeout(() => {
            if (scene.buttons) {
                scene.buttons.forEach(buttonData => {
                    const button = document.createElement('button');
                    button.textContent = buttonData.text;
                    button.onclick = buttonData.action;
                    button.classList.add('btn-primary', 'fade-in');
                    actionButtonsEl.appendChild(button);
                });
            }
        }, 300);
    }

    // --- LOGIKA TREZORŮ A BEZPEČNOSTI ---
    function checkVaultStatus() {
        const vaultKey = findVaultKey();
        if (vaultKey) {
            renderScene('ACCESS_GRANTED');
        } else {
            renderScene('NO_VAULT_ACCOUNT');
        }
    }

    async function createVaultAccount() {
        const costInKnuts = toKnuts(5, 0, 0);
        const walletInKnuts = toKnuts(characterData.peněženka.galeony, characterData.peněženka.srpce, characterData.peněženka.svrcky);

        if (walletInKnuts < costInKnuts) {
            renderScene('INSUFFICIENT_FUNDS');
            return;
        }

        try {
            const querySnapshot = await db.collectionGroup('postavy').where('trezorCislo', '>', 0).get();
            const existingNumbers = querySnapshot.docs.map(doc => doc.data().trezorCislo);

            let newVaultNumber;
            do {
                newVaultNumber = Math.floor(Math.random() * (99999 - 1000 + 1)) + 1000;
            } while (existingNumbers.includes(newVaultNumber));

            const newWalletInKnuts = walletInKnuts - costInKnuts;
            const newWallet = fromKnuts(newWalletInKnuts);
            const newKey = { nazev: `Klíč s nápisem ${newVaultNumber}`, typ: 'klic_trezoru' };

            await characterRef.update({
                trezorCislo: newVaultNumber,
                peněženka: newWallet,
                inventar: firebase.firestore.FieldValue.arrayUnion(newKey)
            });

            renderScene('VAULT_CREATED', newVaultNumber);
        } catch (error) {
            console.error("Chyba při vytváření trezoru: ", error);
            alert("Došlo k chybě při komunikaci s bankou. Zkuste to prosím znovu.");
        }
    }

    async function showVaultsList(forceReload = false) {
        showView('vaultsList');
        if (allVaults.length > 0 && !forceReload) {
            renderVaultsList();
            return;
        }

        vaultsListEl.innerHTML = '<p>Načítám seznam trezorů...</p>';
        try {
            const querySnapshot = await db.collectionGroup('postavy').where('trezorCislo', '>', 0).orderBy('trezorCislo').get();
            allVaults = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderVaultsList();
        } catch (error) {
            console.error("Chyba při načítání seznamu trezorů: ", error);
            vaultsListEl.innerHTML = '<p>Nepodařilo se načíst seznam trezorů. Ujistěte se, že byl ve Firebase konzoli vytvořen potřebný index.</p>';
        }
    }

    function renderVaultsList() {
        vaultsListEl.innerHTML = '';
        if (allVaults.length === 0) {
            vaultsListEl.innerHTML = '<p>V bance zatím nejsou žádné trezory.</p>';
            return;
        }

        allVaults.forEach(vault => {
            const isOwner = (vault.id === selectedCharacterId);
            const vaultElement = document.createElement('div');
            vaultElement.classList.add('vault-item');
            if (!isOwner) vaultElement.classList.add('locked');

            vaultElement.innerHTML = `
                <div class="vault-number">#${vault.trezorCislo}</div>
                <div class="vault-owner">Majitel: ${vault.jmeno || 'Neznámý'}</div>
                <div class="vault-status">
                    ${isOwner
                        ? '<button class="btn-unlock-vault">Odemknout</button>'
                        : '<i class="fas fa-lock"></i> Zamčeno'
                    }
                </div>
            `;

            if (isOwner) {
                vaultElement.querySelector('.btn-unlock-vault').addEventListener('click', () => {
                    showView('vaultInterface');
                });
            }
            vaultsListEl.appendChild(vaultElement);
        });
    }

    // --- FINANČNÍ TRANSAKCE S POPLATKY ---
    function handleTransaction(type) {
        const isDeposit = type === 'wallet-to-vault';
        const form = isDeposit ? depositForm : withdrawForm;
        const amount = {
            galleons: parseInt(form.querySelector('input[placeholder="Galeony"]').value) || 0,
            sickles: parseInt(form.querySelector('input[placeholder="Srpce"]').value) || 0,
            knuts: parseInt(form.querySelector('input[placeholder="Svrčci"]').value) || 0
        };
        const amountInKnuts = toKnuts(amount.galleons, amount.sickles, amount.knuts);
        if (amountInKnuts <= 0) return alert('Částka musí být větší než nula.');

        db.runTransaction(transaction => {
            return transaction.get(characterRef).then(doc => {
                if (!doc.exists) throw new Error("Postava nenalezena.");
                const data = doc.data();
                const walletInKnuts = toKnuts(data.peněženka.galeony, data.peněženka.srpce, data.peněženka.svrcky);
                const vaultInKnuts = toKnuts(data.trezor.galeony, data.trezor.srpce, data.trezor.svrcky);
                let newWalletKnuts, newVaultKnuts, feeInKnuts = 0;

                if (isDeposit) {
                    if (walletInKnuts < amountInKnuts) throw new Error("Nedostatek prostředků v peněžence.");
                    newWalletKnuts = walletInKnuts - amountInKnuts;
                    newVaultKnuts = vaultInKnuts + amountInKnuts;
                } else {
                    if (vaultInKnuts < amountInKnuts) throw new Error("Nedostatek prostředků v trezoru.");
                    const feeRate = Math.random() * (0.015 - 0.005) + 0.005;
                    feeInKnuts = Math.ceil(amountInKnuts * feeRate);
                    if (vaultInKnuts < amountInKnuts + feeInKnuts) throw new Error("Nedostatek prostředků v trezoru na pokrytí výběru a poplatku.");
                    newVaultKnuts = vaultInKnuts - amountInKnuts - feeInKnuts;
                    newWalletKnuts = walletInKnuts + amountInKnuts;
                }
                transaction.update(characterRef, { peněženka: fromKnuts(newWalletKnuts), trezor: fromKnuts(newVaultKnuts) });
                return feeInKnuts;
            });
        }).then((feeInKnuts) => {
            let message = 'Přesun proběhl úspěšně!';
            if (feeInKnuts > 0) {
                const fee = fromKnuts(feeInKnuts);
                message += `\nTroll si pro sebe ponechal ${fee.galeony}G ${fee.srpce}S ${fee.svrcky}K jako poplatek za službu.`;
            }
            alert(message);
            form.querySelectorAll('input[type="number"]').forEach(input => input.value = '');
        }).catch(error => {
            alert('Transakce selhala: ' + error.message);
        });
    }

    // --- SPRÁVA INVENTÁŘE ---
    function updateInventoryUI() {
        renderInventoryList(playerInventoryListEl, characterData.inventar || [], 'deposit');
        renderInventoryList(vaultInventoryListEl, characterData.trezorInventar || [], 'withdraw');
    }

    function renderInventoryList(element, items, type) {
        element.innerHTML = '';
        if (!items || items.length === 0) {
            element.innerHTML = '<p style="text-align: center; opacity: 0.5;">Prázdné</p>';
            return;
        }
        items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.classList.add('inventory-item');
            itemEl.innerHTML = `<span>${item.nazev}</span><button class="btn-item-transfer">${type === 'deposit' ? 'Uložit' : 'Vzít'}</button>`;
            itemEl.querySelector('button').addEventListener('click', () => handleItemTransfer(item, type));
            element.appendChild(itemEl);
        });
    }

    function handleItemTransfer(itemToMove, type) {
        // Zabráníme přesunu klíče z inventáře
        if (itemToMove.typ === 'klic_trezoru') {
            alert("Klíč od trezoru nelze uložit do trezoru. Musíte ho mít u sebe!");
            return;
        }
        const sourceArray = type === 'deposit' ? 'inventar' : 'trezorInventar';
        const destinationArray = type === 'deposit' ? 'trezorInventar' : 'inventar';
        characterRef.update({
            [sourceArray]: firebase.firestore.FieldValue.arrayRemove(itemToMove),
            [destinationArray]: firebase.firestore.FieldValue.arrayUnion(itemToMove)
        }).catch(error => {
            console.error("Chyba při přesunu předmětu: ", error);
            alert("Přesun předmětu se nezdařil.");
        });
    }

    // --- POMOCNÉ FUNKCE ---
    function ensureDataStructure(data) {
        const updates = {};
        if (!data.peněženka) updates.peněženka = { galeony: 0, srpce: 0, svrcky: 0 };
        if (!data.trezor) updates.trezor = { galeony: 0, srpce: 0, svrcky: 0 };
        if (!data.inventar) updates.inventar = [];
        if (!data.trezorInventar) updates.trezorInventar = [];
        if (Object.keys(updates).length > 0) {
            characterRef.set(updates, { merge: true });
        }
    }

    function updateFinancialUI() {
        const wallet = characterData.peněženka || { galeony: 0, srpce: 0, svrcky: 0 };
        const vault = characterData.trezor || { galeony: 0, srpce: 0, svrcky: 0 };
        walletBalanceEl.innerHTML = `<p>Galeonů: <span>${wallet.galeony || 0}</span></p><p>Srpů: <span>${wallet.srpce || 0}</span></p><p>Svrčků: <span>${wallet.svrcky || 0}</span></p>`;
        vaultBalanceEl.innerHTML = `<p>Galeonů: <span>${vault.galeony || 0}</span></p><p>Srpů: <span>${vault.srpce || 0}</span></p><p>Svrčků: <span>${vault.svrcky || 0}</span></p>`;
    }

    // Event Listeners
    depositForm.querySelector('button').addEventListener('click', (e) => { e.preventDefault(); handleTransaction('wallet-to-vault'); });
    withdrawForm.querySelector('button').addEventListener('click', (e) => { e.preventDefault(); handleTransaction('vault-to-wallet'); });
    backToTellerBtn.addEventListener('click', () => renderScene('APPROACH_TELLER'));
    backToVaultsListBtn.addEventListener('click', () => showVaultsList());
});
