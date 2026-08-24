# 🩺 Hakeem — AI-Powered Pharmacy Ordering Automation

> An AI-powered pharmacy ordering and customer management system built with **n8n, PostgreSQL, WhatsApp, RAG, and AI Agents**.

---

## 📌 Overview

**Hakeem** is an AI-powered pharmacy ordering automation system designed to manage customer interactions, pharmacy orders, order tracking, and pharmacy availability through WhatsApp.

The system combines **AI Agents, RAG, n8n automation, WhatsApp integration, and PostgreSQL** to create an intelligent and persistent pharmacy ordering workflow.

Hakeem automates communication between **customers, pharmacies, and delivery services**, while maintaining structured customer data and order context.

---

## ✨ Key Features

* 🤖 AI-powered customer interaction
* 💬 WhatsApp-based ordering
* 🧠 AI intent classification
* 🔀 Router Agent
* 📦 Upper & Lower Agents
* 🧠 RAG-based pharmacy knowledge retrieval
* 👤 Automated customer data collection
* 🗄️ PostgreSQL database integration
* 🔄 Persistent session management
* 📦 Order management
* 🚚 Order tracking and delivery notifications
* 🏪 Multi-pharmacy order fulfillment
* 🔎 Pharmacy availability checking
* 🔄 Partial order fulfillment
* 📊 Admin dashboard
* 🏪 Pharmacy dashboard
* 📈 Sales and platform analytics
* ⚡ n8n workflow automation
* 🔗 WhatsApp API integration

---

# 🏗️ System Architecture

```text
                         ┌──────────────────┐
                         │     WhatsApp     │
                         │     Customer     │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │   WhatsApp API   │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │   Session Check  │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │   Router Agent   │
                         └────────┬─────────┘
                                  │
                       ┌──────────┴──────────┐
                       ▼                     ▼
                ┌─────────────┐       ┌─────────────┐
                │ Upper Agent │       │ Lower Agent │
                └──────┬──────┘       └──────┬──────┘
                       │                     │
                       └──────────┬──────────┘
                                  ▼
                         ┌──────────────────┐
                         │    RAG System    │
                         │ Hakeem Policies  │
                         └────────┬─────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │ Customer Data Collection│
                    └────────────┬────────────┘
                                 │
                                 ▼
                       ┌──────────────────┐
                       │    PostgreSQL    │
                       └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Order Processing │
                       └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ WhatsApp Response│
                       └──────────────────┘
```

---

# 🔄 Main Workflow

The complete Hakeem automation workflow is orchestrated through **n8n**.

![Main Workflow](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20004012.png)

The workflow handles:

1. Receiving the WhatsApp message
2. Checking the customer's session
3. Routing the request
4. Selecting the appropriate AI Agent
5. Retrieving relevant information using the RAG system
6. Checking customer information
7. Collecting missing data
8. Checking product availability
9. Processing the order
10. Updating PostgreSQL
11. Tracking order status
12. Sending the appropriate response through WhatsApp

---

# 💬 WhatsApp Integration

WhatsApp is the primary communication channel between customers and Hakeem.

```text
Customer
   │
   ▼
WhatsApp
   │
   ▼
WhatsApp API
   │
   ▼
n8n
   │
   ▼
AI Agents
   │
   ▼
RAG / PostgreSQL
   │
   ▼
Order Processing
   │
   ▼
AI Response
   │
   ▼
WhatsApp
   │
   ▼
Customer
```

### WhatsApp Conversation

![WhatsApp 1](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/5793933590256095252_121.jpg)

![WhatsApp 2](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/5793933590256095253_121.jpg)

![WhatsApp 3](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/5793933590256095254_121.jpg)

![WhatsApp 4](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/5793933590256095255_121.jpg)

![WhatsApp 5](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/5793933590256095257_121.jpg)

---

# 🧠 AI Agent Architecture

Hakeem uses a **multi-agent architecture**, where each agent has a specific responsibility.

![AI Agents](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003928.png)

---

## Router Agent

The Router Agent analyzes the customer's request and routes it to the appropriate workflow.

```text
Customer Message
       │
       ▼
 Router Agent
       │
   ┌───┴────┐
   ▼        ▼
 upper    lower
   │        │
   ▼        ▼
Upper     Lower
Agent     Agent
```

