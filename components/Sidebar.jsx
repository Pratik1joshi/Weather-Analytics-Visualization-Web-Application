import React, { useContext, useState } from 'react';
import { Archive, Map as MapIcon } from 'lucide-react';
import { MapContext } from '../context/MapContext';

const Sidebar = () => {
  const [activeTab, setActiveTab] = useState('map');
  const {dataType, setDataType} = useContext(MapContext);
  
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setDataType(tab);
  };

  return (
    <div className="w-1/4 h-full bg-white shadow-lg">
      {/* Tabs */}
      <div className="flex">
        <button
          onClick={() => handleTabChange('archive')}
          className={`flex-1 py-6 flex items-center justify-center gap-2 font-medium transition-all border-b-2
            ${activeTab === 'archive' 
              ? 'text-blue-600 border-blue-600 bg-blue-50' 
              : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'}`}
        >
          <Archive className="w-5 h-5" />
          <span className="text-base">Archive</span>
        </button>
        <button
          onClick={() => handleTabChange('map')}
          className={`flex-1 py-6 flex items-center justify-center gap-2 font-medium transition-all border-b-2
            ${activeTab === 'map' 
              ? 'text-blue-600 border-blue-600 bg-blue-50' 
              : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'}`}
        >
          <MapIcon className="w-5 h-5" />
          <span className="text-base">Map</span>
        </button>
      </div>

      {/* Content */}
      <div className="p-8 w-[230] h-full">
        {activeTab === 'map' && (
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-base font-medium text-gray-900">Data Type</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="mapType"
                    value="precipitation"
                    checked={dataType === 'precipitation'}
                    onChange={(e) => setDataType(e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Precipitation</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="mapType"
                    value="temperature"
                    checked={dataType === 'temperature'}
                    onChange={(e) => setDataType(e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Temperature</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;