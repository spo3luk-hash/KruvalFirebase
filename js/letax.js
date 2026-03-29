document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    auth.onAuthStateChanged(user => {
        if (!user) {
            console.log("Uživatel není přihlášen, cestování letaxem není možné.");
            window.location.href = 'index.html';
            return;
        }

        const destinations = document.querySelectorAll('.destination-item');

        destinations.forEach(destination => {
            if (!destination.classList.contains('disabled')) {
                destination.addEventListener('click', async () => {
                    const worldId = destination.getAttribute('data-location-id');
                    
                    // OPRAVA 1: Používáme sessionStorage a správný klíč 'selectedCharacterId'
                    const activeCharacterId = sessionStorage.getItem('selectedCharacterId');

                    if (!activeCharacterId) {
                        console.error("Není vybrána žádná aktivní postava!");
                        alert("Chyba: Není vybrána žádná postava. Vraťte se na výběr postav.");
                        return;
                    }

                    console.log(`Zahajuji cestování do světa: ${worldId} pro postavu: ${activeCharacterId}`);

                    try {
                        // OPRAVA 2: Používáme správnou, vnořenou cestu ke kolekci postav
                        const characterRef = db.collection('hraci').doc(user.uid).collection('postavy').doc(activeCharacterId);
                        
                        await characterRef.update({
                            aktualniSvet: worldId,
                            aktualniLokace: 'vstupni-brana' // Výchozí lokace pro každý svět
                        });

                        console.log("Pozice postavy v databázi byla úspěšně aktualizována.");

                        // Přesměrování na stránku odpovídající světu
                        window.location.href = `${worldId}.html`;

                    } catch (error) {
                        console.error("Došlo k chybě při aktualizaci pozice postavy: ", error);
                        alert("Došlo k chybě při cestování letaxovou sítí. Zkuste to prosím znovu.");
                    }
                });
            }
        });
    });
});
