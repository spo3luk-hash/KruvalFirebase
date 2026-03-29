document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const adminQuizBtn = document.getElementById('admin-quiz-btn');
    const quizListContainer = document.getElementById('quiz-list-container');

    auth.onAuthStateChanged(async user => {
        if (user) {
            const userDoc = await db.collection('hraci').doc(user.uid).get();
            if (userDoc.exists && userDoc.data().admin === true) {
                adminQuizBtn.style.display = 'block';
                adminQuizBtn.onclick = () => window.location.href = 'sprava-kvizu.html';
            }

            // Načteme ID všech kvízů, které uživatel dokončil
            const userResultsSnapshot = await db.collection('vysledkyKvizu').where('userId', '==', user.uid).get();
            const completedQuizzes = new Set();
            userResultsSnapshot.forEach(doc => {
                completedQuizzes.add(doc.data().quizId);
            });

            loadQuizzes(completedQuizzes);
        } else {
            window.location.href = '/index.html';
        }
    });

    function loadQuizzes(completedQuizzes) {
        db.collection('kvizy').orderBy('nazev').get()
            .then(snapshot => {
                if (snapshot.empty) {
                    quizListContainer.innerHTML = '<p>Žádné kvízy zatím nejsou k dispozici. Zeptej se administrátorů, kdy nějaké přidají!</p>';
                    return;
                }

                let html = '';
                snapshot.forEach(doc => {
                    const quiz = doc.data();
                    const quizId = doc.id;
                    const isCompleted = completedQuizzes.has(quizId);

                    const difficultyMap = {
                        lehky: { text: 'Lehký', class: 'difficulty-lehky' },
                        stredni: { text: 'Střední', class: 'difficulty-stredni' },
                        tezky: { text: 'Těžký', class: 'difficulty-tezky' },
                        expertni: { text: 'Expertní', class: 'difficulty-expertni' }
                    };
                    const difficultyInfo = difficultyMap[quiz.obtiznost] || { text: quiz.obtiznost, class: '' };
                    
                    const badgeInfoHtml = quiz.odznakId ? `<div class="quiz-badge">🏆 Získáš odznak!</div>` : '';
                    
                    const buttonHtml = isCompleted
                        ? '<button class="start-quiz-btn completed" disabled>Dokončeno</button>'
                        : `<button class="start-quiz-btn" onclick="window.location.href='plneni-kvizu.html?id=${quizId}'">Spustit kvíz</button>`;

                    const cardClass = isCompleted ? 'quiz-card completed-card' : 'quiz-card';

                    html += `
                        <div class="${cardClass}">
                            <h2>${quiz.nazev}</h2>
                            ${badgeInfoHtml}
                            <p>${quiz.popis || 'Tento kvíz nemá žádný popis.'}</p>
                            <div class="quiz-meta">
                                <span class="quiz-difficulty ${difficultyInfo.class}">${difficultyInfo.text}</span>
                                <span>${quiz.casovyLimit ? quiz.casovyLimit + ' min' : 'Bez limitu'}</span>
                            </div>
                            ${buttonHtml}
                        </div>
                    `;
                });

                quizListContainer.innerHTML = html;
            })
            .catch(error => {
                console.error("Chyba při načítání kvízů: ", error);
                quizListContainer.innerHTML = '<p>Při načítání kvízů došlo k chybě. Zkuste to prosím později.</p>';
            });
    }
});