document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    const spellsBtn = document.getElementById('spells-btn');
    const spellsModal = document.getElementById('spells-modal');
    const closeSpellsBtn = document.getElementById('close-spells-btn');
    const spellsListEl = document.getElementById('spells-list');

    const trainSpellModal = document.getElementById('train-spell-modal');
    const closeTrainSpellBtn = document.getElementById('close-train-spell-btn');
    const trainSpellTitle = document.getElementById('train-spell-title');
    const trainSpellProgressText = document.getElementById('train-spell-progress-text');
    const trainSpellInstructions = document.getElementById('train-spell-instructions');
    const trainSpellInput = document.getElementById('train-spell-input');
    const submitTrainSpellBtn = document.getElementById('submit-train-spell-btn');

    let currentUser = null;
    let characterId = null;
    let characterData = null;
    let allSpells = [];
    let characterSpells = {};

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            characterId = sessionStorage.getItem('selectedCharacterId');
            if (characterId) {
                attachCharacterListener();
                loadAllSpells();
                attachCharacterSpellsListener();
            }
        }
    });

    function attachCharacterListener() {
        if (!currentUser || !characterId) return;
        const charRef = db.collection('hraci').doc(currentUser.uid).collection('postavy').doc(characterId);
        charRef.onSnapshot(doc => {
            if (doc.exists) {
                characterData = { id: doc.id, ...doc.data() };
            }
        }, error => console.error("Chyba při poslouchání změn postavy: ", error));
    }

    async function loadAllSpells() {
        try {
            const snapshot = await db.collection('kouzla').orderBy('rocnik').get();
            allSpells = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Chyba při načítání všech kouzel: ", error);
        }
    }

    function attachCharacterSpellsListener() {
        if (!currentUser || !characterId) return;
        const charSpellsRef = db.collection('hraci').doc(currentUser.uid).collection('postavy').doc(characterId).collection('kouzla');
        charSpellsRef.onSnapshot(snapshot => {
            characterSpells = {};
            snapshot.forEach(doc => {
                characterSpells[doc.id] = doc.data();
            });
            if (!spellsModal.classList.contains('hidden')) {
                renderSpells();
            }
        }, error => console.error("Chyba při poslouchání kouzel postavy: ", error));
    }

    function renderSpells() {
        spellsListEl.innerHTML = '';
        if (allSpells.length === 0) {
            spellsListEl.innerHTML = '<p>Žádná kouzla nebyla nalezena.</p>';
            return;
        }

        let currentYear = 0;
        allSpells.forEach(spell => {
            const charSpellData = characterSpells[spell.id] || { pokrok: 0, nauceno: false };
            const progress = charSpellData.pokrok;

            if (spell.rocnik > currentYear) {
                currentYear = spell.rocnik;
                const yearHeader = document.createElement('h3');
                yearHeader.className = 'spells-year-header';
                yearHeader.textContent = `${currentYear}. Ročník`;
                spellsListEl.appendChild(yearHeader);
            }

            const card = document.createElement('div');
            card.className = 'spell-card';
            card.innerHTML = `
                <div class="spell-card-header">
                    <div class="spell-name">${spell.jmeno}</div>
                    <div class="spell-mana-cost">Mana: ${spell.manaCost || 'N/A'}</div>
                </div>
                <div class="spell-description">${spell.popis}</div>
                <div class="spell-progress-container">
                    <div class="spell-progress-bar"><div class="spell-progress-fill" style="width: ${progress}%;"></div></div>
                    <div class="spell-progress-text">Zvládnuto: ${progress}%</div>
                </div>
                <div class="spell-actions">
                    <button class="btn-primary cast-spell-btn" data-spell-id="${spell.id}" ${progress < 100 ? 'disabled' : ''}>Seslat</button>
                    <button class="btn-secondary train-spell-btn" data-spell-id="${spell.id}" ${progress >= 100 ? 'disabled' : ''}>Trénovat</button>
                </div>
            `;
            spellsListEl.appendChild(card);
        });
    }
    
    function dispatchChatMessage(messageType, data) {
        const event = new CustomEvent('request-chat-message', {
            detail: { messageType, data }
        });
        document.dispatchEvent(event);
    }

    spellsBtn.addEventListener('click', () => {
        renderSpells();
        spellsModal.classList.remove('hidden');
    });

    closeSpellsBtn.addEventListener('click', () => spellsModal.classList.add('hidden'));
    closeTrainSpellBtn.addEventListener('click', () => trainSpellModal.classList.add('hidden'));

    spellsListEl.addEventListener('click', (e) => {
        const spellId = e.target.closest('[data-spell-id]')?.dataset.spellId;
        if (!spellId) return;

        if (e.target.classList.contains('train-spell-btn')) {
            openTrainModal(spellId);
        } else if (e.target.classList.contains('cast-spell-btn')) {
            castSpell(spellId);
        }
    });

    submitTrainSpellBtn.addEventListener('click', handleTrainSpell);

    function openTrainModal(spellId) {
        const spell = allSpells.find(s => s.id === spellId);
        const charSpellData = characterSpells[spellId] || { pokrok: 0 };

        trainSpellTitle.textContent = `Trénovat: ${spell.jmeno}`;
        trainSpellProgressText.textContent = `Tohle kouzlo zatím umíš na ${charSpellData.pokrok}%. K úplnému zvládnutí ti zbývá ${100 - charSpellData.pokrok}%.`;
        trainSpellInstructions.textContent = `Pokud chceš nyní kouzlo trénovat, napiš k němu příspěvek o délce alespoň 30 znaků. Stojí tě to 5 many.`;
        trainSpellInput.value = '';
        submitTrainSpellBtn.dataset.spellId = spellId;

        trainSpellModal.classList.remove('hidden');
        spellsModal.classList.add('hidden');
        trainSpellInput.focus();
    }

    async function handleTrainSpell() {
        const spellId = submitTrainSpellBtn.dataset.spellId;
        const trainingText = trainSpellInput.value.trim();
        const spell = allSpells.find(s => s.id === spellId);
        const manaCost = 5;

        if (!characterData || characterData.mana < manaCost) {
            alert('Nemáš dostatek many na trénování tohoto kouzla.');
            return;
        }

        if (trainingText.length < 30) {
            alert('Příspěvek pro trénink musí mít alespoň 30 znaků.');
            return;
        }

        trainSpellModal.classList.add('hidden');
        const charRef = db.collection('hraci').doc(currentUser.uid).collection('postavy').doc(characterId);
        
        dispatchChatMessage('emote', { text: `se soustředí a snaží se trénovat kouzlo ${spell.jmeno}.` });
        if(trainingText) {
            setTimeout(() => dispatchChatMessage('standard', { text: trainingText }), 200);
        }

        await charRef.update({ mana: firebase.firestore.FieldValue.increment(-manaCost) });

        const isSuccess = Math.random() < 0.7; 

        if (isSuccess) {
            const charSpellRef = charRef.collection('kouzla').doc(spellId);
            const currentProgress = characterSpells[spellId]?.pokrok || 0;
            const progressGain = Math.floor(Math.random() * 5) + 1;
            const newProgress = Math.min(currentProgress + progressGain, 100);

            try {
                await charSpellRef.set({ pokrok: newProgress, nauceno: newProgress === 100 }, { merge: true });
                const effect = getSpellEffect(spell, newProgress);
                const successMessage = effect ? `Trénink kouzla ${spell.jmeno} byl úspěšný! ${effect.efekt}` : `Trénink kouzla ${spell.jmeno} se zdařil! ${characterData.jmeno} si vylepšil/a své dovednosti.`;
                setTimeout(() => dispatchChatMessage('narrator', { text: successMessage }), 1000);
            } catch (error) {
                console.error("Chyba při ukládání pokroku kouzla: ", error);
                await charRef.update({ mana: firebase.firestore.FieldValue.increment(manaCost) });
                const failureMessage = `Něco se pokazilo a trénink kouzla ${spell.jmeno} se nezdařil.`;
                setTimeout(() => dispatchChatMessage('narrator', { text: failureMessage }), 1000);
            }
        } else {
            const effect = getSpellEffect(spell, characterSpells[spellId]?.pokrok || 0);
            const failureMessage = `Trénink kouzla ${spell.jmeno} se tentokrát nepovedl. ${effect ? effect.efekt : 'Nic se nestalo.'}`;
            setTimeout(() => dispatchChatMessage('narrator', { text: failureMessage }), 1000);
        }
    }

    function castSpell(spellId) {
        const spell = allSpells.find(s => s.id === spellId);
        if (!spell) return;
        const manaCost = spell.manaCost || 10;

        if (!characterData || characterData.mana < manaCost) {
            dispatchChatMessage('emote', { text: `se pokouší seslat kouzlo ${spell.jmeno}, ale je příliš vyčerpaný/á a kouzlo selže.` });
            return;
        }

        const charRef = db.collection('hraci').doc(currentUser.uid).collection('postavy').doc(characterId);
        charRef.update({ mana: firebase.firestore.FieldValue.increment(-manaCost) });

        const currentProgress = characterSpells[spellId]?.pokrok || 0;
        const effect = getSpellEffect(spell, currentProgress);

        dispatchChatMessage('emote', { text: `napřahuje hůlku a sesílá kouzlo ${spell.jmeno}...` });

        setTimeout(() => {
            if (effect) {
                dispatchChatMessage('narrator', { text: effect.efekt });
            } else {
                dispatchChatMessage('narrator', { text: "Kouzlo se rozplyne bez účinku." });
            }
        }, 1200);
    }

    function getSpellEffect(spell, progress) {
        if (!spell || !spell.uspesnost) return null;
        return spell.uspesnost.slice().reverse().find(e => progress >= e.min);
    }
});