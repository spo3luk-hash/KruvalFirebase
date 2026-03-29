document.addEventListener('DOMContentLoaded', () => {
    // --- Globální systém pro modální okna v Admin Centru ---

    /**
     * Vytvoří a zobrazí modální okno s daným titulkem a obsahem.
     * @param {string} title - Titulek, který se zobrazí v hlavičce okna.
     * @param {HTMLElement|string} content - HTML prvek nebo string, který se vloží do těla okna.
     * @param {Function} [onClose] - Volitelná funkce, která se zavolá po zavření okna.
     */
    window.openModal = (title, content, onClose) => {
        // Odstranění existujícího modálního okna, pokud existuje
        const existingOverlay = document.getElementById('modal-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // Vytvoření struktury modálního okna
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-overlay'; // Přidání ID pro snadnější manipulaci

        const modal = document.createElement('div');
        modal.className = 'modal-content';

        modal.innerHTML = `
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="modal-close-btn" title="Zavřít">&times;</button>
            </div>
            <div class="modal-body"></div>
        `;

        const modalBody = modal.querySelector('.modal-body');
        if (typeof content === 'string') {
            modalBody.innerHTML = content;
        } else {
            modalBody.appendChild(content);
        }

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Zobrazení s přechodem
        setTimeout(() => overlay.classList.add('visible'), 10);

        // --- Event Listeners ---
        const closeBtn = modal.querySelector('.modal-close-btn');

        // Funkce pro zavření modálního okna
        const closeModal = () => {
            overlay.classList.remove('visible');
            overlay.addEventListener('transitionend', () => {
                overlay.remove();
                if (onClose && typeof onClose === 'function') {
                    onClose();
                }
            }, { once: true });
        };

        closeBtn.addEventListener('click', closeModal);

        // Zavření kliknutím na pozadí
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });

        // Globální přístup k zavření
        window.closeCurrentModal = closeModal;
    };

    /**
     * Zobrazí modální okno s načítacím spinnerem.
     * @param {string} title - Titulek, který se zobrazí v hlavičce okna.
     * @returns {object} - Instance modálního okna s metodou pro aktualizaci obsahu.
     */
    window.openLoadingModal = (title) => {
        const loadingContent = '<div class="loading-spinner">Načítám data...</div>';
        window.openModal(title, loadingContent);

        return {
            /**
             * Aktualizuje obsah aktuálně otevřeného modálního okna.
             * @param {HTMLElement|string} newContent - Nový obsah pro tělo okna.
             */
            updateContent: (newContent) => {
                const modalBody = document.querySelector('#modal-overlay .modal-body');
                if (modalBody) {
                    if (typeof newContent === 'string') {
                        modalBody.innerHTML = newContent;
                    } else {
                        modalBody.innerHTML = ''; // Vyčistit před přidáním prvku
                        modalBody.appendChild(newContent);
                    }
                }
            }
        };
    };

    /**
     * Zobrazí potvrzovací modální okno ve stylu fantasy.
     * @param {string} title - Titulek okna (např. 'Opravdu smazat?').
     * @param {string} message - Zpráva pro uživatele.
     * @param {Function} onConfirm - Funkce, která se zavolá po kliknutí na "Potvrdit".
     */
    window.openConfirmationModal = (title, message, onConfirm) => {
        const confirmationContent = document.createElement('div');
        confirmationContent.className = 'confirmation-modal-content';

        confirmationContent.innerHTML = `
            <p>${message}</p>
            <div class="confirmation-buttons">
                <button class="confirm-btn">Potvrdit</button>
                <button class="cancel-btn-modal">Zrušit</button>
            </div>
        `;

        const confirmBtn = confirmationContent.querySelector('.confirm-btn');
        const cancelBtn = confirmationContent.querySelector('.cancel-btn-modal');

        // Otevřít modální okno bez standardního zavíracího křížku v hlavičce
        window.openModal(title, confirmationContent);

        confirmBtn.addEventListener('click', () => {
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
            window.closeCurrentModal(); // Zavřít okno po potvrzení
        });

        cancelBtn.addEventListener('click', () => {
            window.closeCurrentModal(); // Zavřít okno při zrušení
        });
    };
});
