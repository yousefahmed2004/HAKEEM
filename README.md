# Hakeem — AI-Powered Pharmacy Ordering Platform

> An AI-powered pharmacy ordering and fulfillment platform that connects customers, AI agents, pharmacies, and delivery companies through an automated workflow.

---

## 📌 Overview

**Hakeem** is an AI-powered pharmacy ordering platform designed to automate the complete journey of a pharmacy order — from the first customer message to pharmacy fulfillment and delivery.

The platform combines:

- AI Agents
- WhatsApp
- RAG
- n8n
- PostgreSQL
- Pharmacy Dashboards
- Admin Dashboard
- Order Management
- Delivery Integration

The main idea behind Hakeem is to create a **centralized pharmacy network** where customers can place an order through WhatsApp, while Hakeem automatically manages customer information, order processing, pharmacy fulfillment, partial fulfillment, order tracking, and delivery communication.

---

# 🎯 Core Concept

The platform is built around a simple flow:

```text
Customer
   │
   ▼
WhatsApp
   │
   ▼
AI Customer Agent
   │
   ├── Missing Customer Data
   │        │
   │        ▼
   │   Collect Information
   │
   └── Customer Data Complete
            │
            ▼
       Order Agent
            │
            ▼
       Create Order
            │
            ▼
     Pharmacy Network
            │
      ┌─────┴─────┐
      ▼           ▼
 Pharmacy A    Pharmacy B
      │           │
      └─────┬─────┘
            ▼
      Order Fulfillment
            │
      ┌─────┴──────┐
      ▼            ▼
 Full Fulfillment  Partial Fulfillment
      │            │
      │            ▼
      │       Remaining Items
      │            │
      │            ▼
      │       Another Pharmacy
      │            │
      └──────┬─────┘
             ▼
       Delivery Company
             │
             ▼
          Customer
````

---

# ✨ Key Features

* 🤖 AI-powered customer interaction
* 💬 WhatsApp-based ordering
* 👤 Automated customer data collection
* 🧠 Multi-agent architecture
* 🔀 Intelligent request routing
* 📦 Automated order creation
* 💊 Medicine details and specifications collection
* 🏪 Multi-pharmacy network
* 📥 Pharmacy order dashboards
* ⚡ First-pharmacy acceptance workflow
* 📦 Full order fulfillment
* 🔄 Partial order fulfillment
* 🔁 Automatic redistribution of remaining items
* 🚚 Delivery company integration
* 🧾 Order timeline management
* 💰 Multi-pharmacy payment / collection handling
* 📊 Admin analytics dashboard
* 🏪 Pharmacy management
* 💊 Best-selling medicine analytics
* 🧠 RAG-based Hakeem policies and knowledge
* 🔄 Persistent customer sessions
* 🗄️ PostgreSQL integration
* ⚡ n8n workflow automation

---

# 🏗️ System Architecture

```text
                         ┌──────────────────┐
                         │     Customer     │
                         │     WhatsApp     │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │   WhatsApp API   │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │       n8n        │
                         └────────┬─────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │ Customer Data Agent     │
                    └────────────┬────────────┘
                                 │
                       ┌─────────┴─────────┐
                       ▼                   ▼
                Missing Data        Data Complete
                       │                   │
                       ▼                   ▼
                Ask Customer        Order Agent
                                           │
                                           ▼
                                    Collect Order
                                      Details
                                           │
                                           ▼
                                      Create Order
                                           │
                                           ▼
                                  Pharmacy Network
                                           │
                            ┌──────────────┴──────────────┐
                            ▼                             ▼
                       Pharmacy A                    Pharmacy B
                            │                             │
                            └──────────────┬──────────────┘
                                           ▼
                                    Order Fulfillment
                                           │
                              ┌────────────┴────────────┐
                              ▼                         ▼
                       Full Fulfillment          Partial Fulfillment
                              │                         │
                              │                         ▼
                              │                  Remaining Items
                              │                         │
                              │                         ▼
                              │                  Another Pharmacy
                              │                         │
                              └────────────┬────────────┘
                                           ▼
                                    Delivery Company
                                           │
                                           ▼
                                         Customer
