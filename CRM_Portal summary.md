# CRM Portal: Comprehensive System & Feature Report

## Executive Summary
The CRM Portal is an advanced, full-stack web application designed to centralize lead management, automate manual data entry, and intelligently extract data from complex, unstructured documents using cutting-edge AI. Built with a modern technology stack, it replaces traditional spreadsheet-based tracking with real-time updates, automated webhook integrations (e.g., LinkedIn Lead Gen), and a robust, fully automated document processing pipeline. 

This document serves as an exhaustive guide to every feature implemented in the portal, its underlying mechanics, and the business value it delivers.

---

## 1. System Architecture & Technology Stack

The application employs a robust client-server architecture to ensure scalability, real-time performance, and secure data handling.

*   **Frontend (User Interface):** Built entirely in **Angular 17** (TypeScript). It leverages RxJS for state management and reactivity. The UI is designed as a Single Page Application (SPA), ensuring smooth navigation without page reloads. It incorporates advanced HTML5 canvas manipulation for native PDF rendering (`pdfjs-dist`).
*   **Backend (API & Services):** A **Node.js** server powered by **Express.js**. It handles business logic, security, file uploads (via `multer` in-memory), and coordinates asynchronous background jobs.
*   **Database:** A relational **PostgreSQL** database handles structured data persistence. The backend automatically manages the schema using initialization scripts, ensuring environments are perfectly synced.
*   **AI Engine:** Integrated with the **Google Gemini API** (specifically the `gemini-2.5-flash` model) to handle complex Optical Character Recognition (OCR), unstructured text parsing, and template-based data extraction.

---

## 2. Core CRM Features: Lead Management

At its core, the portal serves as a central hub for managing potential clients or candidates (referred to as "Leads").

### The Interactive Dashboard
*   **Metric Cards:** Provides a high-level overview with top-level stats: Total Leads, New Leads, Converted Leads, and Rejected Leads. These update dynamically.
*   **Data Table:** A comprehensive grid displaying all leads in the system. It supports:
    *   **Local Search Filtering:** Instantly filter leads by name, email, or company without hitting the server.
    *   **Status Management:** Visual badges denote lead status (`New`, `Contacted`, `Qualified`, `Converted`, `Rejected`). Users can update statuses directly from the dashboard.
    *   **CRUD Operations:** Full capability to Create (add manually), Read (view details), Update (edit information), and Delete (remove with confirmation) leads.

---

## 3. Real-Time Capabilities: Server-Sent Events (SSE) & Notifications

Unlike traditional web applications that require users to hit "Refresh" to see new data, this CRM portal is truly real-time.

*   **Continuous Connection (SSE):** The backend maintains an open, continuous HTTP connection (`/api/leads/stream`) with the frontend using Server-Sent Events. 
*   **Instant Broadcasts:** Whenever a lead is added (e.g., via a LinkedIn webhook or another user), updated, or deleted, the backend instantly broadcasts a JSON payload to all connected clients.
*   **Live UI Updates:** The Angular dashboard intercepts these events and seamlessly injects the new data into the table and metric cards without any page reload.
*   **Notification Bell:** The application shell features a bell icon in the top header. Powered by the SSE stream, it triggers live toast alerts when events occur and maintains an "unread" notification counter. Clicking the bell shows a history of system events (e.g., "New lead arrived from LinkedIn").

---

## 4. Automated Integrations: LinkedIn Webhooks

To eliminate manual data entry from social media marketing campaigns, the portal integrates directly with LinkedIn.

*   **Webhook Listener:** The backend exposes a secure `/api/webhook/linkedin` endpoint. 
*   **Security & Validation:** It strictly verifies the `x-linkedin-webhook-secret` header and processes LinkedIn's automated challenge codes to ensure data integrity and prevent malicious payloads.
*   **Data Mapping:** When a user fills out a Lead Gen Form on LinkedIn, the payload is sent to the CRM. The `linkedin-sync.service` parses the proprietary question IDs, maps them to human-readable columns (e.g., 'Work email' -> `email`, 'Company name' -> `company`), and automatically inserts the lead into the database.
*   **Deduplication:** The database enforces a unique `linkedin_id` constraint, automatically preventing duplicate entries if LinkedIn sends the same webhook twice.

---

## 5. The "Watcher": Automated AI Document Processing Pipeline

One of the most powerful features of the CRM is its ability to operate autonomously in the background, extracting structured data from bulk documents without human intervention.

