///// User Authentication /////

const auth = firebase.auth();

const whenSignedIn = document.getElementById('whenSignedIn');
const whenSignedOut = document.getElementById('whenSignedOut');

const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');

const userDetails = document.getElementById('userDetails');


const provider = new firebase.auth.GoogleAuthProvider();

/// Sign in event handlers

signInBtn.onclick = () => auth.signInWithPopup(provider);

signOutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
    if (user) {
        // signed in
        whenSignedIn.hidden = false;
        whenSignedOut.hidden = true;
        userDetails.innerHTML = `<h3>Hello ${user.displayName}!</h3>`;
    } else {
        // not signed in
        whenSignedIn.hidden = true;
        whenSignedOut.hidden = false;
        userDetails.innerHTML = '';
        cadetsTableBody.innerHTML = ""; // Clear the table before updating
    }
});

console.log('hello world');



///// Firestore /////

const db = firebase.firestore();

const addCadet = document.getElementById('addCadet');
const cadetList = document.getElementById('cadetList');

const addCadetModal = document.getElementById('addCadetModal');
const closeModal = document.getElementById('closeModal');
const addCadetForm = document.getElementById('addCadetForm');






let cadetListRef;
let unsubscribe;

auth.onAuthStateChanged(user => {

    if (user) {
        console.log('Logged in as: ' + user.displayName + ' (' + user.uid + ')');
        // Database Reference
        cadetListRef = db.collection('Cadets')

        // Show the modal when the addCadet button is clicked
        addCadet.onclick = () => {
            addCadetModal.style.display = 'block';
        };

        // Close the modal when the close button is clicked
        closeModal.onclick = () => {
            addCadetModal.style.display = 'none';
        };

        // Close the modal if the user clicks outside of it
        window.onclick = (event) => {
            if (event.target === addCadetModal) {
                addCadetModal.style.display = 'none';
            }
        };

        // Handle form submission
        addCadetForm.onsubmit = (event) => {
            event.preventDefault(); // Prevent the form from refreshing the page

            const forename = document.getElementById('forename').value;
            const surname = document.getElementById('surname').value;
            const rank = parseInt(document.getElementById('rank').value, 10);
            const flight = parseInt(document.getElementById('flight').value, 10);
            const classification = parseInt(document.getElementById('classification').value, 10);
            const startDate = document.getElementById('startDate').value;

            // Add the new cadet to Firestore
            cadetListRef.add({
                addedBy: auth.currentUser.displayName,
                classification: classification,
                flight: flight,
                forename: forename,
                surname: surname,
                rank: rank,
                startDate: startDate,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                console.log('Cadet added successfully!');
                addCadetModal.style.display = 'none'; // Close the modal
                addCadetForm.reset(); // Reset the form
            }).catch((error) => {
                console.error('Error adding cadet: ', error);
            });
        };
        
        


            // Fetch Cadets data from Firestore
            db.collection("Cadets").onSnapshot(snapshot => {
            cadetsTableBody.innerHTML = ""; // Clear the table before updating

            snapshot.forEach(doc => {
                const cadet = doc.data();
                const createdAt = cadet.createdAt && cadet.createdAt.toDate 
                ? cadet.createdAt.toDate().toLocaleString() 
                : "N/A"; // Default value if undefined
                const row = `<tr id="${doc.id}">
                                <td>${cadet.forename}</td>
                                <td>${cadet.surname}</td>
                                <td>${cadet.rank}</td>
                                <td>${cadet.flight}</td>
                                <td>${cadet.classification}</td>
                                <td>${cadet.startDate}</td>
                                <td>${createdAt}</td>
                                <td>${cadet.addedBy}</td>
                            </tr>`;

                cadetsTableBody.innerHTML += row;
            });
        });
        


    } else {
        console.log('Logged out');
        // Unsubscribe when the user signs out
        unsubscribe && unsubscribe();
        
    }
});