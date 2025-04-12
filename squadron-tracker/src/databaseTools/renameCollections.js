import { getFirestore, collection, getDocs, doc, setDoc } from "firebase/firestore";

const db = getFirestore();

/**
 * Renames collections and subcollections in Firestore by removing spaces from their names.
 */
const renameCollections = async () => {
  try {
    console.log("Starting the renaming process...");

    // List the top-level collections explicitly
    const topLevelCollectionNames = ["SquadronDatabases"]; // Replace with your actual collection names

    for (const collectionName of topLevelCollectionNames) {
      console.log(`Processing top-level collection: ${collectionName}`);

      // Check if the collection name contains spaces
      let newCollectionName = collectionName;
      if (collectionName.includes(" ")) {
        newCollectionName = collectionName.replace(/\s+/g, ""); // Remove spaces
        console.log(`Renaming collection: ${collectionName} -> ${newCollectionName}`);

        // Copy data to the new collection
        console.log(`Copying data from ${collectionName} to ${newCollectionName}...`);
        await copyCollectionData(collection(db, collectionName), collection(db, newCollectionName));
        console.log(`Data copied successfully for collection: ${collectionName}`);
      } else {
        console.log(`No spaces found in collection name: ${collectionName}`);
      }

      // Check for subcollections within this collection
      console.log(`Checking for subcollections in ${collectionName}...`);
      const topLevelDocs = await getDocs(collection(db, collectionName));
      for (const docSnapshot of topLevelDocs.docs) {
        const oldDocRef = doc(db, collectionName, docSnapshot.id);
        const newDocRef = doc(db, newCollectionName, docSnapshot.id);
        console.log(`Checking document: ${oldDocRef.path}`);

        // Known subcollections for each document
        const subcollectionNames = ["AuthorisedUsers", "Cadets", "EventLog", "FlightPoints", "UserRequests"];

        for (const subcollectionName of subcollectionNames) {
          console.log(`Processing subcollection: ${subcollectionName}`);
          if (subcollectionName.includes(" ")) {
            const newSubcollectionName = subcollectionName.replace(/\s+/g, ""); // Remove spaces
            console.log(`Renaming subcollection: ${subcollectionName} -> ${newSubcollectionName}`);

            // Copy data to the new subcollection under the new top-level collection
            console.log(`Copying data from ${oldDocRef.path}/${subcollectionName} to ${newDocRef.path}/${newSubcollectionName}...`);
            await copyCollectionData(
              collection(db, `${oldDocRef.path}/${subcollectionName}`),
              collection(db, `${newDocRef.path}/${newSubcollectionName}`)
            );
            console.log(`Data copied successfully for subcollection: ${subcollectionName}`);

            // Optionally delete the old subcollection (uncomment if needed)
            // console.log(`Deleting old subcollection: ${oldDocRef.path}/${subcollectionName}`);
            // await deleteCollection(collection(db, `${oldDocRef.path}/${subcollectionName}`));
            // console.log(`Old subcollection deleted: ${oldDocRef.path}/${subcollectionName}`);
          } else {
            console.log(`No spaces found in subcollection name: ${subcollectionName}`);

            // Copy data to the new subcollection under the new top-level collection
            console.log(`Copying data from ${oldDocRef.path}/${subcollectionName} to ${newDocRef.path}/${subcollectionName}...`);
            await copyCollectionData(
              collection(db, `${oldDocRef.path}/${subcollectionName}`),
              collection(db, `${newDocRef.path}/${subcollectionName}`)
            );
            console.log(`Data copied successfully for subcollection: ${subcollectionName}`);
          }
        }
      }
    }

    console.log("Renaming process completed successfully.");
  } catch (error) {
    console.error("Error renaming collections:", error);
  }
};

/**
 * Copies all documents from one collection to another.
 * @param {CollectionReference} sourceCollection - The source collection.
 * @param {CollectionReference} targetCollection - The target collection.
 */
const copyCollectionData = async (sourceCollection, targetCollection) => {
  console.log(`Starting to copy documents from source to target collection...`);
  const snapshot = await getDocs(sourceCollection);

  for (const docSnapshot of snapshot.docs) {
    const docData = docSnapshot.data();
    const targetDocRef = doc(targetCollection, docSnapshot.id);

    console.log(`Copying document with ID: ${docSnapshot.id}`);
    // Copy the document to the new collection
    await setDoc(targetDocRef, docData);
  }
  console.log(`Finished copying documents for collection.`);
};

/**
 * Deletes all documents in a collection.
 * @param {CollectionReference} collectionRef - The collection to delete.
 */


export default renameCollections;