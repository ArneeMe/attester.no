// One-shot export of the hashcollection from Firestore to JSON.
// Usage:
//   1. cp .env.example .env.local  (fill in PROD Firebase values)
//   2. node --env-file=.env.local scripts/export-firestore-hashes.mjs
//
// Output: scripts/hashes-export.json

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { writeFile } from "node:fs/promises";

const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

for (const [key, value] of Object.entries(config)) {
    if (!value) {
        console.error(`Missing env var for ${key}. Did you run with --env-file=.env.local?`);
        process.exit(1);
    }
}

const app = initializeApp(config);
const db = getFirestore(app);

const snapshot = await getDocs(collection(db, "hashcollection"));

const hashes = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
        firestoreDocId: doc.id,
        id: data.id,
        hash: data.hash,
        timestamp: data.timestamp?.toDate?.()?.toISOString() ?? null,
    };
});

const outPath = "scripts/hashes-export.json";
await writeFile(outPath, JSON.stringify(hashes, null, 2));

console.log(`Exported ${hashes.length} hashes to ${outPath}`);
process.exit(0);
