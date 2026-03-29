
document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- Elementy pro vzhled ---
    const avatarUrlInput = document.getElementById('avatar-url-input');
    const frameSelectionGrid = document.getElementById('frame-selection-grid');
    const avatarImagePreview = document.getElementById('avatar-image-preview');
    const avatarInitialPreview = document.getElementById('avatar-initial-preview');
    const framePreview = document.getElementById('avatar-frame-preview');

    // --- Elementy pro správu účtu ---
    const nicknameInput = document.getElementById('nickname-input');
    const birthdateInput = document.getElementById('birthdate-input');
    const newPasswordInput = document.getElementById('new-password-input');
    const confirmPasswordInput = document.getElementById('confirm-password-input');
    const saveNicknameBtn = document.getElementById('save-nickname-btn');
    const saveBirthdateBtn = document.getElementById('save-birthdate-btn');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const viewProfileBtn = document.getElementById('view-profile-btn');

    // --- Elementy pro správu postav ---
    const characterListContainer = document.getElementById('character-list-container');

    let currentUser = null;
    let selectedFrameId = null;

    // --- Datová struktura pro rámečky ---
    const frameData = [
        { id: 'frame-1', name: 'Stříbrný' },
        { id: 'frame-7', name: 'Ledový' },
        { id: 'frame-10', name: 'Oranžový' },
        { id: 'frame-17', name: 'Pulzující fialová' },
        { id: 'frame-19', name: 'Zelený přerušovaný' },
        { id: 'frame-20', name: 'Oranžový kruh' },
        { id: 'frame-50', name: 'Éterický Dech' },
        { id: 'frame-51', name: 'Magmatické Jádro' },
        { id: 'frame-52', name: 'Runový Kruh' },
        { id: 'frame-53', name: 'Mrazivá Aura' },
        { id: 'frame-54', name: 'Galaktický Vír' }
    ];

    // --- Inicializace ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            populateFrameSelection();
            await loadAndDisplayInitialData(user.uid);
            await loadAndDisplayCharacters(user.uid); // Načtení postav
        } else {
            window.location.href = 'index.html';
        }
    });

    // --- Debounce function ---
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    // --- Funkce pro uložení URL avatara ---
    const saveAvatarUrl = async (newAvatarUrl) => {
        if (!currentUser) return;
        try {
            const userRef = db.collection('hraci').doc(currentUser.uid);
            await userRef.update({ avatarUrl: newAvatarUrl });
        } catch (error) {
            console.error("Chyba při ukládání URL avatara: ", error);
        }
    };
    
    const debouncedSaveAvatarUrl = debounce(saveAvatarUrl, 1000);

    // --- Změna URL avatara ---
    avatarUrlInput.addEventListener('input', () => {
        const newAvatarUrl = avatarUrlInput.value.trim();
        if (newAvatarUrl) {
            avatarImagePreview.style.backgroundImage = `url('${newAvatarUrl}')`;
            avatarInitialPreview.style.display = 'none';
            debouncedSaveAvatarUrl(newAvatarUrl);
        } else {
            avatarImagePreview.style.backgroundImage = 'none';
            avatarInitialPreview.style.display = 'flex';
        }
    });

    // --- HLAVNÍ FUNKCE PRO NAČTENÍ DAT ---
    async function loadAndDisplayInitialData(userId) {
        try {
            const userDoc = await db.collection('hraci').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                await zobrazAvatarHrace(userId, avatarImagePreview, framePreview);

                avatarUrlInput.value = userData.avatarUrl || '';
                birthdateInput.value = userData.birthdate || '';
                
                const frameExists = frameData.some(frame => frame.id === userData.frameCssClass);
                selectedFrameId = frameExists ? userData.frameCssClass : (frameData.length > 0 ? frameData[0].id : null);

                nicknameInput.value = userData.herniNick || '';
                updateFrameSelectionUI();

                const event = new Event('input');
                avatarUrlInput.dispatchEvent(event);
            }
        } catch (error) {
            console.error("Chyba při načítání dat uživatele: ", error);
        }
    }

    // --- FUNKCE PRO VÝBĚR RÁMEČKŮ ---
    function populateFrameSelection() {
        frameSelectionGrid.innerHTML = '';
        frameData.forEach(frame => {
            const wrapper = document.createElement('div');
            wrapper.classList.add('frame-choice-wrapper');
            const frameDiv = document.createElement('div');
            frameDiv.classList.add('frame-item', frame.id);
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('frame-name');
            nameSpan.textContent = frame.name;

            wrapper.appendChild(frameDiv);
            wrapper.appendChild(nameSpan);
            wrapper.addEventListener('click', () => {
                selectedFrameId = frame.id;
                updateFramePreview();
                updateFrameSelectionUI();
                saveFrameSelection();
            });
            wrapper.dataset.frameId = frame.id;
            frameSelectionGrid.appendChild(wrapper);
        });
    }

    async function saveFrameSelection() {
        if (!currentUser) return;
        try {
            const userRef = db.collection('hraci').doc(currentUser.uid);
            await userRef.update({ frameCssClass: selectedFrameId });
        } catch (error) {
            console.error("Chyba při ukládání rámečku: ", error);
        }
    }

    function updateFramePreview() {
        framePreview.className = 'avatar-frame'; // Reset
        if (selectedFrameId) framePreview.classList.add(selectedFrameId);
    }

    function updateFrameSelectionUI() {
        frameSelectionGrid.querySelectorAll('.frame-choice-wrapper').forEach(wrapper => {
            wrapper.classList.toggle('selected', wrapper.dataset.frameId === selectedFrameId);
        });
        updateFramePreview();
    }

    // --- SPRÁVA ÚČTU ---
    viewProfileBtn.addEventListener('click', () => {
        if (currentUser) {
            window.open(`profil-hrace.html?id=${currentUser.uid}`, '_blank');
        }
    });

    saveNicknameBtn.addEventListener('click', async () => {
        if (!currentUser) return window.openModal('Chyba', 'Uživatel nenalezen.');
        const newName = nicknameInput.value.trim();
        if (newName.length < 3) return window.openModal('Chyba', 'Jméno musí mít alespoň 3 znaky.');

        setButtonLoading(saveNicknameBtn, true, 'Měním...');
        try {
            await db.collection('hraci').doc(currentUser.uid).update({ herniNick: newName });
            window.openModal('Úspěch', 'Jméno bylo úspěšně změněno!');
        } catch (error) {
            window.openModal('Chyba', `Chyba při změně jména: ${error.message}`);
        } finally {
            setButtonLoading(saveNicknameBtn, false, 'Změnit');
        }
    });

    saveBirthdateBtn.addEventListener('click', async () => {
        if (!currentUser) return window.openModal('Chyba', 'Uživatel nenalezen.');
        const birthdate = birthdateInput.value;
        if (!birthdate) return window.openModal('Chyba', 'Vyberte prosím platné datum.');

        setButtonLoading(saveBirthdateBtn, true, 'Ukládám...');
        try {
            await db.collection('hraci').doc(currentUser.uid).update({ birthdate: birthdate });
            window.openModal('Úspěch', 'Datum narození bylo úspěšně uloženo!');
        } catch (error) {
            window.openModal('Chyba', `Chyba při ukládání data narození: ${error.message}`);
        } finally {
            setButtonLoading(saveBirthdateBtn, false, 'Uložit datum');
        }
    });

    changePasswordBtn.addEventListener('click', () => {
        if (!currentUser) return;
        const newPassword = newPasswordInput.value;
        if (newPassword.length < 6) return window.openModal('Chyba', 'Heslo musí mít alespoň 6 znaků.');
        if (newPassword !== confirmPasswordInput.value) return window.openModal('Chyba', 'Hesla se neshodují.');

        const originalText = changePasswordBtn.textContent;
        setButtonLoading(changePasswordBtn, true, 'Měním...');
        currentUser.updatePassword(newPassword)
            .then(() => {
                window.openModal('Úspěch', 'Heslo bylo úspěšně změněno!');
                newPasswordInput.value = '';
                confirmPasswordInput.value = '';
            })
            .catch(err => window.openModal('Chyba', `Chyba: ${err.message}. Může být vyžadováno nedávné přihlášení.`))
            .finally(() => setButtonLoading(changePasswordBtn, false, originalText));
    });

    function setButtonLoading(button, isLoading, loadingText = 'Ukládám...') {
        const originalHtml = button.dataset.originalText || button.innerHTML;
        if (isLoading) {
            if (!button.dataset.originalText) button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
            button.disabled = true;
        } else {
            button.innerHTML = originalHtml;
            button.disabled = false;
        }
    }

    // --- SPRÁVA POSTAV (OPRAVENO) ---
    async function getCharacters(userId) {
        const characters = [];
        try {
            const querySnapshot = await db.collection('hraci').doc(userId).collection('postavy').get();
            querySnapshot.forEach((doc) => {
                characters.push({ id: doc.id, ...doc.data() });
            });
        } catch (error) {
            console.error("Error getting characters: ", error);
        }
        return characters;
    }

    function displayCharacters(characters) {
        characterListContainer.innerHTML = ''; // Vyčistit

        if (characters.length === 0) {
            characterListContainer.innerHTML = '<p>Zatím nemáte vytvořené žádné postavy.</p>';
            return;
        }

        const puvodTextMap = {
            cistokrevny: "Čistokrevný",
            smiseny: "Smíšený původ",
            mudlovsky: "Z mudlovské rodiny"
        };

        characters.forEach(char => {
            const charCard = document.createElement('div');
            charCard.classList.add('character-card');

            const avatar = document.createElement('div');
            avatar.classList.add('character-avatar');
            if (char.avatar) {
                avatar.style.backgroundImage = `url('${char.avatar}')`;
            } else {
                avatar.textContent = char.jmeno ? char.jmeno.charAt(0).toUpperCase() : '?';
            }

            const name = document.createElement('div');
            name.classList.add('character-name');
            name.textContent = char.jmeno || 'Bezejmenná postava';

            const info = document.createElement('div');
            info.classList.add('character-info');
            info.textContent = puvodTextMap[char.puvod] || "Neznámý původ";

            const actions = document.createElement('div');
            actions.classList.add('character-actions');

            const editButton = document.createElement('button');
            editButton.classList.add('btn');
            editButton.textContent = 'Upravit';
            editButton.onclick = () => {
                window.location.href = `postava-upravit.html?charId=${char.id}`;
            };

            const deleteButton = document.createElement('button');
            deleteButton.classList.add('btn');
            deleteButton.textContent = 'Smazat';
            deleteButton.onclick = () => {
                window.openConfirmationModal(
                    `Smazat postavu ${char.jmeno}`,
                    'Opravdu si přejete trvale smazat tuto postavu? Tuto akci nelze vrátit zpět.',
                    async () => {
                        try {
                            await db.collection('hraci').doc(currentUser.uid).collection('postavy').doc(char.id).delete();
                            charCard.remove();
                            window.openModal('Postava smazána', 'Postava byla úspěšně odstraněna z vašeho účtu.');
                        } catch (error) {
                            console.error("Chyba při mazání postavy: ", error);
                            window.openModal('Chyba', 'Došlo k chybě při mazání postavy. Zkuste to prosím znovu.');
                        }
                    }
                );
            };
            
            actions.appendChild(editButton);
            actions.appendChild(deleteButton);

            charCard.appendChild(avatar);
            charCard.appendChild(name);
            charCard.appendChild(info);
            charCard.appendChild(actions);

            characterListContainer.appendChild(charCard);
        });
    }

    async function loadAndDisplayCharacters(userId) {
        const characters = await getCharacters(userId);
        displayCharacters(characters);
    }
});
