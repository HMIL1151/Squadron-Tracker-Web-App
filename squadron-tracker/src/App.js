import "./App.css";
import { useState } from "react";
import Auth from "./Auth";
import CadetsDashboard from "./CadetsDashboard";

const App = () => {
  const [user, setUser] = useState(null);

  const handleUserChange = (currentUser) => {
    setUser(currentUser);
  };

  return (
    <div className="App">
      <h2>Squadron Tracker</h2>
      <Auth onUserChange={handleUserChange} />
      {user ? (
        <CadetsDashboard user={user} />      ) : (
        <p>Please sign in to view the cadet list.</p>
      )}
    </div>
  );
};

export default App;