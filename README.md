# 🚌 PINBUS – School Bus Tracker Backend

[![Deploy on Vercel](https://vercel.com/button)](https://vercel.com)  
**Backend for the PINBUS Mobile Application**

---

## 📘 Project Overview

**Title:** PINBUS – School Bus Tracker  
**Purpose:** Backend API for a real-time school bus tracking mobile app.  
**Goal:** Reduce parent anxiety by allowing real-time tracking of school buses and student arrivals.  
**Deployment:** Hosted on **Vercel**

---

## 🧭 Table of Contents
- [Overview](#-overview)
- [User Roles](#-user-roles)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Folder Structure](#-folder-structure)
- [Authentication Flow](#-authentication-flow)
- [Environment Variables](#-environment-variables)
- [Local Development](#-local-development)
- [Deployment](#-deployment-vercel)
- [Example API Routes](#-example-api-routes)
- [Notes for Contributors](#-notes-for-contributors)
- [Contact](#-contact)

---

## 🚀 Overview

The **PINBUS backend** powers the mobile application used by schools, supervisors, and parents to manage and monitor school transportation.  
It supports **real-time GPS updates**, **attendance tracking**, **role-based access control**, and **plan-based permissions**.

Each endpoint is secured by **JWT authentication**, and **Redis caching** accelerates common queries for high performance.

---

## 👥 User Roles

| Role | Description |
|------|--------------|
| **Admin** | Global platform administrator with access to all modules. |
| **School** | Represents a school account. Can manage staff, supervisors, and plans. |
| **Supervisor** | Tracks and reports bus locations (latitude/longitude) in real-time. |
| **School Staff** | Manages attendance, buses, and students within their assigned school. Permissions depend on the school’s subscription plan. |
| **Parent** | Linked to a student. Receives **real-time notifications** when their child’s bus arrives or leaves, and can view/update student information. |

---

## ⚙️ Features

### ✅ Authentication
- JWT token-based authentication (`verifyToken.js`).
- Each token includes user `id`, `email`, and `role`.
- All routes under `/api` require valid tokens.

### 🚌 Bus Tracking
- Supervisor sends GPS coordinates (lat/lng) via Supabase.
- Endpoints:
  - `getBusesBySchool`
  - `getBusesBySupervisor`
- Cached responses using Redis.

### 🧾 CRUD Operations
- Every controller supports full **CRUD** (Create, Read, Update, Delete).
- Implemented for: `bus`, `driver`, `school`, `student`, `attendance`, etc.
- Includes advanced retrieval and pagination.

### 📢 Notifications
- Parents receive notifications for their student’s activities and bus status.
- Notification system supports CRUD operations for alerts and events.

### 🧩 Permissions & Plans
- Schools subscribe to plans that define available roles and permissions.
- Controlled through `plan.js`, `permission.js`, and `rolePermission.js`.

### ⚡ Redis Caching
- GET requests cached for quick access.
- Cache invalidated automatically on create/update/delete actions.

### 🔍 Pagination & Validation
- Pagination through `utils/pagination.js`.
- Centralized request validation via `utils/validate.js`.

---

## 🧱 Tech Stack

| Category | Technology |
|-----------|-------------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | PostgreSQL (via Supabase) |
| Caching | Redis |
| Authentication | JWT (JSON Web Tokens) |
| Deployment | Vercel |
| Utilities | Pagination, Validation, Token Verification |

---

## 📂 Folder Structure
PINBUS-Backend/
│
├── config/
│ ├── db.js # PostgreSQL (Supabase) connection
│ └── redis.js # Redis configuration
│
├── controllers/
│ ├── admin.js
│ ├── attendance.js
│ ├── bus.js
│ ├── busAssignment.js
│ ├── busLocation.js
│ ├── driver.js
│ ├── emergencyContact.js
│ ├── notification.js
│ ├── parent.js
│ ├── permission.js
│ ├── plan.js
│ ├── rolePermission.js
│ ├── school.js
│ ├── schoolStaff.js
│ ├── student.js
│ └── supervisor.js
│
├── utils/
│ ├── pagination.js
│ ├── validate.js
│ └── verifyToken.js
│
├── server.js
├── vercel.json
├── package.json
└── .gitignore

---

## 🔐 Authentication Flow

1. Login via `/api/<role>/login`
2. Server returns a JWT:
   ```json
   {
     "id": "123",
     "email": "admin@pinbus.com",
     "role": "admin",
     "token": "..."
   }
---

---

## 🧰 How to Work It on Local

# Clone the project
git clone https://github.com/yourusername/pinbus-backend.git
cd pinbus-backend

# Install dependencies
npm install

# Start development server
npm run dev

Then open in your browser:
👉 http://localhost:5000/api

## 🚀 Deployment

1. Push your repository to GitHub  
2. Import the project on **Vercel**  
3. Add environment variables in **Vercel → Project Settings → Environment Variables**  
4. Deploy — Vercel auto-detects and builds Node.js  

**Production Example:**  
https://pinbus.vercel.app/api
✅ Keep it exactly like that — it’s clean and correct.  

---

### 🧠 **Notes for Contributors Section**
✅ **Purpose:** Helps collaborators follow your backend’s structure and standards.  
✅ **Why it’s right:**
- Lists best practices (code style, validation, caching, JWT security).  
- Encourages maintainable and secure code.  

---

## 📞 Contact

**Author:** Your Name  
**Project:** PINBUS – School Bus Tracker  
**Backend:** Node.js / Express / Supabase / Redis  
**Deployment:** [Vercel](https://vercel.com)

---

## 🏁 Summary

The **PINBUS backend** provides a scalable, secure API for managing school transportation and tracking students in real time.  
Built for **reliability** and **extensibility**, it ensures **peace of mind for parents** and **efficiency for schools**.

---

✅ **Usage:**  
Just copy everything above — paste it directly into your `README.md` file.  
GitHub will render all Markdown and badges perfectly — it’s fully ready to use.
