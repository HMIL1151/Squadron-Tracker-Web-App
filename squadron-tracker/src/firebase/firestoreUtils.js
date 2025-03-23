import { getFirestore, collection, getDocs } from "firebase/firestore/lite";
import { app } from "./firebase";

// Function to fetch data from a specific Firestore collection
export const fetchCollectionData = async (collectionName) => {
  const db = getFirestore(app);
  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(collectionRef);

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};