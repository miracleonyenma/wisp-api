import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { ChatRoomManager } from "../services/chat/roomManager";
import { NotificationService } from "../services/notification";
import { ChatMessage, PushSubscription } from "../types";

export class ChatController {
  private io: Server;
  private chatRoomManager: ChatRoomManager;
  private notificationService: NotificationService;

  constructor(
    io: Server,
    chatRoomManager: ChatRoomManager,
    notificationService: NotificationService
  ) {
    this.io = io;
    this.chatRoomManager = chatRoomManager;
    this.notificationService = notificationService;
  }

  handleConnection = (socket: Socket) => {
    console.log(`New connection: ${socket.id}`);

    // Join a room
    socket.on("joinRoom", (roomId: string, userId?: string) => {
      const room = this.chatRoomManager.getRoom(roomId);

      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      const anonymousId = this.chatRoomManager.addUserToRoom(
        roomId,
        socket.id,
        userId
      );
      socket.join(roomId);

      // Notify others that a new user joined
      socket.to(roomId).emit("userJoined", { userId: anonymousId });

      // Send current users to the new joiner
      socket.emit("roomUsers", {
        users: this.chatRoomManager.getUsersInRoom(roomId),
      });

      // Send message history to the new joiner
      socket.emit("messageHistory", {
        messages: room.messages,
      });

      console.log(`User ${anonymousId} joined room ${roomId}`);
    });

    // Leave a room
    socket.on("leaveRoom", (roomId: string) => {
      const room = this.chatRoomManager.getRoom(roomId);
      if (!room) return;

      const anonymousId = room.users.get(socket.id);
      this.chatRoomManager.removeUserFromRoom(roomId, socket.id);

      socket.leave(roomId);
      socket.to(roomId).emit("userLeft", { userId: anonymousId });

      console.log(`User ${anonymousId} left room ${roomId}`);
    });

    // Send a message
    socket.on(
      "sendMessage",
      ({ roomId, content }: { roomId: string; content: string }) => {
        const room = this.chatRoomManager.getRoom(roomId);
        if (!room) {
          socket.emit("error", { message: "Room not found" });
          return;
        }

        const anonymousId = room.users.get(socket.id);
        if (!anonymousId) {
          socket.emit("error", { message: "Not in room" });
          return;
        }

        const message: ChatMessage = {
          id: uuidv4(),
          sender: anonymousId,
          content,
          timestamp: Date.now(),
        };

        this.chatRoomManager.addMessageToRoom(roomId, message);

        // Broadcast message to everyone in the room
        this.io.to(roomId).emit("newMessage", message);

        // Send push notifications to users who have subscribed
        // This would be for users who have the tab closed but have enabled notifications
        for (const userId of room.users.values()) {
          if (userId !== anonymousId) {
            this.notificationService.sendNotification(userId, {
              title: "New Message",
              body: `${anonymousId}: ${content.substring(0, 50)}${
                content.length > 50 ? "..." : ""
              }`,
            });
          }
        }
      }
    );

    // Register for push notifications
    socket.on(
      "subscribeToPush",
      ({
        roomId,
        subscription,
      }: {
        roomId: string;
        subscription: PushSubscription;
      }) => {
        const room = this.chatRoomManager.getRoom(roomId);
        if (!room) return;

        const anonymousId = room.users.get(socket.id);
        if (!anonymousId) return;

        this.notificationService.addSubscription(anonymousId, subscription);
        console.log(`User ${anonymousId} subscribed to push notifications`);
      }
    );

    // Handle disconnection
    socket.on("disconnect", () => {
      // Find which rooms this socket was in
      for (const [roomId, room] of this.chatRoomManager["rooms"].entries()) {
        if (room.users.has(socket.id)) {
          const anonymousId = room.users.get(socket.id);
          this.chatRoomManager.removeUserFromRoom(roomId, socket.id);
          socket.to(roomId).emit("userLeft", { userId: anonymousId });
          console.log(`User ${anonymousId} disconnected from room ${roomId}`);
        }
      }
    });
  };
}
