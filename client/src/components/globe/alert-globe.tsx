import { useEffect, useRef, useState } from "react";
import Globe, { GlobeMethods } from "react-globe.gl";
import { type Alert } from "@shared/routes";

interface AlertGlobeProps {
  alerts: Alert[];
}

export function AlertGlobe({ alerts }: AlertGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeEl = useRef<GlobeMethods | undefined>();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    
    window.addEventListener("resize", updateSize);
    updateSize();
    
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    // Add auto-rotation
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 0.5;
      globeEl.current.pointOfView({ altitude: 2.5 });
    }
  }, []);

  // Format alerts for react-globe.gl
  const activeAlerts = alerts.filter(a => a.status === 'active');
  
  const ringsData = activeAlerts.map(alert => ({
    lat: parseFloat(alert.lat),
    lng: parseFloat(alert.lng),
    maxR: alert.severity === 'critical' ? 8 : alert.severity === 'high' ? 5 : 3,
    propagationSpeed: alert.severity === 'critical' ? 2 : 1,
    repeatPeriod: alert.severity === 'critical' ? 500 : 1000,
    color: getSeverityColor(alert.severity),
  }));

  const arcsData = activeAlerts
    .filter(a => a.type === 'missile')
    .map(alert => {
      // Create a simulated arc from a random origin to the alert destination for visual flair
      const targetLat = parseFloat(alert.lat);
      const targetLng = parseFloat(alert.lng);
      return {
        startLat: targetLat + (Math.random() * 20 - 10),
        startLng: targetLng + (Math.random() * 20 - 10),
        endLat: targetLat,
        endLng: targetLng,
        color: ['rgba(255, 0, 60, 0.1)', 'rgba(255, 0, 60, 1)'],
      };
    });

  return (
    <div ref={containerRef} className="w-full h-full bg-background absolute inset-0 cursor-move">
      <Globe
        ref={globeEl}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)"
        
        ringsData={ringsData}
        ringColor="color"
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        
        arcsData={arcsData}
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={1500}
        arcsTransitionDuration={1000}
      />
    </div>
  );
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical': return '#ff003c'; // Neon Red
    case 'high': return '#ff8a00'; // Neon Orange
    case 'medium': return '#ffd600'; // Yellow
    case 'low': return '#00f0ff'; // Cyan
    default: return '#ffffff';
  }
}
