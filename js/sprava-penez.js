document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();
    const financeListContainer = document.getElementById('finance-list-container');

    let currentAdminNick = 'Admin';

    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('hraci').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    currentAdminNick = doc.data().herniNick || 'Admin';
                }
            });
        }
    });

    async function loadCharactersFinanceData() {
        try {
            financeListContainer.innerHTML = '<div class="loading-spinner"></div>';
            const charactersWithFinance = [];
            const playersSnapshot = await db.collection('hraci').get();

            for (const playerDoc of playersSnapshot.docs) {
                const charactersSnapshot = await playerDoc.ref.collection('postavy').get();
                charactersSnapshot.forEach(charDoc => {
                    const charData = charDoc.data();
                    charactersWithFinance.push({
                        id: charDoc.id,
                        ownerId: playerDoc.id,
                        jmeno: charData.jmeno || 'Neznámé',
                        penezenaGaleony: charData.peněženka?.galeony || 0,
                        trezorGaleony: charData.trezor?.galeony || 0,
                        hasVault: charData.trezor !== undefined,
                        trezorCislo: charData.trezorCislo || 'Žádný'
                    });
                });
            }
            renderFinanceTable(charactersWithFinance.sort((a, b) => a.jmeno.localeCompare(b.jmeno)));
        } catch (error) {
            console.error("Chyba při načítání finančních dat postav: ", error);
            financeListContainer.innerHTML = '<p class="error-text">Nepodařilo se načíst finanční data.</p>';
        }
    }

    function renderFinanceTable(characters) {
        const tableRows = characters.map(char => `
            <tr>
                <td>${char.jmeno}</td>
                <td>
                    <div class="finance-actions">
                        <span>${char.penezenaGaleony} G</span>
                        <input type="number" id="peněženka-amount-${char.id}" placeholder="Částka">
                        <button class="action-btn add" data-char-id="${char.id}" data-owner-id="${char.ownerId}" data-type="peněženka" data-action="add">+</button>
                        <button class="action-btn remove" data-char-id="${char.id}" data-owner-id="${char.ownerId}" data-type="peněženka" data-action="remove">-</button>
                    </div>
                </td>
                <td>${char.hasVault ? 'Ano' : 'Ne'}</td>
                <td>${char.trezorCislo}</td>
                <td>
                    ${char.hasVault ? `
                        <div class="finance-actions">
                            <span>${char.trezorGaleony} G</span>
                            <input type="number" id="trezor-amount-${char.id}" placeholder="Částka">
                            <button class="action-btn add" data-char-id="${char.id}" data-owner-id="${char.ownerId}" data-type="trezor" data-action="add">+</button>
                            <button class="action-btn remove" data-char-id="${char.id}" data-owner-id="${char.ownerId}" data-type="trezor" data-action="remove">-</button>
                        </div>
                    ` : '<span class="vault-status">Postava nemá trezor</span>'}
                </td>
            </tr>
        `).join('');

        financeListContainer.innerHTML = `
            <table class="finance-table">
                <thead>
                    <tr>
                        <th>Jméno postavy</th>
                        <th>Peněženka (Galeony)</th>
                        <th>Vlastní trezor?</th>
                        <th>Číslo trezoru</th>
                        <th>Trezor (Galeony)</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;
        setupFinanceActionButtons();
    }

    function setupFinanceActionButtons() {
        document.querySelectorAll('.finance-actions .action-btn').forEach(button => {
            button.addEventListener('click', handleFinanceAction);
        });
    }

    async function handleFinanceAction(event) {
        const button = event.currentTarget;
        const { charId, ownerId, type, action } = button.dataset;
        const amountInput = document.getElementById(`${type}-amount-${charId}`);
        const amount = parseInt(amountInput.value, 10);

        if (isNaN(amount) || amount <= 0) {
            alert('Zadejte prosím platnou kladnou částku.');
            return;
        }

        button.disabled = true;
        const characterRef = db.collection('hraci').doc(ownerId).collection('postavy').doc(charId);

        try {
            const charDocInitial = await characterRef.get();
            if (!charDocInitial.exists) throw new Error("Postava nenalezena!");
            const characterName = charDocInitial.data().jmeno;

            await db.runTransaction(async (transaction) => {
                const charDoc = await transaction.get(characterRef);
                if (!charDoc.exists) throw new Error("Postava nenalezena během transakce!");
                
                const charData = charDoc.data();
                const updatePath = `${type}.galeony`;
                const currentValue = (type === 'peněženka' ? charData.peněženka?.galeony : charData.trezor?.galeony) || 0;
                const newValue = action === 'add' ? currentValue + amount : currentValue - amount;

                if (newValue < 0) throw new Error('Výsledná částka nesmí být záporná.');

                transaction.update(characterRef, { [updatePath]: newValue });
            });

            await logFinanceChange(charId, characterName, type, action, amount);
            alert('Finanční stav byl úspěšně aktualizován.');
            loadCharactersFinanceData();

        } catch (error) {
            console.error("Chyba při aktualizaci financí: ", error);
            alert(`Při aktualizaci financí došlo k chybě: ${error.message}`);
            button.disabled = false;
        }
    }
    
    async function logFinanceChange(characterId, characterName, type, action, amount) {
        const logMessage = `Admin ${currentAdminNick} ${action === 'add' ? 'přidal' : 'odebral'} ${amount}G ${type === 'peněženka' ? 'do peněženky' : 'do trezoru'} postavy ${characterName}.`;
        try {
            await db.collection('audit_logs').add({
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                admin: currentAdminNick,
                action: 'Úprava financí',
                targetCharacterId: characterId,
                targetCharacterName: characterName,
                details: logMessage
            });
        } catch (error) {
            console.error("Chyba při zápisu do audit logu: ", error);
        }
    }

    const financeTab = document.querySelector('.menu-item[data-target="sprava-penez"]');
    let dataLoaded = false;
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' && financeTab.classList.contains('active') && !dataLoaded) {
                loadCharactersFinanceData();
                dataLoaded = true; 
            }
        });
    });
    if(financeTab) {
      observer.observe(document.getElementById('sprava-penez'), { attributes: true });
    }
});
