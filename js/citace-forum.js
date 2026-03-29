/**
 * citace-forum.js
 * Modul pro zpracování citací na fóru.
 * Spolupracuje s modulem editoru (Kruval.forumEditor) pro vkládání citací.
 */

window.Kruval = window.Kruval || {};
window.Kruval.quoteSystem = (function() {

    /**
     * Inicializuje modul citací.
     */
    function initialize() {
        // Změna: Odebrán třetí parametr 'true', vracíme se ke standardnímu "bubbling" eventu.
        document.body.addEventListener('click', handleQuoteClick);
    }

    /**
     * Zpracovává kliknutí na tlačítko citace.
     * @param {Event} e - Událost kliknutí.
     */
    function handleQuoteClick(e) {
        const quoteButton = e.target.closest('.quote-post-btn');
        if (!quoteButton) return;
        
        // Stále je důležité zastavit výchozí akci (např. skok na #) a další šíření, aby se zabránilo dvojitému spuštění.
        e.preventDefault();
        e.stopPropagation(); 

        const postId = quoteButton.dataset.postId;
        const authorName = quoteButton.dataset.authorName;
        
        if (!window.Kruval.forumEditor || !window.Kruval.forumAdmin.showAlert) {
             console.error('Editor pro fórum nebo systém alertů není dostupný.');
            return;
        }

        if (!postId || !authorName) {
            console.error('Chyba: Chybí ID příspěvku nebo jméno autora.');
            return;
        }

        const postContentElement = document.querySelector(`.post-content[data-post-id='${postId}']`);
        
        if (postContentElement && postContentElement.querySelector('blockquote')) {
            window.Kruval.forumAdmin.showAlert('Příspěvky, které již obsahují citaci, nelze znovu citovat.', 'warning');
            return;
        }
        
        if (!postContentElement || !postContentElement.dataset.rawContent) {
            console.error(`Chyba: Nepodařilo se najít syrový obsah příspěvku s ID ${postId}.`);
            return;
        }

        const rawContent = postContentElement.dataset.rawContent.trim();

        window.Kruval.forumEditor.insertQuote(authorName, rawContent);
        
        const editorElement = document.getElementById('kruval-editor');
        if(editorElement) {
            editorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(editorElement);
            range.collapse(false); 
            sel.removeAllRanges();
            sel.addRange(range);
            editorElement.focus();
        }
    }

    // Veřejné API modulu
    return {
        initialize: initialize
    };

})();
