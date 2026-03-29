document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    let currentUser = null;
    let characterId = null;
    let characterRef = null;

    const charNameInput = document.getElementById('char-name');
    const charPublicBioInput = document.getElementById('char-public-bio');
    const charPrivateNotesInput = document.getElementById('char-private-notes');
    const charStatusInput = document.getElementById('char-status'); 
    const saveBtn = document.getElementById('save-all-btn');
    const characterNameHeader = document.getElementById('character-name-header');
    
    const viewProfileBtn = document.getElementById('view-profile-btn');

    const avatarEditorBG = document.getElementById('avatar-editor-bg');
    const avatarUrlInput = document.getElementById('char-avatar-url');
    const avatarZoomSlider = document.getElementById('avatar-zoom-slider');
    const avatarPreview = document.getElementById('char-avatar-preview');
    const avatarInitial = document.getElementById('char-avatar-initial');

    let dragStartPosition = { x: 0, y: 0 };
    let currentBgPosition = { x: 0, y: 0 };
    let isDragging = false;

    const tabLinks = document.querySelectorAll('.tab-link');
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetTab = link.dataset.tab;
            tabLinks.forEach(l => l.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            link.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            const urlParams = new URLSearchParams(window.location.search);
            characterId = urlParams.get('id');

            if (!characterId) {
                alert("Nebylo specifikováno ID postavy.");
                window.location.href = 'uzivatelske-nastaveni.html';
                return;
            }
            
            characterRef = db.collection('hraci').doc(currentUser.uid).collection('postavy').doc(characterId);
            loadCharacterData();

        } else {
            window.location.href = 'index.html';
        }
    });

    const loadCharacterData = async () => {
        try {
            const doc = await characterRef.get();
            if (doc.exists) {
                const data = doc.data();
                characterNameHeader.textContent = data.jmeno || "Upravit postavu";
                charNameInput.value = data.jmeno || '';
                charPublicBioInput.value = data.verejnyPopis || '';
                charPrivateNotesInput.value = data.soukromePoznamky || '';
                charStatusInput.value = data.status || '';
                avatarUrlInput.value = data.avatar || '';

                updateAvatarDisplay(data.avatar, data.jmeno, data.avatarPosition, data.avatarZoom);
                generateProfileLink();

            } else {
                alert("Postava nenalezena.");
            }
        } catch (error) {
            console.error("Chyba při načítání postavy: ", error);
            alert("Došlo k chybě při načítání dat postavy.");
        }
    };
    
    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...';
        
        const newName = charNameInput.value.trim();
        if (!newName) {
            alert("Jméno postavy nesmí být prázdné.");
            resetSaveBtn();
            return;
        }

        try {
            await characterRef.update({
                jmeno: newName,
                verejnyPopis: charPublicBioInput.value.trim(),
                soukromePoznamky: charPrivateNotesInput.value.trim(),
                status: charStatusInput.value.trim(),
                avatar: avatarUrlInput.value.trim(),
                avatarPosition: currentBgPosition,
                avatarZoom: parseFloat(avatarZoomSlider.value)
            });
            alert("Změny byly úspěšně uloženy!");
            characterNameHeader.textContent = newName;
        } catch (error) {
            console.error("Chyba při ukládání: ", error);
            alert("Došlo k chybě při ukládání změn.");
        } finally {
            resetSaveBtn();
        }
    });

    function resetSaveBtn() {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Uložit vše';
    }

    function generateProfileLink() {
        if (characterId) {
            const link = `${window.location.origin}/profil-postavy.html?id=${characterId}`;
            viewProfileBtn.href = link;
        } else {
            viewProfileBtn.href = '#';
        }
    }

    avatarUrlInput.addEventListener('change', () => {
        const url = avatarUrlInput.value.trim();
        updateAvatarDisplay(url, charNameInput.value.trim(), {x: 0, y: 0}, 1);
    });

    function updateAvatarDisplay(url, name, position, zoom) {
        currentBgPosition = position || { x: 0, y: 0 };
        const aZoom = zoom || 1;

        if (url) {
            avatarEditorBG.style.backgroundImage = `url(${url})`;
            avatarEditorBG.style.backgroundSize = `${aZoom * 100}%`;
            avatarEditorBG.style.backgroundPosition = `${currentBgPosition.x}px ${currentBgPosition.y}px`;
            avatarPreview.style.backgroundImage = `url(${url})`;
            avatarPreview.style.backgroundSize = `${aZoom * 100}%`;
            avatarPreview.style.backgroundPosition = `${currentBgPosition.x}px ${currentBgPosition.y}px`;
            avatarInitial.style.display = 'none';
        } else {
            avatarEditorBG.style.backgroundImage = 'none';
            avatarPreview.style.backgroundImage = 'none';
            avatarInitial.textContent = name ? name.charAt(0).toUpperCase() : '?';
            avatarInitial.style.display = 'flex';
        }
        avatarZoomSlider.value = aZoom;
    }

    avatarZoomSlider.addEventListener('input', () => {
        const zoom = avatarZoomSlider.value;
        avatarEditorBG.style.backgroundSize = `${zoom * 100}%`;
        avatarPreview.style.backgroundSize = `${zoom * 100}%`;
        updateBgPosition();
    });

    avatarEditorBG.addEventListener('mousedown', (e) => {
        if (!avatarUrlInput.value) return;
        isDragging = true;
        dragStartPosition.x = e.clientX - currentBgPosition.x;
        dragStartPosition.y = e.clientY - currentBgPosition.y;
        avatarEditorBG.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            avatarEditorBG.style.cursor = 'grab';
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            currentBgPosition.x = e.clientX - dragStartPosition.x;
            currentBgPosition.y = e.clientY - dragStartPosition.y;
            updateBgPosition();
        }
    });

    function updateBgPosition() {
        avatarEditorBG.style.backgroundPosition = `${currentBgPosition.x}px ${currentBgPosition.y}px`;
        avatarPreview.style.backgroundPosition = `${currentBgPosition.x}px ${currentBgPosition.y}px`;
    }

});