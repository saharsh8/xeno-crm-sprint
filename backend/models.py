from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import uuid

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    total_spent = Column(Float, default=0.0)
    
    # UPDATED: Now tracks the source file name instead of a simple boolean
    source_file = Column(String, default="Seed Data") 
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    orders = relationship("Order", back_populates="customer")
    logs = relationship("CommunicationLog", back_populates="customer")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    amount = Column(Float)
    order_date = Column(DateTime(timezone=True), server_default=func.now())
    
    customer = relationship("Customer", back_populates="orders")

class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    audience_criteria = Column(Text)
    message_template = Column(Text)
    ai_rationale = Column(Text)
    status = Column(String, default="draft")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    logs = relationship("CommunicationLog", back_populates="campaign")

class CommunicationLog(Base):
    __tablename__ = "communication_logs"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    customer_id = Column(Integer, ForeignKey("customers.id"))
    status = Column(String) 
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    campaign = relationship("Campaign", back_populates="logs")
    customer = relationship("Customer", back_populates="logs")