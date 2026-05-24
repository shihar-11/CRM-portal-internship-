# Internship Project: CRM & Lead Management System

## Project Goal
To develop a robust, full-stack Customer Relationship Management (CRM) application that handles automated lead ingestion, real-time UI updates, and AI-powered document parsing. This system streamlines the recruitment and sales pipeline by eliminating manual data entry through LinkedIn webhooks and OCR resume scanning.

---

## 1. System Architecture overview

### Frontend (Angular 17)
- **Framework**: Single Page Application (SPA) built with Angular 17.
- **Design System**: Custom dark-theme UI with floating labels and responsive grid layouts.
- **Real-Time Engine**: Integrates Server-Sent Events (SSE) via a dedicated `NotificationService` to push live dashboard updates to admins without page reloads.

### Backend (Node.js + Express)
- **API Engine**: RESTful architecture utilizing `express.json()` and `cors`.
- **Database**: PostgreSQL connection pooling via the `pg` library.
- **Asynchronous Services**: Dedicated background services for handling webhooks and SSE broadcasting.

---

## 2. Implemented Features & Workflows

### A. Real-Time Dashboard & Leads CRUD
- **Endpoints**: `/api/leads` handles all standard `GET`, `POST`, `PUT`, and `DELETE` operations.
- **SSE Stream**: The `/api/leads/stream` endpoint maintains persistent connections with the Angular frontend, instantly broadcasting `NEW_LEAD` events to the UI whenever a lead is generated.

### B. Automated LinkedIn Ingestion
- **Challenge Verification**: The `/api/webhook/linkedin` endpoint correctly responds to LinkedIn's `challengeCode` to verify the server footprint.
- **Payload Parsing**: The `linkedin.service.js` background worker deeply parses LinkedIn's nested `formResponse.answers` array to extract names, emails, companies, and phone numbers. It automatically checks for duplicates before injecting the lead into PostgreSQL.

### C. AI-Powered OCR Document Scanner
- **UI Integration**: The `OcrScannerComponent` provides a drag-and-drop zone for resumes and business cards (PDF, JPG, PNG).
- **Processing**: Files are packaged as `FormData` and sent to `/api/ocr/extract` where `multer` stores the buffer in memory.
- **AI Extraction**: The backend converts the buffer to Base64 and interfaces directly with Google's **Gemini AI model** (`gemini-2.5-flash`). It uses a strict prompt to extract the following specific fields into a pure JSON structure:
  - Full Name
  - Email Address
  - Phone Number
  - University / College
  - Degree
  - Skills
- **Data Mapping**: If a field is missing, the frontend elegantly handles the `null` value with a red "Not found in document" placeholder. Successfully extracted data is securely combined and pushed to the PostgreSQL `leads` table.

---

## 3. Database Schema

The core `leads` table (migrated from `employees`) features the following columns to handle the diverse data inputs:
- `id` (Primary Key)
- `name` 
- `email` 
- `department`
- `status` (Default: 'New')
- `source` (Tracks origin: 'Website', 'LinkedIn Lead Gen', 'OCR Scanner')
- `company`
- `notes` (Used to store expanded OCR data like University, Degree, and Skills)
- `linkedin_id`
- `created_at` (Timestamp)

---

## 4. Verification & Testing Plan

### Automated / API Testing
- Verify PostgreSQL connection pool stability under load.
- Use Postman to trigger mock LinkedIn webhook payloads to `/api/webhook/linkedin` and ensure exact 201 responses.
- Test the `/api/ocr/extract` route using varied file formats (PDFs vs. Images) to guarantee the Gemini 2.5 Flash model parses JSON correctly without markdown contamination.

### Manual UI Verification
1. **Authentication**: Verify admin login flow via `/api/auth/login`.
2. **Real-time Engine**: Open the dashboard in two separate browsers; manually add a lead in one browser and confirm it instantly appears in the other via SSE.
3. **OCR Scanner**: Drop a sample resume into the `/ocr-scanner` route. Verify the 2.5-second loading spinner, the auto-population of the form fields, and the final data propagation to the leads database.
