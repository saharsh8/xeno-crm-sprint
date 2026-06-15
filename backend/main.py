import sys
import os
import csv
import io
import re
import asyncio
import random
from typing import List
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc, distinct
from pydantic import BaseModel
import httpx
import models
import ai_agent
from database import get_db, engine

app = FastAPI(title="Xeno AI-Native CRM Backend")
models.Base.metadata.create_all(bind=engine)

# Corrected Production-Ready CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://xeno-crm-sprint.vercel.app",  # Your live Vercel frontend
        "http://localhost:3000"                # Allows local development to still work
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class DraftRequest(BaseModel):
    name: str
    audience_criteria: str
    channel: str

class DispatchRequest(BaseModel):
    name: str
    template: str
    channel: str
    min_spend: float = 0.0
    max_spend: float = 999999.0
    source_filter: str = "All Data"

class BulkActionRequest(BaseModel):
    campaign_ids: List[int]
    action: str  # "delete" (soft), "restore", or "hard_delete"

# 1. Customers Route
@app.get("/api/v1/customers")
def get_customers(
    db: Session = Depends(get_db), 
    page: int = 1, 
    limit: int = 10,
    sort_by: str = "total_spent",
    min_spent: float = 0.0,
    max_spend: float = 999999.0,
    source_filter: str = "All Data"
):
    query = db.query(models.Customer)
    
    if source_filter and source_filter != "All Data":
        query = query.filter(models.Customer.source_file == source_filter)
        
    query = query.filter(models.Customer.total_spent >= min_spent)
    query = query.filter(models.Customer.total_spent <= max_spend)
        
    sort_col = getattr(models.Customer, sort_by, models.Customer.total_spent)
    query = query.order_by(desc(sort_col))
    
    total_customers = query.count()
    offset = (page - 1) * limit
    customers = query.offset(offset).limit(limit).all()
    
    return {
        "customers": customers,
        "total_pages": (total_customers + limit - 1) // limit if limit > 0 else 1,
        "current_page": page,
        "total_count": total_customers
    }

# 1b. Sources Route
@app.get("/api/v1/customers/sources")
def get_sources(db: Session = Depends(get_db)):
    sources = db.query(models.Customer.source_file).distinct().all()
    return {"sources": [s[0] for s in sources]}

