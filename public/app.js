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


let cadetListRef;
let unsubscribe;

auth.onAuthStateChanged(user => {

    if (user) {
        console.log('Logged in as: ' + user.uid);
        // Database Reference
        cadetListRef = db.collection('Cadets')

        addCadet.onclick = () => {
            console.log('clicked');

            cadetListRef.add({
                addedBy: user.displayName,
                classification: 5,
                dischargeDate: '2026-02-04',
                flight: 0,
                forename: 'Annabelle',
                surname: 'Larmour',
                rank: 0,
                startDate: '2021-06-15',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        


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
                                <td>${cadet.dischargeDate}</td>
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