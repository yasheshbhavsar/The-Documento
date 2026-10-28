"use client";

import { Globe } from "./cobe-globe";

const markers = [
  { id: "usa", location: [39.0, -98.0] as [number, number], label: "USA" },
  { id: "uk", location: [51.5074, -0.1278] as [number, number], label: "UK" },
  { id: "canada", location: [45.4215, -75.6972] as [number, number], label: "Canada" },
  { id: "australia", location: [-33.8688, 151.2093] as [number, number], label: "Australia" },
  { id: "germany", location: [52.5200, 13.4050] as [number, number], label: "Germany" },
];

export default function GlobeDemo() {
  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-white p-8 overflow-hidden">
      <div className="w-full max-w-lg">
        <Globe
          markers={markers}
          arcs={[]}
          markerColor={[0.05, 0.41, 0.40]}
          baseColor={[1, 1, 1]}
          arcColor={[0.05, 0.41, 0.40]}
          glowColor={[0.74, 0.90, 0.85]}
          dark={0}
          mapBrightness={6}
          markerSize={0.045}
          markerElevation={0.01}
        />
      </div>
    </div>
  );
}