The router returns a controlled intent:

```text
upper
```

or

```text
lower
```

This allows the workflow to determine which agent should handle the request.

---

## Upper Agent

The Upper Agent handles requests classified as `upper`.

Responsibilities include:

* Understanding the customer's request
* Validating customer information
* Processing the request
* Checking relevant pharmacy information
* Communicating with the database
* Generating the appropriate response

---

## Lower Agent

The Lower Agent handles requests classified as `lower`.

Responsibilities include:

* Understanding the customer's request
* Validating customer information
* Processing the request
* Checking relevant pharmacy information
* Communicating with the database
* Generating the appropriate response

---

# 🧠 RAG System

Hakeem integrates a **RAG (Retrieval-Augmented Generation)** system directly into the workflow.

![RAG System](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003908.png)

The RAG system provides AI agents with relevant information from the Hakeem knowledge base and operational policies.

### RAG Knowledge Base

The system can retrieve information related to:

* Hakeem policies
* Pharmacy rules
* Ordering policies
* Customer interaction policies
* Operational procedures
* Pharmacy workflow information
* Other Hakeem documentation

Instead of relying only on the model's internal knowledge, the agent retrieves relevant information before generating a response.

### RAG Flow

```text
Customer Request
       │
       ▼
   AI Agent
       │
       ▼
   RAG Search
       │
       ▼
Retrieve Relevant
   Information
       │
       ▼
   AI Agent
       │
       ▼
Generate Response
```

---

# 👤 Customer Data Collection

The **Customer Data Collection Agent** manages the required customer information.

### Required Data

* Name
* Phone number
* Address

The system checks the database before asking the customer for information.

For example:

```text
Name:     Yusuf Ahmed
Phone:    010XXXXXXXX
Address:  NULL
```

Instead of asking for all information again, the agent asks only for the missing field:

```text
What is your address?
```

### Collection Flow

```text
Customer
   │
   ▼
Check Database
   │
   ├── Complete ───────► Continue
   │
   └── Missing ────────► Identify Missing Field
                              │
                              ▼
                         Ask Customer
                              │
                              ▼
                        Update Database
```

This prevents the system from repeatedly asking customers for information that is already stored.

---

# 🔄 Session Management

Hakeem maintains persistent sessions for customer conversations.

```text
Incoming Message
       │
       ▼
Check Session
       │
   ┌───┴──────┐
   ▼          ▼
Exists     Doesn't Exist
   │            │
   ▼            ▼
Continue      Create
Session       Session
   │            │
   └──────┬─────┘
          ▼
      AI Agent
          │
          ▼
       Response
```

This allows the system to:

* Continue active conversations
* Reopen existing sessions when required
* Create new sessions when no session exists
* Maintain conversation context
* Preserve customer interaction history

---

# 🏪 Multi-Pharmacy Order Processing

Hakeem supports order fulfillment across multiple pharmacies.

The system can check product availability across participating pharmacies and determine how an order should be fulfilled.

### Multi-Pharmacy Scenario

When a requested product is unavailable in several pharmacies, Hakeem can monitor availability and respond to the customer based on the overall pharmacy network.

For example, when more than five pharmacies report that a product is unavailable, the system can automatically notify the customer once the product becomes available in most pharmacies.

The customer can then be informed that:

* The product is available in most pharmacies
* Part of the order is already available
* The remaining part of the order is being fulfilled by another pharmacy

### Availability Workflow

```text
Customer Order
       │
       ▼
Check Pharmacies
       │
       ▼
Check Product Availability
       │
       ├── Available
       │      │
       │      ▼
       │   Process Order
       │
       └── Not Available
              │
              ▼
       Monitor Pharmacies
              │
              ▼
     Availability Threshold
              │
              ▼
      Notify Customer
```

---

# 🚚 Order Tracking & Notifications

Hakeem handles order status communication throughout the fulfillment process.

![Order Tracking](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003859.png)

The notification workflow can communicate order status updates to:

* The customer
* The pharmacy
* The delivery/shipping company

### Order Notification Flow

```text
Order Created
      │
      ▼
Order Processing
      │
      ▼
Pharmacy Confirmation
      │
      ▼
Order Prepared
      │
      ▼
Shipping / Delivery
      │
      ▼
Customer Notification
```

