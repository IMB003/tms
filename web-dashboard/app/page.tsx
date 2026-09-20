"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://tms-backend-u82f.onrender.com");
const queueId = "60cc4028-3d4c-4ea1-a877-5be5491224ce";

export default function Dashboard() {
  const [activeToken, setActiveToken] = useState<any>(null);
  const [pendingTokens, setPendingTokens] = useState<any[]>([]);

  // Fetch initial state and listen for live updates
  useEffect(() => {
    fetch(`https://tms-backend-u82f.onrender.com/api/queues/${queueId}/state`)
      .then(res => res.json())
      .then(data => {
        setActiveToken(data.activeToken);
        setPendingTokens(data.pendingTokens);
      });

    socket.emit("join_queue", queueId);

    // When a user requests a new token from their phone
    socket.on("token_added", (newToken) => {
      console.log("📡 SOCKET MESSAGE RECEIVED token_added:", data);
      setPendingTokens((prev) => [...prev, newToken]);
    });

    // When the business clicks Next or Skip
    socket.on("queue_updated", (newState) => {
      console.log("📡 SOCKET MESSAGE RECEIVED queue_updated:", data);
      setActiveToken(newState.activeToken);
      setPendingTokens(newState.pendingTokens);
    });

    return () => {
      socket.off("token_added");
      socket.off("queue_updated");
    };
  }, []);

  // Admin Actions
  const callNextPatient = async () => {
    await fetch('https://tms-backend-u82f.onrender.com/api/queues/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId })
    });
  };

  const skipPatient = async (tokenId: string) => {
    await fetch('https://tms-backend-u82f.onrender.com/api/tokens/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenId, queueId })
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex p-8 gap-8">
      
      {/* LEFT: Public Live TV Display */}
      <div className="flex-1 bg-white rounded-2xl shadow-xl p-12 text-center flex flex-col justify-center border-4 border-gray-200">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Public TV Display</h1>
        <p className="text-gray-500 mb-8">General Consultation</p>
        
        <div className="bg-blue-600 rounded-xl p-10 mb-8 shadow-inner transform transition-all">
          <h2 className="text-blue-200 text-2xl font-semibold mb-2">NOW SERVING</h2>
          <div className="text-9xl font-black text-white">
            {activeToken ? activeToken.tokenNumber : "--"}
          </div>
        </div>
        <h3 className="text-2xl font-semibold text-gray-600">Please proceed to the desk</h3>
      </div>

      {/* RIGHT: Private Business Control Panel */}
      <div className="w-1/3 bg-white rounded-2xl shadow-xl p-8 flex flex-col">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-4 mb-4">Doctor's Dashboard</h2>
        
        <button 
          onClick={callNextPatient}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-4 rounded-xl shadow-lg mb-8 transition-colors text-lg"
        >
          Call Next Patient
        </button>

        <h3 className="font-semibold text-gray-700 border-b pb-2 mb-4">
          Waiting ({pendingTokens.length})
        </h3>
        <ul className="space-y-3 overflow-y-auto flex-1">
          {pendingTokens.map((t) => (
            <li key={t.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex justify-between items-center group">
              <span className="font-bold text-lg text-gray-700">Token #{t.tokenNumber}</span>
              <button 
                onClick={() => skipPatient(t.id)}
                className="text-red-500 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
              >
                Mark No-Show
              </button>
            </li>
          ))}
          {pendingTokens.length === 0 && (
            <p className="text-gray-400 text-center italic mt-4">The queue is empty.</p>
          )}
        </ul>
      </div>

    </div>
  );
}