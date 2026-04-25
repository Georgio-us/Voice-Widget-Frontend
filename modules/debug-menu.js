export class DebugMenuManager {
  constructor(widget) {
    this.widget = widget;
    this.selectionHistory = [];
    this.lastApiPayload = null;
    this.lastApiMeta = null;
    this.lastReportText = '';
  }

  _parseFirstNumber(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v).replace(/\s/g, '');
    const m = s.match(/-?\d+(?:[.,]\d+)?/);
    if (!m) return null;
    const n = Number(m[0].replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  _toPretty(value) {
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  }

  pushHistory(event, payload = {}) {
    try {
      const row = {
        ts: new Date().toISOString(),
        event: String(event || 'event'),
        payload
      };
      this.selectionHistory.push(row);
      if (this.selectionHistory.length > 120) {
        this.selectionHistory = this.selectionHistory.slice(-120);
      }
    } catch {}
  }

  storeLastApiPayload(payload, meta = {}) {
    this.lastApiPayload = payload || null;
    this.lastApiMeta = {
      ts: new Date().toISOString(),
      source: meta?.source || 'unknown',
      requestType: meta?.requestType || 'unknown'
    };
    const cardsCount = Array.isArray(payload?.cards) ? payload.cards.length : 0;
    this.pushHistory('candidates_received', {
      source: this.lastApiMeta.source,
      requestType: this.lastApiMeta.requestType,
      cardsCount
    });
    try { this.refresh(); } catch {}
  }

  buildCanonicalPatch(insights = {}) {
    const src = insights || {};
    const operationRaw = String(src.operation || '').toLowerCase();
    let operation = null;
    if (/rent|аренд|alquil/.test(operationRaw)) operation = 'rent';
    else if (operationRaw) operation = 'sale';
    const canonical = {
      operation,
      type: src.type || null,
      location: src.location || null,
      rooms: this._parseFirstNumber(src.rooms),
      maxPrice: this._parseFirstNumber(src.budget),
      maxArea: this._parseFirstNumber(src.area),
      details: src.details || null,
      preferences: src.preferences || null
    };
    Object.keys(canonical).forEach((k) => {
      if (canonical[k] === null || canonical[k] === '' || canonical[k] === undefined) delete canonical[k];
    });
    return canonical;
  }

  getEffectiveSearchParams(insights = {}) {
    const patch = this.buildCanonicalPatch(insights);
    return {
      ...patch,
      lang: this.widget.getLangCode(),
      sessionId: this.widget.sessionId || null
    };
  }

  _collectCandidatePool() {
    const fromDom = [];
    try {
      const nodes = this.widget.shadowRoot.querySelectorAll('.cards-slider .card-slide .cs[data-variant-id]');
      nodes.forEach((node, idx) => {
        fromDom.push({
          id: node.getAttribute('data-variant-id') || null,
          city: node.getAttribute('data-city') || null,
          district: node.getAttribute('data-district') || null,
          rooms: this._parseFirstNumber(node.getAttribute('data-rooms')),
          priceEUR: this._parseFirstNumber(node.getAttribute('data-price-eur')),
          source: `dom#${idx + 1}`
        });
      });
    } catch {}

    const apiCards = Array.isArray(this.widget.api?.lastProposedCards) ? this.widget.api.lastProposedCards : [];
    const fromApiMemory = apiCards.map((c, idx) => ({ ...c, source: `api.memory#${idx + 1}` }));
    const payloadCards = Array.isArray(this.lastApiPayload?.cards) ? this.lastApiPayload.cards : [];
    const fromPayload = payloadCards.map((c, idx) => ({ ...c, source: `api.payload#${idx + 1}` }));

    const merged = [...fromDom, ...fromApiMemory, ...fromPayload];
    const seen = new Set();
    const deduped = [];
    merged.forEach((item) => {
      const key = item?.id ? `id:${item.id}` : `k:${item?.city || ''}|${item?.district || ''}|${item?.rooms || ''}|${item?.priceEUR || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(item);
    });
    return deduped;
  }

  _evaluateCandidateAgainstQuery(candidate = {}, query = {}) {
    const checks = [];
    const pushCheck = (name, status, actual, expected) => checks.push({ name, status, actual, expected });

    if (query.operation) {
      const actual = String(candidate.operation || '').toLowerCase();
      pushCheck('operation', actual ? (actual === query.operation ? 'pass' : 'fail') : 'skip', actual || '-', query.operation);
    } else pushCheck('operation', 'skip', '-', '-');

    if (query.type) {
      const actual = String(candidate.type || candidate.property_type || '').toLowerCase();
      const expected = String(query.type).toLowerCase();
      pushCheck('type', actual ? (actual.includes(expected) ? 'pass' : 'fail') : 'skip', actual || '-', expected);
    } else pushCheck('type', 'skip', '-', '-');

    if (query.location) {
      const actual = `${candidate.city || ''} ${candidate.district || ''}`.trim().toLowerCase();
      const expected = String(
        (typeof query.location === 'object' && query.location !== null)
          ? (query.location.normalized || query.location.raw || '')
          : query.location
      ).toLowerCase();
      pushCheck('location', actual ? (actual.includes(expected) ? 'pass' : 'fail') : 'skip', actual || '-', expected);
    } else pushCheck('location', 'skip', '-', '-');

    if (typeof query.rooms === 'number') {
      const actual = this._parseFirstNumber(candidate.rooms);
      pushCheck('rooms', typeof actual === 'number' ? (actual === query.rooms ? 'pass' : 'fail') : 'skip', actual ?? '-', query.rooms);
    } else pushCheck('rooms', 'skip', '-', '-');

    if (typeof query.maxPrice === 'number') {
      const actual = this._parseFirstNumber(candidate.priceEUR ?? candidate.price);
      pushCheck('maxPrice', typeof actual === 'number' ? (actual <= query.maxPrice ? 'pass' : 'fail') : 'skip', actual ?? '-', query.maxPrice);
    } else pushCheck('maxPrice', 'skip', '-', '-');

    if (typeof query.maxArea === 'number') {
      const actual = this._parseFirstNumber(candidate.area_m2 ?? candidate.built_area ?? candidate.area);
      pushCheck('maxArea', typeof actual === 'number' ? (actual <= query.maxArea ? 'pass' : 'fail') : 'skip', actual ?? '-', query.maxArea);
    } else pushCheck('maxArea', 'skip', '-', '-');

    const considered = checks.filter((c) => c.status !== 'skip').length;
    const passed = checks.filter((c) => c.status === 'pass').length;
    return { checks, considered, passed };
  }

  buildSnapshot() {
    const serverTrace = this.lastApiPayload?.queryTraceV1 || null;
    const insights = serverTrace?.sourceInsights || this.widget.getUnderstanding();
    const canonicalPatch = serverTrace?.canonicalPatch || this.buildCanonicalPatch(insights);
    const effectiveQuery = serverTrace?.postValidationQuery || this.getEffectiveSearchParams(insights);
    const preValidationQuery = serverTrace?.preValidationQuery || null;
    const droppedFields = Array.isArray(serverTrace?.droppedFields) ? serverTrace.droppedFields : [];
    const missingFields = Array.isArray(serverTrace?.missingFields) ? serverTrace.missingFields : [];
    const matchedCount = Number.isFinite(serverTrace?.matchedCount) ? serverTrace.matchedCount : null;
    const candidates = this._collectCandidatePool();
    const match = candidates.slice(0, 12).map((c) => {
      const m = this._evaluateCandidateAgainstQuery(c, effectiveQuery);
      return { candidate: c, ...m };
    });
    const user = [...this.widget.messages].reverse().find((m) => m?.type === 'user');
    const assistant = [...this.widget.messages].reverse().find((m) => m?.type === 'assistant');
    const dialog = {
      user: user?.content || null,
      assistant: assistant?.content || null
    };
    const apiMeta = {
      ...this.lastApiMeta,
      role: this.widget.role || null,
      timing: this.lastApiPayload?.timing || null,
      tokens: this.lastApiPayload?.tokens || null,
      stage: this.lastApiPayload?.stage || null,
      serverQueryTrace: !!serverTrace,
      matchedCount,
      cardsCount: Array.isArray(this.lastApiPayload?.cards) ? this.lastApiPayload.cards.length : 0,
      historyTail: this.selectionHistory.slice(-20)
    };
    return { insights, canonicalPatch, preValidationQuery, effectiveQuery, droppedFields, missingFields, matchedCount, candidates, match, apiMeta, dialog };
  }

  buildReportText(snapshot) {
    const s = snapshot || this.buildSnapshot();
    const lines = [];
    lines.push('=== DEBUG REPORT ===');
    lines.push(`time: ${new Date().toISOString()}`);
    lines.push(`sessionId: ${this.widget.sessionId || '-'}`);
    lines.push('');
    lines.push('[AI understanding]');
    lines.push(this._toPretty(s.insights));
    lines.push('');
    lines.push('[Canonical patch]');
    lines.push(this._toPretty(s.canonicalPatch));
    lines.push('');
    lines.push('[Effective query]');
    lines.push(this._toPretty({
      preValidationQuery: s.preValidationQuery,
      postValidationQuery: s.effectiveQuery,
      droppedFields: s.droppedFields,
      missingFields: s.missingFields
    }));
    lines.push('');
    lines.push('[Candidate pool]');
    lines.push(`count: ${s.candidates.length}`);
    lines.push(`ids: ${s.candidates.map((c) => c.id).filter(Boolean).join(', ') || '-'}`);
    lines.push('');
    lines.push('[Last model/API metadata]');
    lines.push(this._toPretty(s.apiMeta));
    lines.push('');
    lines.push('[Last dialog turn]');
    lines.push(this._toPretty(s.dialog));
    return lines.join('\n');
  }

  refresh() {
    const debugScreen = this.widget.shadowRoot?.getElementById('debugScreen');
    if (!debugScreen) return;
    const s = this.buildSnapshot();
    const set = (id, text) => {
      const el = this.widget.shadowRoot.getElementById(id);
      if (el) el.textContent = text;
    };
    set('debugInsightsPre', this._toPretty(s.insights));
    set('debugCanonicalPre', this._toPretty(s.canonicalPatch));
    set('debugQueryPre', this._toPretty({
      preValidationQuery: s.preValidationQuery,
      postValidationQuery: s.effectiveQuery,
      droppedFields: s.droppedFields,
      missingFields: s.missingFields
    }));
    set('debugCandidatesPre', this._toPretty({
      count: s.candidates.length,
      matchedCount: s.matchedCount,
      ids: s.candidates.map((c) => c.id).filter(Boolean),
      sample: s.candidates.slice(0, 8)
    }));
    const matchLines = s.match.map((m) => {
      const id = m?.candidate?.id || '-';
      const ratio = m.considered ? `${m.passed}/${m.considered}` : 'n/a';
      const checks = m.checks.map((c) => `${c.status === 'pass' ? '✅' : c.status === 'fail' ? '❌' : '⏭️'} ${c.name}: ${c.actual} -> ${c.expected}`).join('\n');
      return `#${id} (${ratio})\n${checks}`;
    });
    set('debugMatchPre', matchLines.join('\n\n') || '-');
    set('debugMetaPre', this._toPretty(s.apiMeta));
    set('debugDialogPre', this._toPretty(s.dialog));
    set('debugRawPre', this._toPretty({
      sourceInsights: s.insights,
      canonicalPatch: s.canonicalPatch,
      preValidationQuery: s.preValidationQuery,
      postValidationQuery: s.effectiveQuery,
      droppedFields: s.droppedFields,
      missingFields: s.missingFields,
      lastApiPayloadCompact: this.lastApiPayload
        ? {
            sessionId: this.lastApiPayload.sessionId || null,
            stage: this.lastApiPayload.stage || null,
            cardsCount: Array.isArray(this.lastApiPayload.cards) ? this.lastApiPayload.cards.length : 0,
            insights: this.lastApiPayload.insights || null
          }
        : null
    }));
    this.lastReportText = this.buildReportText(s);
  }

  async copyReport() {
    const text = this.lastReportText || this.buildReportText(this.buildSnapshot());
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      this.widget.ui?.showNotification?.(this.widget.t('debugCopied') || 'Copied');
    } catch {
      this.widget.ui?.showNotification?.('Copy failed');
    }
  }
}
