import { useState, useEffect } from "react";
import { Mic, Upload, ShieldAlert, ChevronLeft } from "lucide-react";
import { useRecorder } from "../hooks/useRecorder"; // <- NEW HOOK
import WaveformRecorder from "../components/WaveformRecorder";
import WaveformVisualizer from "../components/WaveformVisualizer";

function bufferToWavBlob(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  let offset = 0;

  function writeString(s) {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset++, s.charCodeAt(i));
    }
  }

  function writeUint16(data) {
    view.setUint16(offset, data, true);
    offset += 2;
  }

  function writeUint32(data) {
    view.setUint32(offset, data, true);
    offset += 4;
  }

  writeString("RIFF");
  writeUint32(length - 8);
  writeString("WAVE");
  writeString("fmt ");
  writeUint32(16);
  writeUint16(1);
  writeUint16(numOfChan);
  writeUint32(buffer.sampleRate);
  writeUint32(buffer.sampleRate * numOfChan * 2);
  writeUint16(numOfChan * 2);
  writeUint16(16);
  writeString("data");
  writeUint32(buffer.length * numOfChan * 2);

  const interleaved = new Int16Array(buffer.length * numOfChan);
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      let sample = buffer.getChannelData(ch)[i];
      sample = Math.max(-1, Math.min(1, sample));
      interleaved[i * numOfChan + ch] =
        sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
  }

  for (let i = 0; i < interleaved.length; i++, offset += 2) {
    view.setInt16(offset, interleaved[i], true);
  }

  return new Blob([view], { type: "audio/wav" });
}

