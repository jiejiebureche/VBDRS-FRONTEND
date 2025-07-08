import { useEffect, useRef, useState } from "react";

export function useRecorder({ timeLimit = 4000 } = {}) {
  const [audioURL, setAudioURL] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);

  const startRecording = async () => {
    try {
      const userStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setStream(userStream);
      setAudioURL(null);
      audioChunks.current = [];

      const recorder = new MediaRecorder(userStream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        setAudioURL(URL.createObjectURL(blob));
        setIsRecording(false); // <- Ensure this is triggered
        userStream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // 🔥 THIS is key: clear any previous timer and ensure exact timing
      if (mediaRecorderRef.current.stopTimeout) {
        clearTimeout(mediaRecorderRef.current.stopTimeout);
      }

      mediaRecorderRef.current.stopTimeout = setTimeout(() => {
        if (mediaRecorderRef.current.state === "recording") {
          recorder.stop();
        }
      }, timeLimit + 200);
    } catch (err) {
      alert("Microphone access denied or error occurred.");
      console.error("Recording error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return { startRecording, stopRecording, isRecording, audioURL, stream, setAudioURL, };
}
