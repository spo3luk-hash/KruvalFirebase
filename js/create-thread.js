
document.addEventListener('DOMContentLoaded', function () {
    const db = firebase.firestore();
    const auth = firebase.auth();
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('cat');
    const forumId = params.get('forum');

    const backLink = document.getElementById('back-to-forum-link');
    const form = document.getElementById('create-thread-form');
    const errorMessage = document.getElementById('error-message');
    const submitBtn = document.getElementById('submit-thread-btn');

    // --- NOVÉ: Reference na prvky pro tvorbu anket ---
    const threadTypeSelector = document.getElementById('thread-type-selector');
    const pollCreationContainer = document.getElementById('poll-creation-container');
    const pollQuestionInput = document.getElementById('poll-question');
    const pollOptionsContainer = document.getElementById('poll-options-container');
    const addPollOptionBtn = document.getElementById('add-poll-option-btn');
    // --- KONEC NOVÉ ČÁSTI ---

    if (!categoryId || !forumId) {
        form.innerHTML = '<h2>Chybí ID kategorie nebo fóra. Nelze vytvořit téma.</h2>';
        if (backLink) backLink.href = 'forum.html';
        return;
    }

    if (backLink) {
        backLink.href = `forum-view.html?cat=${categoryId}&forum=${forumId}`;
    }

    // --- NOVÉ: Logika pro zobrazení a skrytí formuláře pro anketu ---
    threadTypeSelector.addEventListener('change', function(e) {
        if (e.target.value === 'anketa') {
            pollCreationContainer.classList.remove('hidden');
            pollQuestionInput.required = true;
        } else {
            pollCreationContainer.classList.add('hidden');
            pollQuestionInput.required = false;
        }
    });

    addPollOptionBtn.addEventListener('click', function() {
        const newOption = document.createElement('input');
        newOption.type = 'text';
        newOption.name = 'poll-option';
        newOption.className = 'poll-option-input';
        pollOptionsContainer.appendChild(newOption);
    });
    // --- KONEC NOVÉ ČÁSTI ---

    auth.onAuthStateChanged(async user => {
        if (!user) {
            form.innerHTML = '<h2>Pro vytvoření tématu se musíte přihlásit.</h2>';
            if (backLink) backLink.style.display = 'none';
        } else {
            try {
                const forumRef = db.collection('forum_categories').doc(categoryId).collection('fora').doc(forumId);
                const forumDoc = await forumRef.get();
                if (forumDoc.exists) {
                    const headerTitle = document.querySelector('header h1');
                    headerTitle.textContent = `Nové téma v: ${forumDoc.data().nazev}`;
                }
            } catch (error) {
                console.error("Chyba při načítání názvu fóra: ", error);
                errorMessage.textContent = 'Došlo k chybě při načítání informací o fóru.';
            }
        }
    });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        submitBtn.disabled = true;
        errorMessage.textContent = '';

        const title = document.getElementById('thread-title').value.trim();
        const content = document.getElementById('thread-content').value.trim();
        const user = auth.currentUser;

        if (!user) {
            errorMessage.textContent = 'Nejste přihlášeni.';
            submitBtn.disabled = false;
            return;
        }

        if (!title || !content) {
            errorMessage.textContent = 'Název i obsah musí být vyplněny.';
            submitBtn.disabled = false;
            return;
        }

        // --- UPRAVENO: Zpracování dat podle typu tématu ---
        const threadType = document.querySelector('input[name="thread-type"]:checked').value;
        let threadData = {
            nazev: title,
            autorId: user.uid,
            vytvoreno: firebase.firestore.FieldValue.serverTimestamp(),
            posledniPrispevek: firebase.firestore.FieldValue.serverTimestamp(),
            odpovedi: 0,
            typ: threadType, // Přidáno pole pro typ
            zamceno: false, // Defaultní hodnota
            seznamSledujicichIdentit: [] // Defaultní hodnota
        };
        let pollOptions = [];

        if (threadType === 'anketa') {
            const pollQuestion = pollQuestionInput.value.trim();
            if (!pollQuestion) {
                errorMessage.textContent = 'Anketní otázka nesmí být prázdná.';
                submitBtn.disabled = false;
                return;
            }
            threadData.otazka = pollQuestion;

            pollOptions = Array.from(document.querySelectorAll('.poll-option-input'))
                .map(input => input.value.trim())
                .filter(optionText => optionText !== '');

            if (pollOptions.length < 2) {
                errorMessage.textContent = 'Anketa musí mít alespoň dvě vyplněné možnosti.';
                submitBtn.disabled = false;
                return;
            }
        }
        // --- KONEC UPRAVENÉ ČÁSTI ---

        try {
            const forumRef = db.collection('forum_categories').doc(categoryId).collection('fora').doc(forumId);
            
            // --- UPRAVENO: Uložení tématu a případně i ankety ---
            const newThreadRef = await forumRef.collection('temata').add(threadData);

            if (threadType === 'anketa') {
                const batch = db.batch();
                const optionsCollectionRef = newThreadRef.collection('moznosti');
                pollOptions.forEach(optionText => {
                    const optionDocRef = optionsCollectionRef.doc();
                    batch.set(optionDocRef, { text: optionText, pocetHlasu: 0 });
                });
                await batch.commit();
            }
            // --- KONEC UPRAVENÉ ČÁSTI ---

            await newThreadRef.collection('prispevky').add({
                obsah: content,
                autorId: user.uid,
                cas: firebase.firestore.FieldValue.serverTimestamp()
            });

            await db.runTransaction(async (transaction) => {
                const forumDoc = await transaction.get(forumRef);
                if (!forumDoc.exists) throw "Fórum neexistuje!";
                
                const newPocetTemat = (forumDoc.data().pocetTemat || 0) + 1;
                const newPocetPrispevku = (forumDoc.data().pocetPrispevku || 0) + 1;

                transaction.update(forumRef, { 
                    pocetTemat: newPocetTemat,
                    pocetPrispevku: newPocetPrispevku,
                    posledniAktivita: {
                        temaId: newThreadRef.id,
                        temaNazev: title,
                        autorId: user.uid,
                        cas: firebase.firestore.FieldValue.serverTimestamp(),
                    }
                });
            });

            const userRef = db.collection('users').doc(user.uid);
            await userRef.update({
                'forumStats.pocetTemat': firebase.firestore.FieldValue.increment(1)
            });

            window.location.href = `thread-view.html?cat=${categoryId}&forum=${forumId}&thread=${newThreadRef.id}`;

        } catch (error) {
            console.error('Chyba při vytváření tématu: ', error);
            errorMessage.textContent = 'Při zakládání tématu došlo k chybě. Zkuste to prosím znovu.';
            submitBtn.disabled = false;
        }
    });
});