```

---

# 🤖 AI Agent Architecture

Hakeem uses a multi-agent architecture where each agent has a specific responsibility.

![AI Agents](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003928.png)

---

# 👤 Customer Data Agent

The first agent is responsible for collecting and validating customer information.

The required information includes:

* Name
* WhatsApp phone number
* Address

The phone number is already associated with the customer's WhatsApp interaction, while the agent ensures that the required customer information is available.

---

## Customer Data Flow

```text
Customer Message
       │
       ▼
Customer Data Agent
       │
       ▼
Check Customer Database
       │
       ├── Data Complete
       │       │
       │       ▼
       │   Order Agent
       │
       └── Data Missing
               │
               ▼
        Identify Missing Field
               │
               ▼
          Ask Customer
               │
               ▼
        Update Customer Data
               │
               ▼
        Check Again
```

The agent does not repeatedly ask for information that already exists.

For example:

```text
Name:     Yusuf Ahmed
Phone:    010XXXXXXXX
Address:  NULL
```

The agent will only ask:

```text
What is your address?
```

Once the required customer information is complete, the conversation moves to the order agent.

---

# 📦 Order Agent

After the customer's information is complete, the system moves the conversation to the **Order Agent**.

The Order Agent is responsible for collecting the actual order details.

The agent can collect information such as:

* Medicine name
* Quantity
* Concentration
* Dosage
* Product form
* Cream
* Ointment
* Tablets
* Capsules
* Syrup
* Other requested specifications

For example:

```text
Customer:
I need Panadol 500mg, two boxes.
```

The Order Agent understands the request and structures the order before sending it into the pharmacy fulfillment workflow.

---

# 🧠 RAG System

Hakeem integrates a **RAG (Retrieval-Augmented Generation)** system into the workflow.

![RAG System](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003908.png)

The RAG system provides the AI agents with relevant information from the Hakeem knowledge base.

The knowledge base can contain:

* Hakeem policies
* Pharmacy policies
* Ordering rules
* Customer interaction rules
* Operational procedures
* Fulfillment policies
* Other Hakeem documentation

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

This allows the agents to use the latest Hakeem-specific policies instead of relying only on the LLM's internal knowledge.

---

# 🏪 Pharmacy Network

Hakeem is designed to operate with a network of pharmacies.

The platform administrator can register and manage multiple pharmacies through the Admin Dashboard.

For example:

```text
Hakeem
  │
  ├── Pharmacy 1
  ├── Pharmacy 2
  ├── Pharmacy 3
  ├── Pharmacy 4
  ├── Pharmacy 5
  ├── Pharmacy 6
  ├── Pharmacy 7
  ├── Pharmacy 8
  ├── Pharmacy 9
  └── Pharmacy 10
```

When a customer creates an order, the order can be distributed to the connected pharmacy network.

---

# 📥 Pharmacy Order Acceptance

Once an order is created, it becomes available to participating pharmacies.

```text
Customer Order
      │
      ▼
Pharmacy Network
      │
 ┌────┼────┬────┐
 ▼    ▼    ▼    ▼
 P1   P2   P3   P4
 │
 │ First Pharmacy
 │ Accepts
 ▼
Order Processing
```

The first pharmacy that accepts the order becomes responsible for processing it.

---

# 📦 Full Order Fulfillment

If the pharmacy has all requested products, it can perform a **full fulfillment**.

```text
Customer Order
      │
      ▼
Pharmacy A
      │
      ▼
All Items Available
      │
      ▼
Full Fulfillment
      │
      ▼
Order Completed
      │
      ▼
Delivery Timeline
      │
      ▼
Delivery Company
      │
      ▼
Customer
```

In this case, the pharmacy controls the complete order timeline and is responsible for sending the required order information to the delivery company.

---

# 🔄 Partial Order Fulfillment

One of Hakeem's most important features is **partial order fulfillment**.

A pharmacy may have only some of the products requested by the customer.

Instead of rejecting the entire order, the pharmacy can fulfill the available items.

```text
Customer Order
      │
      ▼
Pharmacy A
      │
 ┌────┴─────┐
 ▼          ▼
Available  Unavailable
 Items       Items
 │            │
 ▼            ▼
Fulfill    Remaining
Items        Order
              │
              ▼
       Create New Order
              │
              ▼
       Another Pharmacy
```

---

# 🧩 Partial Fulfillment Example

Suppose the customer requests:

```text
Product A
Product B
Product C
Product D
```

Pharmacy A has:

```text
Product A
Product B
```

but does not have:

```text
Product C
Product D
```

Pharmacy A performs partial fulfillment:

```text
Pharmacy A
    │
    ├── Product A ✓
    ├── Product B ✓
    │
    ├── Product C ✗
    └── Product D ✗
