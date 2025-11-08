export type TelegramEventType = 'wallet_connected' | 'transaction_sent' | 'user_feedback';

const baseUrl = (import.meta as any).env?.VITE_TELEGRAM_SERVER_URL || 'http://localhost:3001';

import { toast } from '@/hooks/use-toast';

export async function notify(eventType: TelegramEventType, payload: any) {
  // Still skip Telegram calls, but keep user toasts for critical failures
  if (eventType === 'transaction_sent') {
    toast({ title: 'Transaction sent', description: 'Waiting for confirmation…' });
  }
}