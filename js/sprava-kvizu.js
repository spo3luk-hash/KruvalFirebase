document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- UI prvky ---
    const quizListContainer = document.getElementById('quiz-admin-list-container');
    const addQuizBtn = document.getElementById('add-quiz-btn');
    const modal = document.getElementById('quiz-modal');
    const closeModalBtn = document.querySelector('.close-button');
    const quizForm = document.getElementById('quiz-form');
    const modalTitle = document.getElementById('modal-title');
    const hiddenQuizId = document.getElementById('quiz-id');
    const quizNameInput = document.getElementById('quiz-name');
    const quizDescriptionInput = document.getElementById('quiz-description');
    const quizDifficultyInput = document.getElementById('quiz-difficulty');
    const quizTimeLimitInput = document.getElementById('quiz-time-limit');
    const quizBadgeUrlInput = document.getElementById('quiz-badge-url');

    // --- Kontrola administrátorských práv ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            const userDoc = await db.collection('hraci').doc(user.uid).get();
            if (!userDoc.exists || userDoc.data().admin !== true) {
                // Pokud uživatel není admin, přesměrujeme ho pryč
                alert('Přístup odepřen. Tato stránka je pouze pro administrátory.');
                window.location.href = '/kvizova-mistnost.html';
            } else {
                // Uživatel je admin, načteme kvízy
                loadQuizzesForAdmin();
            }
        } else {
            window.location.href = '/index.html';
        }
    });

    // --- Načtení a zobrazení kvízů v tabulce ---
    function loadQuizzesForAdmin() {
        db.collection('kvizy').orderBy('nazev').onSnapshot(snapshot => {
            if (snapshot.empty) {
                quizListContainer.innerHTML = '<p>Zatím nebyly vytvořeny žádné kvízy.</p>';
                return;
            }
            let tableHtml = '<table class="quiz-admin-table"><thead><tr><th>Název</th><th>Obtížnost</th><th>Časový limit</th><th>Akce</th></tr></thead><tbody>';
            snapshot.forEach(doc => {
                const quiz = doc.data();
                const quizId = doc.id;
                tableHtml += `
                    <tr>
                        <td>${quiz.nazev}</td>
                        <td>${quiz.obtiznost}</td>
                        <td>${quiz.casovyLimit ? quiz.casovyLimit + ' min' : 'Bez limitu'}</td>
                        <td class="action-buttons">
                            <button class="manage-questions-btn" data-id="${quizId}">Otázky</button>
                            <button class="edit-quiz-btn" data-id="${quizId}">Upravit</button>
                            <button class="delete-quiz-btn" data-id="${quizId}">Smazat</button>
                        </td>
                    </tr>
                `;
            });
            tableHtml += '</tbody></table>';
            quizListContainer.innerHTML = tableHtml;
            addTableEventListeners();
        }, error => {
            console.error("Chyba při načítání kvízů pro adminy: ", error);
            quizListContainer.innerHTML = '<p>Došlo k chybě při načítání dat.</p>';
        });
    }

    // --- Přidání event listenerů na tlačítka v tabulce ---
    function addTableEventListeners() {
        document.querySelectorAll('.manage-questions-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const quizId = e.target.dataset.id;
                window.location.href = `editor-otazek.html?id=${quizId}`;
            });
        });
        document.querySelectorAll('.edit-quiz-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleEdit(e.target.dataset.id));
        });
        document.querySelectorAll('.delete-quiz-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleDelete(e.target.dataset.id));
        });
    }

    // --- Ovládání modálního okna ---
    addQuizBtn.addEventListener('click', () => {
        quizForm.reset();
        hiddenQuizId.value = '';
        modalTitle.textContent = 'Vytvořit nový kvíz';
        modal.style.display = 'block';
    });

    closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // --- Zpracování formuláře (vytvoření/úprava) ---
    quizForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = hiddenQuizId.value;
        const quizData = {
            nazev: quizNameInput.value,
            popis: quizDescriptionInput.value,
            obtiznost: quizDifficultyInput.value,
            casovyLimit: parseInt(quizTimeLimitInput.value, 10) || 0,
            odznakUrl: quizBadgeUrlInput.value.trim()
        };

        if (id) {
            // Update
            await db.collection('kvizy').doc(id).update(quizData);
        } else {
            // Create
            await db.collection('kvizy').add(quizData);
        }
        modal.style.display = 'none';
    });

    // --- Funkce pro úpravu a smazání ---
    async function handleEdit(id) {
        const doc = await db.collection('kvizy').doc(id).get();
        if (doc.exists) {
            const quiz = doc.data();
            hiddenQuizId.value = id;
            quizNameInput.value = quiz.nazev;
            quizDescriptionInput.value = quiz.popis;
            quizDifficultyInput.value = quiz.obtiznost;
            quizTimeLimitInput.value = quiz.casovyLimit;
            quizBadgeUrlInput.value = quiz.odznakUrl || '';
            modalTitle.textContent = 'Upravit kvíz';
            modal.style.display = 'block';
        }
    }

    async function handleDelete(id) {
        if (confirm('Opravdu si přejete smazat tento kvíz? Tímto krokem smažete i VŠECHNY jeho otázky!')) {
             // Nejdříve smažeme všechny otázky v subkolekci
            const questionsSnapshot = await db.collection('kvizy').doc(id).collection('otazky').get();
            const batch = db.batch();
            questionsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            // Poté smažeme samotný kvíz
            await db.collection('kvizy').doc(id).delete();
        }
    }
});
