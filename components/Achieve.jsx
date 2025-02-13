import React, { useState, useRef } from "react";
import Chart from "chart.js/auto";

const Achieve = () => {
  const [file, setFile] = useState(null);
  const [progressVisible, setProgressVisible] = useState(false);
  const [chartVisible, setChartVisible] = useState(false);
  const [weatherChart, setWeatherChart] = useState(null);
  const [isFiltered, setIsFiltered] = useState(false);
  const chartRef = useRef(null);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) {
      alert("Please select a file.");
      return;
    }

    if (file.type !== "text/csv") {
      alert("Please upload a valid CSV file.");
      return;
    }

    const formData = new FormData();
    formData.append("csvFile", file);

    setProgressVisible(true);

    try {
      const response = await fetch("http://localhost:3000/upload", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unknown server error");
      }

      alert(result.message);
    } catch (error) {
      alert(`Error uploading file: ${error.message}`);
    } finally {
      setProgressVisible(false);
    }
  };

  const handleChart = async () => {
    const location = document.getElementById("locationInput").value;
    const source = document.querySelector('input[name="source"]:checked')?.value;
    let date = document.getElementById("dateInput").value;
    let startDate, endDate;

    if (isFiltered) {
      startDate = document.getElementById("startDateInput").value;
      endDate = document.getElementById("endDateInput").value;
      if (!startDate || !endDate) {
        alert("Please fill out both start and end dates.");
        return;
      }
      date = `${startDate}&endDate=${endDate}`;
    }

    if (!location || !date || !source) {
      alert("Please fill out all inputs.");
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:3000/get-chart?location=${location}&date=${date}&source=${source}`
      );
      if (!response.ok) {
        const { message } = await response.json();
        alert(message);
        return;
      }

      const data = await response.json();
      const labels = data.map((row) => row.Hour);
      const temperatures = data.map((row) => row.Temperature);
      const winds = data.map((row) => row.Wind);
      const rains = data.map((row) => row.Rain ?? 0);

      if (weatherChart) weatherChart.destroy();

      const ctx = chartRef.current.getContext("2d");
      const newChart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Temperature (°C)",
              data: temperatures,
              borderColor: "rgba(255, 99, 132, 1)",
              borderWidth: 2,
              fill: false,
              tension: 0.2,
            },
            {
              label: "Wind (km/h)",
              data: winds,
              borderColor: "rgba(54, 162, 235, 1)",
              borderWidth: 2,
              fill: false,
              tension: 0.2,
            },
            {
              label: "Rain (mm)",
              data: rains,
              borderColor: "rgba(75, 192, 192, 1)",
              borderWidth: 2,
              fill: false,
              tension: 0.2,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "top" } },
          scales: {
            x: { title: { display: true, text: "Hours" } },
            y: { title: { display: true, text: "Metrics" }, beginAtZero: true },
          },
        },
      });

      setWeatherChart(newChart);
      setChartVisible(true);
    } catch (error) {
      alert("Failed to fetch data or render graph.");
    }
  };

  const closeChart = () => {
    if (weatherChart) weatherChart.destroy();
    setWeatherChart(null);
    setChartVisible(false);
  };

  return (
    <div className="container mx-auto p-6" style={{ fontFamily: "Arial, sans-serif" }}>
      <h1 className="text-2xl font-bold mb-4">Upload CSV File</h1>
      <form onSubmit={handleUpload} className="mb-6">
        <input type="file" accept=".csv" onChange={handleFileChange} className="block mb-2" />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Upload</button>
      </form>
      {progressVisible && <progress value="0" max="100" className="block mb-4"></progress>}

      <h2 className="text-xl font-semibold mb-4">Download Data</h2>
      <input id="locationInput" type="text" placeholder="Enter location" required className="block mb-4 p-2 border rounded" />
      <div className="mb-4">
        <label className="mr-4">
          <input type="radio" name="dataType" value="raw" defaultChecked onChange={() => setIsFiltered(false)} /> Raw Data
        </label>
        <label>
          <input type="radio" name="dataType" value="filtered" onChange={() => setIsFiltered(true)} /> Filtered Data
        </label>
      </div>
      {isFiltered ? (
        <div className="mb-4">
          <label htmlFor="startDateInput" className="block mb-2">Start Date</label>
          <input id="startDateInput" type="date" required className="block mb-4 p-2 border rounded" />
          <label htmlFor="endDateInput" className="block mb-2">End Date</label>
          <input id="endDateInput" type="date" required className="block mb-4 p-2 border rounded" />
        </div>
      ) : (
        <div className="mb-4">
          <label htmlFor="dateInput" className="block mb-2">Date</label>
          <input id="dateInput" type="date" required className="block mb-4 p-2 border rounded" />
        </div>
      )}
      <div className="mb-4">
        <label className="mr-4">
          <input type="radio" name="source" value="GFS" defaultChecked /> GFS
        </label>
        <label className="mr-4">
          <input type="radio" name="source" value="ICON" /> ICON
        </label>
        <label>
          <input type="radio" name="source" value="ECMWF" /> ECMWF
        </label>
      </div>
      <button onClick={handleChart} className="bg-green-500 text-white px-4 py-2 rounded">Show Chart</button>
      {chartVisible && (
        <div className="mt-6">
          <canvas ref={chartRef} width="400" height="200" className="mb-4"></canvas>
          <button onClick={closeChart} className="bg-red-500 text-white px-4 py-2 rounded">Close Chart</button>
        </div>
      )}
    </div>
  );
};

export default Achieve;