```

The remaining products are then returned to the pharmacy network as a new order.

```text
Remaining Order
      │
      ├── Product C
      └── Product D
             │
             ▼
       Another Pharmacy
```

This allows another pharmacy to fulfill the remaining part of the customer's order.

---

# 🆕 Remaining Order Creation

After a partial fulfillment, Hakeem creates a new order containing only the remaining items.

```text
Original Order
      │
      ▼
Pharmacy A
      │
      ▼
Partial Fulfillment
      │
      ├── Fulfilled Items
      │
      └── Remaining Items
              │
              ▼
        New Order Created
              │
              ▼
        Pharmacy Network
              │
              ▼
          Pharmacy B
```

This means the customer does not need to place another order manually.

---

# 🚚 Order Timeline

Hakeem maintains an order timeline for tracking the fulfillment process.

![Order Timeline](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20003859.png)

The timeline tracks the different stages of the order.

```text
Order Created
      │
      ▼
Pharmacy Accepted
      │
      ▼
Processing
      │
      ▼
Full / Partial Fulfillment
      │
      ▼
Delivery Preparation
      │
      ▼
Delivery Company
      │
      ▼
Customer
```

---

# 🔄 Timeline During Partial Fulfillment

Partial fulfillment has a special timeline behavior.

When Pharmacy A performs partial fulfillment:

```text
Pharmacy A
    │
    ▼
Partial Fulfillment
    │
    ▼
Pharmacy A Timeline
    │
    ▼
Closed
```

The remaining order is then assigned to another pharmacy.

```text
Remaining Order
      │
      ▼
Pharmacy B
      │
      ▼
New Timeline
      │
      ▼
Continue Fulfillment
```

The second pharmacy becomes responsible for continuing the remaining order.

---

# 🚚 Delivery Company Integration

When the order is ready for delivery, the responsible pharmacy prepares the delivery information.

In a full fulfillment:

```text
Pharmacy A
    │
    ▼
Full Order
    │
    ▼
Delivery Timeline
    │
    ▼
Delivery Company
```

In a partial fulfillment scenario, the second pharmacy becomes responsible for preparing the final delivery information.

The delivery information can include:

* Pharmacy A information
* Pharmacy B information
* Customer information
* Order details
* Amount collected from Pharmacy A
* Amount collected from Pharmacy B
* Delivery fees
* Total collection amount

---

# 💰 Multi-Pharmacy Collection

When an order is fulfilled by multiple pharmacies, the delivery company needs the financial information associated with each pharmacy.

For example:

```text
Pharmacy A
    │
    ├── Fulfilled Items
    └── Collection Amount
             │
             ▼
        Delivery Data
             ▲
             │
    ┌────────┴────────┐
    │                 │
Pharmacy A        Pharmacy B
Amount            Amount
```

The final delivery information can therefore contain the amounts that should be collected from each participating pharmacy along with the delivery fees and total order value.

---

# 🏪 Multi-Pharmacy Fulfillment

The complete distributed fulfillment process works as follows:

```text
                         CUSTOMER ORDER
                               │
                               ▼
                      Pharmacy Network
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
           Pharmacy A     Pharmacy B     Pharmacy C
                │
                ▼
          Accepts Order
                │
                ▼
        Check Availability
                │
          ┌─────┴─────┐
          ▼           ▼
        Full        Partial
      Fulfillment  Fulfillment
          │           │
          │           ▼
          │      Remaining Items
          │           │
          │           ▼
          │      New Order
          │           │
          │           ▼
          │      Pharmacy B
          │           │
          │           ▼
          └─────┬─────┘
                ▼
        Delivery Company
                │
                ▼
             Customer
```

---

# ❌ Product Unavailability Threshold

Hakeem also handles situations where a requested product cannot be found across the pharmacy network.

If more than **five pharmacies** report that a specific requested item is unavailable, the system can trigger a customer notification.

```text
Requested Product
       │
       ▼
Check Pharmacies
       │
       ▼
Pharmacy 1 → Not Available
Pharmacy 2 → Not Available
Pharmacy 3 → Not Available
Pharmacy 4 → Not Available
Pharmacy 5 → Not Available
Pharmacy 6 → Not Available
       │
       ▼
More Than 5 Pharmacies
       │
       ▼