---

# 📦 Order Availability Monitoring

Hakeem can monitor product availability across multiple pharmacies.

![Multi-Pharmacy Availability](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003848.png)

If the requested product is unavailable across multiple pharmacies, the system can monitor availability and trigger an automated customer notification once the defined availability condition is reached.

This helps Hakeem handle distributed inventory and keep customers updated without requiring manual follow-up.

---

# 🖥️ Admin Dashboard

Hakeem provides an administrative dashboard for monitoring the overall platform, pharmacies, orders, and sales activity.

## 📊 Platform Statistics

The Admin Dashboard provides an overview of platform activity and key operational metrics.

![Admin Statistics](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20010958.png)

The dashboard can be used to monitor:

* 📞 Calls and customer interactions
* 📦 Orders
* 🏪 Pharmacies
* 📈 Platform activity
* 📊 Operational statistics

---

## 🏪 Pharmacy Management

Administrators can view and manage registered pharmacies through the dashboard.

![Pharmacy Management](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011122.png)

The pharmacy management interface allows administrators to:

* View registered pharmacies
* Monitor pharmacy information
* Review pharmacy activity
* Add new pharmacies
* Manage the pharmacy network

---

## 📦 Order Management

Administrators can monitor customer orders from the Admin Dashboard.

![Admin Orders](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011151.png)

The order management interface provides visibility into:

* Customer orders
* Order status
* Order processing
* Order fulfillment
* Order history

---

## 💊 Most Sold Medicines

Hakeem provides analytics for identifying the most frequently ordered medicines.

![Most Sold Medicines](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011204.png)

This helps administrators understand:

* Most requested medicines
* Product demand
* Sales trends
* Inventory requirements

---

# 🏪 Pharmacy Dashboard

Each pharmacy has its own dashboard for managing incoming orders and fulfilling requested products.

## 📥 Incoming Orders

Pharmacists can view orders assigned to their pharmacy.

![Pharmacy Orders](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011233.png)

The pharmacy interface allows pharmacists to:

* View incoming orders
* Review requested medicines
* Check order details
* Process assigned orders
* Update order status

---

# 📦 Order Fulfillment

Hakeem supports both **full and partial order fulfillment**.

![Order Fulfillment](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011251.png)

A pharmacy can indicate whether it can fulfill:

* The complete order
* Only part of the order
* None of the requested products

This allows Hakeem to dynamically distribute orders across multiple pharmacies.

---

# 🚚 Order Timeline & Delivery

Hakeem maintains an order timeline to track different stages of order processing and delivery.

![Order Timeline](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011305.png)

The timeline allows the pharmacy to:

* Track order progress
* Update fulfillment status
* Prepare the order for delivery
* Send order information to the delivery company
* Maintain a history of order events

---

# 🔄 Partial Order Fulfillment

One of Hakeem's key capabilities is handling **partial order fulfillment** across multiple pharmacies.

When a pharmacy cannot fulfill the complete order, the available products are processed while the remaining products are redistributed to another pharmacy.

### Partial Fulfillment Flow

```text
                  CUSTOMER ORDER
                        │
                        ▼
                 Pharmacy A
                        │
                ┌───────┴────────┐
                ▼                ▼
          Available Items    Unavailable
                │                │
                ▼                ▼
        Partial Fulfillment   Remaining
                              Items
                                │
                                ▼
                        Find Another Pharmacy
                                │
                                ▼
                           Pharmacy B
                                │
                                ▼
                         New Order Created
                                │
                                ▼
                        Delivery Company
```

## Partial Fulfillment Process

![Partial Fulfillment 1](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011337.png)

![Partial Fulfillment 2](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011400.png)

![Partial Fulfillment 3](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011410.png)

When a pharmacy can only fulfill part of an order:

1. The pharmacy confirms the available items.
2. The available items are processed.
3. The unavailable items remain pending.
4. Hakeem creates a new order for the remaining items.
5. Another pharmacy receives the new order.
6. The second pharmacy fulfills the remaining products.
7. The new order is sent to the delivery company.
8. The customer receives the appropriate status updates.

This allows a single customer order to be fulfilled through **multiple pharmacies** without requiring the customer to manually place separate orders.

---

# 🔀 Distributed Order Fulfillment

