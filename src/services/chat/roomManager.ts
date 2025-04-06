import { ChatRoom, ChatMessage } from "../../types";

export class ChatRoomManager {
  private rooms: Map<string, ChatRoom>;

  constructor() {
    this.rooms = new Map();

    // Setup periodic cleanup of inactive rooms
    setInterval(() => this.cleanupInactiveRooms(), 1000 * 60 * 30); // Check every 30 minutes
  }

  createRoom(roomId: string): ChatRoom {
    const room: ChatRoom = {
      id: roomId,
      messages: [],
      users: new Map(),
    };

    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): ChatRoom | undefined {
    return this.rooms.get(roomId);
  }

  addUserToRoom(
    roomId: string,
    socketId: string,
    userId?: string
  ): string | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const anonymousId = userId || `anon-${Math.floor(Math.random() * 10000)}`;
    room.users.set(socketId, anonymousId);
    return anonymousId;
  }

  removeUserFromRoom(roomId: string, socketId: string): void {
    const room = this.getRoom(roomId);
    if (!room) return;

    room.users.delete(socketId);

    // If the room is empty, schedule it for deletion
    if (room.users.size === 0) {
      setTimeout(() => {
        // Double check if still empty before removing
        const currentRoom = this.getRoom(roomId);
        if (currentRoom && currentRoom.users.size === 0) {
          this.rooms.delete(roomId);
        }
      }, 1000 * 60 * 5); // Remove after 5 minutes of inactivity
    }
  }

  addMessageToRoom(roomId: string, message: ChatMessage): boolean {
    const room = this.getRoom(roomId);
    if (!room) return false;

    room.messages.push(message);
    return true;
  }

  getUsersInRoom(roomId: string): string[] {
    const room = this.getRoom(roomId);
    if (!room) return [];

    return Array.from(room.users.values());
  }

  cleanupInactiveRooms(): void {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.users.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }
}