# 2. CSV Upload Route
@app.post("/api/v1/customers/upload")
async def upload_customers(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        contents = await file.read()
        decoded = contents.decode('utf-8')
        reader = csv.DictReader(io.StringIO(decoded))
        
        new_count = 0
        updated_count = 0
        file_name = file.filename 
        
        for row in reader:
            email = row.get('email', '').strip()
            if not email: continue 
                
            existing_customer = db.query(models.Customer).filter(models.Customer.email == email).first()
            
            if existing_customer:
                existing_customer.total_spent += float(row.get('total_spent', 0.0))
                updated_count += 1
            else:
                customer = models.Customer(
                    name=row.get('name', 'Unknown'),
                    email=email,
                    phone=row.get('phone', ''),
                    total_spent=float(row.get('total_spent', 0.0)),
                    source_file=file_name
                )
                db.add(customer)
                new_count += 1
                
        db.commit()
        return {"message": "Upload complete", "count": new_count, "updated": updated_count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing CSV: {str(e)}")

# 3. Receipt Route
@app.post("/crm/receipt")
def receive_delivery_receipt(payload: dict, db: Session = Depends(get_db)):
    log = db.query(models.CommunicationLog).filter(models.CommunicationLog.id == payload.get("log_id")).first()
    if log:
        log.status = payload.get("status")
        db.commit()
        db.refresh(log)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Log not found")

# 4. AI Copilot: Phase 1 (Generate Draft)
@app.post("/api/v1/campaigns/generate-draft")
async def generate_draft(data: DraftRequest):
    ai_insights = ai_agent.generate_campaign_intelligence(
        user_prompt=data.audience_criteria, 
        channel=data.channel
    )
    
    min_spend = ai_insights.get("min_spend", 0.0)
    max_spend = ai_insights.get("max_spend", 999999.0)
    
    prompt_lower = data.audience_criteria.lower()
    numbers = [float(n) for n in re.findall(r'\d+', prompt_lower)]
    
    if numbers:
        if "between" in prompt_lower and len(numbers) >= 2:
            min_spend = min(numbers[0], numbers[1])
            max_spend = max(numbers[0], numbers[1])
        elif "less than" in prompt_lower or "under" in prompt_lower or "<" in prompt_lower:
            max_spend = numbers[0]
            min_spend = 0.0
        elif "more than" in prompt_lower or "greater than" in prompt_lower or "over" in prompt_lower or ">" in prompt_lower:
            min_spend = numbers[0]
            max_spend = 999999.0

    return {
        "suggested_template": ai_insights.get("message_template", "Special offer inside!"),
        "min_spend": min_spend,
        "max_spend": max_spend
    }

# 5. AI Copilot: Phase 2 (Approve & Dispatch)
@app.post("/api/v1/campaigns/dispatch")
async def dispatch_campaign(
    data: DispatchRequest, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    query = db.query(models.Customer)
    query = query.filter(models.Customer.total_spent >= data.min_spend)
    query = query.filter(models.Customer.total_spent <= data.max_spend)
    
    if data.source_filter and data.source_filter != "All Data":
        query = query.filter(models.Customer.source_file == data.source_filter)
    
    targets = query.all()
    
    if not targets:
        raise HTTPException(status_code=400, detail="No customers found matching criteria")

    campaign = models.Campaign(
        name=data.name,
        audience_criteria=f"Source: {data.source_filter} | Range: ${data.min_spend}-${data.max_spend}",
        message_template=data.template,
        ai_rationale="Human-in-the-loop approved draft.",
        status="active"
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    payload_data = []
    for customer in targets:
        log = models.CommunicationLog(campaign_id=campaign.id, customer_id=customer.id, status="sent")
        db.add(log)
        db.commit()
        db.refresh(log)
        
        payload_data.append({
            "log_id": log.id,
            "customer_name": customer.name,
            "destination": customer.phone if data.channel in ['WhatsApp', 'SMS', 'RCS'] else customer.email,
            "message": data.template.replace("[Name]", customer.name)
        })

    background_tasks.add_task(forward_to_channel_stub, campaign.id, payload_data)
    
    return {
        "message": "AI-Native Campaign dispatched successfully",
        "campaign_id": campaign.id,
        "recipients_count": len(targets)
    }

async def forward_to_channel_stub(campaign_id: int, payload: list):
    # Now points to your live Render public URL instead of localhost
    CHANNEL_STUB_URL = "https://xeno-crm-sprint.onrender.com/api/v1/channel/send"
    async with httpx.AsyncClient() as client:
        try:
            await client.post(CHANNEL_STUB_URL, json={"campaign_id": campaign_id, "data": payload}, timeout=10.0)
        except Exception as e:
            print(f"Failed to communicate with Channel Service: {e}")

# 6. Analytics Route
@app.get("/api/v1/campaigns/{campaign_id}/analytics")
def get_campaign_analytics(campaign_id: int, db: Session = Depends(get_db)):
    # Join CommunicationLog with Customer to get the name/email/phone for the UI
    logs = db.query(models.CommunicationLog, models.Customer).join(
        models.Customer, models.CommunicationLog.customer_id == models.Customer.id
    ).filter(models.CommunicationLog.campaign_id == campaign_id).all()
    
    stats = {"sent": 0, "delivered": 0, "opened": 0, "failed": 0, "clicked": 0}
    recipients = []
    
    for log, customer in logs:
        current_status = log.status.lower() if log.status else "sent"
        if current_status in stats:
            stats[current_status] += 1
            
        recipients.append({
            "name": customer.name,
            "email": customer.email,
            "phone": customer.phone,
            "status": log.status.upper() if log.status else "SENT"
        })
            
    return {
        "campaign_id": campaign_id, 
        "metrics": stats,
        "recipients": recipients
    }

# --- Campaign Manager & History Routes ---

@app.get("/api/v1/campaigns")
def get_all_campaigns(db: Session = Depends(get_db)):
    """Fetches all campaigns for the manager and history dashboards"""
    campaigns = db.query(models.Campaign).order_by(desc(models.Campaign.id)).all()
    return {"campaigns": campaigns}

@app.post("/api/v1/campaigns/bulk-action")
def bulk_campaign_action(data: BulkActionRequest, db: Session = Depends(get_db)):
    """Handles Soft Deleting, Restoring, and Hard Deleting of Campaigns"""
    if data.action == "hard_delete":
        # Physically delete from DB
        db.query(models.CommunicationLog).filter(models.CommunicationLog.campaign_id.in_(data.campaign_ids)).delete(synchronize_session=False)
        db.query(models.Campaign).filter(models.Campaign.id.in_(data.campaign_ids)).delete(synchronize_session=False)
    elif data.action == "delete":
        # Soft delete (moves to History tab)
        db.query(models.Campaign).filter(models.Campaign.id.in_(data.campaign_ids)).update({"status": "deleted"}, synchronize_session=False)
    elif data.action == "restore":
        # Restore to Active
        db.query(models.Campaign).filter(models.Campaign.id.in_(data.campaign_ids)).update({"status": "active"}, synchronize_session=False)
    
    db.commit()
    return {"message": f"Successfully processed {len(data.campaign_ids)} campaigns."}


# ==========================================
# INTERNAL SIMULATED CHANNEL STUB SERVICE
# ==========================================
@app.post("/api/v1/channel/send")
async def simulated_channel_service(payload: dict, background_tasks: BackgroundTasks):
    """This acts as the 'separate' channel service requested in the assignment."""
    background_tasks.add_task(process_and_fire_webhooks, payload)
    return {"status": "accepted by channel stub"}

async def process_and_fire_webhooks(payload: dict):
    # The webhook receiver URL on your live CRM
    WEBHOOK_URL = "https://xeno-crm-sprint.onrender.com/crm/receipt"
    
    async with httpx.AsyncClient() as client:
        for item in payload.get("data", []):
            # Simulate processing and network delay
            await asyncio.sleep(random.uniform(0.5, 1.5))
            
            # Randomize a realistic outcome for the Matrix Insights dashboard
            status = random.choices(["DELIVERED", "OPENED", "FAILED"], weights=[0.5, 0.4, 0.1])[0]
            
            try:
                # Fire the callback webhook back to the CRM
                await client.post(WEBHOOK_URL, json={"log_id": item["log_id"], "status": status})
            except Exception as e:
                print(f"Webhook failed: {e}")