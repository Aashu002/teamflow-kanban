import React, { createContext, useContext, useState, useCallback } from 'react';

const NavbarContext = createContext();

export function NavbarProvider({ children }) {
  const [projectName, setProjectName] = useState(null);
  const [onBack, setOnBack] = useState(null);

  const setHeaderData = useCallback((data) => {
    setProjectName(data?.projectName || null);
    setOnBack(() => data?.onBack || null);
  }, []);

  const clearHeaderData = useCallback(() => {
    setProjectName(null);
    setOnBack(null);
  }, []);

  return (
    <NavbarContext.Provider value={{ projectName, onBack, setHeaderData, clearHeaderData }}>
      {children}
    </NavbarContext.Provider>
  );
}

export function useNavbar() {
  const context = useContext(NavbarContext);
  if (!context) {
    throw new Error('useNavbar must be used within a NavbarProvider');
  }
  return context;
}
