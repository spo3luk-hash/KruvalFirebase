document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    const quizContainer = document.getElementById('quiz-container');
    const quizIntro = document.getElementById('quiz-intro');
    const startQuizBtn = document.getElementById('start-quiz-btn');
    const quizQuestion = document.getElementById('quiz-question');
    const questionText = document.getElementById('question-text');
    const answersContainer = document.getElementById('answers-container');
    const quizResult = document.getElementById('quiz-result');
    const wandResultText = document.getElementById('wand-result');

    let currentUser = null;
    let userWandAnswers = {};

    const quizData = [
        {
            question: "Která cesta tě nejvíce láká?",
            answers: [
                { text: "Úzká, dlážděná ulička lemovaná starými obchody.", attribute: { type: 'drevo', value: ['cedrové', 'jilmové', 'tisové'] } },
                { text: "Široká, sluncem zalitá louka plná květin.", attribute: { type: 'drevo', value: ['jabloňové', 'hlohové', 'třešňové'] } },
                { text: "Tichá, mechem porostlá lesní pěšina.", attribute: { type: 'drevo', value: ['dubové', 'sekvojové', 'vrbové'] } },
                { text: "Kamenitá stezka vinoucí se vysoko v horách.", attribute: { type: 'drevo', value: ['jedlové', 'borové', 'modřínové'] } }
            ]
        },
        {
            question: "Vyber si magického tvora:",
            answers: [
                { text: "Fénix, znovuzrozený z popela.", attribute: { type: 'jadro', value: 'fénixův pernatý ocas' } },
                { text: "Drak, jehož síla je legendární.", attribute: { type: 'jadro', value: 'blána z dračího srdce' } },
                { text: "Jednorožec, symbol čistoty a dobra.", attribute: { type: 'jadro', value: 'žíně z jednorožce' } },
                { text: "Testrál, viditelný jen těm, kdo spatřili smrt.", attribute: { type: 'jadro', value: 'ocasní žíně testrála' } }
            ]
        },
        {
            question: "Který artefakt bys chtěl(a) vlastnit?",
            answers: [
                { text: "Myslánku, pro uchování a zkoumání vzpomínek.", attribute: { type: 'pruznost', value: ['pružná', 'ohybná'] } },
                { text: "Neviditelný plášť, pro skryté objevování.", attribute: { type: 'pruznost', value: ['poddajná', 'velmi ohebná'] } },
                { text: "Kámen vzkříšení, pro rozhovor s těmi, co odešli.", attribute: { type: 'pruznost', value: ['pevná', 'tuhá'] } },
                { text: "Meč Godrika Nebelvíra, pro boj se zlem.", attribute: { type: 'pruznost', value: ['nepoddajná', 'neústupná'] } }
            ]
        }
    ];

    let currentQuestionIndex = 0;

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            const playerDocRef = db.collection('hraci').doc(currentUser.uid);
            const playerDoc = await playerDocRef.get();

            if (playerDoc.exists) {
                const activeCharId = playerDoc.data().aktivniPostava;
                if (!activeCharId) {
                    quizIntro.innerHTML = '<h2>Chyba</h2><p>Nejprve si musíš ve svém profilu vybrat aktivní postavu, než si budeš moci pořídit hůlku.</p><a href="vyber-postavy.html" class="btn">Vybrat postavu</a>';
                    return;
                }

                const characterDocRef = db.collection('hraci').doc(currentUser.uid).collection('postavy').doc(activeCharId);
                const characterDoc = await characterDocRef.get();

                if (characterDoc.exists && characterDoc.data().maHulku) {
                    showHasWandMessage();
                } else {
                    startQuizBtn.addEventListener('click', startQuiz);
                }
            } else {
                 window.location.href = 'login.html';
            }
        } else {
            window.location.href = 'login.html';
        }
    });
    
    function showHasWandMessage() {
        quizIntro.innerHTML = '<h2>Už svou hůlku máš.</h2><p>Každý kouzelník má jen jednu hůlku, která si ho vybrala. Ta tvá na tebe čeká v tvém inventáři.</p><a href="profil-hrace.html" class="btn">Zobrazit inventář</a>';
    }

    function startQuiz() {
        quizIntro.classList.add('hidden');
        quizQuestion.classList.remove('hidden');
        displayQuestion();
    }

    function displayQuestion() {
        if (currentQuestionIndex < quizData.length) {
            const currentQ = quizData[currentQuestionIndex];
            questionText.textContent = currentQ.question;
            answersContainer.innerHTML = '';
            currentQ.answers.forEach(answer => {
                const button = document.createElement('button');
                button.textContent = answer.text;
                button.classList.add('answer-btn');
                button.onclick = () => selectAnswer(answer.attribute);
                answersContainer.appendChild(button);
            });
        } else {
            finishQuiz();
        }
    }

    function selectAnswer(attribute) {
        userWandAnswers[attribute.type] = attribute.value;
        currentQuestionIndex++;
        displayQuestion();
    }

    async function finishQuiz() {
        quizQuestion.classList.add('hidden');
        quizResult.classList.remove('hidden');
        wandResultText.innerHTML = "Hledám tu pravou...";

        try {
            const woodTypes = Array.isArray(userWandAnswers.drevo) ? userWandAnswers.drevo : [userWandAnswers.drevo];
            const coreType = userWandAnswers.jadro;

            const wandsSnapshot = await db.collection('hulky')
                .where('jadro', '==', coreType)
                .where('drevo', 'in', woodTypes)
                .get();
            
            let possibleWands = [];
            wandsSnapshot.forEach(doc => {
                possibleWands.push({ id: doc.id, ...doc.data() });
            });
            
            if (possibleWands.length === 0) {
                 const coreOnlySnapshot = await db.collection('hulky').where('jadro', '==', coreType).get();
                 coreOnlySnapshot.forEach(doc => {
                    possibleWands.push({ id: doc.id, ...doc.data() });
                });
            }

            if (possibleWands.length === 0) {
                 const anyWandSnapshot = await db.collection('hulky').where('vlastnik', '==', null).limit(10).get();
                 anyWandSnapshot.forEach(doc => {
                    possibleWands.push({ id: doc.id, ...doc.data() });
                });
            }

            if (possibleWands.length === 0) {
                wandResultText.textContent = "Je nám líto, ale zdá se, že pro tebe momentálně žádná hůlka není připravena. Zkus to prosím později.";
                return;
            }

            const chosenWand = possibleWands[Math.floor(Math.random() * possibleWands.length)];

            const wandDescription = `Dřevo: ${chosenWand.drevo}, Jádro: ${chosenWand.jadro}, Délka: ${chosenWand.delka} palců, Pružnost: ${chosenWand.pruznost}.`;
            wandResultText.innerHTML = wandDescription;

            const playerDocRef = db.collection('hraci').doc(currentUser.uid);
            await db.runTransaction(async (transaction) => {
                const playerDoc = await transaction.get(playerDocRef);
                if (!playerDoc.exists) { throw "Player document not found!"; }

                const activeCharId = playerDoc.data().aktivniPostava;
                if (!activeCharId) {
                    wandResultText.innerHTML = "Nemáš vybranou žádnou aktivní postavu. Běž si ji nejprve vybrat.";
                    throw "No active character selected!";
                }

                const characterDocRef = db.collection('hraci').doc(currentUser.uid).collection('postavy').doc(activeCharId);
                const characterDoc = await transaction.get(characterDocRef);

                if (characterDoc.exists && characterDoc.data().maHulku) {
                    console.log("Tato postava již hůlku má.");
                    return;
                }

                const inventoryRef = characterDocRef.collection('inventar').doc(chosenWand.id);
                transaction.set(inventoryRef, {
                    nazev: `Hůlka (${chosenWand.drevo}, ${chosenWand.jadro})`,
                    typ: 'hulka',
                    ...chosenWand
                });
                
                transaction.update(characterDocRef, { maHulku: true });
                
                const wandDocRef = db.collection('hulky').doc(chosenWand.id);
                transaction.update(wandDocRef, { vlastnik: currentUser.uid, vlastnikPostavaId: activeCharId });
            });

        } catch (error) {
            console.error("Chyba při výběru hůlky: ", error);
            wandResultText.textContent = "Při výběru hůlky se stala chyba. Zkuste to prosím znovu.";
        }
    }
});