Hakeem can dynamically distribute a customer's order across multiple pharmacies.

```text
                         CUSTOMER
                            │
                            ▼
                      Original Order
                            │
                            ▼
                  ┌─────────────────────┐
                  │   Pharmacy Search   │
                  └──────────┬──────────┘
                             │
                  ┌──────────┴──────────┐
                  ▼                     ▼
             Pharmacy A             Pharmacy B
                  │                     │
             Available              Available
                Items                Items
                  │                     │
                  └──────────┬──────────┘
                             ▼
                     Order Fulfillment
                             │
                             ▼
                     Delivery Company
                             │
                             ▼
                          Customer
```

This architecture allows Hakeem to handle complex orders where different products are available at different pharmacies.

---

# 🔔 Order Status Communication

The order lifecycle is continuously tracked through the system.

```text
Order Created
      │
      ▼
Pharmacy Assignment
      │
      ▼
Pharmacy Processing
      │
      ├───────────────┐
      │               │
      ▼               ▼
Fully Fulfilled   Partially Fulfilled
      │               │
      │               ▼
      │        Remaining Items
      │               │
      │               ▼
      │        Another Pharmacy
      │               │
      │               ▼
      │          New Order
      │               │
      └───────┬───────┘
              ▼
       Delivery Company
              │
              ▼
           Customer
```

---

# 🗄️ Database Integration

Hakeem uses **PostgreSQL** as its persistent data layer.

The database is responsible for storing and managing:

* Customer information
* Pharmacy information
* Ordering sessions
* Orders
* Order items
* Order status
* Order timeline
* AI conversation history

### Main Tables

| Table                | Description                |
| -------------------- | -------------------------- |
| `customers`          | Customer information       |
| `pharmacies`         | Pharmacy information       |
| `order_sessions`     | Customer ordering sessions |
| `order_items`        | Individual order items     |
| `orders`             | Customer orders            |
| `order_timeline`     | Order status and events    |
| `n8n_chat_histories` | AI conversation history    |

---

# ⚙️ n8n Automation

n8n is responsible for orchestrating the entire Hakeem workflow.

### Main Responsibilities

* WhatsApp message handling
* Webhooks
* Session management
* AI Agent execution
* RAG retrieval
* Database queries
* Customer data validation
* Pharmacy availability checking
* Order processing
* Order status tracking
* Automated notifications
* Sending WhatsApp responses

---

# 🛠️ Tech Stack

| Technology           | Purpose                                    |
| -------------------- | ------------------------------------------ |
| **n8n**              | Workflow automation and orchestration      |
| **AI Agents / LLMs** | Understanding and processing requests      |
| **RAG**              | Retrieval of Hakeem knowledge and policies |
| **PostgreSQL**       | Persistent data storage                    |
| **WhatsApp API**     | Customer communication                     |
| **REST APIs**        | System integration                         |
| **Webhooks**         | Event-driven communication                 |
| **SQL**              | Database operations                        |

---

# 📊 End-to-End Flow

```text
                    CUSTOMER
                       │
                       ▼
                   WhatsApp
                       │
                       ▼
                WhatsApp API
                       │
                       ▼
                     n8n
                       │
                       ▼
                Session Manager
                       │
                       ▼
                 Router Agent
                       │
              ┌────────┴────────┐
              ▼                 ▼
        Upper Agent        Lower Agent
              │                 │
              └────────┬────────┘
                       ▼
                  RAG System
                       │
                       ▼
             Customer Data Agent
                       │
                       ▼
                PostgreSQL
                       │
                       ▼
          Pharmacy Availability
                       │
                       ▼
                 Order Logic
                       │
                       ▼
              Order Fulfillment
                       │
                       ▼
                Order Tracking
                       │
                       ▼
                 AI Response
                       │
                       ▼
                   WhatsApp
                       │
                       ▼
                    CUSTOMER
```

---

# 🖥️ Hakeem Platform

Hakeem includes different interfaces for managing the pharmacy ecosystem.

### Admin Interface

The administrator can:

* Monitor platform statistics
* Manage pharmacies
* Add new pharmacies
* Monitor orders
* Analyze medicine sales
* Track overall platform activity

### Pharmacy Interface

Pharmacists can:

