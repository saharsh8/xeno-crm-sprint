# Xeno AI-Native CRM 🚀

An intelligent, fully decoupled Mini CRM designed to help retail brands intuitively segment audiences and execute automated, high-volume customer engagement campaigns. 

Built as a take-home engineering assessment for the Xeno SDE role.

**🎥 [Watch the Video Walkthrough Here](Insert Your Video Link Here)**
**🌐 [Live Vercel Frontend](Insert Your Vercel URL Here)**
**⚙️ [Live Render Backend API](Insert Your Render URL Here)**

---

## 🏗️ System Architecture & Design

To handle high-volume concurrent campaign dispatches without blocking the main event loop, this application utilizes a strictly decoupled, asynchronous architecture.

1. **Frontend Client:** A Next.js React application hosted on Vercel, featuring a highly responsive UI with real-time analytics rendering.
2. **Core API Engine:** A FastAPI backend hosted on Render, handling data validation, ORM operations, and API routing.
3. **Relational Database:** A PostgreSQL instance managing structured tables for `Customers`, `Campaigns`, and row-level `CommunicationLogs`.
4. **The Asynchronous Webhook Loop:** 
   To honor the assignment's requirement for a separate channel service without choking production traffic, the dispatch route utilizes FastAPI's `BackgroundTasks`. 
   * When a campaign is dispatched, payloads are offloaded asynchronously to an internal **Channel Service Stub**.
   * The stub simulates network processing and randomly assigns realistic delivery outcomes.
   * It then uses `httpx` to fire asynchronous webhook callbacks back to the CRM's `/crm/receipt` endpoint, mapping delivery states (Sent, Delivered, Opened, Failed) to exact rows in the database.

---

## ✨ Key Features

* **Audience Studio:** Ingest CSV audience data with automated duplicate handling, real-time pagination, and dynamic lifecycle value filtering.
* **AI Copilot Engine:** Natural language prompt ingestion that dynamically calculates bounding parameters (`min_spend`, `max_spend`) and generates highly contextualized draft templates for multiple channels (WhatsApp, SMS, Email, RCS).
* **Active Campaign Manager:** Track active targets, with bulk actions to soft-delete or restore campaigns to/from a dedicated History state.
* **Matrix Insights:** A real-time, multi-color charting dashboard. By querying the `CommunicationLog` joined with the `Customer` table, it provides both aggregate webhook delivery metrics and row-level tracking for every targeted recipient.

---

## 🛠️ Technology Stack

**Frontend:**
* Next.js (React)
* Tailwind CSS (Styling)
* Recharts (Data Visualization)
* Lucide React (Iconography)

**Backend:**
* FastAPI (High-performance async Python framework)
* SQLAlchemy (ORM)
* PostgreSQL (Database)
* HTTPX (Async webhook firing)
* Pydantic (Strict data validation)

---

## 🚀 Local Development Setup

If you wish to run this application locally, follow these steps:

```1. Backend Setup
Navigate to the backend directory and set up your Python environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```env
# Add this to your .env file in the backend directory
DATABASE_URL=postgresql://user:password@localhost:5432/xeno_crm
**Run the server:** Once the file is saved, start your API in your terminal using:
    ```bash
uvicorn main:app --reload --port 8000

``` ### 1. Frontend Setup
Open a new terminal, navigate to the frontend directory:

```bash
cd frontend
npm install
```markdown

```env
# Add this to your .env.local file in the frontend directory
NEXT_PUBLIC_API_URL=http://localhost:8000
**Run the development server:** After saving the file, ensure you have installed your dependencies (`npm install`) and start the frontend:
    ```bash
    npm run dev
