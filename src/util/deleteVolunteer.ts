import {collection, deleteDoc, getDocs, query, where} from "firebase/firestore";
import {db} from "@/app/firebase/fb_config";

export const deleteVolunteer = async (id: string) => {
    console.log('Attempting to delete document with ID:', id);
    try {
        const q = query(collection(db, "volunteers"), where("id", "==", id));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (doc): Promise<void> => {
           await deleteDoc(doc.ref)
        })

    } catch (error) {
        console.error('Error removing document: ', error);
        alert('Feil ved sletting av dokument. Sjekk konsollen for detaljer.');
    }
};