export default function HomePage() {
  const [showRecorder, setShowRecorder] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [detectedEmotion, setDetectedEmotion] = useState("");
  const [predictionTable, setPredictionTable] = useState([]);

  const { startRecording, stopRecording, isRecording, audioURL, stream, setAudioURL, } =
    useRecorder({
      timeLimit: 4000,
    });

  useEffect(() => {
    const sendToBackend = async () => {
      if (!audioURL) return;

      const response = await fetch(audioURL);
      const blob = await response.blob();
      setAudioFile(blob);

      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      try {
        const res = await fetch("https://vbdrs-gru-backend-1.onrender.com/predict", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Prediction failed");

        const data = await res.json();
        setDetectedEmotion(data.emotion);
        setPredictionTable((prev) => [
          ...(data.prediction_table || []),
          ...prev,
        ]);
      } catch (err) {
        console.error("Error predicting:", err);
        alert("Prediction failed.");
      }
    };

    sendToBackend();
  }, [audioURL]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];

    if (!file || file.size > 5 * 1024 * 1024) {
      alert("File must be a WAV and less than 5MB.");
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();

      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Get first 4 seconds
      const duration = 4; // seconds
      const trimmedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        Math.min(audioBuffer.sampleRate * duration, audioBuffer.length),
        audioBuffer.sampleRate
      );

      for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        trimmedBuffer
          .getChannelData(i)
          .set(audioBuffer.getChannelData(i).slice(0, trimmedBuffer.length));
      }

      // Encode back to WAV
      const wavBlob = bufferToWavBlob(trimmedBuffer);

      const formData = new FormData();
      formData.append("audio", wavBlob, file.name);

      const response = await fetch("https://vbdrs-gru-backend-1.onrender.com/predict", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Prediction failed");

      const data = await response.json();
      setDetectedEmotion(data.emotion);
      setPredictionTable((prev) => [...(data.prediction_table || []), ...prev]);
    } catch (error) {
      console.error("Error handling uploaded audio:", error);
      alert("Error processing audio file. Try another WAV file.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col p-0 m-0">
      <header className="w-full bg-gray-800 flex justify-left items-center px-4 py-4 shadow-md">
        <span className="text-xl font-semibold flex items-center gap-2">
          <ShieldAlert className="text-red-400 w-6 h-6" />
          VBDRS
        </span>
      </header>

      <main className="w-full max-w-4xl mx-auto text-center p-4 md:p-8">
        <h1 className="text-2xl md:text-4xl font-bold mt-6">
          VOICE-BASED DANGER RECOGNITION SYSTEM
        </h1>
        <p className="italic text-xs md:text-sm mt-2 px-2 text-gray-300 leading-relaxed">
          Voice-Based Danger Recognition System is a Web System created for the
          study{" "}
          <q>
            An Enhancement of Gated Recurrent Unit (GRU) for Speech Emotion
            Recognition in the Implementation of Voice-Based Danger Recognition
            System
          </q>
          . This detects 6 classified emotions namely: Sad, Happy, Anger,
          Disgust, Fear, and Neutral and correlates the 'Fear' emotion to the
          state of danger.
        </p>

        {!showRecorder ? (
          <div className="flex flex-col md:flex-row justify-center items-center gap-6 mt-10">
            <button
              className="w-60 h-40 bg-red-500 text-white flex flex-col items-center justify-center rounded-lg shadow hover:bg-red-600 transition"
              onClick={() => setShowRecorder(true)}
            >
              <Mic className="w-10 h-10 text-gray-900" />
              <span className="mt-2 font-medium text-gray-900">
                Record an Audio
              </span>
              <span className="text-sm italic mt-1 text-gray-500">
                Max. of 4 seconds
              </span>
            </button>

            <label className="w-60 h-40 bg-gray-800 text-white flex flex-col items-center justify-center rounded-lg shadow hover:bg-gray-700 transition cursor-pointer">
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Upload className="w-10 h-10" />
              <span className="mt-2 font-medium">Upload a File</span>
              <span className="text-sm italic mt-1 text-gray-400">
                Max. of 5 MB
              </span>
            </label>
          </div>
        ) : (
          <div className="mt-10 w-full flex flex-col items-center">
            <div className="w-full max-w-2xl h-40 bg-gray-800 rounded-lg mb-4 flex items-center justify-center">
              {isRecording ? (
                <WaveformVisualizer stream={stream} isRecording={isRecording} />
              ) : audioURL ? (
                <audio src={audioURL} controls className="mx-auto mt-2" />
              ) : (
                <p className="text-gray-500">
                  Click the mic to start recording
                </p>
              )}
            </div>

            <div className="w-full flex items-center justify-between mb-4">
              <button
                className="bg-gray-700 p-4 rounded-full text-white hover:bg-gray-600 transition ml-4"
                onClick={() => {
                  setShowRecorder(false);
                  setAudioURL(null); // <- clear the audio blob
                }}
                title="Back"
              >
                <ChevronLeft className="w-6 h-6 text-gray-700" />
              </button>
              <div className="flex-1 flex justify-center">
                <button
                  className="bg-gray-700 p-4 rounded-full text-white hover:bg-gray-600 transition"
                  onClick={isRecording ? stopRecording : startRecording}
                  title={isRecording ? "Stop Recording" : "Start Recording"}
                >
                  <Mic className="w-6 h-6 text-gray-900" />
                </button>
              </div>
              <div style={{ width: "56px" }} />{" "}
            </div>

            <span className="mt-2 text-sm italic text-gray-400">
              Max. of 4 seconds
            </span>
          </div>
        )}

        <div className="mt-10 bg-gray-800 rounded-lg p-6 text-center w-full max-w-3xl mx-auto">
          <p className="italic text-gray-300">Detected Emotion:</p>
          <p className="text-xl font-semibold mt-1 text-white">
            {detectedEmotion ? detectedEmotion.toUpperCase() : "—"}
          </p>

          <p className="mt-4 italic text-gray-300">Result:</p>
          {detectedEmotion ? (
            <p
              className={`text-2xl font-bold mt-1 ${
                detectedEmotion.toLowerCase() === "fear"
                  ? "text-red-500"
                  : "text-green-400"
              }`}
            >
              {detectedEmotion.toLowerCase() === "fear"
                ? "Danger Detected!"
                : "No Danger Detected."}
            </p>
          ) : (
            <p className="text-2xl font-semibold mt-1 text-gray-400">—</p>
          )}
        </div>

        {predictionTable.length > 0 ? (
          <div className="overflow-x-auto mt-4">
            <table className="w-full table-auto text-sm text-left text-white border border-gray-600">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-2 border border-gray-600">
                    True Emotion
                  </th>
                  <th className="px-4 py-2 border border-gray-600">
                    Predicted Emotion
                  </th>
                  <th className="px-4 py-2 border border-gray-600">
                    Predicted Probability
                  </th>
                </tr>
              </thead>
              <tbody>
                {predictionTable.map((row, index) => (
                  <tr key={index} className="bg-gray-800 hover:bg-gray-700">
                    <td className="px-4 py-2 border border-gray-600">
                      {row["True Emotion"]}
                    </td>
                    <td className="px-4 py-2 border border-gray-600">
                      {row["Predicted Emotion"]}
                    </td>
                    <td className="px-4 py-2 border border-gray-600">
                      {(row["Predicted Probability"] * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 mt-2 text-sm italic">
            No predictions yet.
          </p>
        )}
        {predictionTable.length > 0 && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setPredictionTable([])}
              className="text-sm text-gray-900 hover:underline"
            >
              Clear Prediction Log
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
