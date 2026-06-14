import asyncio
import random
import httpx
from fastapi import FastAPI, BackgroundTasks

app = FastAPI(title="Xeno External Channel Simulator")

async def simulate_delivery_lifecycle(log_id: int):
    """Simulates a human receiving, opening, and clicking a message."""
    # This URL now matches your simplified backend route
    MAIN_SERVER_RECEIPT_URL = "http://127.0.0.1:8000/crm/receipt"
    
    async with httpx.AsyncClient() as client:
        # 1. Simulate network transit time (1 to 3 seconds)
        await asyncio.sleep(random.uniform(1.0, 3.0))
        
        # 2. Did the message deliver? (90% success rate)
        status = "delivered" if random.random() < 0.90 else "failed"
        try:
            await client.post(MAIN_SERVER_RECEIPT_URL, json={"log_id": log_id, "status": status})
        except Exception as e:
            print(f"Error sending delivery status: {e}")
            return 

        if status == "failed":
            return
            
        # 3. Did the user open it? (60% open rate)
        await asyncio.sleep(random.uniform(2.0, 5.0))
        if random.random() < 0.60:
            try:
                await client.post(MAIN_SERVER_RECEIPT_URL, json={"log_id": log_id, "status": "opened"})
            except:
                pass
            
            # 4. Did the user click the link? (30% click rate)
            await asyncio.sleep(random.uniform(2.0, 4.0))
            if random.random() < 0.30:
                try:
                    await client.post(MAIN_SERVER_RECEIPT_URL, json={"log_id": log_id, "status": "clicked"})
                except:
                    pass

@app.post("/api/v1/channel/send")
async def receive_campaign_batch(payload: dict, background_tasks: BackgroundTasks):
    data = payload.get("data", [])
    print(f"📥 STUB RECEIVED BATCH: Processing {len(data)} simulated users...")
    
    # --- THIS LOOP PRINTS THE CONTENTS ---
    for item in data:
        # This unpacks the JSON 'item' and displays the specific message
        print(f"💌 SENDING TO: {item['customer_name']} | MESSAGE: {item['message']}")
    # --------------------------------------
        
    for item in data:
        background_tasks.add_task(simulate_delivery_lifecycle, item["log_id"])
        
    return {"status": "accepted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)