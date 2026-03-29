document.addEventListener('DOMContentLoaded', function() {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const pathname = window.location.pathname;

    // Zpracování formulářů na index.html a registrace.html
    if (pathname.endsWith('index.html') || pathname.endsWith('registrace.html') || pathname === '/') {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const showRegister = document.getElementById('show-register');
        const showLogin = document.getElementById('show-login');
        const loginContainer = document.getElementById('login-container');
        const registerContainer = document.getElementById('register-container');

        if (showRegister && showLogin && loginContainer && registerContainer) {
            showRegister.addEventListener('click', (e) => {
                e.preventDefault();
                loginContainer.style.display = 'none';
                registerContainer.style.display = 'block';
            });

            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                registerContainer.style.display = 'none';
                loginContainer.style.display = 'block';
            });
        }

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = e.target.identifier.value;
                const password = e.target.password.value;

                auth.signInWithEmailAndPassword(email, password)
                    .then(() => {
                        window.location.href = 'vyber-postavy.html';
                    })
                    .catch((error) => {
                        alert(`Chyba při přihlášení: ${error.message}`);
                    });
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const nickname = e.target.nickname.value;
                const email = e.target.email.value;
                const password = e.target.password.value;

                auth.createUserWithEmailAndPassword(email, password)
                    .then((userCredential) => {
                        const user = userCredential.user;
                        // OPRAVA: Ponechána kolekce 'hraci', změněna role na 'Hráč'
                        return db.collection('hraci').doc(user.uid).set({
                            herniNick: nickname,
                            email: email,
                            role: 'Hráč', // Sjednocení na 'Hráč' dle požadavku
                            datumRegistrace: firebase.firestore.FieldValue.serverTimestamp(),
                            posledniAktivita: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    })
                    .then(() => {
                        alert(`Vítej, ${nickname}! Tvá registrace proběhla úspěšně.`);
                        window.location.href = 'vyber-postavy.html';
                    })
                    .catch((error) => {
                        alert(`Chyba při registraci: ${error.message}`);
                    });
            });
        }
    }

    // Globální hlídač přihlášení
    auth.onAuthStateChanged(function(user) {
        const publicPages = ['/index.html', '/', '/registrace.html'];
        const isPublicPage = publicPages.some(page => pathname.endsWith(page));

        if (user) {
            if (isPublicPage) {
                window.location.href = 'vyber-postavy.html';
            }
        } else {
            if (!isPublicPage) {
                window.location.href = 'index.html';
            }
        }
    });
});
