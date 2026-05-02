# 🎥 LyvStreem — Live Streaming Platform

A full-featured live streaming web application built with React + Node.js, inspired by BIGO Live. Includes real-time chat, virtual gifts with stunning effects, Paystack payments, leaderboards, and more.

---

## ✨ Features

- 🔴 **Live Streaming** — Go live with webcam, view live streams
- 💬 **Real-time Chat** — Socket.io powered chat with reactions
- 🎁 **25+ Virtual Gifts** — Common, Rare, Epic & Legendary with particle effects
- 💎 **Gift Animations** — Full-screen animated effects per gift rarity
- 🪙 **Coin System** — Buy coins with Paystack (NGN), send gifts
- 👑 **Leaderboard** — Top streamers ranked by likes
- 🔍 **Discover** — Browse & search live streams by category
- 👤 **Profiles** — Follow/unfollow, view stream history
- 🔔 **Notifications** — Follow, gift and stream alerts
- ⚙️ **Settings** — Profile editing, avatar selection, notification prefs
- 🔐 **Auth** — JWT-based login/register with 100 free welcome coins

---

## 🗂️ Project Structure

```
lyvstreem/
├── frontend/          # React + Vite + TailwindCSS (→ Netlify)
│   ├── src/
│   │   ├── components/   # Layout, StreamCard, GiftPanel, GiftEffect
│   │   ├── context/      # AuthContext, SocketContext
│   │   ├── pages/        # Home, Discover, Live, Profile, GoLive, Coins...
│   │   └── utils/        # api.js (axios)
│   └── .env.example
├── backend/           # Node.js + Express + Socket.io (→ Render)
│   ├── models/        # User, Stream, ChatMessage, Transaction, Notification
│   ├── routes/        # auth, users, streams, gifts, payments, notifications
│   ├── middleware/    # auth.js (JWT)
│   └── .env.example
├── netlify.toml       # Netlify config
├── render.yaml        # Render config
└── Dockerfile         # Backend Docker config
```

---

## 🚀 Quick Start (Local)

### 1. Clone and install
```bash
npm run install:all
```

### 2. Setup backend env
```bash
cp backend/.env.example backend/.env
# Fill in your MongoDB URI, JWT secret, Paystack keys
```

### 3. Setup frontend env
```bash
cp frontend/.env.example frontend/.env
# Set VITE_API_URL=http://localhost:5000/api
# Set VITE_PAYSTACK_PUBLIC_KEY=pk_test_...
```

### 4. Run dev servers
```bash
# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev:frontend
```

---

## ☁️ Deploy to Netlify + Render

### Backend → Render

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo, set:
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && node index.js`
4. Add Environment Variables:
   ```
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET=your_super_secret_key
   PAYSTACK_SECRET_KEY=sk_live_...
   FRONTEND_URL=https://your-app.netlify.app
   NODE_ENV=production
   ```
5. Deploy — copy your Render URL (e.g. `https://lyvstreem-backend.onrender.com`)

### Frontend → Netlify

1. Go to [netlify.com](https://netlify.com) → New Site from Git
2. Connect your repo
3. Set build settings (auto-detected from `netlify.toml`):
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `frontend/dist`
4. Add Environment Variables:
   ```
   VITE_API_URL=https://lyvstreem-backend.onrender.com/api
   VITE_PAYSTACK_PUBLIC_KEY=pk_live_...
   ```
5. Deploy!

---

## 💳 Paystack Setup

1. Create a [Paystack](https://paystack.com) account
2. Get your **Public Key** and **Secret Key** from dashboard
3. Set them in both frontend and backend `.env` files
4. For production, use `pk_live_` / `sk_live_` keys

### Coin Packages (NGN)
| Package | Coins | Price |
|---------|-------|-------|
| Starter | 100 | ₦500 |
| Basic | 250 + 20 bonus | ₦1,000 |
| Popular | 500 + 80 bonus | ₦2,000 |
| Value | 1,000 + 200 bonus | ₦4,000 |
| Premium | 2,500 + 700 bonus | ₦10,000 |
| Elite | 5,000 + 2,000 bonus | ₦20,000 |

---

## 🎁 Gift System

| Rarity | Coin Range | Effect |
|--------|-----------|--------|
| Common | 1–10 | Hearts, sparkles |
| Rare | 50–199 | Flowers, music notes, golden sparkles |
| Epic | 500–2,000 | Zoom, waves, diamond rain, rocket launch |
| Legendary | 5,000–50,000 | Full-screen explosion, particle burst, screen darkening |

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, TailwindCSS, Framer Motion |
| Backend | Node.js, Express, Socket.io |
| Database | MongoDB + Mongoose |
| Auth | JWT |
| Payments | Paystack |
| Realtime | Socket.io |
| Deploy | Netlify (frontend) + Render (backend) |

---

## 📞 Support

For issues or questions, open a GitHub issue or contact the LyvStreem team.
