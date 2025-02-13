import React, { createContext, useContext, useState } from 'react';

export const MapContext = createContext();

export const MapProvider = ({ children }) => {
  const [dataType, setDataType] = useState('precipitation');
  return (
    <MapContext.Provider value={{ dataType, setDataType }}>
      {children}
    </MapContext.Provider>
  );
};