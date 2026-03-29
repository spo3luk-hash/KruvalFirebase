
/**
 * @file avatar-hrace-uloz.js
 * @description Obsahuje funkce pro nahrání a uložení nového avataru hráče.
 */

/**
 * Nahraje soubor s avatarem do Firebase Storage a aktualizuje URL v dokumentu hráče ve Firestore.
 * 
 * @param {string} userId ID hráče, jehož avatar se má aktualizovat.
 * @param {File} file Objekt souboru (obrázek), který se má nahrát.
 * @param {function(progress: number): void} [onProgress] Volitelná funkce pro sledování průběhu nahrávání (0-100).
 * @returns {Promise<string>} Vrací URL nově nahraného avataru.
 */
async function uploadAndSaveAvatar(userId, file, onProgress) {
    const storage = firebase.storage();
    const db = firebase.firestore();

    if (!userId || !file) {
        throw new Error("Funkci uploadAndSaveAvatar chybí ID hráče nebo soubor.");
    }
    if (!file.type.startsWith('image/')) {
        throw new Error("Soubor musí být obrázek (např. PNG, JPG, GIF).");
    }

    try {
        const fileExtension = file.name.split('.').pop();
        const fileName = `avatar_${Date.now()}.${fileExtension}`;
        // Ukládáme do složky vázané na UID hráče pro přehlednost
        const storagePath = `user-avatars/${userId}/${fileName}`;
        const storageRef = storage.ref(storagePath);
        const uploadTask = storageRef.put(file);

        if (typeof onProgress === 'function') {
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    onProgress(progress);
                }
            );
        }

        await uploadTask;
        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();

        // Aktualizace dokumentu v kolekci 'hraci'
        const userRef = db.collection('hraci').doc(userId);
        await userRef.update({ avatarUrl: downloadURL });

        console.log(`Avatar pro hráče ${userId} byl úspěšně aktualizován.`);
        return downloadURL;

    } catch (error) {
        console.error("Došlo k chybě při nahrávání avataru:", error);
        throw error;
    }
}

/**
 * Uloží URL adresu avataru přímo do dokumentu hráče ve Firestore.
 * 
 * @param {string} userId ID hráče, jehož avatar se má aktualizovat.
 * @param {string} avatarUrl URL adresa obrázku, který se má nastavit jako avatar.
 * @returns {Promise<void>} Vrací promise, která je splněna po úspěšném uložení.
 */
async function ulozAvatarHraceZUrl(userId, avatarUrl) {
    const db = firebase.firestore();

    if (!userId || !avatarUrl) {
        throw new Error("Funkci ulozAvatarHraceZUrl chybí ID hráče nebo URL avataru.");
    }

    if (!avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://')) {
        throw new Error("Neplatný formát URL. Adresa musí začínat http:// nebo https://");
    }

    try {
        // Aktualizace dokumentu v kolekci 'hraci'
        const userRef = db.collection('hraci').doc(userId);
        await userRef.update({
            avatarUrl: avatarUrl
        });

        console.log(`Avatar pro hráče ${userId} byl úspěšně aktualizován z URL.`);

    } catch (error) {
        console.error("Došlo k chybě při ukládání avataru z URL:", error);
        throw error;
    }
}
