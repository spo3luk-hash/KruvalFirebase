/**
 * Tento soubor obsahuje logiku specifickou pro skupinové konverzace.
 */

/**
 * Vytvoří novou skupinovou konverzaci a odešle první zprávu.
 * Tato funkce je volána ze souboru soukrome-zpravy-forum.js
 * 
 * @param {string} groupName Název nové skupiny.
 * @param {string[]} recipientIds Pole s UID všech příjemců.
 * @param {string} firstMessageText Text první zprávy.
 * @returns {Promise<string|null>} ID nově vytvořené konverzace, nebo null při chybě.
 */
async function createNewGroupConversation(groupName, recipientIds, firstMessageText) {
    const db = firebase.firestore();
    const currentUser = firebase.auth().currentUser;

    if (!currentUser) {
        console.error("Uživatel není přihlášen.");
        Kruval.forumAdmin.showAlert('Pro vytvoření skupiny musíte být přihlášeni.', 'error');
        return null;
    }

    const allParticipantIds = [currentUser.uid, ...recipientIds];

    try {
        // Získáme data všech účastníků v jedné dávce pro efektivitu
        const userPromises = allParticipantIds.map(uid => db.collection('users').doc(uid).get());
        const userDocs = await Promise.all(userPromises);

        const infoUcastniku = {};
        for (const userDoc of userDocs) {
            if (userDoc.exists) {
                const userData = userDoc.data();
                infoUcastniku[userDoc.id] = {
                    identitaNaForu: userData.identitaNaForu,
                    avatarNaForu: userData.avatarNaForu || 'images/silhouettes/placeholder.png'
                };
            } else {
                // Záložní data pro případ, že by profil uživatele neexistoval
                infoUcastniku[userDoc.id] = {
                    identitaNaForu: 'Neznámý uživatel',
                    avatarNaForu: 'images/silhouettes/placeholder.png'
                };
            }
        }

        // Použijeme dávkový zápis (batch) pro zajištění atomicity operace
        const batch = db.batch();
        const conversationRef = db.collection('soukromeZpravyForum').doc();

        // 1. Vytvoření hlavního dokumentu konverzace
        batch.set(conversationRef, {
            typ: 'skupinova',
            zakladatel: currentUser.uid,
            administratori: [currentUser.uid], // Zakladatel je automaticky admin
            ucastnici: allParticipantIds,
            jmenoSkupiny: groupName,
            ikonaSkupiny: '', // Prázdné, možnost přidat později
            casVytvoreni: firebase.firestore.FieldValue.serverTimestamp(),
            casPosledniZpravy: firebase.firestore.FieldValue.serverTimestamp(),
            posledniZpravaText: firstMessageText.substring(0, 80), // Delší úryvek pro skupiny
            infoUcastniku: infoUcastniku,
            neprectenoPro: recipientIds // Nepřečteno pro všechny kromě odesílatele
        });

        // 2. Vytvoření první zprávy v subkolekci
        const firstMessageRef = conversationRef.collection('zpravy').doc();
        batch.set(firstMessageRef, {
            odesilatelId: currentUser.uid,
            text: firstMessageText,
            casOdeslani: firebase.firestore.FieldValue.serverTimestamp(),
            stav: 'odeslano' // U skupin začínáme jako 'odeslano'
        });
        
        // 3. Vytvoření systémové zprávy o založení skupiny
        const systemMessageRef = conversationRef.collection('zpravy').doc();
        batch.set(systemMessageRef, {
            typ: 'system', // Speciální typ pro odlišení v UI
            text: `${infoUcastniku[currentUser.uid].identitaNaForu} založil(a) skupinu "${groupName}".`,
            casOdeslani: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Provedeme všechny operace najednou
        await batch.commit();

        console.log(`Skupina '${groupName}' byla úspěšně vytvořena s ID: ${conversationRef.id}`);
        return conversationRef.id; // Vrátíme ID pro přesměrování

    } catch (error) {
        console.error("Fatální chyba při vytváření skupinové konverzace: ", error);
        Kruval.forumAdmin.showAlert('Při zakládání skupiny došlo k závažné chybě.', 'error');
        return null;
    }
}
