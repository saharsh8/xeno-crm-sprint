import random
from faker import Faker
from database import SessionLocal, engine
import models

# Ensure tables exist before we try to insert data
models.Base.metadata.create_all(bind=engine)

fake = Faker()
db = SessionLocal()

def seed_database(num_customers=500, max_orders_per_customer=5):
    print("🌱 Initiating database seeding...")
    
    # 1. Generate Customers
    customers = []
    for _ in range(num_customers):
        customer = models.Customer(
            name=fake.name(),
            email=fake.unique.email(),
            phone=fake.unique.phone_number()[:15],
            total_spent=0.0,
            source_file="Seed Data"  # UPDATED: Changed from is_uploaded=False
        )
        db.add(customer)
        customers.append(customer)
    
    db.commit()
    print(f"✅ Successfully created {num_customers} shoppers.")

    # 2. Generate Orders and update Lifetime Value (total_spent)
    total_orders = 0
    for customer in customers:
        num_orders = random.randint(0, max_orders_per_customer)
        customer_total = 0
        for _ in range(num_orders):
            amount = round(random.uniform(15.0, 350.0), 2)
            customer_total += amount
            order = models.Order(
                customer_id=customer.id,
                amount=amount,
                # Randomize order dates over the past year to simulate history
                order_date=fake.date_time_between(start_date='-1y', end_date='now') 
            )
            db.add(order)
            total_orders += 1
        
        # Update the customer's total lifetime value based on their fake orders
        customer.total_spent = round(customer_total, 2)
        
    db.commit()
    db.close()
    
    print(f"✅ Successfully created {total_orders} historical orders.")
    print("🚀 Database seeding complete! You are ready to build the API.")

if __name__ == "__main__":
    seed_database() # Fixed typo here