* View incoming orders
* Review requested medicines
* Accept and process orders
* Fulfill orders partially or completely
* Track order status
* Send orders to the delivery company
* Continue remaining order fulfillment through another pharmacy

---

# 🌐 Website

## Hakeem Web Platform

The Hakeem web platform provides the administrative and pharmacy interfaces used to manage the operational side of the system.

**Website:** Coming Soon

> Add the website URL here when the platform is publicly available.

---

# 📸 Project Screenshots

## 🔄 Main n8n Workflow

![Main Workflow](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20004012.png)

---

## 🧠 AI Agents

![AI Agents](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003928.png)

---

## 🧠 RAG System

![RAG System](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003908.png)

---

## 🚚 Order Tracking & Notifications

![Order Tracking](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003859.png)

---

## 🏪 Multi-Pharmacy Availability

![Multi-Pharmacy Availability](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003848.png)

---

## 🖥️ Admin Dashboard

### Platform Statistics

![Admin Statistics](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20010958.png)

### Pharmacy Management

![Pharmacy Management](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011122.png)

### Admin Orders

![Admin Orders](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011151.png)

### Most Sold Medicines

![Most Sold Medicines](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011204.png)

---

## 🏪 Pharmacy Dashboard

### Incoming Orders

![Pharmacy Orders](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011233.png)

### Order Fulfillment

![Order Fulfillment](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011251.png)

### Order Timeline

![Order Timeline](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011305.png)

---

## 🔄 Partial Fulfillment

### Partial Fulfillment 1

![Partial Fulfillment 1](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011337.png)

### Partial Fulfillment 2

![Partial Fulfillment 2](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011400.png)

### Partial Fulfillment 3

![Partial Fulfillment 3](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011410.png)

---

# 📁 Repository Structure

```text
HAKEEM/
│
├── README.md
│
├── images/
│   └── ...
│
├── workflows/
│   └── hakeem-workflow.json
│
├── database/
│   ├── schema.sql
│   └── queries.sql
│
├── prompts/
│   ├── router-agent.txt
│   ├── upper-agent.txt
│   ├── lower-agent.txt
│   └── customer-data-agent.txt
│
└── docs/
    └── architecture.md
```

---

# 🚀 How Hakeem Works

A typical customer interaction follows this pipeline:

```text
1. Customer sends a WhatsApp message
              ↓
2. WhatsApp API receives the message
              ↓
3. n8n starts the workflow
              ↓
4. Existing session is checked
              ↓
5. Router Agent classifies the request
              ↓
6. Upper or Lower Agent handles the request
              ↓
7. RAG retrieves relevant Hakeem information
              ↓
8. Customer information is validated
              ↓
9. Missing information is collected
              ↓
10. Pharmacy availability is checked
              ↓
11. Order is processed
              ↓
12. PostgreSQL is updated
              ↓
13. Order status is tracked
              ↓
14. AI generates the response
              ↓
15. WhatsApp notification is sent
              ↓
16. Customer receives the update
```

---

# 🎯 Project Goals

Hakeem was built to:

* Automate pharmacy customer interactions
* Reduce manual order processing
* Improve customer experience
* Maintain structured customer information
* Avoid repeatedly asking for existing data
* Connect conversational AI with real business data
* Automate communication between customers, pharmacies, and delivery services
* Monitor product availability across multiple pharmacies
* Support partial and distributed order fulfillment
* Provide intelligent order tracking and notifications
* Build a scalable multi-agent automation architecture

---

# 🔮 Future Improvements

* 📦 Advanced order tracking
* 💳 Payment integration
* 🧾 Automated invoices
* 📊 Advanced analytics dashboard
* 🔔 Advanced automated notifications
* 🧠 Advanced long-term memory
* 🏪 Multi-pharmacy expansion
* 📱 Mobile application
* 📈 Customer analytics
* 🌐 Hakeem web platform

---

# 📌 Project Status

**Active Development**

Hakeem is designed as a modular architecture that can be extended with additional agents, workflows, integrations, pharmacy services, and intelligent automation capabilities.

---

# 👨‍💻 Author

**Yousef Ahmed**

AI Engineer | Machine Learning | Deep Learning | NLP | AI Automation

---

## ⭐ Hakeem

**AI-powered pharmacy ordering automation through WhatsApp.**
