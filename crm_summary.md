# Complete Architecture & Implementation Guide: CRM Portal

This document is the exhaustive technical blueprint of the Customer Relationship Management (CRM) portal built during the internship. It covers **everything** from the database schema and backend API routes to the frontend Angular components, third-party integrations, and the inner workings of the AI processing pipelines.

---

## 1. Project Overview & Objective
The CRM Portal is a full-stack web application designed to centralize lead management, automate data extraction from complex documents using AI, and provide real-time updates across the system. It replaces manual data entry with intelligent, template-driven OCR and automated webhook integrations from platforms like LinkedIn.

---

## 2. Tech Stack & Environment

### Frontend
- **Framework**: Angular 17.3 (TypeScript, HTML5, CSS3)
- **PDF Rendering**: `pdfjs-dist` (Version ^3.11.174) for rendering documents natively on HTML5 canvases.
- **State Management & Reactivity**: RxJS

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (`pg` library)
- **AI / LLM Integration**: Google Gemini API (`@google/generative-ai`) via the `gemini-2.5-flash` model.
- **File Handling**: `multer` (configured for memory storage).
- **Environment**: `dotenv` for managing secrets (DB credentials, API keys, Webhook secrets).

---

## 3. Database Schema (PostgreSQL)

The system operates on four primary tables. The backend includes automated scripts (`alter_db_*.js`) that ensure the schema is initialized and migrated automatically on server start.

### Table: `leads` (Formerly `employees`)
Stores all lead data, whether entered manually, parsed via OCR, or received via LinkedIn webhooks.
- `id` (SERIAL PRIMARY KEY)
- `name` (VARCHAR)
- `department` (VARCHAR)
- `email` (VARCHAR)
- `status` (VARCHAR, Default 'New') - Enum: New, Contacted, Qualified, Converted, Rejected
- `source` (VARCHAR, Default 'Website') - Enum: Website, Referral, Social Media, Direct, Other, Webhook
- `notes` (TEXT)
- `created_at` (TIMESTAMP)
- `company` (VARCHAR)
- `linkedin_id` (VARCHAR UNIQUE) - Prevents duplicate leads from LinkedIn.

### Table: `admin_users`
Stores credentials and profile data for CRM administrators.
- `id` (SERIAL PRIMARY KEY)
- `username` (VARCHAR UNIQUE)
- `password` (VARCHAR)
- `full_name` (VARCHAR, Default 'Admin')
- `profile_image` (TEXT, Base64 or URL)
- `updated_at` (TIMESTAMP)

### Table: `notifications`
Stores system events to be displayed in the frontend bell icon.
- `id` (SERIAL PRIMARY KEY)
- `message` (TEXT)
- `type` (VARCHAR) - e.g., 'lead_added', 'lead_deleted'
- `lead_name` (VARCHAR)
- `is_read` (BOOLEAN, Default FALSE)
- `created_at` (TIMESTAMP)

### Table: `ocr_template_mappings` (Formerly `bill_scan_templates`)
Stores the visual bounding-box coordinates created by users in the Annotation Tool.
- `id` (SERIAL PRIMARY KEY)
- `document_name` (VARCHAR)
- `document_type` (VARCHAR UNIQUE) - e.g., 'work_order', 'purchase_order'
- `annotations` (JSONB) - Contains the normalized X, Y, Width, and Height of every mapped field.
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

## 4. Backend Architecture: Routes & Services

The Express application is modularized into distinct domains, mounted in `index.js`.

### API Routes
1. **`/api/auth`**: Handles user login and session creation against the `admin_users` table.
2. **`/api/leads`**: 
   - Provides full CRUD (Create, Read, Update, Delete) for leads.
   - Hosts the `/stream` endpoint which upgrades the HTTP connection to a Server-Sent Events (SSE) stream.
   - When a lead is added/updated/deleted, this route emits events (`NEW_LEAD`, `LEAD_UPDATED`, `LEAD_DELETED`) to the SSE stream and logs an entry in the `notifications` table.
3. **`/api/webhook`**:
   - `/linkedin`: Processes inbound webhooks from LinkedIn Lead Gen Forms. It verifies the `x-linkedin-webhook-secret` header, handles LinkedIn's challenge codes, and passes the payload to `linkedin.service.js`.
   - `/generic`: A generic webhook endpoint for tools like Zapier or Postman testing.
4. **`/api/ocr`**:
   - Accepts a single file upload. Uses Gemini 2.5 Flash to extract basic candidate info (Name, Email, Phone, Skills, University) and returns a strict JSON object.
