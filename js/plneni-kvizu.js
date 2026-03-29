document.addEventListener('DOMContentLoaded', async () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- UI Prvky ---
    const quizTitle = document.getElementById('quiz-title');
    const quizTimer = document.getElementById('quiz-timer');
    const quizMainContent = document.getElementById('quiz-main-content');
    const loadingIndicator = document.getElementById('loading-indicator');
    const progressIndicator = document.getElementById('progress-indicator');
    const questionText = document.getElementById('question-text');
    const answersArea = document.getElementById('answers-area');
    const nextQuestionBtn = document.getElementById('next-question-btn');

    // --- Stavové proměnné hry ---
    let quizId = null;
    let currentUser = null;
    let questions = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let userAnswers = [];
    let timerInterval = null;

    // --- Inicializace --- 
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            const urlParams = new URLSearchParams(window.location.search);
            quizId = urlParams.get('id');
            if (quizId) {
                initializeQuiz();
            } else {
                alert('Chybí ID kvízu!');
                window.location.href = 'kvizova-mistnost.html';
            }
        } else {
            window.location.href = '/index.html';
        }
    });

    async function initializeQuiz() {
        try {
            const quizDoc = await db.collection('kvizy').doc(quizId).get();
            if (!quizDoc.exists) {
                alert('Kvíz nenalezen.'); return;
            }
            const quizData = quizDoc.data();
            quizTitle.textContent = quizData.nazev;

            const questionsSnapshot = await db.collection('kvizy').doc(quizId).collection('otazky').get();
            questions = questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            if(questions.length === 0) {
                alert('Tento kvíz zatím neobsahuje žádné otázky.');
                window.location.href = 'kvizova-mistnost.html';
                return;
            }

            // Náhodně zamíchat otázky
            questions.sort(() => Math.random() - 0.5);

            loadingIndicator.style.display = 'none';
            quizMainContent.style.display = 'block';

            if (quizData.casovyLimit > 0) {
                startTimer(quizData.casovyLimit * 60);
            }

            displayQuestion();
        } catch (error) {
            console.error("Chyba při inicializaci kvízu: ", error);
        }
    }

    function displayQuestion() {
        if (currentQuestionIndex >= questions.length) {
            endQuiz();
            return;
        }

        nextQuestionBtn.disabled = true;
        const question = questions[currentQuestionIndex];
        progressIndicator.textContent = `Otázka ${currentQuestionIndex + 1} z ${questions.length}`;
        questionText.textContent = question.text;
        answersArea.innerHTML = '';

        // Náhodně zamíchat odpovědi
        const shuffledAnswers = [...question.answers].sort(() => Math.random() - 0.5);

        shuffledAnswers.forEach((answer, index) => {
            const answerBtn = document.createElement('button');
            answerBtn.className = 'answer-btn';
            answerBtn.textContent = answer.text;
            answerBtn.dataset.correct = answer.correct; // Uložíme si, zda je správná
            answerBtn.addEventListener('click', () => selectAnswer(answerBtn, shuffledAnswers));
            answersArea.appendChild(answerBtn);
        });

        nextQuestionBtn.textContent = (currentQuestionIndex === questions.length - 1) ? 'Dokončit kvíz' : 'Další otázka';
    }

    function selectAnswer(selectedBtn, answers) {
        // Zrušit předchozí výběr, pokud existuje
        document.querySelectorAll('.answer-btn.selected').forEach(btn => btn.classList.remove('selected'));
        // Označit nový výběr
        selectedBtn.classList.add('selected');
        nextQuestionBtn.disabled = false;
    }

    nextQuestionBtn.addEventListener('click', () => {
        const selectedBtn = answersArea.querySelector('.answer-btn.selected');
        if (!selectedBtn) return;

        const isCorrect = selectedBtn.dataset.correct === 'true';
        userAnswers.push({ questionId: questions[currentQuestionIndex].id, correct: isCorrect });
        if (isCorrect) {
            score++;
            selectedBtn.classList.add('correct');
        } else {
            selectedBtn.classList.add('incorrect');
            // Zvýrazníme i správnou odpověď
            const correctBtn = answersArea.querySelector('.answer-btn[data-correct="true"]');
            if(correctBtn) correctBtn.classList.add('correct');
        }
        
        // Znemožnit další klikání
        document.querySelectorAll('.answer-btn').forEach(btn => btn.disabled = true);
        nextQuestionBtn.disabled = true;

        setTimeout(() => {
            currentQuestionIndex++;
            displayQuestion();
        }, 1500); // 1.5 sekundy na zobrazení výsledku
    });

    function startTimer(duration) {
        let timeLeft = duration;
        timerInterval = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60);
            let seconds = timeLeft % 60;
            seconds = seconds < 10 ? '0' + seconds : seconds;
            quizTimer.textContent = `${minutes}:${seconds}`;
            
            if (--timeLeft < 0) {
                clearInterval(timerInterval);
                alert('Čas vypršel!');
                endQuiz();
            }
        }, 1000);
    }

    function endQuiz() {
        clearInterval(timerInterval);
        // Uložíme výsledek a přesměrujeme
        const result = {
            score: score,
            totalQuestions: questions.length,
            characterId: localStorage.getItem('characterId') // Důležité pro uložení odznaku
        };

        // Uložíme výsledek do session storage pro zobrazení na další stránce
        sessionStorage.setItem('quizResult', JSON.stringify(result));
        window.location.href = `vysledky-kvizu.html?id=${quizId}`;
    }
});
