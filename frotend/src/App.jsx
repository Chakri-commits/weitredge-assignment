import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL;

function App() {
  const [sessionId, setSessionId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize session
  useEffect(() => {
    let stored = localStorage.getItem("sessionId");

    if (!stored) {
      stored = crypto.randomUUID();
      localStorage.setItem("sessionId", stored);
    }

    setSessionId(stored);
    fetchMessages(stored);
  }, []);

  // Fetch conversation
  const fetchMessages = async (id) => {
    try {
      const res = await fetch(`${API}/api/conversations/${id}`);
      const data = await res.json();
      setMessages(data || []);
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!message.trim()) return;

    setLoading(true);

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          message,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("");
        await fetchMessages(sessionId);
      } else {
        alert(data.error || "Something went wrong");
      }
    } catch (err) {
      console.error("Chat error", err);
      alert("Server error");
    } finally {
      setLoading(false);
    }
  };

  // Start new chat
  const newChat = () => {
    const newId = crypto.randomUUID();
    localStorage.setItem("sessionId", newId);
    setSessionId(newId);
    setMessages([]);
  };

  return (
    <div className="h-screen flex flex-col p-4 bg-gray-100">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">AI Support Assistant</h1>
        <button
          onClick={newChat}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          New Chat
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto my-4 bg-white shadow rounded p-4">
        {messages.length === 0 && (
          <p className="text-gray-400 text-center">Start a conversation...</p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 ${
              msg.role === "user" ? "text-right" : "text-left"
            }`}
          >
            <div
              className={`inline-block px-4 py-2 rounded-lg ${
                msg.role === "user"
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              {msg.content}
            </div>

            {msg.created_at && (
              <div className="text-xs text-gray-400 mt-1">
                {new Date(msg.created_at).toLocaleString()}
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2"
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded"
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default App;
