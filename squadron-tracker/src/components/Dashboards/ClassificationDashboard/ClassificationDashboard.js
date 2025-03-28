import React, { useEffect, useState } from "react";
import { fetchCollectionData } from "../../../firebase/firestoreUtils"; // Assuming this utility exists
import { classificationMap } from "../../../utils/mappings"; // Import classificationMap

const ClassificationDashboard = () => {
  const [cadetData, setCadetData] = useState([]);

  useEffect(() => {
    const fetchCadets = async () => {
      const cadets = await fetchCollectionData("Cadets"); // Fetch cadets from Firestore
      const formattedCadets = cadets.map((cadet) => {
        var { forename, surname, startDate, classification } = cadet;
        if (classification === undefined) {
          classification = 1;
        }

        // Calculate service length in months
        const startDateObj = new Date(startDate);
        const today = new Date();
        const serviceLengthInMonths =
          (today.getFullYear() - startDateObj.getFullYear()) * 12 +
          (today.getMonth() - startDateObj.getMonth());

        // Get classification label
        const classificationLabel =
          classificationMap[classification] || "Junior";

        return {
          cadetName: `${forename} ${surname}`,
          serviceLengthInMonths,
          classification,
          classificationLabel
        };
      });

      setCadetData(formattedCadets);
    };

    fetchCadets();
  }, []);

  return (
    <div>
      <h1>Classification Dashboard</h1>
      <p>This is a placeholder for the Classification Dashboard component.</p>
      <pre>{JSON.stringify(cadetData, null, 2)}</pre> {/* Display the array */}
    </div>
  );
};

export default ClassificationDashboard;