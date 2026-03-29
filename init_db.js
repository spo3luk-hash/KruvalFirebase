const admin = require('firebase-admin');
const { spellsData } = require('./seed_spells.js');

// Inicializace Firebase Admin SDK s explicitním projectId
try {
  admin.initializeApp({
    projectId: 'hrakruval2-9a626'
  });
} catch (e) {
  console.log("Aplikace již byla inicializována nebo nastala jiná chyba.");
}

const db = admin.firestore();

async function seedSpells() {
  const spellsCollection = db.collection('kouzla');
  console.log('Nahrávám kouzla do databáze...');

  // Zkontrolujeme, zda kolekce již neobsahuje data
  const snapshot = await spellsCollection.limit(1).get();
  if (!snapshot.empty) {
    console.log('Kolekce "kouzla" již obsahuje data. Nahrávání se přeskakuje.');
    return;
  }

  const batch = db.batch();

  spellsData.forEach(spell => {
    const docRef = spellsCollection.doc(spell.id);
    batch.set(docRef, spell);
  });

  try {
    await batch.commit();
    console.log(`Úspěšně nahráno ${spellsData.length} kouzel.`);
  } catch (error) {
    console.error('Chyba při nahrávání kouzel:', error);
  }
}

seedSpells().then(() => {
    console.log('Skript dokončen.');
    // Ukončení procesu, aby se skript správně zastavil
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