### How It Works
1.  **The Watcher Service:** A Node.js background process (`chokidar`) continuously monitors a designated local folder (`watched_docs`). 
2.  **Auto-Queueing:** When a user (or another system) drops a file (PDF, JPG, PNG, DOCX) into this folder, the Watcher instantly detects it and inserts a record into the `document_queue` database table with a status of `pending`.
3.  **The Processor Service:** A separate, interval-based service queries the database every 15 seconds for `pending` documents. It ensures only one document is processed at a time to respect rate limits.
4.  **AI Analysis:** The Processor reads the file, converts it to base64 (or extracts raw text if it's a DOCX), and sends it to the **Gemini 2.5 Flash** AI model. The AI is prompted to classify the document type (e.g., Bank Statement, Salary Slip, Invoice) and extract all possible key-value data fields.
5.  **Completion & Archiving:** Upon successful extraction, the data is saved to the `document_extractions` table, the queue status updates to `completed`, and the physical file is automatically moved out of the `watched_docs` folder into a `processed_docs` directory to keep the input folder clean.

### The Pipeline Frontend UI
Managers can monitor this entire background process via the "Document Pipeline" screen:
*   **Live Queue Monitoring:** View a searchable, filterable list of all documents in the system and their current status (`pending`, `processing`, `completed`, `failed`).
*   **Extraction Review & Edit:** Click on any completed document to view a clean JSON representation of the data the AI extracted. Users can click "Edit Extraction" to manually override or correct the AI's findings.
*   **Document Preview:** A modal allows users to preview the actual file (PDF/Image) side-by-side with the data.
*   **Version Comparison:** If the same document was processed multiple times, users can click "Compare" to view a diff of the extractions, highlighting added, missing, or changed fields.
*   **Error Recovery:** If the AI API fails (e.g., quota exceeded, network error), the document status changes to `failed`. Users can click a "Retry" button to put the document back into the `pending` queue.

---

## 6. Interactive AI Bill & Document Scanning (OCR & Annotation)

For highly specific, templated documents (like proprietary vendor invoices or specific work orders), the CRM provides a specialized, interactive extraction tool.

### The Annotation Tool (Template Builder)
*   **Visual Mapping:** Users upload a blank template of a document (e.g., an empty Work Order form). The Angular app renders the PDF onto an HTML `<canvas>`.
*   **Drawing Bounding Boxes:** Users use their mouse to physically draw boxes over the areas where data will appear. They assign a label to each box (e.g., "Invoice Number", "Total Amount").
*   **Spatial Normalization:** The system calculates the exact X, Y, Width, and Height percentages relative to the document size and saves this "map" to the database under a specific Template Name.

### The Bill Scanner (Execution)
*   **Guided Extraction:** When a user receives a filled-out version of a templated document, they use the Bill Scanner. They select the appropriate template and upload the file.
*   **Precision AI Prompting:** The backend dynamically constructs a strict JSON Schema based on the bounding boxes saved in the Annotation Tool. It sends the image and the exact coordinates to Gemini, instructing it: *"Extract text ONLY from these specific regions. Do not guess."*
*   **Accuracy:** This guarantees high-fidelity data extraction because the AI is restricted from hallucinating data from other parts of the page. The system highlights which fields were successfully mapped and alerts the user if a mandatory field was completely missing from the document.

### Drag-and-Drop General OCR
*   A streamlined interface is also available for generic OCR, allowing users to simply drop a resume or candidate profile into the browser. The system extracts basic entities (Name, Email, Phone, Skills) without requiring a pre-built template.

---

## 7. Database Architecture & Audit Trails

The PostgreSQL database is structured to support scalability and accountability. Key tables include:

*   **`leads`**: Central repository for all contacts, tracking source, status, and associated metadata.
*   **`admin_users`**: Secure storage for administrator credentials and profiles.
*   **`notifications`**: Persistent storage for all system events, ensuring notifications aren't lost if a user is offline.
*   **`ocr_template_mappings`**: Stores the complex JSON arrays of bounding-box coordinates created in the Annotation Tool.
*   **`document_queue` & `document_extractions`**: The backbone of the Automated Pipeline, tracking the state of files and the massive JSON objects returned by the AI.
*   **`document_audit_trail`**: A critical security and compliance feature. Every action taken on a document in the pipeline (queued, processing started, completed, failed, manual override/edit, retried) is logged with a timestamp, ensuring full traceability of how data was extracted and modified.

---

## 8. Summary of Business Benefits

1.  **Elimination of Manual Entry:** The LinkedIn Webhooks and Automated Document Pipeline effectively reduce manual data entry to zero.
2.  **Unmatched Real-Time Visibility:** The SSE architecture ensures that managers and sales teams are always looking at the exact same, up-to-the-second data without constantly refreshing pages.
3.  **High-Fidelity AI:** By combining generalized AI for standard documents (The Pipeline) with strict, bounded-box Template AI (The Annotation Tool), the system handles both standard and highly esoteric documents with extreme accuracy.
4.  **Full Traceability:** The Audit Trail ensures that if an extraction is incorrect, management can track exactly when it failed, when it was manually edited, and who corrected it.
5.  **Scalability:** The background queueing system ensures the server is never overwhelmed by massive document dumps, processing files sequentially and moving them cleanly upon completion.
