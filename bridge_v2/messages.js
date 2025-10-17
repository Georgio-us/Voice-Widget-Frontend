// bridge_v2/messages.js — мост для операций с сообщениями/чатом
import { UIManager } from '../modules/ui-manager.js';

export class MessagesBridgeV2 {
  constructor(widget) {
    this.ui = new UIManager(widget);
  }

  init() { return this.ui.initializeUI(); }
  addMessage(msg) { return this.ui.addMessage(msg); }
  showLoading() { return this.ui.showLoading(); }
  hideLoading() { return this.ui.hideLoading(); }
  showNotification(m) { return this.ui.showNotification(m); }
  resetSession() { return this.ui.resetSessionHard(); }
}


