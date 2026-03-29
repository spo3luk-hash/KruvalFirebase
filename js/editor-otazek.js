document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- UI a stavové prvky ---
    const quizNameHeader = document.getElementById('quiz-name-header');
    const questionForm = document.getElementById('question-form');
    const hiddenQuestionId = document.getElementById('question-id');
    const questionText = document.getElementById('question-text');
    const answersContainer = document.getElementById('answers-container');
    const addAnswerBtn = document.getElementById('add-answer-btn');
    const questionListContainer = document.getElementById('question-list-container');

    let quizId = null;
    let quizRef = null;

    // --- Inicializace --- 
    const urlParams = new URLSearchParams(window.location.search);
    quizId = urlParams.get('id');

    if (!quizId) {
        alert('Nebylo zadáno ID kvízu.');
        window.location.href = '/sprava-kvizu.html';
        return;
    }

    quizRef = db.collection('kvizy').doc(quizId);

    auth.onAuthStateChanged(async user => {
        if (user) {
            const userDoc = await db.collection('hraci').doc(user.uid).get();
            if (!userDoc.exists || userDoc.data().admin !== true) {
                alert('Přístup odepřen.');
                window.location.href = '/index.html';
            } else {
                loadQuizDetailsAndQuestions();
            }
        } else {
            window.location.href = '/index.html';
        }
    });

    async function loadQuizDetailsAndQuestions() {
        try {
            const doc = await quizRef.get();
            if (doc.exists) {
                quizNameHeader.textContent = `Editor Otázek pro: ${doc.data().nazev}`;
                listenForQuestions();
            } else {
                alert('Kvíz s tímto ID neexistuje.');
                window.location.href = '/sprava-kvizu.html';
            }
        } catch (error) {
            console.error("Chyba při načítání detailů kvízu: ", error);
        }
    }

    // --- Dynamické přidávání odpovědí ---
    let answerCount = 2;
    addAnswerBtn.addEventListener('click', () => {
        answerCount++;
        const newAnswerGroup = document.createElement('div');
        newAnswerGroup.className = 'answer-input-group';
        newAnswerGroup.innerHTML = `
            <input type="text" placeholder="Text odpovědi ${answerCount}" class="answer-text" required>
            <label><input type="radio" name="correct-answer" class="correct-answer-radio" value="${answerCount - 1}"> Správná</label>
            <button type="button" class="remove-answer-btn">X</button>
        `;
        answersContainer.appendChild(newAnswerGroup);
        newAnswerGroup.querySelector('.remove-answer-btn').addEventListener('click', () => newAnswerGroup.remove());
    });

    // --- Zpracování formuláře ---
    questionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const answers = [];
        const answerInputs = answersContainer.querySelectorAll('.answer-text');
        const correctRadio = answersContainer.querySelector('input[name="correct-answer"]:checked');

        if (!correctRadio) {
            alert('Označte prosím jednu odpověď jako správnou.');
            return;
        }
        const correctIndex = parseInt(correctRadio.value, 10);

        answerInputs.forEach((input, index) => {
            answers.push({ text: input.value, correct: index === correctIndex });
        });

        const questionData = {
            text: questionText.value,
            answers: answers
        };

        const id = hiddenQuestionId.value;
        if (id) {
            await quizRef.collection('otazky').doc(id).update(questionData);
        } else {
            await quizRef.collection('otazky').add(questionData);
        }
        resetForm();
    });

    function resetForm() {
        questionForm.reset();
        hiddenQuestionId.value = '';
        answersContainer.innerHTML = `
            <div class="answer-input-group">
                <input type="text" placeholder="Text odpovědi 1" class="answer-text" required>
                <label><input type="radio" name="correct-answer" class="correct-answer-radio" value="0"> Správná</label>
            </div>
            <div class="answer-input-group">
                <input type="text" placeholder="Text odpovědi 2" class="answer-text" required>
                <label><input type="radio" name="correct-answer" class="correct-answer-radio" value="1"> Správná</label>
            </div>
        `;
        answerCount = 2;
    }

    // --- Načítání a zobrazení otázek ---
    function listenForQuestions() {
        quizRef.collection('otazky').onSnapshot(snapshot => {
            if (snapshot.empty) {
                questionListContainer.innerHTML = '<p>Tento kvíz zatím neobsahuje žádné otázky.</p>';
                return;
            }
            let html = '';
            snapshot.forEach(doc => {
                const question = doc.data();
                html += `
                    <div class="question-item">
                        <div class="question-item-header">
                            <p>${question.text}</p>
                            <div class="question-item-actions">
                                <button class="edit-question-btn" data-id="${doc.id}">Upravit</button>
                                <button class="delete-question-btn" data-id="${doc.id}">Smazat</button>
                            </div>
                        </div>
                    </div>
                `;
            });
            questionListContainer.innerHTML = html;
            addQuestionActionListeners();
        });
    }

    function addQuestionActionListeners() {
        document.querySelectorAll('.edit-question-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleEditQuestion(e.target.dataset.id));
        });
        document.querySelectorAll('.delete-question-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleDeleteQuestion(e.target.dataset.id));
        });
    }

    async function handleEditQuestion(id) {
        const doc = await quizRef.collection('otazky').doc(id).get();
        if (!doc.exists) return;
        const question = doc.data();

        resetForm();
        hiddenQuestionId.value = id;
        questionText.value = question.text;
        answersContainer.innerHTML = '';
        answerCount = 0;

        question.answers.forEach((answer, index) => {
            answerCount++;
            const newAnswerGroup = document.createElement('div');
            newAnswerGroup.className = 'answer-input-group';
            newAnswerGroup.innerHTML = `
                <input type="text" value="${answer.text}" class="answer-text" required>
                <label><input type="radio" name="correct-answer" class="correct-answer-radio" value="${index}" ${answer.correct ? 'checked' : ''}> Správná</label>
                <button type="button" class="remove-answer-btn">X</button>
            `;
            answersContainer.appendChild(newAnswerGroup);
            newAnswerGroup.querySelector('.remove-answer-btn').addEventListener('click', () => newAnswerGroup.remove());
        });
        window.scrollTo(0, 0);
    }

    async function handleDeleteQuestion(id) {
        if (confirm('Opravdu si přejete smazat tuto otázku?')) {
            await quizRef.collection('otazky').doc(id).delete();
        }
    }
});
