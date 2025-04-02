import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { generatePortFromName } from "@untools/port-gen";

import { ChatRoomManager } from "./services/chat/roomManager";
import { NotificationService } from "./services/notification";
import { ChatController } from "./controllers/chat";
import { formatIPUrl } from "@untools/ip-url";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const chatRoomManager = new ChatRoomManager();
const notificationService = new NotificationService();
const chatController = new ChatController(
  io,
  chatRoomManager,
  notificationService
);

// API Routes
app.get("/api/health", (req, res) => {
  res.status(200).send({ status: "OK" });
});

// Create a new chat room
app.post("/api/rooms", (req, res) => {
  const roomId = uuidv4();
  chatRoomManager.createRoom(roomId);
  res.status(201).send({ roomId });
});

// Start server
const PORT = process.env.PORT || generatePortFromName("wisp-api");
server.listen(PORT, () => {
  const url = formatIPUrl(PORT as number);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API available at ${url}`);
});

// Socket.io connection handling
io.on("connection", chatController.handleConnection);
