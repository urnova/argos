## Packages
react-globe.gl | 3D interactive globe visualization
three | Peer dependency for react-globe.gl
date-fns | Date formatting for alerts history
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility for merging tailwind classes

## Notes
The application features a real-time 3D globe. 
Alerts are polled every 3 seconds to update the UI and globe automatically.
Missiles are rendered as arcs (using a simulated origin offset for visual effect).
Conflicts are rendered as expanding rings.
Warnings are rendered as glowing points.
