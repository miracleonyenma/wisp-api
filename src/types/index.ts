export type ChatMessage = {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
};

export type ChatRoom = {
  id: string;
  messages: ChatMessage[];
  users: Map<string, string>; // socketId -> anonymousId
};

export type PushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};
