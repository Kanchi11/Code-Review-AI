# AI-Powered ChatBox

An interactive **React-based chat interface** connected to a mock streaming API. This project simulates an AI assistant that improves content by providing real-time feedback and edit suggestions.

---

## Features

- Real-time streaming of AI messages
- Edit suggestion cards (approve or reject)
- Voice input and transcription simulation
- Text-to-speech playback per persona
- Dark mode with theme toggle
- Settings panel for persona & stream speed
- Export chat history to JSON
- Copy messages to clipboard
- Scroll-to-top detection and button
- Persona-specific behavior (creative, technical, casual, professional)
- Type-safe with TypeScript

---


## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/chatbox-app.git
cd chatbox-app
```

### 2. Start the server

```bash
cd server
npm install
node server.js
```

This runs the mock streaming API at:  
`http://localhost:3001/api/stream`

### 3. Start the React frontend

```bash
cd client
npm install
npm start
```

Open in your browser:  
`http://localhost:3000`

---

## API Streaming Format

The frontend listens to the streaming endpoint using `EventSource` (Server-Sent Events). The stream emits `JSON` chunks with types such as:

```json
{
  "type": "streaming",
  "text": "[]Here is a sentence being streamed"
}
```

And finally:

```json
{
  "type": "final_message",
  "text": "Full response text...",
  "message": "Final message to show"
}
```

---

## Mock Voice Transcription

When recording is stopped, it randomly selects a transcription from predefined strings.

```ts
const mockTranscriptions = [
  "Make this more engaging please",
  "Add some technical details",
  ...
];
```

---

## Tech Stack

- Frontend: React, TypeScript
- Backend: Node.js, Express, Server-Sent Events (SSE)
- Styling: Tailwind CSS (via utility classes)
- Icons: react-icons
- Voice APIs: Web Speech API (mocked)

---

## To-Do

- [ ] Add real voice-to-text via Whisper API or browser speech API
- [ ] Support for real-time backend (e.g. OpenAI)
- [ ] Better mobile/responsive design
- [ ] Authenticated chat sessions

---

## Author

Built  by Kanchana Dhana Sadaivan.

---

# Code-Review-AI
