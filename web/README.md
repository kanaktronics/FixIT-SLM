# FIXIT web

A local chat interface for FIXIT SLM. It talks to Ollama at `http://localhost:11434` and keeps chat history in the browser. Nothing leaves your machine.

```bash
npm install
npm run dev      # http://localhost:3000
```

The status dot turns amber once a model named `fixit-slm` is available in Ollama. See the main README for how to create it.
