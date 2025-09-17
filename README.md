Pdf dependency toegevoegd voor ingest deel: 
npm i pdf-parse
npm i pdf-parse pdfjs-dist


docker run --name rag-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=rag -p 5432:5432 -d ankane/pgvector:latest

  Env file:

   ```
   OPENAI_API_KEY=your_api_key_here
   DATABASE_URL=your_postgres_connection_string_here
   ```


npm install
npm run db:migrate
npm run dev

open http://localhost:3000 en http://localhost:3000/upload

