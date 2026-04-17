# TeamFlow — Modern Kanban & Sprint Planning Dashboard

![TeamFlow Banner](https://img.shields.io/badge/Status-Development-blueviolet?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-React_|_Node_|_PostgreSQL-007ACC?style=for-the-badge)

**TeamFlow** is a high-performance, collaborative Kanban and Sprint Planning dashboard designed for modern engineering teams. Built with a focus on visual excellence and intuitive user experience, it combines powerful task management with real-time analytics and a premium glassmorphic interface.

---

## ✨ Key Features

### 🏃‍♂️ Sprint Planning & Backlog
- **Project Backlog**: A dedicated two-column planning hub for managing unassigned tasks vs. your current sprint.
- **Sprint Lifecycle**: Full support for sprint states—**Planning**, **Active**, and **Completed**.
- **In-place Editing**: Update sprint names, goals, and dates instantly with inline editing.
- **Real-time Capacity**: Track sprint workload with automatic progress bars based on estimated hours (completed vs. total).
- **Auto-Rollback**: Unfinished tasks automatically move back to the Project Backlog when a sprint is completed.

### 📋 Intelligent Kanban Board
- **Active Sprint Visibility**: Smart banner tracking the current sprint's name, goal, and countdown.
- **Fluid Drag & Drop**: Manage project flow with smooth, responsive transitions across customizable columns.
- **Sprint-Filtered Views**: Focus the board on the current active sprint or view all project issues.

### ⚡ Professional Task Hierarchy
Enforced hierarchy rules for structured project management:
- **Epic** ➔ High-level objectives.
- **Story** ➔ User requirements (optionally linked to Epics).
- **Task** ➔ Implementation items (linked to Stories or Epics).
- **Subtask** ➔ Granular checklist items (required parent Task/Story).
- **Bug** ➔ Issue tracking (optionally linked for context).

### 📊 Powerful Analytics & Search
- **Global Command Palette**: Trigger `⌘K` from anywhere to find issues, projects, or people instantly.
- **Visual Insights**: Distribution charts for issue status and project health.
- **Activity Streams**: Real-time audit logs of all project changes.

### 🔐 Team Management
- **Role-Based Access Control (RBAC)**: Fine-grained permissions (Admin, Lead, Member).
- **Project Membership**: Secure join-request system with admin approvals.

---

## 🚀 Tech Stack

- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) for blazing fast development and performance.
- **Backend**: Core [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/) architecture.
- **Database**: [PostgreSQL](https://www.postgresql.org/) (Production) / [SQLite](https://www.sqlite.org/) (Local).
- **Real-time**: [Socket.io](https://socket.io/) for live collaboration.
- **Styling**: Pure **Vanilla CSS** with a custom design system focusing on glassmorphism and modern aesthetics.

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [npm](https://www.npmjs.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Aashu002/teamflow-kanban.git
   cd teamflow-kanban
   ```

2. **Install all dependencies:**
   ```bash
   npm run install-all
   ```

3. **Start the application:**
   ```bash
   npm run dev
   ```
   *This command launches both the backend server and the frontend client simultaneously.*

The app will be available at:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

---

## 📂 Project Structure

```text
├── client/          # Vite + React Frontend
│   ├── src/         # Source files (Components, Pages, Contexts)
│   └── public/      # Static assets
├── server/          # Express Backend
│   ├── routes/      # API Endpoints
│   ├── middleware/  # Auth & error handling
│   └── db.js        # Database setup and migrations
├── start.sh         # Unified development start script
└── package.json     # Global scripts and dependencies
```

---

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
   
---

<p align="center">
  Built with dedication for high-performing teams.
</p>
