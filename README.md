Pdf dependency toegevoegd voor ingest deel: 
npm i pdf-parse /
npm i pdfjs-dist@3


docker run --name rag-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=rag -p 5432:5432 -d ankane/pgvector:latest

docker exec -it rag-pg psql -U postgres -d rag -c "ALTER TABLE resources ADD COLUMN filename TEXT;"


  Env file:

   ```
   OPENAI_API_KEY=your_api_key_here
   DATABASE_URL=your_postgres_connection_string_here
   ```

rm -rf .next
npm install
npm run db:migrate
npm run dev

open http://localhost:3000 

