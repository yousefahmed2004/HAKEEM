# 🩺 Hakeem — AI-Powered Pharmacy Ordering Automation

> An AI-powered pharmacy ordering and customer management system built with **n8n, PostgreSQL, and WhatsApp automation**.

---

## 📌 Overview

**Hakeem** is an intelligent automation system designed to streamline pharmacy ordering through WhatsApp.

The system uses AI agents to understand customer requests, manage conversations, collect missing customer information, handle orders, and maintain persistent sessions and customer data through a PostgreSQL database.

The main goal is to transform a traditional WhatsApp-based pharmacy ordering process into an **automated, intelligent, and structured workflow**.

---

## ✨ Key Features

* 🤖 AI-powered customer interaction
* 💬 WhatsApp-based ordering
* 🧠 Intelligent intent routing
* 🔀 Router Agent for request classification
* 📦 Upper / Lower Agents for specialized workflows
* 👤 Automatic customer data collection
* 🗄️ PostgreSQL database integration
* 🔄 Persistent conversation sessions
* 🧾 Order management
* 📍 Customer address management
* 📱 Fully automated WhatsApp workflow
* ⚡ Built with n8n automation
* 🔎 Database validation before requesting information
* 🧩 Modular multi-agent architecture

---

# 🏗️ System Architecture

The overall system follows a multi-agent architecture:

```text
                    ┌─────────────────┐
                    │     WhatsApp    │
                    │     Customer    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   WhatsApp API  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Router Agent  │
                    └────────┬────────┘
                             │
                  ┌──────────┴──────────┐
                  │                     │
                  ▼                     ▼
          ┌──────────────┐      ┌──────────────┐
          │ Upper Agent  │      │ Lower Agent  │
          └──────┬───────┘      └──────┬───────┘
                 │                     │
                 └──────────┬──────────┘
                            ▼
                 ┌─────────────────────┐
                 │ Customer Data /     │
                 │ Order Processing    │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │     PostgreSQL      │
                 │      Database       │
                 └─────────────────────┘
```

---

## 🔄 Main Workflow

### Workflow Diagram

> 📸 **Add Workflow Screenshot Here**

```text
[WhatsApp Message]
        │
        ▼
[WhatsApp API]
        │
        ▼
[Session Check]
        │
        ├── Existing Session ──► Continue Session
        │
        └── No Session ─────────► Create Session
                                      │
                                      ▼
                              [Router Agent]
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                   [Upper Agent]             [Lower Agent]
                         │                         │
                         └────────────┬────────────┘
                                      ▼
                           [Customer Data Check]
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                  Data Complete              Data Missing
                         │                         │
                         ▼                         ▼
                  Process Order           Ask For Missing
                                                Data
                                      │
                                      ▼
                                [PostgreSQL]
```

### 🔗 Workflow Screenshot

Replace the placeholder below with your actual workflow image:

```markdown
![Hakeem Workflow](./images/workflow.png)
```

---

# 💬 WhatsApp Integration

Hakeem uses WhatsApp as the primary communication channel between customers and the pharmacy system.

Customers can send natural-language messages through WhatsApp without interacting directly with the database or internal systems.

### WhatsApp Flow

```text
Customer
   │
   │ WhatsApp Message
   ▼
WhatsApp API
   │
   ▼
n8n Workflow
   │
   ▼
AI Agents
   │
   ▼
Database
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

### 📱 WhatsApp Screenshots

> 📸 **Add WhatsApp conversation screenshots here**

```markdown
![WhatsApp Conversation](./images/whatsapp-conversation.png)
```

---

# 🧠 AI Agent Architecture

Hakeem uses multiple specialized AI agents instead of relying on a single large agent.

This makes the system easier to control, maintain, debug, and extend.

---

## 1. Router Agent

The **Router Agent** is responsible for determining which workflow should handle the customer's request.

Its output is intentionally limited to a specific intent.

Example:

```text
Customer Message
       │
       ▼
 Router Agent
       │
       ├── upper
       │
       └── lower
```

The router prevents unrelated logic from being executed and directs the conversation to the appropriate agent.

---

## 2. Upper Agent

The **Upper Agent** handles requests classified as `upper`.

It processes the request according to the business logic associated with the upper workflow.

```text
Router
   │
   ▼
Upper Agent
   │
   ├── Validate Data
   ├── Process Request
   ├── Access Database
   └── Generate Response
```

---

## 3. Lower Agent

The **Lower Agent** handles requests classified as `lower`.

```text
Router
   │
   ▼
Lower Agent
   │
   ├── Validate Data
   ├── Process Request
   ├── Access Database
   └── Generate Response
```

---

# 👤 Customer Data Collection

One of the important components of Hakeem is the **Customer Data Collection Agent**.

The agent is responsible for collecting the required customer information.

### Required Information

* Customer Name
* Phone Number
* Address

Before asking the customer for information, the system checks the PostgreSQL database to determine which fields are already available.

### Example

If the database contains:

```text
Name:     Yusuf Ahmed
Phone:    010XXXXXXXX
Address:  NULL
```

The agent should only ask:

```text
What is your address?
```

Instead of asking for all customer information again.

### Collection Logic

```text
                Customer
                   │
                   ▼
          Check Customer DB
                   │
          ┌────────┴────────┐
          ▼                 ▼
     Data Complete      Data Missing
          │                 │
          ▼                 ▼
     Continue Order    Identify Missing
                            │
                            ▼
                    Ask ONE Field
                            │
                            ▼
                    Update Database
```

---

# 🔄 Session Management

Hakeem maintains conversation sessions to ensure that customers can continue an existing conversation without losing context.

### Session Logic

```text
Incoming Message
       │
       ▼
