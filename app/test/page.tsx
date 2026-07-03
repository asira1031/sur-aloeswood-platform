"use client";

export default function TestPage() {
  async function generateVideo() {
    console.log("BUTTON CLICKED");

    try {
      const response = await fetch("/api/heygen/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          script:
            "Hi, I'm Antonio Coral, Vice President of TDI. Welcome to our technology platform.",
        }),
      });

      const data = await response.json();

      console.log("HEYGEN RESPONSE:", data);
    } catch (err) {
      console.error("ERROR:", err);
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <button onClick={generateVideo}>
        Generate Antonio Video
      </button>
    </div>
  );
}