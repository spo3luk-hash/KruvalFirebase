
// Tento skript slouží k jednorázovému vložení dat do databáze.
// Měl by být spuštěn manuálně, například vývojářem.

const seedBadge = async (db) => {
    try {
        console.log("Začínám vkládat vzorový odznak...");

        // 1. Vytvoření odznaku
        const badgeRef = await db.collection('odznaky').add({
            nazev: "Vítej v Bradavicích",
            popis: "Tento odznak získá každý, kdo úspěšně projde základním kvízem o Bradavicích.",
            obrazek: "/img/badges/bradavice_badge.png", // Cesta k obrázku odznaku
            kategorie: "Kvízy"
        });

        console.log(`Odznak "Vítej v Bradavicích" byl úspěšně vytvořen s ID: ${badgeRef.id}`);

        // 2. Propojení odznaku s kvízem "Bradavice"
        // Nejprve najdeme kvíz "Bradavice"
        const quizQuery = await db.collection('kvizy').where('nazev', '==', 'Bradavice').limit(1).get();

        if (quizQuery.empty) {
            console.error("Kvíz s názvem 'Bradavice' nebyl nalezen. Odznak nebyl propojen.");
            return;
        }

        const quizDoc = quizQuery.docs[0];
        await quizDoc.ref.update({
            odznakId: badgeRef.id // Přidáme referenci na nově vytvořený odznak
        });

        console.log(`Kvíz "Bradavice" (ID: ${quizDoc.id}) byl úspěšně aktualizován a nyní uděluje odznak.`);
        
        console.log("Vzorový odznak byl úspěšně vložen a propojen.");

    } catch (error) {
        console.error("Došlo k chybě při vkládání vzorového odznaku:", error);
    }
};

// Pokud chcete tento skript spustit, odkomentujte následující řádek a spusťte ho v kontextu,
// kde máte přístup k inicializované Firebase databázi (db).
// seedBadge(firebase.firestore());
