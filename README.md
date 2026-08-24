# 🩺 Hakeem — AI-Powered Pharmacy Ordering Automation

> An AI-powered pharmacy ordering and customer management system built with **n8n, PostgreSQL, WhatsApp, RAG, and AI Agents**.

---

## 📌 Overview

**Hakeem** is an AI-powered pharmacy ordering automation system designed to manage customer interactions, pharmacy orders, order tracking, and pharmacy availability through WhatsApp.

The system combines **AI Agents, RAG, n8n automation, WhatsApp integration, and PostgreSQL** to create an intelligent and persistent pharmacy ordering workflow.

Hakeem is designed to automate the communication between **customers, pharmacies, and the delivery process**, while maintaining structured customer data and order context.

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
* 🚚 Order status and delivery notifications
* 🏪 Multi-pharmacy order aggregation
* 🔎 Pharmacy availability checking
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
                         │   RAG System     │
                         │ Pharmacy/Policy  │
                         │    Knowledge     │
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

### Workflow

![Hakeem Workflow](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20004012.png)

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

# 🧠 AI Agent Architecture

Hakeem uses a **multi-agent architecture**, where each agent has a specific responsibility.

![AI Agent Architecture](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003928.png)

The agent architecture is designed to separate different responsibilities and provide a controlled workflow for customer requests and pharmacy orders.

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

The router is designed to return a controlled intent such as:

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

Hakeem integrates a **RAG (Retrieval-Augmented Generation)** system into the workflow.

The RAG system is used to provide the AI agents with relevant information from the Hakeem knowledge base and operational policies.

![Hakeem RAG System](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003908.png)

### RAG Knowledge Base

The RAG system can provide the agents with information related to:

* Hakeem policies
* Pharmacy-related rules
* Ordering policies
* Customer interaction policies
* Operational procedures
* Pharmacy workflow information
* Other relevant Hakeem documentation

Instead of relying only on the model's internal knowledge, the agent can retrieve relevant information from the knowledge base before generating a response.

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

The **Customer Data Collection Agent** manages required customer information.

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

Hakeem is designed to communicate with multiple pharmacies when processing an order.

The system can check product availability across participating pharmacies and determine how the order should be fulfilled.

### Multi-Pharmacy Scenario

When a requested product is unavailable in several pharmacies, Hakeem can monitor availability and respond to the customer based on the overall pharmacy network.

For example, when more than five pharmacies report that a product is unavailable, the system can automatically send a notification to the customer when the product becomes available in the majority of pharmacies.

The customer can then be informed that:

* The product has become available in most pharmacies
* Part of the order is already available
* The remaining part of the order is on the way

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

Hakeem also handles order status communication.

The system can send automated messages when the order moves through different stages of the fulfillment and delivery process.

![Order Tracking](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003859.png)

The notification workflow can communicate order status updates to:

* The customer
* The pharmacy
* The delivery/shipping company

This allows the involved parties to remain informed about the current state of the order.

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

![Order Availability Monitoring](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003848.png)

If the requested product is unavailable across multiple pharmacies, the system can monitor the availability status and trigger an automated customer notification once the defined availability condition is reached.

This helps the system handle distributed inventory and keep the customer updated without requiring manual follow-up.

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
PostgreSQL / RAG
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

The system supports automated customer communication throughout the ordering lifecycle.

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

# 🌐 Website

> **Hakeem Website:**
> **Coming Soon**

<!-- Add the website link here when available -->

---

# 📁 Repository Structure

```text
HAKEEM/
│
├── README.md
│
├── Screenshot 2026-08-25 003848.png
├── Screenshot 2026-08-25 003859.png
├── Screenshot 2026-08-25 003908.png
├── Screenshot 2026-08-25 003928.png
├── Screenshot 2026-08-25 004012.png
│
├── 5793933590256095252_121.jpg
├── 5793933590256095253_121.jpg
├── 5793933590256095254_121.jpg
├── 5793933590256095255_121.jpg
├── 5793933590256095257_121.jpg
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
* Provide intelligent order tracking and notifications
* Build a scalable multi-agent automation architecture

---

# 🔮 Future Improvements

* 📦 Advanced order tracking
* 💳 Payment integration
* 🧾 Automated invoices
* 📊 Analytics dashboard
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
