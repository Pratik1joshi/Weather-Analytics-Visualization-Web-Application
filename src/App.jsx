import React, { useState } from 'react'
import Sidebar from '../components/Sidebar';
import Map from '../components/Map';
import './index.css'
import { MapContext, MapProvider } from '../context/MapContext';

const App = () => {

  return (
    <MapProvider>
      <div className="flex w-screen h-full">
        <Sidebar className="w-1/4 px-5 py-6" />
        <Map />
      </div>
      </MapProvider>
  );
}

export default App