Product Unavailable
       │
       ▼
Notify Customer
```

The customer can receive a message informing them that the unavailable product is currently not available while the rest of the order is already on its way.

Example:

```text
The requested item is currently unavailable.

The remaining items from your order are already on the way.
We will update you when the unavailable item becomes available.
```

This prevents the entire order from being blocked because of a single unavailable product.

---

# 📊 Admin Dashboard

Hakeem provides a centralized Admin Dashboard for managing the pharmacy network and monitoring platform activity.

## Platform Statistics

![Admin Statistics](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20010958.png)

The administrator can monitor:

* Customer activity
* Calls and interactions
* Orders
* Pharmacies
* Platform statistics

---

## 🏪 Pharmacy Management

![Pharmacy Management](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011122.png)

The administrator can:

* View pharmacies
* Add new pharmacies
* Manage pharmacy information
* Monitor pharmacy activity
* Manage the connected pharmacy network

---

## 📦 Admin Orders

![Admin Orders](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011151.png)

The administrator can monitor:

* Customer orders
* Order status
* Fulfillment status
* Order history
* Pharmacy fulfillment

---

## 💊 Most Sold Medicines

![Most Sold Medicines](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011204.png)

The dashboard provides analytics about the most frequently sold or requested medicines.

This helps administrators understand:

* Product demand
* Most requested medicines
* Sales activity
* Inventory requirements

---

# 🏪 Pharmacy Dashboard

Each pharmacy has its own dashboard for receiving and processing orders.

## 📥 Incoming Orders

![Pharmacy Orders](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011233.png)

Pharmacists can:

* View incoming orders
* Review requested products
* Check order details
* Accept orders
* Process orders
* Update fulfillment status

---

# 📦 Pharmacy Fulfillment Interface

![Order Fulfillment](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011251.png)

The pharmacy can choose between:

### Full Fulfillment

The pharmacy has all requested products and completes the entire order.

### Partial Fulfillment

The pharmacy has only some of the requested products.

The available products are fulfilled while the remaining products are returned to the network as a new order.

---

# 🔄 Partial Fulfillment Screens

![Partial Fulfillment 1](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011337.png)

![Partial Fulfillment 2](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011400.png)

![Partial Fulfillment 3](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011410.png)

These screens demonstrate how Hakeem handles the partial fulfillment workflow and redistributes the remaining order to another pharmacy.

---

# 🗄️ Database Integration

Hakeem uses **PostgreSQL** as the persistent data layer.

The database manages:

* Customer information
* Pharmacy information
* Customer sessions
* Orders
* Order items
* Order status
* Order timeline
* Pharmacy fulfillment
* AI conversation history

### Main Tables

| Table                | Description                         |
| -------------------- | ----------------------------------- |
| `customers`          | Customer information                |
| `pharmacies`         | Pharmacy information                |
| `order_sessions`     | Customer ordering sessions          |
| `order_items`        | Individual order items              |
| `orders`             | Customer orders                     |
| `order_timeline`     | Order status and fulfillment events |
| `n8n_chat_histories` | AI conversation history             |

---

# ⚙️ n8n Automation

n8n is responsible for orchestrating the complete automation workflow.

### Main Responsibilities

* WhatsApp message handling
* Webhooks
* Session management
* Customer data collection
* AI Agent execution
* RAG retrieval
* Database queries
* Order creation
* Pharmacy order distribution
* Pharmacy fulfillment
* Partial fulfillment
* New remaining-order creation
* Order timeline management
* Delivery notifications
* Customer notifications

---

# 🛠️ Tech Stack

| Technology           | Purpose                                   |
| -------------------- | ----------------------------------------- |
| **n8n**              | Workflow automation and orchestration     |
| **AI Agents / LLMs** | Customer interaction and order processing |
| **RAG**              | Hakeem policies and knowledge retrieval   |
| **PostgreSQL**       | Persistent data storage                   |
| **WhatsApp API**     | Customer communication                    |
| **REST APIs**        | System integrations                       |
| **Webhooks**         | Event-driven communication                |
| **SQL**              | Database operations                       |

---

# 📊 Complete End-to-End Flow

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
                 Customer Data Agent
                            │
                    ┌───────┴───────┐
                    ▼               ▼
              Data Missing      Data Complete
                    │               │
                    ▼               ▼
              Ask Customer      Order Agent
                    │               │
                    │               ▼
                    │        Collect Order Details
                    │               │
                    └───────────────┤
                                    ▼
                              Create Order
                                    │
                                    ▼
                            Pharmacy Network
                                    │
                                    ▼
                           First Pharmacy Accepts
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
                   Full Fulfillment      Partial Fulfillment
                         │                     │
                         ▼                     ▼
                  Complete Order        Available Items
                         │                     │
                         │                     ▼
                         │              Remaining Items
                         │                     │
                         │                     ▼
                         │                New Order
                         │                     │
                         │                     ▼
                         │              Another Pharmacy
                         │                     │
                         └──────────┬──────────┘
                                    ▼
                              Order Timeline
                                    │
                                    ▼
                           Delivery Company
                                    │
                                    ▼
                                Customer
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
4. Customer session is checked
              ↓
5. Customer Data Agent checks customer information
              ↓
6. Missing information is collected
              ↓
7. Customer data becomes complete
              ↓
8. Order Agent starts collecting the order
              ↓
9. Medicine name, quantity, concentration and form are collected
              ↓
10. Order is created
              ↓
11. Order is distributed to the pharmacy network
              ↓
12. First pharmacy accepts the order
              ↓
13. Pharmacy checks product availability
              ↓
14. Full or partial fulfillment is selected
              ↓
15. If partial, remaining items become a new order
              ↓
16. Remaining order is sent to another pharmacy
              ↓
17. Fulfillment timelines are updated
              ↓
18. Delivery information is prepared
              ↓
19. Delivery company receives the required information
              ↓
20. Customer receives order updates
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

## 🚚 Order Tracking

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

![Partial Fulfillment 1](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011337.png)

![Partial Fulfillment 2](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011400.png)

![Partial Fulfillment 3](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/Screenshot%202026-08-25%20011410.png)

---


# 💬 WhatsApp AI Assistant

Hakeem uses **WhatsApp as the main customer communication channel**, allowing customers to interact with the platform naturally and place pharmacy orders through conversation.

The WhatsApp assistant is connected to the AI agents, n8n workflows, PostgreSQL database, and RAG system.

### 📱 WhatsApp Customer Interaction

The customer can start a conversation through WhatsApp, provide their information, request medicines, and receive order updates directly through the chat.

![WhatsApp Chat 1](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/5793933590256095252_121.jpg)

![WhatsApp Chat 2](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/5793933590256095253_121.jpg)

![WhatsApp Chat 3](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/5793933590256095254_121.jpg)

![WhatsApp Chat 4](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/5793933590256095255_121.jpg)

![WhatsApp Chat 5](https://raw.githubusercontent.com/yousefahmed2004/HAKEEM/main/5793933590256095257_121.jpg)

# 🌐 Website

## Hakeem Web Platform

The Hakeem web platform provides the administrative and pharmacy interfaces used to manage the operational side of the system.

**Website:**

> https://hakeem.sbs/

---

```

