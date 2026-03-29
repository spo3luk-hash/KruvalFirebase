/**
 * editor-forum.js
 * Poskytuje funkce pro inicializaci a správu editoru zpráv na fóru.
 * Zahrnuje formátování textu a dynamické přidávání nástrojů.
 */

function initializeEditor(elementId, options = {}) {
    const editor = document.getElementById(elementId);
    if (!editor) {
        console.error(`Editor element with id '${elementId}' not found.`);
        return;
    }

    const editorWrapper = editor.closest('#editor-wrapper');
    if (!editorWrapper) {
        console.error(`Editor wrapper for '${elementId}' not found.`);
        return;
    }

    const toolbar = editorWrapper.querySelector('.editor-toolbar');
    if (!toolbar) {
        console.error(`Toolbar for editor '${elementId}' not found.`);
        return;
    }

    // --- DEFINICE ZÁKLADNÍCH NÁSTROJŮ ---
    const tools = [
        { name: 'bold', icon: '<b>B</b>', command: 'bold', title: 'Tučné' },
        { name: 'italic', icon: '<i>I</i>', command: 'italic', title: 'Kurzíva' },
        { name: 'underline', icon: '<u>U</u>', command: 'underline', title: 'Podtržené' },
        { name: 'strikeThrough', icon: '<strike>S</strike>', command: 'strikeThrough', title: 'Přeškrtnuté' },
        { name: 'removeFormat', icon: '&#128473;', command: 'removeFormat', title: 'Odstranit formátování' }
    ];
    
    // --- VYMAZÁNÍ A ZNOVU-SESTAVENÍ LIŠTY ---
    toolbar.innerHTML = '';

    // --- VYTVOŘENÍ ZÁKLADNÍCH TLAČÍTEK ---
    tools.forEach(tool => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'editor-button';
        button.innerHTML = tool.icon;
        button.title = tool.title;
        button.addEventListener('click', (e) => {
            e.preventDefault();
            document.execCommand(tool.command, false, null);
            editor.focus();
        });
        toolbar.appendChild(button);
    });

    // --- DYNAMICKÉ PŘIDÁNÍ IKONY PRO PŘÍMÝ VZKAZ (MENTION) ---
    if (options.enableMentions) {
        const mentionButton = document.createElement('button');
        mentionButton.type = 'button';
        mentionButton.id = 'mention-trigger'; // ID pro navázání existující logiky
        mentionButton.className = 'editor-button';
        mentionButton.title = 'Přímý vzkaz';
        mentionButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
        // Event listener se na toto tlačítko naváže externě v `zobrazeni-skupinove-zpravy.js`
        toolbar.appendChild(mentionButton);
    }

    // --- PLACEHOLDER --- 
    editor.addEventListener('focus', () => {
        if (editor.textContent.trim() === editor.dataset.placeholder) {
            editor.innerHTML = '';
            editor.classList.remove('is-placeholder');
        }
    });

    editor.addEventListener('blur', () => {
        if (!editor.textContent.trim()) {
            editor.innerHTML = editor.dataset.placeholder;
            editor.classList.add('is-placeholder');
        }
    });

    // Inicializace stavu placeholderu
    if (!editor.textContent.trim() || editor.innerHTML === editor.dataset.placeholder) {
        editor.innerHTML = editor.dataset.placeholder;
        editor.classList.add('is-placeholder');
    } else {
        editor.classList.remove('is-placeholder');
    }

    // --- ZPRACOVÁNÍ VLOŽENÍ TEXTU ---
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.originalEvent || e).clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    });
}
