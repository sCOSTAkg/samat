# Overview

This is a Mastra-based agentic automation framework built for Replit. The application enables users to create AI-powered automations using agents, tools, and workflows with two primary trigger types: time-based (cron) and webhook-based (Slack, Telegram, Linear, etc.). The system uses Mastra as the core framework with Inngest providing durable workflow execution and orchestration.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Framework Stack

**Mastra Framework** - The application is built on Mastra (`@mastra/core`), an all-in-one TypeScript framework for building AI-powered agents and workflows. Mastra provides:
- Agent creation with LLM integration (OpenAI, Google, OpenRouter)
- Workflow orchestration with step-based execution
- Memory management for conversation history and semantic recall
- Tool execution for extending agent capabilities

**Inngest Integration** - Durable workflow execution is achieved through Inngest (`@mastra/inngest`, `inngest`), which:
- Provides step-by-step memoization (completed steps are skipped on retry)
- Enables real-time monitoring via publish-subscribe system
- Handles event-driven workflow triggers
- Supports suspend/resume functionality for human-in-the-loop interactions

Rationale: Inngest was chosen over basic execution to ensure workflows can recover from failures in production, picking up exactly where they left off without re-executing completed steps.

## Trigger Architecture

The system supports two trigger patterns, each with distinct routing:

**Time-Based Triggers (Cron)** - Registered via `registerCronTrigger()` in `src/triggers/cronTriggers.ts`:
- Uses standard 5-field cron expressions for scheduling
- Triggers workflows without external input (empty input schemas required)
- Registration happens before Mastra initialization, not in apiRoutes array
- Inngest evaluates cron expressions and fires at scheduled times

**Webhook Triggers** - Registered via connector-specific functions (e.g., `registerTelegramTrigger`, `registerSlackTrigger`):
- Creates HTTP endpoints using `registerApiRoute()` from `src/mastra/inngest`
- Routes follow pattern: `/webhooks/{provider}/action` or `/{connector}/webhook`
- Event routing through Inngest: `event/api.webhooks.{provider}.action`
- Validates payloads, then triggers workflows via `workflow.start()`

Rationale: Separating trigger types allows clean handling of scheduled vs. event-driven workflows, with Inngest providing consistent orchestration for both.

## Agent & Memory System

**Agent Configuration** - Agents are created with:
- System instructions defining personality and behavior
- Model selection (supports 600+ models via AI SDK)
- Optional tools for API calls, database queries, custom functions
- Memory for conversation history and context persistence

**Memory Architecture** - Two-tier scoping system:
- **Thread-scoped** (default): Memory isolated per conversation thread
- **Resource-scoped**: Memory persists across all threads for same user/entity
- Storage backends: LibSQL (`:memory:` or file-based), PostgreSQL, Upstash Redis
- Three memory types: working memory, conversation history, semantic recall (RAG-based)

Rationale: Memory scoping provides flexibility for both isolated conversations and persistent user preferences, while multiple storage options support different deployment scenarios.

## Workflow Execution Model

**Step-Based Workflows** - Created with `createWorkflow` and `createStep`:
- Input/output schemas using Zod for type safety
- Chaining via `.then()` for sequential execution
- Parallel execution via `.parallel()` for concurrent steps
- Input mapping via `.map()` for schema transformation

**Suspend/Resume Pattern** - Enables human-in-the-loop interactions:
- Workflows can pause at any step using `suspend()`
- State persisted as snapshots in storage
- Resume with additional data when ready
- Status types: `running`, `suspended`, `success`, `failed`

Rationale: Step-based workflows provide explicit control over task execution order, while suspend/resume enables complex approval flows and multi-turn interactions that agents alone cannot handle reliably.

## Streaming & Real-Time Feedback

**Streaming API** - Dual streaming approach:
- `.stream()` for AI SDK v5 models (LanguageModelV2)
- `.streamLegacy()` for AI SDK v4 models (LanguageModelV1) - required for Replit Playground UI compatibility

**Event Types** - Granular execution tracking:
- Agent events: `text-delta`, `tool-call`, `tool-result`, `finish`
- Workflow events: `step-start`, `step-finish`, `finish`
- Network events: `routing-agent-start`, `agent-execution-event-*`, etc.

Rationale: Streaming provides immediate user feedback for long-running operations, while the legacy API maintains compatibility with Replit's existing UI infrastructure.

## Data Flow & Integration Points

**Mastra Server** - Central orchestration (runs on `localhost:5000` in dev):
- Registers agents, workflows, tools
- Exposes Inngest webhook endpoint at `/api/inngest`
- Handles HTTP routes for webhook triggers
- Provides playground UI for testing

**Inngest Dev Server** - Orchestration runtime (runs on `localhost:3000` in dev):
- Connects to Mastra server via `-u http://localhost:5000/api/inngest`
- Executes workflow steps with memoization
- Provides dashboard for monitoring execution
- Handles event routing and step coordination

Rationale: Separating the Mastra server from Inngest runtime allows independent scaling and provides clear separation between application logic and orchestration infrastructure.

# External Dependencies

## AI Model Providers
- **OpenAI** (`@ai-sdk/openai`) - GPT-4o, GPT-4o-mini models
- **Google** (`@ai-sdk/google`) - Gemini models
- **OpenRouter** (`@openrouter/ai-sdk-provider`) - Access to multiple LLM providers
- Requires API keys via environment variables (`OPENAI_API_KEY`, etc.)

## Storage & Databases
- **LibSQL** (`@mastra/libsql`) - Embedded SQL database with vector support, file or memory-based
- **PostgreSQL** (`@mastra/pg`, `@types/pg`) - Primary production database option with pgvector extension
- **Upstash** - Redis and Vector services for serverless deployments

Note: While PostgreSQL support is included via `@mastra/pg`, the application may not currently use it. Future changes may add PostgreSQL as the default storage provider.

## Messaging & Communication
- **Slack** (`@slack/web-api`) - Slack bot integration for message handling
- **Telegram** - Bot API integration for message/webhook handling (via `TELEGRAM_BOT_TOKEN`)
- **WhatsApp** - Business API integration (requires multiple env vars: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_PHONE_NUMBER_ID`, etc.)

## Search & Data Retrieval
- **Exa** (`exa-js`) - Web search and content retrieval API

## Workflow Orchestration
- **Inngest** (`inngest`, `@inngest/realtime`) - Durable workflow execution with step memoization
- **Inngest CLI** (`inngest-cli`) - Development server for local testing

## Development Tools
- **TypeScript** (`typescript`, `@types/node`) - Type safety and compilation
- **TSX** (`tsx`) - TypeScript execution for development and testing
- **Mastra CLI** (`mastra`) - Development server and build tools (`npm run dev`, `npm run build`)
- **Prettier** - Code formatting
- **Pino** (`pino`, `@mastra/loggers`) - Production logging

## Runtime Requirements
- Node.js >= 20.9.0 (specified in package.json engines)
- ES2022 module system (ESM) with bundler resolution