# Smart Travel Checklist - ChatGPT MCP Connector

A Model Context Protocol (MCP) server that provides an interactive travel checklist widget for ChatGPT. Helps users generate personalized, customizable packing lists based on their trip profile.

**[Privacy Policy](PRIVACY.md)** | **[OpenAI Apps SDK](https://developers.openai.com/apps-sdk)**

## Features

- ✈️ Generate personalized packing checklists based on trip details
- 📋 Smart rules engine for documents, clothing, toiletries, health, tech, and more
- 🌍 International vs domestic trip support with appropriate items
- 👨‍👩‍👧‍👦 Family-specific items for children, infants, seniors, and pets
- 🎿 Activity-specific gear recommendations (hiking, beach, camping, etc.)
- ✅ Interactive checklist with progress tracking
- 🖨️ Print-friendly output

## Checklist Categories

1. **Mandatory Documents** - ID, passport, visa, insurance, itinerary
2. **Clothing & Accessories** - Climate-appropriate items with quantities
3. **Toiletries** - TSA-compliant options for carry-on travelers
4. **Health & Safety** - First aid, medications, sanitizer
5. **Tech & Gadgets** - Phone, chargers, adapters
6. **Activity-Specific Gear** - Based on planned activities
7. **Family-Specific Items** - For children, infants, seniors, pets
8. **Pre-Departure Tasks** - Confirmations, bank notifications, home prep

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
pnpm install
```

### Build the Widget

```bash
pnpm run build
```

### Run Locally

```bash
pnpm start
```

Server runs on `http://localhost:8000`. **Note:** HTTP endpoints are for local development only.

### Deploy to Render.com

1. Push this repo to GitHub
2. Connect to Render.com
3. Create new Web Service from this repo
4. Render will auto-detect `render.yaml` and deploy

## How to Use in ChatGPT

1. Open ChatGPT in **Developer Mode**
2. Add MCP Connector with your deployed URL
3. Say: **"What should I pack for my trip?"** or **"Create a packing list for Paris"**
4. The interactive widget appears!

### Example Prompts

- "I'm going to Paris for 7 days"
- "Help me pack for a beach vacation in Hawaii"
- "Business trip packing list for London"
- "Family vacation checklist with 2 kids"
- "What documents do I need for international travel?"

## Tech Stack

- **MCP SDK** - Model Context Protocol for ChatGPT integration
- **Node.js + TypeScript** - Server runtime
- **Server-Sent Events (SSE)** - Real-time communication
- **React** - Widget UI components
- **Lucide Icons** - Beautiful icons

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
BUTTONDOWN_API_KEY=your_api_key
ANALYTICS_PASSWORD=your_password
```

## Privacy & Data Use

- **What we collect:** When the widget runs inside ChatGPT we receive the location (city/region/country), locale, device/browser fingerprint, and trip query details via `_meta`.
- **How we use it:** These fields feed the `/analytics` dashboard only; we do not sell or share this data.
- **Retention:** Logs are stored for **30 days** in the `/logs` folder and then automatically rotated.
- **User input storage:** The widget caches your checklist progress in `localStorage`; entries expire after **30 days**. Clear anytime with the "Reset" button.

## Monitoring & Alerts

- Visit `/analytics` (Basic Auth protected) to review the live dashboard.
- Alerts for tool failures and subscription issues are logged automatically.

## License

MIT
