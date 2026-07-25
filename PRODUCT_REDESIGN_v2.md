# ARKAVENA OS - PRODUCT REDESIGN v2.0

> **Product Identity & Architecture Specification v2.0** (2026-07-25)

---

## Product Identity

Arkavena OS is **NOT** an ERP.
Arkavena OS is **NOT** a contractor management system.
Arkavena OS is **NOT** a client monitoring dashboard.

Arkavena OS is a **Construction Management Operating System** designed for a company that sits between Clients and Subcontractors.

* **Arkavena** acts as the General Contractor / Construction Manager.
* **Clients** only interact with Arkavena.
* **Subcontractors** only interact with Arkavena.
* All information flows through Arkavena.

---

## Core Principles

Every feature must satisfy at least one of these goals:

1. **Help Arkavena control projects.**
2. **Reduce administrative workload.**
3. **Increase client trust.**

> *If a feature satisfies none of these goals, reject it.*

---

## User Roles & Boundaries

### 1. Client
**Can only:**
* View project progress
* View approved photo reports
* View project documents
* Receive invoices
* Approve addendums
* Receive important notifications

**Clients NEVER see:**
* Workers
* Materials
* Purchases
* Internal costs
* Internal schedules
* Internal discussions

### 2. Project Manager (Arkavena)
Controls every workflow.

**Can:**
* Review reports
* Publish updates
* Review subcontractor RAB
* Adjust selling price
* Generate invoices
* Manage approvals
* Manage project documents

### 3. Subcontractor
**Can only:**
* Upload photos / videos
* Submit daily reports
* Submit requested RAB
* Respond to revision requests

**Subcontractors NEVER communicate directly with clients inside the system.**

---

## Core Workflows

### Project Workflow
```
Subcontractor ──► Upload Daily Report ──► Arkavena Review ──► Approve / Reject / Revise ──► Publish ──► Client Feed
```

### Variation Workflow
```
Client requests additional work
       │
       ▼
Arkavena reviews request
       │
       ▼
If approved internally
       │
       ▼
Request quotation (RAB) from subcontractor
       │
       ▼
Subcontractor submits RAB
       │
       ▼
Arkavena reviews
       │
       ▼
Arkavena adjusts selling price
       │
       ▼
Generate Addendum Proposal
       │
       ▼
Send to Client
       │
       ▼
Client Approval
       │
       ▼
Work Order Released
       │
       ▼
Subcontractor Executes
```

---

## Main Modules

1. **Dashboard**
2. **Projects**
3. **Daily Report Inbox**
4. **Review Center**
5. **Client Feed**
6. **Variations**
7. **Invoice Generator**
8. **Documents**
9. **Subcontractors**
10. **Performance Analytics**

---

## Client Design Philosophy

Keep the client interface extremely simple.
The client should open the app and answer these **4 questions within 30 seconds**:

1. **Is my project progressing?**
2. **What has changed since my last visit?**
3. **Do I need to approve anything?**
4. **Do I have any invoice to pay?**

*Nothing else should compete for attention.*

---

## Architecture Rule

* **Data Isolation**: Always keep internal operational data isolated from client-facing data.
* **Curation Gate**: Client-facing information must always be curated and approved by Arkavena before publication.
* **Single Source of Truth**: Arkavena is the single source of truth.
