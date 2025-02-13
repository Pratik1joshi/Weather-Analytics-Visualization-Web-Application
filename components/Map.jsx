import React, { useContext, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import * as d3 from 'd3';
import 'leaflet/dist/leaflet.css';
import { MapContext } from '../context/MapContext';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const Map = () => {
  const { dataType: selectedDataType } = useContext(MapContext);
  const [mapData, setMapData] = useState({ precipitation: null, temperature: null });
  const [hoveredData, setHoveredData] = useState(null);
  const [currentLevel, setCurrentLevel] = useState('province');
  const [activeLayer, setActiveLayer] = useState(null);
  const [activeProvinceId, setActiveProvinceId] = useState(null);
  const [activeDistrictName, setActiveDistrictName] = useState(null);
  const [activeProvinceName, setActiveProvinceName] = useState(null);

  const mapRef = useRef(null);
  const provinceLayerRef = useRef(null);
  const districtLayerRef = useRef(null);
  const municipalityLayerRef = useRef(null);
  const labelsLayerRef = useRef(null);
  const legendRef = useRef(null);

  const precipitationColorScale = d3.scaleSequential()
    .domain([0, 50])
    .interpolator(d3.interpolateBlues);

  const temperatureColorScale = d3.scaleSequential()
    .domain([0, 50])
    .interpolator(d3.interpolateReds);

  const getStyle = (feature, data) => {
    const baseStyle = {
      weight: 1,
      opacity: 1,
      color: 'black',
      fillOpacity: 0.7,
    };
  
    // Get the region name based on the level
    const regionName = feature.properties.LOCAL ||
      feature.properties.DISTRICT ||
      feature.properties.PR_NAME;
  
    // Create the correct data key
    const dataKey = feature.properties.LOCAL 
      ? `${feature.properties.LOCAL}_${feature.properties.DISTRICT}` 
      : regionName;
  
    // Get the value from the data
    const value = data?.data?.[dataKey]?.[selectedDataType];
    const colorScale = selectedDataType === 'precipitation' 
      ? precipitationColorScale 
      : temperatureColorScale;
  
    return {
      ...baseStyle,
      fillColor: value != null ? colorScale(value) : '#cccccc',
    };
  };

  const loadGeoJSONForRegion = async (level, regionId = null, districtName = null) => {
    try {
      let geoJSON = { features: [] };
      let response;
  
      // First load the GeoJSON
      if (level === 'municipality' && districtName) {
        response = await fetch('/Palika.json');
        geoJSON = await response.json();
        geoJSON.features = geoJSON.features.filter(
          (feature) => feature.properties.DISTRICT === districtName
        );
      } else if (level === 'district' && regionId) {
        response = await fetch('/District.json');
        geoJSON = await response.json();
        geoJSON.features = geoJSON.features.filter(
          (feature) => Number(feature.properties.PROVINCE) === Number(regionId)
        );
      } else if (level === 'province') {
        response = await fetch('/Province.json');
        geoJSON = await response.json();
      }
  
      // Load the data from your backend
      const [precipData, tempData] = await Promise.all([
        fetch(`http://localhost:5001/getprecipitation?level=${level}&type=precipitation&source=era5`)
          .then(res => res.json()),
        fetch(`http://localhost:5001/getprecipitation?level=${level}&type=temperature&source=era5`)
          .then(res => res.json())
      ]);
  
      // Update the mapData state
      setMapData({
        precipitation: precipData,
        temperature: tempData
      });
  
      // Return both geoJSON and the current data type's data
      return {
        geoJSON,
        data: selectedDataType === 'precipitation' ? precipData : tempData
      };
    } catch (error) {
      console.error('Error loading data:', error);
      return null;
    }
  };

  const clearLayer = () => {
    if (mapRef.current && activeLayer) {
      mapRef.current.removeLayer(activeLayer);
      setActiveLayer(null);
    }
  };

  const clearAllLayers = () => {
    if (mapRef.current && activeLayer) {
      mapRef.current.removeLayer(activeLayer);
      setActiveLayer(null);
    }

    if (mapRef.current && provinceLayerRef.current) {
      mapRef.current.removeLayer(provinceLayerRef.current);
    }
  };

  const resetToProvince = () => {
    clearLabels();
    clearTheLayer(districtLayerRef);
    clearTheLayer(municipalityLayerRef);

    if (provinceLayerRef.current) {
      mapRef.current.removeLayer(provinceLayerRef.current);
      provinceLayerRef.current = null;
    }

    setActiveProvinceId(null);
    setActiveProvinceName(null);
    setActiveDistrictName(null);
    setCurrentLevel('province');

    loadGeoJSONForRegion('province').then((data) => {
      if (data?.geoJSON) {
        const layer = createLayer(data.geoJSON, data[selectedDataType], 'province');
        layer.addTo(mapRef.current);
        provinceLayerRef.current = layer;

        addLabels(data.geoJSON.features);
      }
    });

    mapRef.current.setView([28.394857, 84.124008], 6.5);
  };

  const handleBreadcrumbClick = async (level, provinceId = null) => {
    switch (level) {
      case 'province':
        resetToProvince();
        break;
      case 'district':
        if (provinceId) {
          clearLabels();
          clearTheLayer(districtLayerRef);
          clearTheLayer(municipalityLayerRef);

          const data = await loadGeoJSONForRegion('district', provinceId);
          if (data?.geoJSON) {
            const districtsLayer = createLayer(data.geoJSON, data[selectedDataType], 'district');
            districtsLayer.addTo(mapRef.current);
            districtLayerRef.current = districtsLayer;

            addLabels(data.geoJSON.features);

            mapRef.current.fitBounds(districtsLayer.getBounds());
            setCurrentLevel('district');
            setActiveProvinceId(provinceId);
          }
        }
        break;
      default:
        break;
    }
  };

  const clearTheLayer = (layerRef) => {
    if (layerRef.current) {
      mapRef.current.removeLayer(layerRef.current);
      layerRef.current = null;
    }
  };

  const handleProvinceClick = async (provinceId, provinceName) => {
    clearLabels();
    clearTheLayer(districtLayerRef);
    clearTheLayer(municipalityLayerRef);

    const data = await loadGeoJSONForRegion('district', provinceId);
    if (data?.geoJSON) {
      const districtsLayer = createLayer(data.geoJSON, data[selectedDataType], 'district');
      districtsLayer.addTo(mapRef.current);
      districtLayerRef.current = districtsLayer;

      addLabels(data.geoJSON.features);

      mapRef.current.fitBounds(districtsLayer.getBounds());
      setActiveProvinceId(provinceId);
      setActiveProvinceName(provinceName);
      setCurrentLevel('district');
    }
  };

  const handleDistrictClick = async (districtName) => {
    clearLabels();
    clearTheLayer(municipalityLayerRef);

    const data = await loadGeoJSONForRegion('municipality', null, districtName);
    if (data?.geoJSON) {
      const municipalitiesLayer = createLayer(data.geoJSON, data[selectedDataType], 'municipality');
      municipalitiesLayer.addTo(mapRef.current);
      municipalityLayerRef.current = municipalitiesLayer;

      addLabels(data.geoJSON.features);

      mapRef.current.fitBounds(municipalitiesLayer.getBounds());
      setActiveDistrictName(districtName);
      setCurrentLevel('municipality');
    }
  };

  const showDistricts = async (provinceId) => {
    const data = await loadGeoJSONForRegion('district', provinceId);
    if (data?.geoJSON) {
      const districtsLayer = createLayer(data.geoJSON, data[selectedDataType], 'district');
      districtsLayer.addTo(mapRef.current);
      mapRef.current.fitBounds(districtsLayer.getBounds());

      setActiveLayer(districtsLayer);
      setActiveProvinceId(provinceId);
      setCurrentLevel('district');
    }
  };

  const showMunicipalities = async (districtName) => {
    const data = await loadGeoJSONForRegion('municipality', null, districtName);
    if (data?.geoJSON) {
      const municipalitiesLayer = createLayer(data.geoJSON, data[selectedDataType], 'municipality');
      municipalitiesLayer.addTo(mapRef.current);
      mapRef.current.fitBounds(municipalitiesLayer.getBounds());

      setActiveLayer(municipalitiesLayer);
      setActiveDistrictName(districtName);
      setCurrentLevel('municipality');
    }
  };

  const clearLabels = () => {
    if (mapRef.current && labelsLayerRef.current) {
      mapRef.current.removeLayer(labelsLayerRef.current);
      labelsLayerRef.current = null;
    }
  };

  const addLabels = (features) => {
    clearLabels();

    labelsLayerRef.current = L.layerGroup();

    features.forEach(feature => {
      const layer = L.geoJSON(feature);
      const center = layer.getBounds().getCenter();

      const regionName = feature.properties.LOCAL ||
        feature.properties.DISTRICT ||
        feature.properties.PR_NAME;

      const formattedRegionName = regionName.split(' ').join('<br>');
      const label = L.divIcon({
        className: 'map-label',
        html: `<div class="bg-opacity-75 px-2 py-1 rounded text-xs">${formattedRegionName}</div>`,
        iconSize: [100, 20],
        iconAnchor: [50, 10]
      });

      const marker = L.marker(center, { icon: label, interactive: false });
      marker.addTo(labelsLayerRef.current);

      marker.on('add', () => {
        const mapBounds = mapRef.current.getBounds();
        const markerLatLng = marker.getLatLng();
        const offset = 0.1;

        if (!mapBounds.contains(markerLatLng)) {
          const newLatLng = {
            lat: Math.max(mapBounds.getSouth() + offset, Math.min(mapBounds.getNorth() - offset, markerLatLng.lat)),
            lng: Math.max(mapBounds.getWest() + offset, Math.min(mapBounds.getEast() - offset, markerLatLng.lng))
          };
          marker.setLatLng(newLatLng);
        }
      });
    });

    labelsLayerRef.current.addTo(mapRef.current);
  };

  const addLegend = (map, options) => {
    const {
      position = 'bottomright',
      title = 'Legend',
      grades = [0, 10, 20, 30, 40],
      colorScale,
      unit = ''
    } = options;

    const legend = L.control({ position });

    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'legend bg-white p-2 rounded shadow');

      div.innerHTML += `<h4 class="font-semibold mb-2">${title}</h4>`;

      for (let i = 0; i < grades.length; i++) {
        const color = colorScale(grades[i]);
        const rangeText = `${grades[i]}${grades[i + 1] ? `&ndash;${grades[i + 1]}` : '+'}`;

        div.innerHTML +=
          `<div class="flex items-center mb-1">` +
          `<i style="background: ${color}; width: 18px; height: 18px; display: inline-block; margin-right: 5px;"></i>` +
          `${rangeText}${unit}</div>`;
      }

      return div;
    };

    return legend.addTo(map);
  };

  // useEffect(() => {
  //   if (legendRef.current) {
  //     legendRef.current.remove();
  //   }
  
  //   const legendOptions = {
  //     title: selectedDataType === 'precipitation' ? 'Precipitation (mm)' : 'Temperature (°C)',
  //     colorScale: selectedDataType === 'precipitation' ? precipitationColorScale : temperatureColorScale,
  //     unit: selectedDataType === 'precipitation' ? 'mm' : '°C'
  //   };
  
  //   if (mapRef.current) {
  //     legendRef.current = addLegend(mapRef.current, legendOptions);
  //   }
  
  //   // Update all layers
  //   if (provinceLayerRef.current) {
  //     provinceLayerRef.current.setStyle((feature) => getStyle(feature, mapData[selectedDataType]));
  //   }
  //   if (districtLayerRef.current) {
  //     districtLayerRef.current.setStyle((feature) => getStyle(feature, mapData[selectedDataType]));
  //   }
  //   if (municipalityLayerRef.current) {
  //     municipalityLayerRef.current.setStyle((feature) => getStyle(feature, mapData[selectedDataType]));
  //   }
  // }, [selectedDataType, mapData, mapRef.current]);

  const createLayer = (geoJSON, data, level) => {
    const layer = L.geoJSON(geoJSON, {
      style: (feature) => getStyle(feature, data),
      onEachFeature: (feature, layer) => {
        const regionName = feature.properties.LOCAL ||
          feature.properties.DISTRICT ||
          feature.properties.PR_NAME;

        const dataKey = feature.properties.LOCAL ? `${feature.properties.LOCAL}_${feature.properties.DISTRICT}` : regionName;

        layer.on({
          mouseover: () => {
            layer.setStyle({
              weight: 2,
              fillOpacity: 0.9,
            });
            const value = mapData[selectedDataType]?.data?.[dataKey]?.[selectedDataType];
            console.log(mapData)
            setHoveredData({
              name: regionName,
              value: value ? value.toFixed(2) : 'N/A',
              unit: selectedDataType === 'precipitation' ? 'mm' : '°C'
            });
          },
          mouseout: () => {
            layer.setStyle(getStyle(feature, data));
            setHoveredData(null);
          },
          click: (e) => {
            if (level === 'province') {
              const provinceId = feature.properties.PROVINCE;
              const provinceName = feature.properties.PR_NAME;
              handleProvinceClick(provinceId, provinceName);
            } else if (level === 'district') {
              const districtName = feature.properties.DISTRICT;
              handleDistrictClick(districtName);
            }
          },
        });
      },
    });

    return layer;
  };

  const Breadcrumbs = () => {
    const items = [
      { level: 'province', name: 'Nepal' },
      activeProvinceName && {
        level: 'district',
        name: activeProvinceName,
        provinceId: activeProvinceId
      },
      activeDistrictName && {
        level: 'municipality',
        name: activeDistrictName
      }
    ].filter(Boolean);

    return (
      <div className="absolute top-4 left-12 bg-white px-4 py-2 rounded shadow z-[1000]">
        <nav className="flex" aria-label="Breadcrumb">
          {items.map((item, index) => (
            <React.Fragment key={item.level}>
              {index > 0 && <span className="mx-2 text-gray-500">/</span>}
              <button
                onClick={() => handleBreadcrumbClick(item.level, item.provinceId)}
                className={`hover:text-blue-600 ${index === items.length - 1
                  ? 'text-gray-900 font-semibold'
                  : 'text-gray-500'
                  } ${item.level !== 'municipality' ? 'cursor-pointer' : 'cursor-default'}`}
                disabled={item.level === 'municipality'}
              >
                {item.name}
              </button>
            </React.Fragment>
          ))}
        </nav>
      </div>
    );
  };

  useEffect(() => {
    const map = L.map('map', {
      center: [28.394857, 84.124008],
      zoom: 6.5,
      minZoom: 6,
      maxZoom: 12,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // const legendOptions = {
    //   title: selectedDataType === 'precipitation' ? 'Precipitation (mm)' : 'Temperature (°C)',
    //   colorScale: selectedDataType === 'precipitation' ? precipitationColorScale : temperatureColorScale,
    //   unit: selectedDataType === 'precipitation' ? 'mm' : '°C'
    // };

    mapRef.current = map;

    const legendOptions = {
      title: selectedDataType === 'precipitation' ? 'Precipitation (mm)' : 'Temperature (°C)',
      colorScale: selectedDataType === 'precipitation' ? precipitationColorScale : temperatureColorScale,
      unit: selectedDataType === 'precipitation' ? 'mm' : '°C'
    };
    legendRef.current = addLegend(map, legendOptions);

    loadGeoJSONForRegion('province').then((data) => {
      if (data?.geoJSON) {
        const layer = createLayer(data.geoJSON, data[selectedDataType], 'province');
        layer.addTo(map);
        provinceLayerRef.current = layer;

        addLabels(data.geoJSON.features);
      }
    });

    const style = document.createElement('style');
    style.textContent = `
      .map-label {
        background: transparent;
        border: none;
        box-shadow: none;
      }
      .map-label div {
        white-space: nowrap;
        text-align: center;
        font-weight: 500;
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (map) map.remove();
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
  
    // Update layers when data type changes
    const updateLayers = async () => {
      if (currentLevel === 'province') {
        const data = await loadGeoJSONForRegion('province');
        if (provinceLayerRef.current && data) {
          provinceLayerRef.current.setStyle(feature => getStyle(feature, data.data));
        }
      } else if (currentLevel === 'district' && activeProvinceId) {
        const data = await loadGeoJSONForRegion('district', activeProvinceId);
        if (districtLayerRef.current && data) {
          districtLayerRef.current.setStyle(feature => getStyle(feature, data.data));
        }
      } else if (currentLevel === 'municipality' && activeDistrictName) {
        const data = await loadGeoJSONForRegion('municipality', null, activeDistrictName);
        if (municipalityLayerRef.current && data) {
          municipalityLayerRef.current.setStyle(feature => getStyle(feature, data.data));
        }
      }
  
      // Update legend
      if (legendRef.current) {
        legendRef.current.remove();
        const legendOptions = {
          title: selectedDataType === 'precipitation' ? 'Precipitation (mm)' : 'Temperature (°C)',
          colorScale: selectedDataType === 'precipitation' ? precipitationColorScale : temperatureColorScale,
          unit: selectedDataType === 'precipitation' ? 'mm' : '°C'
        };
        legendRef.current = addLegend(mapRef.current, legendOptions);
      }
    };
  
    updateLayers();
  }, [selectedDataType, currentLevel, activeProvinceId, activeDistrictName]);

  return (
    <div className="h-[95vh] w-full relative">
      <div id="map" className='w-full h-full'></div>
      <Breadcrumbs />
      <div className="absolute top-4 right-4 bg-white p-4 rounded shadow z-[1000]">
      {hoveredData && (
    <div>
      <h3 className="font-semibold">{hoveredData.name}</h3>
      <p>{hoveredData.value} {hoveredData.unit}</p>
    </div>
  )}
      </div>
    </div>
  );
};

export default Map;