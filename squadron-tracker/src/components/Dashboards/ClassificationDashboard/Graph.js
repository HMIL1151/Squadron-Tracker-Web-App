import React from "react";
import { Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement, // Register LineElement
  LinearScale,
  CategoryScale,
} from "chart.js";
import { classificationMap } from "../../../utils/mappings"; // Import classificationMap

// Crosshair plugin
const crosshairPlugin = {
  id: "crosshair",
  afterDraw: (chart) => {
    if (chart.tooltip?._active?.length) {
      const ctx = chart.ctx;
      const activePoint = chart.tooltip._active[0];
      const { x, y } = activePoint.element;
      const { left, bottom } = chart.chartArea;

      ctx.save();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      // Vertical line: from point down to x-axis
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, bottom);
      ctx.stroke();

      // Horizontal line: from point to y-axis
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(left, y);
      ctx.stroke();

      // Draw the x-axis value at the bottom of the vertical line
      const xValue = Math.round(chart.scales.x.getValueForPixel(x));
      if (xValue % 5 !== 0) {
        ctx.font = "bold 12px Arial";
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.textAlign = "center";
        ctx.fillText(`${xValue}`, x, bottom + 18); // Adjust position as needed
      }

      // Calculate intersection with the red "Target Classification" line
      const targetDataset = chart.data.datasets.find(
        (dataset) => dataset.label === "Target Classification"
      );
      if (targetDataset) {
        const targetData = targetDataset.data;
        for (let i = 0; i < targetData.length - 1; i++) {
          const point1 = targetData[i];
          const point2 = targetData[i + 1];

          if (xValue >= point1.x && xValue <= point2.x) {
            // Linear interpolation to find the y-value on the target line
            const slope = (point2.y - point1.y) / (point2.x - point1.x);
            const yTarget = point1.y + slope * (xValue - point1.x);
            const yTargetPixel = chart.scales.y.getPixelForValue(yTarget);

            // Only draw the lines if the hovered point is below the red line
            if (chart.scales.y.getValueForPixel(y) < yTarget) {
              // Vertical line: from point up to the target line
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x, yTargetPixel);
              ctx.stroke();

              // Horizontal line: from the intersection point to the y-axis
              ctx.beginPath();
              ctx.moveTo(x, yTargetPixel);
              ctx.lineTo(left, yTargetPixel);
              ctx.stroke();
            }
            break;
          }
        }
      }

      ctx.restore();
    }
  },
};

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement, // Register LineElement
  LinearScale,
  CategoryScale,
  crosshairPlugin
);

const Graph = ({ cadetData, onPointHover }) => {
  const scatterData = {
    datasets: [
      {
        label: "Cadets",
        data: cadetData.map((cadet) => ({
          x: cadet.serviceLengthInMonths,
          y: cadet.classification,
        })),
        backgroundColor: "rgba(75, 192, 192, 0.6)",
        borderColor: "rgba(75, 192, 192, 1)",
        pointRadius: 5,
        hoverRadius: 8,
      },
      {
        label: "Target Classification",
        data: [
          { x: 0, y: 1 },
          { x: 2, y: 2 },
          { x: 6, y: 3 },
          { x: 12, y: 6 },
          { x: 36, y: 12 },
          { x: 50, y: 12 },
        ],
        backgroundColor: "rgba(255, 99, 132, 0.6)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 2,
        showLine: true, // Ensures the points are connected with a line
        pointRadius: 0, // Hides the points
        hoverRadius: 0, // Hides hover effect on points
      },
    ],
  };

  const scatterOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: "top",
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context) => {
            if (context.dataset.label === "Cadets") {
              const cadet = cadetData[context.dataIndex];
              return `${cadet.cadetName}`;
            }
            return null; // No tooltip for the guideline
          },
        },
      },
    },
    interaction: {
      mode: "nearest",
      intersect: true,
    },
    onHover: (event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        onPointHover(cadetData[index].cadetName); // Notify parent of the hovered cadet
      } else {
        onPointHover(null); // Clear hover when no point is hovered
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Service Length (Months)",
        },
        min: 0,
        max: 50,
        grid: {
          drawOnChartArea: true,
        },
      },
      y: {
        title: {
          display: true,
          text: "Classification",
        },
        min: 1,
        max: 13,
        ticks: {
          stepSize: 1,
          callback: (value) => classificationMap[value] || value,
        },
        grid: {
          drawOnChartArea: true,
        },
      },
    },
    elements: {
      point: {
        hoverBorderWidth: 2,
      },
    },
  };

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Scatter data={scatterData} options={scatterOptions} />
    </div>
  );
};

export default Graph;
