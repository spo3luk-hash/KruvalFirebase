// Function to seed initial forum categories.
// Copy and paste the entire content of this function (including the final call)
// into your browser's developer console while on the forum.html page.
async function seedForumCategories() {
    console.log("Attempting to seed categories...");
    try {
        const db = firebase.firestore();
        const categoriesRef = db.collection('forum_kategorie');
        const snapshot = await categoriesRef.get();

        if (!snapshot.empty) {
            console.log("Categories already exist. No action taken.");
            alert("Kategorie již existují. Není třeba je znovu vytvářet.");
            return;
        }

        console.log("Database is empty, creating initial categories as admin...");
        const batch = db.batch();

        const categories = [
            { nazev: 'Obecná diskuze', popis: 'Pro všechny diskuze, které se nehodí jinam.', poradi: 1, pocetVlaken: 0, pocetPrispevku: 0 },
            { nazev: 'Nápady a návrhy', popis: 'Máte nápad na vylepšení hry? Sem s ním!', poradi: 2, pocetVlaken: 0, pocetPrispevku: 0 },
            { nazev: 'Hlášení chyb', popis: 'Našli jste chybu? Dejte nám vědět, ať ji můžeme opravit.', poradi: 3, pocetVlaken: 0, pocetPrispevku: 0 }
        ];

        categories.forEach(categoryData => {
            const docRef = categoriesRef.doc();
            batch.set(docRef, categoryData);
        });

        await batch.commit();
        console.log("Successfully created initial categories.");
        alert("Základní kategorie byly úspěšně vytvořeny! Obnovte prosím stránku (F5).");
    } catch (error) {
        console.error("Error seeding categories:", error);
        alert("Nastala chyba při vytváření kategorií: " + error.message + "\n\nZkontrolujte konzoli pro více detailů a ujistěte se, že jste přihlášen jako administrátor.");
    }
}

// Immediately execute the function.
seedForumCategories();
