<div align="center">

# ⚡ Synapse AI

### Automate Everything. Accelerate Intelligence.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-Bundler-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Styling-06B6D4?logo=tailwindcss&logoColor=white)
![Radix UI](https://img.shields.io/badge/Radix%20UI-Components-161618)
![License](https://img.shields.io/badge/license-private-lightgrey)

A sleek, animated marketing landing page for **Synapse AI** — an AI-powered workflow automation and predictive analytics platform.

</div>

---

## ✨ About

**Synapse AI** helps teams connect their data sources, define intelligent automation rules, and let a real-time engine handle complex workflows with zero manual intervention. This repository contains the **landing page** — a modern, highly polished single-page marketing site built to showcase the product, its pricing, and social proof.

---

## 🧩 Sections

| Section | Purpose |
|---|---|
| 🚀 **Hero** | Animated headline, live dashboard mockup, and gradient visuals |
| 🧭 **Navbar** | Sticky navigation with animated logo |
| 🏢 **Trusted By** | Logo strip of companies using the product |
| 🧠 **Features** | Core product pillars (see below) |
| 🔀 **Comparison** | Feature-by-feature comparison table vs. competitors |
| ⏱️ **Timeline** | Step-by-step "how it works" walkthrough |
| 💬 **Testimonials** | Customer quotes and social proof |
| 💳 **Pricing** | Starter / Professional / Enterprise plans with monthly-annual toggle |
| ❓ **FAQ** | Common questions about privacy, integrations, and billing |
| 📣 **CTA** | Final call-to-action banner |
| 🔻 **Footer** | Site links and legal |

---

## 🧠 Core Features Highlighted

| Feature | Description |
|---|---|
| 🤖 **AI Automation** | Intelligent pipeline orchestration that adapts in real-time to your data topology |
| 🧱 **Workflow Builder** | Visual drag-and-drop designer for complex logic — no code required |
| 📈 **Predictive Analytics** | ML-powered forecasting trained on your own historical data |
| 📡 **Real-time Monitoring** | Live stream observability with millisecond latency |
| ☁️ **Cloud Integration** | 200+ connectors across AWS, GCP, Azure, and your SaaS stack |
| 🔐 **Enterprise Security** | SOC 2 Type II certified, zero-trust architecture, end-to-end encryption |

---

## 💳 Pricing Tiers

| Plan | Price | Best For |
|---|---|---|
| **Starter** | $29/mo | Small teams beginning their AI data journey — up to 1M events/mo |
| **Professional** ⭐ *Most Popular* | $99/mo | Growing teams needing scale — up to 10M events/mo, custom model training |
| **Enterprise** | Custom | Mission-critical operations — unlimited events, on-prem deployment, white-glove onboarding |

---

## 🛠️ Tech Stack

- **Framework:** React 18 + Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS + `tailwind-merge` + `class-variance-authority`
- **Components:** Radix UI primitives + custom `shadcn/ui`-style component library
- **Routing:** [Wouter](https://github.com/molefrog/wouter)
- **Forms:** React Hook Form + Zod validation
- **Animation:** Framer Motion
- **Charts:** Recharts
- **Data Fetching:** TanStack Query
- **Icons:** Lucide React / React Icons
- **Notifications:** Sonner (toasts)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm / pnpm / yarn

### Installation

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at **http://localhost:5173** (or the port Vite assigns).

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Build an optimized production bundle |
| `npm run serve` | Preview the production build locally |
| `npm run typecheck` | Run TypeScript type checking with no emit |

---

## 📁 Project Structure

```
synapse-ai/
├── public/                # Static assets (favicon, robots.txt, OG image)
├── src/
│   ├── components/ui/     # Reusable UI primitives (buttons, dialogs, tables, etc.)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                 # Utility functions
│   ├── pages/               # Route-level pages (Home, 404)
│   ├── sections/            # Landing page sections (Hero, Pricing, FAQ, etc.)
│   ├── App.tsx               # Root app component
│   ├── main.tsx               # Application entry point
│   └── index.css               # Global styles & Tailwind directives
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🎨 Customization

- Update copy and metadata (title, description, OG tags) in **`index.html`**.
- Edit section content directly inside **`src/sections/*.tsx`** — each section is self-contained.
- Adjust theme colors, gradients, and typography in **`src/index.css`** and Tailwind config.
- Replace **`public/opengraph.jpg`** and **`public/favicon.svg`** with your own brand assets.

---

<div align="center">

Built with ⚡ using React, Vite & Tailwind CSS

</div>
