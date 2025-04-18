import React, { useRef, useEffect } from "react";
import { Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  LinearScale,
  CategoryScale,
} from "chart.js";
import { classificationMap } from "../../../utils/mappings";

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
  LineElement,
  LinearScale,
  CategoryScale,
  crosshairPlugin
);

const Graph = ({ cadetData, longestServiceInMonths, onPointHover, hoveredCadet, onPointClick }) => {
  const chartRef = useRef(null);

  // Trigger hover logic when hoveredCadet changes
  useEffect(() => {
    if (!chartRef.current || !hoveredCadet || hoveredCadet.length === 0) return;
    const chart = chartRef.current;
    const dataset = chart.data.datasets.find((ds) => ds.label === "Cadets");

    if (dataset) {
      const index = cadetData.findIndex((cadet) => {
        return hoveredCadet.includes(cadet.cadetName); // Check if hoveredCadet array contains cadet.cadetName
      });

      if (index !== -1) {
        const meta = chart.getDatasetMeta(0); // Assuming "Cadets" is the first dataset
        const point = meta.data[index];

        if (point) {
          // Simulate hover by setting the tooltip and triggering the hover effect
          chart.tooltip.setActiveElements(
            [{ datasetIndex: 0, index }],
            { x: point.x, y: point.y }
          );
          chart.update();
        }
      }
    }
  }, [hoveredCadet, cadetData]);

  const handleHover = (event) => {
    if (!chartRef.current || !event) return;

    const chart = chartRef.current;
    const elements = chart.getElementsAtEventForMode(
      event,
      "nearest",
      { intersect: false },
      false
    );

    if (elements.length > 0) {
      const hoveredCadets = elements
        .map((element) => {
          const { datasetIndex, index } = element;
          if (chart.data.datasets[datasetIndex].label === "Cadets") {
            return cadetData[index].cadetName;
          }
          return null;
        })
        .filter(Boolean);

      onPointHover(hoveredCadets);
    } else {
      onPointHover([]);
    }
  };

  const handlePointClick = (event) => {
    if (!chartRef.current || !event) return;

    const chart = chartRef.current;
    const elements = chart.getElementsAtEventForMode(
      event,
      "nearest",
      { intersect: true },
      false
    );

    if (elements.length > 0) {
      const { datasetIndex, index } = elements[0];
      if (chart.data.datasets[datasetIndex].label === "Cadets") {
        onPointClick(cadetData[index].cadetName);
      }
    }
  };

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
          { x: longestServiceInMonths || 50, y: 12 }, // Use default value if longestServiceInMonths is not yet updated   
        ],
        backgroundColor: "rgba(255, 99, 132, 0.6)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 2,
        showLine: true,
        pointRadius: 0,
        hoverRadius: 0,
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
            return null;
          },
        },
      },
    },
    interaction: {
      intersect: false,
      axis: "xy",
    },
    onHover: (event, chartElement) => {
      const canvas = event.native?.target;
      if (chartElement.length > 0) {
        handleHover(event.native);
        canvas.style.cursor = "pointer"; 
      } else {
        onPointHover([]);
        canvas.style.cursor = "default";
      }
    },
    onClick: handlePointClick,
    scales: {
      x: {
        title: {
          display: true,
          text: "Service Length (Months)",
        },
        min: 0,
        max: longestServiceInMonths,
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
      <Scatter ref={chartRef} data={scatterData} options={scatterOptions} />
    </div>
  );
};

export default Graph;
