document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

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

    const initializeApp = () => {
        const form = document.getElementById('send-scroll-form');
        const characterSelect = document.getElementById('character-select');
        const senderSelect = document.getElementById('sender-select');
        const subjectInput = document.getElementById('scroll-subject');
        const contentInput = document.getElementById('scroll-content');
        const signatureInput = document.getElementById('scroll-signature');
        const sealSelect = document.getElementById('scroll-seal');
        const submitBtn = document.getElementById('submit-scroll-btn');

        const loadCharacters = async () => {
            characterSelect.innerHTML = '<option>Načítám postavy...</option>';
            try {
                const playersSnapshot = await db.collection('hraci').get();
                let options = [];
                for (const playerDoc of playersSnapshot.docs) {
                    const playerData = playerDoc.data();
                    const charactersSnapshot = await playerDoc.ref.collection('postavy').get();
                    if (!charactersSnapshot.empty) {
                        const playerName = playerData.herniNick || playerDoc.id;
                        charactersSnapshot.forEach(charDoc => {
                            const char = charDoc.data();
                            const characterPath = `hraci/${playerDoc.id}/postavy/${charDoc.id}`;
                            options.push({ 
                                text: `${char.jmeno} (${playerName})`, 
                                value: characterPath 
                            });
                        });
                    }
                }
                options.sort((a, b) => a.text.localeCompare(b.text));
                characterSelect.innerHTML = options.map(opt => `<option value="${opt.value}">${opt.text}</option>`).join('');
                
                if (window.initCustomSelect) {
                   document.querySelectorAll('.custom-select').forEach(sel => window.initCustomSelect(sel));
                }
            } catch (error) {
                console.error("Chyba při načítání postav: ", error);
                characterSelect.innerHTML = '<option>Nepodařilo se načíst postavy</option>';
            }
        };

        const handleFormSubmit = async (e) => {
            e.preventDefault();

            const recipientPath = characterSelect.value;
            const sender = senderSelect.value;
            const subject = subjectInput.value.trim();
            const content = contentInput.value.trim();
            const signature = signatureInput.value.trim() || null; // Uložíme null, pokud je prázdné
            const seal = sealSelect.value !== 'zadna' ? sealSelect.value : null; // Uložíme null, pokud je "Žádná"

            if (!recipientPath || !sender || !subject || !content) {
                alert('Příjemce, odesílatel, předmět a obsah jsou povinná pole!');
                return;
            }

            const confirmationText = 
                `Opravdu chcete odeslat svitek?\n\n` +
                `Příjemce: ${characterSelect.options[characterSelect.selectedIndex].text}\n` +
                `Odesílatel: ${sender}\n` +
                `Předmět: ${subject}\n` +
                `${signature ? `Podpis: ${signature}\n` : ''}` +
                `${seal ? `Pečeť: ${sealSelect.options[sealSelect.selectedIndex].text}\n` : ''}` +
                `\nTato akce je nevratná.`;

            if (!confirm(confirmationText)) {
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Odesílám...';

            try {
                await db.collection('posta').add({
                    prijemcePath: recipientPath,
                    odesilatel: sender,
                    odesilatelPath: null,
                    predmet: subject,
                    obsah: content,
                    podpis: signature,
                    pecet: seal,
                    casOdeslani: firebase.firestore.FieldValue.serverTimestamp(),
                    precteno: false,
                    typ: 'specialni_svitek'
                });

                alert('Speciální svitek byl úspěšně odeslán!');
                form.reset();
                signatureInput.value = '';
                if (window.initCustomSelect) {
                    document.querySelectorAll('.custom-select').forEach(sel => window.initCustomSelect(sel));
                }

            } catch (error) {
                console.error('Chyba při odesílání svitku:', error);
                alert('Došlo k chybě při odesílání. Zkuste to prosím znovu.');
            } finally {
                 submitBtn.disabled = false;
                 submitBtn.innerHTML = '<i class="fas fa-feather-alt"></i> Odeslat svitek';
            }
        };

        // Používáme 'click', protože form je nyní div
        submitBtn.addEventListener('click', handleFormSubmit);

        loadCharacters();
    };
});