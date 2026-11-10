# Pane And Portal Studio

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cc51fa93-d87b-4555-856c-a48c5bd105bc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating). The app runs in local demo mode with an in-memory database; Supabase credentials are not required.

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Open `http://localhost:5173` and choose one of the demo roles. Data is stored locally and remains after restarting the development server.

The local demo uses SQLite at `data/demo.sqlite`. The schema is in [db/schema.sql](./db/schema.sql) and the reproducible synthetic seed is in [db/seed.sql](./db/seed.sql); the first startup seeds the database automatically. The SQLite file is ignored by Git.

### Lokale AI met Ollama

Installeer Ollama via [ollama.com/download](https://ollama.com/download) en start daarna in PowerShell:

```powershell
ollama pull qwen3.5:9b
ollama serve
```

Maak vervolgens `.env` aan op basis van [.env.example](./.env.example), of gebruik de standaardwaarden. Start de ontwikkelserver opnieuw met `npm run dev`. De AI-agent in **Verkoopassistent** gebruikt dan Ollama via de server op `http://127.0.0.1:11434`.

Een ander lokaal model kan met `OLLAMA_MODEL` worden ingesteld, bijvoorbeeld `qwen2.5:7b`. De AI geeft alleen voorstellen; CPQ-validatie en prijsberekening blijven server-side leidend.