---

# 🎯 Project Goals

Hakeem was built to:

* Automate pharmacy customer interactions
* Collect and maintain customer information
* Automate pharmacy ordering
* Connect customers with a network of pharmacies
* Reduce manual order processing
* Support full and partial order fulfillment
* Automatically redistribute remaining order items
* Coordinate fulfillment across multiple pharmacies
* Track order status and fulfillment events
* Simplify communication with delivery companies
* Keep customers updated throughout the order lifecycle
* Connect conversational AI with real business operations
* Build a scalable AI-powered pharmacy platform

---

# 🔮 Future Improvements

* 💳 Payment integration
* 🧾 Automated invoices
* 📊 Advanced analytics
* 🔔 Advanced notification system
* 🧠 Advanced long-term AI memory
* 🏪 Expanded multi-pharmacy network
* 📱 Mobile application
* 📈 Customer analytics
* 🚚 Advanced delivery integrations
* 🌐 Public Hakeem web platform
* 🤖 Additional specialized AI agents

---

# 📌 Project Status

**Active Development**

Hakeem is designed as a modular pharmacy automation platform that can be extended with additional AI agents, pharmacies, workflows, delivery integrations, analytics, and pharmacy services.

---

# 👨‍💻 Author

**Yousef Ahmed**

AI Engineer | Machine Learning | Deep Learning | NLP | AI Automation

---

## ⭐ Hakeem

**AI-powered pharmacy ordering and fulfillment through WhatsApp.**

```
```
