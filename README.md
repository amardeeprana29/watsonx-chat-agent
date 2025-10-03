# Watsonx Chat Agent

A modern, responsive chat application powered by IBM Watsonx AI with multi-language support (English, Hindi, Hinglish).

## ✨ Features

- 🤖 **AI-Powered Chat**: Integrated with IBM Watsonx for intelligent responses
- 🌍 **Multi-Language Support**: English, Hindi, and Hinglish responses
- 🌙 **Dark/Light Theme**: Toggle between themes with persistence
- 📱 **Responsive Design**: Full-screen and windowed modes
- ⚡ **Real-time Typing Indicators**: Animated dots while AI processes
- 🛡️ **Error Handling**: Graceful fallbacks with friendly messages
- 🔄 **Auto-Retry Logic**: Smart fallback from chat to generation endpoints

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+ recommended)
- IBM Cloud account with Watsonx access
- API key and project ID from IBM Watsonx

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/watsonx-agent.git
   cd watsonx-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd fresh-backend && npm install
   cd ../fresh-frontend && npm install
   cd ..
   ```

3. **Configure environment**
   ```bash
   cd fresh-backend
   cp .env.example .env
   ```

4. **Update your `.env` file** with your IBM Watsonx credentials:
   ```properties
   API_KEY=your_ibm_cloud_api_key_here
   PROJECT_ID=your_watsonx_project_id_here
   MODEL_ID=ibm/granite-13b-instruct-v2
   URL=https://us-south.ml.cloud.ibm.com
   PORT=5000
   ```

5. **Start the development servers**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:5000

## 📁 Project Structure

```
watsonx-agent/
├── fresh-backend/          # Express.js API server
│   ├── server.js          # Main server file
│   ├── package.json       # Backend dependencies
│   ├── .env              # Environment variables (create from .env.example)
│   └── .env.example      # Environment template
├── fresh-frontend/        # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx       # Main React component
│   │   ├── main.jsx      # React entry point
│   │   └── styles.css    # Global styles and theming
│   ├── package.json      # Frontend dependencies
│   └── vite.config.js    # Vite configuration
├── package.json          # Root package.json with scripts
└── README.md            # This file
```

## 🔧 Development

### Available Scripts

```bash
# Start both frontend and backend in development mode
npm run dev

# Start backend only
npm --prefix fresh-backend start

# Start frontend only  
npm --prefix fresh-frontend run start:3001

# Build frontend for production
npm --prefix fresh-frontend run build
```

## 🌐 API Endpoints

### Health Check
```http
GET /api/health
```

### Chat
```http
POST /api/chat
Content-Type: application/json

{
  "message": "Hello, how are you?",
  "language": "en"  // "en" | "hi" | "hinglish"
}
```

## ⚙️ Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `API_KEY` | IBM Cloud API key | Required |
| `PROJECT_ID` | Watsonx project ID | Required |
| `MODEL_ID` | AI model to use | `ibm/granite-13b-instruct-v2` |
| `URL` | Watsonx API base URL | `https://us-south.ml.cloud.ibm.com` |
| `PORT` | Backend server port | `5000` |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## ⚠️ Important Notes

- **Never commit your `.env` file** - it contains sensitive API keys
- Use `.env.example` as a template for required environment variables
- Ensure your IBM Watsonx project has access to the specified model