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
            // Split the date string (YYYY-MM-DD)
            const [startYear, startMonth, startDay] = startDate.split('-');
            // Reformat it to DD/MM/YYYY
            const formattedDate = `${startDay}/${startMonth}/${startYear}`;

            // Add the new cadet to Firestore
            cadetListRef.add({
                addedBy: auth.currentUser.displayName,
                classification: classification,
                flight: flight,
                forename: forename,
                surname: surname,
                rank: rank,
                startDate: formattedDate,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
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
                        ? cadet.createdAt.toDate().toLocaleString('en-GB') 
                        : "N/A"; 
            
                    const row = document.createElement("tr");
                    row.id = doc.id;
                    row.innerHTML = `
                        <td>${cadet.forename}</td>
                        <td>${cadet.surname}</td>
                        <td>${Rank[cadet.rank] || 'Unknown'}</td>
                        <td>${Flights[cadet.flight] || 'Unkown'}</td>
                        <td>${Classification[cadet.classification] || 'Unknown'}</td>
                        <td>${cadet.startDate}</td>
                    `;
            
                    row.addEventListener("mouseover", () => {
                        let messageBox = document.getElementById('hoverMessage');
                        messageBox.innerHTML = `Added by: ${cadet.addedBy}, ${createdAt}`;
                        messageBox.style.display = 'block';
                    });
            
                    // this looks like it works after a console output
                    row.addEventListener("mousemove", (event) => {
                        let messageBox = document.getElementById('hoverMessage');
                        messageBox.style.top = `${event.clientY + 10}px`; // 10px below cursor
                        messageBox.style.left = `${event.clientX + 15}px`; // 15px to the right
                        
                    });
            
                    row.addEventListener("mouseout", () => {
                        document.getElementById('hoverMessage').style.display = 'none';
                    });
            
                    document.getElementById("cadetsTableBody").appendChild(row);
                });
            
        });
        


    } else {
        // Unsubscribe when the user signs out
        unsubscribe && unsubscribe();
        
    }
});

function showMessage(text) {
    let messageBox = document.getElementById('hoverMessage');
    messageBox.innerHTML = text; // Using innerHTML to support line breaks
    messageBox.style.display = 'block';
    messageBox.style.top = event.clientY + 'px';
    messageBox.style.left = event.clientX + 'px';
}

function hideMessage() {
    document.getElementById('hoverMessage').style.display = 'none';
}
