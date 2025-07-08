import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";

export default function WaveformRecorder({ audioURL }) {
  const containerRef = useRef(null);
  const waveRef = useRef(null);

  useEffect(() => {
    if (!audioURL || !containerRef.current) return;

    // Clean up existing wave if present
    if (waveRef.current) {
      waveRef.current.destroy();
    }

    waveRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#6b7280", // gray-500
      progressColor: "#ffffff",
      height: 60,
      barWidth: 2,
      cursorWidth: 0,
      responsive: true,
    });

    waveRef.current.load(audioURL);

    return () => waveRef.current?.destroy();
  }, [audioURL]);

  return <div ref={containerRef} className="w-full h-16" />;
}
