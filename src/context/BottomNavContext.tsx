import React, { createContext, useContext, useState } from 'react';

interface BottomNavContextType {
    isBottomNavVisible: boolean;
    hideBottomNav: () => void;
    showBottomNav: () => void;
}

const BottomNavContext = createContext<BottomNavContextType>({
    isBottomNavVisible: true,
    hideBottomNav: () => { },
    showBottomNav: () => { },
});

export const BottomNavProvider = ({ children }: { children: React.ReactNode }) => {
    const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);

    const hideBottomNav = () => setIsBottomNavVisible(false);
    const showBottomNav = () => setIsBottomNavVisible(true);

    return (
        <BottomNavContext.Provider value={{ isBottomNavVisible, hideBottomNav, showBottomNav }}>
            {children}
        </BottomNavContext.Provider>
    );
};

export const useBottomNav = () => useContext(BottomNavContext);
