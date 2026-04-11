# TeamFlow — Modern Kanban Dashboard

![TeamFlow Banner](https://img.shields.io/badge/Status-Development-blueviolet?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-React_|_Node_|_SQLite-007ACC?style=for-the-badge)

**TeamFlow** is a high-performance, collaborative Kanban dashboard designed for modern teams. Built with a focus on visual excellence and intuitive user experience, it combines powerful task management with real-time analytics and a premium glassmorphic interface.

---

## ✨ Key Features

### 🔍 Global Command Palette 
Navigate your workspace at the speed of thought. Trigger the search palette from anywhere to find tasks, projects, or team members instantly.

### 📋 Intelligent Kanban Board
- **Fluid Drag & Drop**: Manage task status with smooth, responsive transitions.
- **Task Hierarchy**: Link related tasks and manage dependencies effortlessly.
- **Rich Task Details**: Support for markdown comments, file attachments, and time tracking.

### 📊 Powerful Analytics
- **Project Insights**: Visual summaries of project goals and progress.
- **Issue Distribution**: Stay on top of workload with "Issues by Status" donut charts.
- **Activity Streams**: Real-time audit logs of all project changes.

### 🔐 Secure Collaboration
- **Role-Based Access Control (RBAC)**: Fine-grained permissions for Admin, Lead, and Member roles.
- **Project Membership**: Private or team-wide projects with secure requests and approvals.

---

## 🚀 Tech Stack

- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) for blazing fast development and performance.
- **Backend**: Core [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/) architecture.
- **Database**: [SQLite](https://www.sqlite.org/) with native node support for zero-config database management.
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
│   └── db.js        # Database setup and migrations
├── start.sh         # Unified development start script
└── package.json     # Global scripts and dependencies
```

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with dedication by Meeeeeeeee.
</p>
