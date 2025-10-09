# MASTERPLAN.md - RAG AI Chatbot Feature Development

## Project Overview

IntraBot RAG Chatbot - Een geavanceerde AI-powered document processing en chat systeem gebaseerd op Next.js 15, Vercel AI SDK 4.3, en PostgreSQL met vector embeddings.

## Core Architecture

- **Frontend**: Next.js 15.1, React 19, TypeScript, Tailwind CSS
- **Backend**: Vercel AI SDK, OpenAI GPT-4o, Node.js
- **Database**: PostgreSQL met DrizzleORM en pgvector extensie
- **Storage**: Vector embeddings voor document retrieval
- **File Processing**: PDF-parse, pdfjs-dist voor document ingest
- **UI Components**: Framer Motion, Sonner toasts, React Markdown
- **Theming**: Dark/Light mode support with CSS variables
- **State Management**: React Context for theme and chat state

## Project Structuur

```
ai-sdk-preview-rag/
├── app/
│   ├── page.tsx              # Homepage met chat + hover sidebar
│   ├── api/
│   │   ├── chat/route.ts    # Chat API (streaming)
│   │   └── ingest/route.ts  # Document upload
│   └── globals.css          # Perplexity-stijl CSS
├── lib/
│   ├── ai/
│   │   ├── embedding.ts     # Text embeddings
│   │   └── index.ts         # AI utilities
│   ├── chat/
│   │   └── storage.ts       # localStorage chat persistence (Fase 1)
│   ├── db/
│   │   ├── index.ts         # Database client
│   │   ├── migrate.ts       # Migration runner
│   │   └── schema/          # Drizzle schemas
│   └── actions/
│       └── resources.ts     # Document processing
├── components/
│   ├── ui/                  # shadcn/ui components
│   └── theme-toggle.tsx     # Dark mode toggle
├── public/                  # Static assets
├── Dockerfile              # App container
├── compose.yaml            # Docker Compose config
├── drizzle.config.ts       # Drizzle ORM config
├── README.md               # Project overview
├── masterplan.md           # Dit document (feature roadmap)
└── FASE1-CHAT-IMPLEMENTATIE.md  # Technische docs per fase
```

***

## FASE 1: CORE CHAT FUNCTIONALITY

### 1.1 Chat Session Management
- [ ] Chat History Persistence: Save conversations to database
- [ ] Multiple Chat Tabs: Create, switch, and manage multiple conversations  
- [ ] Chat Naming: Auto-generate chat names and manually possibility rename of chats
- [ ] Chat Deletion: Remove individual conversations
- [ ] Session Recovery: Restore chat state on page reload

### 1.2 Message Management
- [ ] Message Threading: Proper conversation flow with message IDs
- [ ] Message Timestamps: Show when messages were sent
- [ ] Message Status: Delivery and read indicators
- [ ] Message Editing: Edit user messages and regenerate responses
- [ ] Message Copying: Copy individual messages to clipboard

### 1.3 Basic UI Improvements
- [ ] Chat Sidebar: List of all conversations with preview
- [ ] Message Formatting: Better markdown rendering and code highlighting
- [ ] Scroll Management: Auto-scroll and scroll-to-bottom functionality
- [ ] Input Enhancements: Multi-line input with Shift+Enter support

***

## FASE 2: USER EXPERIENCE ENHANCEMENTS

### 2.1 Conversatie Features

- [ ] **Typing Indicators**: Real-time "bot is typing" animaties
- [ ] **Message Reactions**: Duim omhoog/omlaag feedback systeem
- [ ] **Conversation Bookmarks**: Belangrijke berichten markeren
- [ ] **Message Search**: Zoeken door chat geschiedenis
- [ ] **Conversation Export**: Download als PDF/TXT


### 2.2 AI Enhancement Features

- [ ] **Follow-up Suggestions**: AI-generated vervolgvragen na responses
- [ ] **Smart Suggestions**: Context-aware vragen gebaseerd op geüploade docs
- [ ] **Auto-Summarization**: Lange documenten automatisch samenvatten
- [ ] **Context Awareness**: Onthoud relevante details uit eerdere berichten

***

## FASE 3: DOCUMENT MANAGEMENT 

### 3.1 Enhanced File Handling

- [ ] **Document Preview**: PDF preview 
- [ ] **Batch Upload**: Meerdere files tegelijk uploaden
- [ ] **Document Categories**: Organiseer uploads in folders/tags
- [ ] **Version Control**: Track document updates en wijzigingen
- [ ] **OCR Support**: Tekst extractie uit afbeeldingen