Check Session
       │
   ┌───┴────┐
   ▼        ▼
Exists    Doesn't Exist
   │           │
   ▼           ▼
Continue     Create
Session      Session
   │           │
   └─────┬─────┘
         ▼
      AI Agent
         │
         ▼
      Response
```

This allows the system to distinguish between:

* New conversations
* Existing conversations
* Closed sessions
* Active sessions

---

# 🗄️ Database Architecture

Hakeem uses **PostgreSQL** as the main persistent data layer.

The database stores customer information, pharmacy information, sessions, orders, order items, and conversation history.

### Main Tables

| Table                | Purpose                                |
| -------------------- | -------------------------------------- |
| `customers`          | Stores customer information            |
| `pharmacies`         | Stores pharmacy information            |
| `order_sessions`     | Manages active ordering sessions       |
| `order_items`        | Stores individual order items          |
| `orders`             | Stores customer orders                 |
| `order_timeline`     | Tracks order events and status changes |
| `n8n_chat_histories` | Stores AI conversation history         |

---

## 🗂️ Database Relationship

```text
Customers
    │
    ├──────────────► Order Sessions
    │
    └──────────────► Orders
                         │
                         ▼
                    Order Items
                         │
                         ▼
                  Order Timeline


Pharmacies
    │
    └──────────────► Orders


AI Conversations
    │
    └──────────────► n8n_chat_histories
```

---

# ⚙️ Automation Workflow

The entire automation pipeline is orchestrated using **n8n**.

n8n is responsible for:

* Receiving WhatsApp messages
* Managing workflow execution
* Checking sessions
* Calling AI agents
* Executing database queries
* Updating customer information
* Creating and updating orders
* Sending responses back to WhatsApp

### High-Level n8n Flow

```text
WhatsApp Trigger
       │
       ▼
Session Management
       │
       ▼
Router Agent
       │
       ├──────────────┐
       ▼              ▼
Upper Agent      Lower Agent
       │              │
       └───────┬──────┘
               ▼
      Customer Validation
               │
               ▼
         PostgreSQL
               │
               ▼
        Generate Response
               │
               ▼
         WhatsApp API
```

---

# 🛠️ Tech Stack

### Automation

* **n8n**

### AI

* **LLM-based AI Agents**
* Prompt-based intent routing
* Multi-agent architecture

### Database

* **PostgreSQL**

### Communication

* **WhatsApp API**

### Backend / Integration

* REST APIs
* Webhooks
* SQL queries
* JSON-based data exchange

---

# 🧩 Architecture Principles

Hakeem was designed around several principles:

### 1. Modular Agents

Each agent has a specific responsibility instead of putting the entire business logic into one AI agent.

### 2. Database-Driven Context

Customer information is retrieved from PostgreSQL instead of relying entirely on conversation memory.

### 3. Persistent Sessions

Customer conversations can continue across multiple messages.

### 4. Minimal Data Collection

The system only asks for information that is actually missing.

### 5. Controlled AI Output

Agents are given clearly defined responsibilities and expected outputs.

---

# 📸 Project Screenshots

## n8n Workflow

> Add your n8n workflow screenshot here.

```markdown
![n8n Workflow](./images/n8n-workflow.png)
```

---

## WhatsApp Conversation

> Add WhatsApp screenshots here.

```markdown
![WhatsApp](./images/whatsapp.png)
```

---

## Database

> Add your PostgreSQL / database diagram here.

```markdown
![Database Architecture](./images/database.png)
```

---

## 🤖 AI Agent Workflow

> Add your AI agent architecture screenshot here.

```markdown
![AI Agents](./images/agents.png)
```

---

# 📁 Suggested Repository Structure

```text
Hakeem/
│
├── README.md
│
├── images/
│   ├── workflow.png
│   ├── whatsapp.png
│   ├── database.png
│   └── agents.png
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

# 🚀 How It Works

A typical customer interaction follows these steps:

```text
1. Customer sends a WhatsApp message
                    ↓
2. WhatsApp API receives the message
                    ↓
3. n8n starts the workflow
                    ↓
4. System checks the customer's session
                    ↓
5. Router Agent determines the intent
                    ↓
6. Request is sent to Upper or Lower Agent
                    ↓
7. Required customer data is validated
                    ↓
8. Missing information is collected
                    ↓
9. PostgreSQL is updated
                    ↓
10. Order/request is processed
                    ↓
11. AI generates a response
                    ↓
12. Response is sent back through WhatsApp
```

---

# 🎯 Project Goals

Hakeem aims to:

* Automate pharmacy customer interactions
* Reduce manual order processing
* Improve customer experience
* Maintain structured customer data
* Reduce repetitive questions
* Provide scalable AI-powered automation
* Connect conversational AI with real business databases

---

# 🔮 Future Improvements

Potential future improvements include:

* 📦 Advanced order tracking
* 💳 Online payment integration
* 🧾 Automated invoices
* 📊 Pharmacy analytics dashboard
* 🔔 Automated order notifications
* 🧠 Improved long-term conversational memory
* 🌐 Multi-pharmacy support
* 📱 Mobile application
* 📈 Customer analytics
* 🔐 Advanced authentication and access control

---

# 👨‍💻 Project

**Hakeem — AI-Powered Pharmacy Ordering Automation**

Built using:

`n8n` · `PostgreSQL` · `WhatsApp API` · `AI Agents` · `REST APIs`

---

## ⭐ Project Status

**Active Development**

The architecture is modular and can be extended with additional AI agents, workflows, integrations, and pharmacy services.

