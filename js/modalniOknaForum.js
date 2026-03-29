/**
 * modalniOknaForum.js
 * Tento soubor obsahuje veškerou logiku pro vytváření a správu modálních oken a alertů pro správu fóra.
 */

// Vytvoření bezpečného jmenného prostoru
window.Kruval = window.Kruval || {};
window.Kruval.forumAdmin = window.Kruval.forumAdmin || {};

let modalOverlay = null;

// --- INICIALIZACE ---
function initializeModal() {
    if (document.getElementById('kruval-modal-overlay')) return;

    modalOverlay = document.createElement('div');
    modalOverlay.id = 'kruval-modal-overlay';
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.display = 'none'; // OPRAVA: Překryv je na začátku skrytý
    document.body.appendChild(modalOverlay);

    modalOverlay.addEventListener('click', (e) => {
        if (e.target.id === 'kruval-modal-overlay') {
            closeModal();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay && modalOverlay.style.display === 'flex') {
            closeModal();
        }
    });
}
document.addEventListener('DOMContentLoaded', initializeModal);


// --- ZÁKLADNÍ MODÁLNÍ OKNA ---

/**
 * Zobrazí modální okno s libovolným HTML obsahem.
 * @param {string} htmlContent - HTML obsah, který se má zobrazit.
 */
function showModal(htmlContent) {
    if (!modalOverlay) initializeModal();
    
    modalOverlay.innerHTML = `<div class="modal-content">${htmlContent}</div>`;
    modalOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

/**
 * Zavře aktuálně otevřené modální okno.
 */
function closeModal() {
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
        modalOverlay.innerHTML = '';
    }
    document.body.style.overflow = 'auto';
};

// --- SPECIFICKÉ DIALOGY ---

/**
 * Zobrazí jednoduchý alert s vlastní zprávou.
 * @param {string} zprava - Zpráva k zobrazení.
 * @param {string} [typ='info'] - Typ alertu ('info', 'success', 'error', 'warning').
 */
function showAlert(zprava, typ = 'info') {
    const alertContent = `
        <div class="alert-box ${typ}">
            <p>${zprava}</p>
            <button class="admin-button" id="alert-close-btn">Rozumím</button>
        </div>
    `;
    showModal(alertContent);
    document.getElementById('alert-close-btn').onclick = closeModal;
    document.getElementById('alert-close-btn').focus();
}

/**
 * Zobrazí potvrzovací dialog s volitelným inputem.
 * @returns {Promise<void>}
 */
function showConfirmation({ title, text, requiredInput = null }) {
    return new Promise((resolve, reject) => {
        const inputHtml = requiredInput ? `
            <div class="form-group" style="margin-top: 1rem;">
                <label>Pro potvrzení napište "${requiredInput}"</label>
                <input type="text" id="confirm-modal-input" autocomplete="off">
                <div id="modal-error-container" class="modal-error-message"></div>
            </div>` : '';

        const confirmationContent = `
            <h3>${title}</h3>
            <p>${text}</p>
            ${inputHtml}
            <div class="modal-actions">
                <button id="confirm-modal-btn" class="admin-button-danger">Potvrdit</button>
                <button id="cancel-confirm-btn" class="admin-button-secondary" type="button">Zrušit</button>
            </div>
        `;

        showModal(confirmationContent);

        const confirmBtn = document.getElementById('confirm-modal-btn');
        const cancelBtn = document.getElementById('cancel-confirm-btn');
        const confirmInput = document.getElementById('confirm-modal-input');
        const errorContainer = document.getElementById('modal-error-container');
        
        confirmInput?.focus();

        const onConfirm = () => {
             if (requiredInput) {
                if (confirmInput.value.trim() === requiredInput) {
                    resolve();
                    closeModal();
                } else {
                    if(errorContainer) errorContainer.textContent = 'Zadaný text se neshoduje.';
                    confirmInput.focus();
                }
            } else {
                resolve();
                closeModal();
            }
        };

        const onCancel = () => {
            closeModal();
            reject('Uživatel zrušil akci');
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    });
};

// --- PŘIPOJENÍ DO JMENNÉHO PROSTORU ---
Kruval.forumAdmin.showModal = showModal;
Kruval.forumAdmin.closeModal = closeModal;
Kruval.forumAdmin.showAlert = showAlert;
Kruval.forumAdmin.showConfirmation = showConfirmation;