### 3.2 Multi-Modal Support

- [ ] **Image Upload**: Afbeeldingen verwerken en analyseren
- [ ] **Audio Files**: Speech-to-text voor audio documenten
- [ ] **Video Processing**: Transcript extractie uit video files
- [ ] **Document Metadata**: Extracteer en toon file eigenschappen

***

## FASE 4: ADVANCED UI/UX

### 4.1 Interface Verbeteringen

- [ ] **Dark/Light Mode Toggle**: Dynamische thema switcher
- [ ] **Voice Input/Output**: Spraak-naar-tekst en tekst-naar-spraak
- [ ] **Responsive Design**: Mobile-first optimalisatie
- [ ] **Accessibility**: WCAG 2.1 AA compliance
- [ ] **Keyboard Shortcuts**: Power user navigatie


### 4.2 Visual Enhancements

- [ ] **Message Animations**: Smooth in/out transitions
- [ ] **Progress Indicators**: Upload en processing status
- [ ] **Empty States**: Engaging onboarding screens
- [ ] **Error Handling**: Gebruiksvriendelijke error messages
- [ ] **Loading Skeletons**: Content placeholder animaties

***

## FASE 5: COLLABORATION \& SHARING 

### 5.1 Real-time Features
- [ ] **Comment System**: Notities aan berichten toevoegen


### 5.2 Integration Features

- [ ] **Platform Integraties**: documents van bijv. Google Drive, sharepoint, Github repo's etc etc etc etc etc
- [ ] **Dropbox Integration**: Sync met cloud storage (azure?)
- [ ] **Slack Integration**: Export conversations naar Slack
- [ ] **API Endpoints**: RESTful API voor externe integratie
- [ ] **Webhook Support**: Real-time notificaties naar externe systemen

***

## FASE 6: ANALYTICS \& OPTIMIZATION

### 6.1 Performance Monitoring

- [ ] **Usage Analytics**: Track gesprekken, populaire vragen
- [ ] **Response Quality Scoring**: AI response effectiviteit
- [ ] **Performance Metrics**: Response tijd, accuracy scores
- [ ] **User Behavior Tracking**: Heatmaps en interaction flows
- [ ] **A/B Testing Framework**: Feature experiment platform


### 6.2 Advanced RAG Features

- [ ] **Knowledge Graph Visualization**: Document connecties tonen
- [ ] **Custom Prompts**: Gebruikers kunnen eigen system prompts maken
- [ ] **Conversation Templates**: Herbruikbare chat templates
- [ ] **Semantic Search Enhancement**: Betere vector matching
- [ ] **Multi-Language Support**: Internationale documentverwerking

***

## TECHNISCHE IMPLEMENTATIE DETAILS

### Database Schema Updates

```sql
-- Chat Threading
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  title TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Message History  
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User Feedback
CREATE TABLE message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id),
  user_id UUID REFERENCES users(id),
  feedback_type TEXT CHECK (feedback_type IN ('like', 'dislike')),
  created_at TIMESTAMP DEFAULT NOW()
);
```


### API Route Structure

```typescript
// /api/chat/[id]/route.ts - Persistent conversations
// /api/upload/batch/route.ts - Multi-file uploads  
// /api/documents/preview/[id]/route.ts - Document previews
// /api/analytics/usage/route.ts - Usage tracking
// /api/feedback/route.ts - User feedback collection
```


### Performance Targets

- **Response Time**: < 2 seconden voor chat responses
- **Upload Speed**: < 10 seconden voor 10MB PDF processing
- **Search Latency**: < 500ms voor document search
- **Concurrent Users**: 100+ simultaneous active users
- **Uptime**: 99.9% availability SLA

***

## DEPLOYMENT \& MONITORING

### Staging Environment

- [ ] Separate staging database en environment
- [ ] Automated testing pipeline met Cypress/Playwright
- [ ] Performance benchmarking suite
- [ ] Security scanning met OWASP tools


### Production Deployment

- [ ] Vercel deployment optimalisatie
- [ ] CDN setup voor static assets
- [ ] Database connection pooling
- [ ] Redis caching layer implementatie
- [ ] Monitoring met Sentry en Analytics


### Success Metrics

- **User Engagement**: Average session duration > 5 minuten
- **Document Processing**: 95% successful PDF uploads
- **User Satisfaction**: > 4.5/5 rating gemiddeld
- **Performance**: < 2s average response time
- **Retention**: 70% gebruikers komen terug binnen week
