# 🩺 Hakeem — AI-Powered Pharmacy Ordering Automation

> An AI-powered pharmacy ordering and customer management system built with **n8n, PostgreSQL, WhatsApp, and AI Agents**.

---

## 📌 Overview

**Hakeem** is an AI-powered pharmacy automation system designed to manage customer interactions and pharmacy orders through WhatsApp.

The system combines **AI Agents, n8n automation, WhatsApp integration, and PostgreSQL** to create an intelligent and persistent ordering workflow.

---

## ✨ Key Features

* 🤖 AI-powered customer interaction
* 💬 WhatsApp-based ordering
* 🧠 AI intent classification
* 🔀 Router Agent
* 📦 Upper & Lower Agents
* 👤 Automated customer data collection
* 🗄️ PostgreSQL database integration
* 🔄 Persistent session management
* 🧾 Order management
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
                       │ WhatsApp Response│
                       └──────────────────┘
```

---

# 🔄 Main Workflow

The complete Hakeem automation workflow is orchestrated through **n8n**.

### Workflow

![Hakeem Workflow](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003848.png)

The workflow handles:

1. Receiving the WhatsApp message
2. Checking the customer's session
3. Routing the request
4. Selecting the appropriate AI Agent
5. Checking customer information
6. Collecting missing data
7. Processing the order
8. Updating PostgreSQL
9. Sending the response back to WhatsApp

---

# 💬 WhatsApp Integration

WhatsApp is the primary communication channel between customers and the Hakeem system.

### WhatsApp Workflow

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
PostgreSQL
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

![WhatsApp Integration](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003859.png)

---

# 🧠 AI Agent Architecture

Hakeem uses a **multi-agent architecture**, where each agent has a specific responsibility.

![AI Agent Architecture](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003908.png)

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

---

## Upper Agent

The Upper Agent handles requests classified as `upper`.

Responsibilities include:

* Understanding the request
* Validating customer information
* Processing the request
* Communicating with the database
* Generating the final response

---

## Lower Agent

The Lower Agent handles requests classified as `lower`.

Responsibilities include:

* Understanding the request
* Validating customer information
* Processing the request
* Communicating with the database
* Generating the final response

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

---

# 🗄️ Database Architecture

Hakeem uses **PostgreSQL** as the persistent data layer.

![Database Architecture](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003928.png)

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

n8n is responsible for orchestrating the entire workflow.

### Main Responsibilities

* WhatsApp message handling
* Webhooks
* Session management
* AI Agent execution
* Database queries
* Customer data validation
* Order processing
* Sending WhatsApp responses

### Automation Workflow

![n8n Automation](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20004012.png)

---

# 🛠️ Tech Stack

| Technology           | Purpose                               |
| -------------------- | ------------------------------------- |
| **n8n**              | Workflow automation                   |
| **AI Agents / LLMs** | Understanding and processing requests |
| **PostgreSQL**       | Persistent database                   |
| **WhatsApp API**     | Customer communication                |
| **REST APIs**        | System integration                    |
| **Webhooks**         | Event-driven communication            |
| **SQL**              | Database operations                   |

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
             Customer Data Agent
                       │
                       ▼
                PostgreSQL
                       │
                       ▼
                 Order Logic
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

## 🔄 Workflow

![Workflow](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003848.png)

## 💬 WhatsApp

![WhatsApp](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003859.png)

## 🧠 AI Agents

![AI Agents](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003908.png)

## 🗄️ Database

![Database](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003928.png)

## ⚙️ n8n Automation

![Automation](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20004012.png)

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
4. Session is checked
              ↓
5. Router Agent classifies the request
              ↓
6. Upper or Lower Agent handles the request
              ↓
7. Customer information is validated
              ↓
8. Missing information is collected
              ↓
9. PostgreSQL is updated
              ↓
10. Order/request is processed
              ↓
11. AI generates the response
              ↓
12. Response is sent through WhatsApp
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
* Build a scalable multi-agent automation architecture

---

# 🔮 Future Improvements

* 📦 Advanced order tracking
* 💳 Payment integration
* 🧾 Automated invoices
* 📊 Analytics dashboard
* 🔔 Automated notifications
* 🧠 Advanced long-term memory
* 🏪 Multi-pharmacy support
* 📱 Mobile application
* 📈 Customer analytics

---

# 📌 Project Status

**Active Development**

Hakeem is designed as a modular architecture that can be extended with additional agents, workflows, integrations, and pharmacy services.

---

# 👨‍💻 Author

**Yousef Ahmed**

AI Engineer | Machine Learning | Deep Learning | NLP | AI Automation

---

## ⭐ Hakeem

**AI-powered pharmacy ordering automation through WhatsApp.**
