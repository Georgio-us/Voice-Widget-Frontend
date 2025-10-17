// bridge_v2/context.js — мост для понимания/контекста
import { UnderstandingManager } from '../modules/understanding-manager.js';

export class ContextBridgeV2 {
  constructor(widget) {
    this.um = new UnderstandingManager(widget);
  }

  update(insights) { return this.um.update(insights); }
  migrate(insights) { return this.um.migrateInsights(insights); }
  reset() { return this.um.reset(); }
  export() { return this.um.export(); }
  import(data) { return this.um.import(data); }
}


