import webpush from "web-push";
import { PushSubscription } from "../types";

export class NotificationService {
  private subscriptions: Map<string, PushSubscription[]>; // userId -> subscriptions

  constructor() {
    this.subscriptions = new Map();

    // Generate VAPID keys for web push
    // In production, these should be environment variables
    const vapidKeys = webpush.generateVAPIDKeys();

    webpush.setVapidDetails(
      "mailto:hi@m10.live", // Change this to your email
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  }

  addSubscription(userId: string, subscription: PushSubscription): void {
    if (!this.subscriptions.has(userId)) {
      this.subscriptions.set(userId, []);
    }

    this.subscriptions?.get(userId)?.push(subscription);
  }

  removeSubscription(userId: string, endpoint: string): void {
    if (!this.subscriptions.has(userId)) return;

    const userSubscriptions = this.subscriptions.get(userId);
    const updatedSubscriptions = userSubscriptions?.filter(
      (sub) => sub.endpoint !== endpoint
    );

    if (updatedSubscriptions?.length === 0) {
      this.subscriptions.delete(userId);
    } else {
      this.subscriptions.set(userId, updatedSubscriptions || []);
    }
  }

  async sendNotification(
    userId: string,
    payload: { title: string; body: string }
  ): Promise<void> {
    if (!this.subscriptions.has(userId)) return;

    const userSubscriptions = this.subscriptions.get(userId);

    const notificationPromises = userSubscriptions?.map(
      async (subscription) => {
        try {
          await webpush.sendNotification(subscription, JSON.stringify(payload));
        } catch (error) {
          console.error(`Failed to send notification: ${error}`);
          // If subscription is invalid, remove it
          if ((error as { statusCode: Number })?.statusCode === 410) {
            this.removeSubscription(userId, subscription.endpoint);
          }
        }
      }
    );

    await Promise.all(notificationPromises || []);
  }
}
