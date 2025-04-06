import React, { useEffect, useState } from 'react';

const LogoRibbons = () => {
    const [tiltOffset, setTiltOffset] = useState(0);

    useEffect(() => {
        if (window.DeviceOrientationEvent) {
            const handleTilt = (event) => {
                // Get gamma value (left-right tilt)
                const tilt = event.gamma;
                // Convert tilt to pixel offset (-20px to 20px range)
                const offset = Math.min(Math.max(tilt * 2, -20), 20);
                setTiltOffset(offset);
            };

            window.addEventListener('deviceorientation', handleTilt);
            return () => window.removeEventListener('deviceorientation', handleTilt);
        }
    }, []);

    return (
        <div className="logo-ribbons">
            <div 
                className="ribbon ribbon-1" 
                style={{ transform: `translateX(${tiltOffset * 0.8}px)` }}
            />
            <div 
                className="ribbon ribbon-2" 
                style={{ transform: `translateX(${tiltOffset * -1.2}px)` }}
            />
            <div 
                className="ribbon ribbon-3" 
                style={{ transform: `translateX(${tiltOffset}px)` }}
            />
        </div>
    );
};

export default LogoRibbons;