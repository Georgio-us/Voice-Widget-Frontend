// bridge_v2/api.js — тонкий мост к API из v1
// На старте просто прокидываем минимально нужные вызовы.

import { APIClient } from '../modules/api-client.js';

export class APIBridgeV2 {
  constructor(widget) {
    this.client = new APIClient(widget);
  }

  // Текст
  async sendText(text) {
    if (typeof this.client.sendTextMessageFromText === 'function') {
      return this.client.sendTextMessageFromText(text);
    }
    return this.client.sendTextMessage();
  }

  // Аудио
  async sendAudio() {
    return this.client.sendMessage();
  }

  // Сессия/инсайты
  async loadSessionInfo() {
    return this.client.loadSessionInfo?.();
  }
}


