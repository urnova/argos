# Argos - Global Conflict Monitoring Platform

## Overview
A real-time global conflict and geopolitical alert monitoring platform. It aggregates data from multiple sources (GDELT, RSS feeds, UCDP, Ukraine Alerts) and displays them on an interactive 3D globe. Features AI-powered briefings and a WebSocket-based live update system.

## Architecture

- **Frontend**: React + Vite (served via Express in dev, static in prod) on port 5000
- **Backend**: Express.js + TypeScript with WebSocket server
- **Database**: PostgreSQL via Drizzle ORM
- **Shared**: Schema types in `shared/schema.ts`

## Key Directories

- `client/` - React frontend (Vite root)
- `server/` - Express backend + WebSocket server
- `server/services/` - Data fetching services (GDELT, RSS, UCDP, Ukraine alerts, AI)
- `shared/` - Shared TypeScript types and Drizzle schema
- `script/` - Build scripts

## Database Schema

Tables:
- `alerts` - Geopolitical/conflict alerts with lat/lng, type, severity, AI verification
- `briefings` - AI-generated hourly briefings (persisted in DB)
- `api_keys` - API key management

## Running the Project

```bash
npm run dev        # Start dev server (port 5000)
npm run build      # Build for production
npm run start      # Start production server
npm run db:push    # Push schema changes to DB
```

## Deployment

- Target: `vm` (always-running, needs WebSockets and background schedulers)
- Build: `npm run build`
- Run: `npm run start`

## Data Sources

- **GDELT**: Global conflict events (fetched every 15 minutes)
- **RSS**: News alerts (every 10 minutes)
- **UCDP**: Uppsala Conflict Data Program (every 6 hours)
- **Ukraine Alerts**: Air raid alerts (every 2 minutes)
- **AI Briefings**: Hourly Argos IA briefings via AI service

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (required)
- `PORT` - Server port (default: 5000)
- Additional API keys may be needed for AI/Telegram services
