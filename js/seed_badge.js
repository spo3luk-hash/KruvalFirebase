
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Cesta k vašemu service account klíči

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedBadges() {
  const badgesCollection = db.collection('hracskeOdznaky');

  const firstCharacterBadge = {
    id: 'prvni-postava',
    nazev: 'První postava',
    popis: 'Uživatel si úspěšně vytvořil svou první herní postavu.',
    ikona: 'fas fa-user-plus',
    kategorie: 'Základní',
    datumVytvoreni: new Date()
  };

  try {
    await badgesCollection.doc(firstCharacterBadge.id).set(firstCharacterBadge);
    console.log('Úspěšně byl vytvořen odznak "První postava".');
  } catch (error) {
    console.error('Chyba při vytváření odznaku:', error);
  }
}

seedBadges();