5. **`/api/bill-scan`**:
   - The most complex endpoint. It first looks up the document type in `ocr_template_mappings`.
   - It dynamically builds a JSON Schema representing the required fields based on the user's annotations.
   - It prompts Gemini 2.5 Flash with the document image and the exact coordinates (bounding boxes) for each field.
   - **Fault Tolerance**: If the Gemini API returns a `429 Quota Exceeded` error, it falls back to a massive predefined object of mock data (Work Orders, Purchase Orders, Invoices) so frontend testing can continue seamlessly.
6. **`/api/annotation-templates`**: Handles fetching and saving the JSONB annotation templates to the database.
7. **`/api/notifications`**: Endpoints to fetch unread notifications, mark them as read, or clear them.
8. **`/api/profile`**: Endpoints to fetch and update the admin user's details and profile picture.

### Core Services
- **`sse.service.js`**: Manages an array of active HTTP responses. Provides methods to broadcast JSON payloads to all connected clients.
- **`linkedin-sync.service.js` & `linkedin.service.js`**: Reaches out to the LinkedIn API to resolve Form Question IDs to actual human-readable answers, maps them to database columns (like 'Work email' -> `email`, 'Company name' -> `company`), and inserts them via `pool.query`.

---

## 5. Frontend Architecture: Angular Components

The UI is built as a Single Page Application (SPA) with Angular, utilizing modular components.

### Core Components
- **`dashboard`**: 
  - The primary view. Features top-level metric cards (Total Leads, New, Converted, Rejected).
  - Contains a robust HTML table with local search filtering, pagination, and status badge styling.
  - Includes modal popups for adding, editing, and confirming the deletion of leads.
- **`annotation-tool`**: 
  - A highly interactive UI. Users upload a blank template (e.g., a PDF Work Order).
  - The component renders the PDF onto an HTML `<canvas>`.
  - Implements mouse-tracking (mousedown, mousemove, mouseup) to let users "draw" boxes over the canvas.
  - Calculates the normalized percentages (X%, Y%, W%, H%) of these boxes relative to the document size, assigns a label (e.g., "Invoice Number"), and saves this configuration to the backend.
- **`bill-scanner`**: 
  - Allows the user to select a predefined template type (e.g., "Work Order").
  - Takes a file upload and sends it to the backend's `/api/bill-scan` route.
  - Displays the successfully mapped fields extracted by the AI, and flags any fields the template expected but the AI couldn't find.
- **`ocr-scanner`**: 
  - A streamlined drag-and-drop interface specifically for extracting standard candidate/resume data.
- **`menu` & `main-layout`**: 
  - The application shell, sidebar navigation, and top header. The header contains a Bell icon connected to `bell-notification.service.ts` which listens to the SSE stream to show live toast alerts and an unread badge counter.
- **`add-employee` / `verify-employee`**: Legacy or specialized forms for internal employee tracking.

---

## 6. Deep Dive: The Real-Time Data Pipeline (SSE)

Unlike traditional apps that require refreshing to see new data, this CRM is truly real-time.
1. When the Angular app loads, `bell-notification.service.ts` makes a GET request to `/api/leads/stream`.
2. The Node.js backend does *not* close this request. It sets headers: `Content-Type: text/event-stream`, `Connection: keep-alive`.
3. If a Lead Gen Form is submitted on LinkedIn, LinkedIn sends a Webhook to the backend.
4. The backend inserts the lead into PostgreSQL.
5. The backend calls `sse.sendEvent('NEW_LEAD', leadData)`.
6. The open HTTP connection pushes this data instantly to the Angular frontend.
7. The Angular Dashboard catches the event, pushes the new lead into the local table array, and updates the stats cards. Concurrently, the Bell icon shows a new notification popup.

---

## 7. Deep Dive: The AI Bill Scanning Pipeline

The CRM uses a "Template-Guided LLM Extraction" approach to reliably parse complex, unstructured documents.
1. **Setup Phase**: The user draws boxes on a document using the Angular **Annotation Tool**. This creates a spatial map (e.g., "Invoice Total is located at X: 80%, Y: 90%").
2. **Execution Phase**: The user uploads a real filled-out document in the **Bill Scanner**.
3. **Prompt Construction**: The backend fetches the spatial map from the DB. It constructs a dynamic JSON schema and a rigid prompt for Gemini 2.5 Flash: *"Extract text ONLY from these specific regions. Do not guess."*
4. **AI Processing**: Gemini receives the image array and the prompt, looks at the specific visual regions requested, extracts the text, and formats it exactly according to the provided JSON Schema.
5. **Reconciliation**: The backend compares the AI's JSON output against the requested fields, formats the response, and sends it to the frontend for review.

---
*End of Document*
