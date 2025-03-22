import './App.css';
import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs } from 'firebase/firestore/lite';
import { app } from './firebase';
import Table from './Table';
import Auth from './Auth';

const App = () => {
  const [user, setUser] = useState(null);
  const [cadets, setCadets] = useState([]);

  const refreshCadets = async () => {
    const db = getFirestore(app);
    const cadetsCollectionRef = collection(db, "Cadets");
    const cadetsSnapshot = await getDocs(cadetsCollectionRef);
    
    const cadetsList = cadetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setCadets(cadetsList);
  };

  useEffect(() => {
    refreshCadets();
  }, []);

  const cadetListColumns = ["Forename", "Surname", "Rank", "Flight", "Classification", "Start Date"];

  const cadetListColumnMapping = {
    Forename: "forename",
    Surname: "surname",
    Rank: "rank",
    Flight: "flight",
    Classification: "classification",
    "Start Date": "startDate",
    AddedBy: "addedBy",
    CreatedAt: "createdAt"
  };

  const handleUserChange = (currentUser) => {
    setUser(currentUser);
  };

  const formattedCadets = cadets.map(cadet => {
    return Object.keys(cadetListColumnMapping).reduce((acc, key) => {
      acc[key] = cadet[cadetListColumnMapping[key]];
      return acc;
    }, {});
  });

  return (
    <div className="App">
      <h2>Squadron Tracker</h2>
      <Auth onUserChange={handleUserChange} />
      {user ? (
        <div>
          <h3>Cadet List</h3>
          <section>
            <Table columns={cadetListColumns} data={formattedCadets} />
          </section>
        </div>
      ) : (
        <p>Please sign in to view the cadet list.</p>
      )}
    </div>
  );
  };

  export default App;
