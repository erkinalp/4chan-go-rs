import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface Report {
  id: string;
  boardId: string;
  threadId: string;
  postId: string;
  reason: string;
  status: string;
  createdAt: string;
}

interface Ban {
  id: string;
  ip: string;
  boardId: string;
  reason: string;
  expires: string;
  status: string;
}

interface ModLogEntry {
  id: string;
  action: string;
  boardId: string;
  performedBy: string;
  createdAt: string;
}

@customElement('mod-panel')
export class ModPanel extends LitElement {
  @property({ type: String, attribute: 'api-base' }) apiBase = '/api/v1';
  @property({ type: String, attribute: 'auth-token' }) authToken = '';
  @state() private activeTab: 'reports' | 'bans' | 'log' = 'reports';
  @state() private reports: Report[] = [];
  @state() private bans: Ban[] = [];
  @state() private modLog: ModLogEntry[] = [];
  @state() private loading = true;
  @state() private error = '';

  @state() private banBoardId = '';
  @state() private banIp = '';
  @state() private banReason = '';
  @state() private banDuration = 24;
  @state() private showBanForm = false;

  static styles = css`
    :host {
      display: block;
      font-family: Arial, Helvetica, sans-serif;
      padding: 16px;
    }
    h2 { color: #800000; margin: 0 0 16px; }
    .tabs {
      display: flex;
      border-bottom: 2px solid #d9bfb7;
      margin-bottom: 16px;
    }
    .tab {
      padding: 8px 16px;
      cursor: pointer;
      border: none;
      background: transparent;
      font-weight: bold;
      color: #666;
      font-size: 0.9rem;
    }
    .tab.active {
      color: #800000;
      border-bottom: 2px solid #800000;
      margin-bottom: -2px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th {
      text-align: left;
      padding: 6px 8px;
      background: #f0e0d6;
      border-bottom: 2px solid #d9bfb7;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #d9bfb7;
    }
    .status {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.75rem;
      color: #fff;
    }
    .status-pending { background: #f39c12; }
    .status-resolved { background: #27ae60; }
    .status-dismissed { background: #95a5a6; }
    .status-active { background: #e74c3c; }
    .status-expired { background: #95a5a6; }
    .actions { display: flex; gap: 4px; }
    button.action {
      padding: 2px 8px;
      font-size: 0.75rem;
      cursor: pointer;
      border: none;
      border-radius: 2px;
      color: #fff;
    }
    .btn-resolve { background: #27ae60; }
    .btn-dismiss { background: #95a5a6; }
    .btn-delete { background: #e74c3c; }
    .btn-lift { background: #e74c3c; }
    .btn-primary { background: #800000; padding: 4px 12px; cursor: pointer; border: none; color: #fff; border-radius: 3px; }
    .ban-form {
      background: #f0e0d6;
      border: 1px solid #d9bfb7;
      padding: 16px;
      margin-top: 12px;
      max-width: 400px;
    }
    .ban-form .field { margin-bottom: 8px; }
    .ban-form label { display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 2px; }
    .ban-form input, .ban-form select { width: 100%; padding: 4px 6px; border: 1px solid #aaa; box-sizing: border-box; }
    .loading, .error { text-align: center; padding: 20px; }
    .error { color: #c00; }
    .empty { color: #707070; text-align: center; padding: 20px; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._fetchData();
  }

  private _headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) h['Authorization'] = `Bearer ${this.authToken}`;
    return h;
  }

  private async _fetchData() {
    this.loading = true;
    this.error = '';
    try {
      const [reportsRes, bansRes, logRes] = await Promise.all([
        fetch(`${this.apiBase}/mod/reports`, { headers: this._headers() }),
        fetch(`${this.apiBase}/mod/bans`, { headers: this._headers() }),
        fetch(`${this.apiBase}/mod/log`, { headers: this._headers() }),
      ]);

      if (reportsRes.ok) {
        const d = await reportsRes.json();
        this.reports = d.data ?? d;
      }
      if (bansRes.ok) {
        const d = await bansRes.json();
        this.bans = d.data ?? d;
      }
      if (logRes.ok) {
        const d = await logRes.json();
        this.modLog = d.data ?? d;
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      this.loading = false;
    }
  }

  private async _resolveReport(id: string, action: string) {
    await fetch(`${this.apiBase}/mod/reports/${id}`, {
      method: 'PATCH',
      headers: this._headers(),
      body: JSON.stringify({ action }),
    });
    this._fetchData();
  }

  private async _liftBan(id: string) {
    await fetch(`${this.apiBase}/mod/bans/${id}`, {
      method: 'DELETE',
      headers: this._headers(),
    });
    this._fetchData();
  }

  private async _createBan() {
    if (!this.banIp || !this.banReason) return;
    await fetch(`${this.apiBase}/mod/bans`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        ip: this.banIp,
        boardId: this.banBoardId || 'all',
        reason: this.banReason,
        duration: this.banDuration,
      }),
    });
    this.showBanForm = false;
    this.banIp = '';
    this.banReason = '';
    this._fetchData();
  }

  private _formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  render() {
    return html`
      <h2>Moderation Panel</h2>

      <div class="tabs">
        <button class="tab ${this.activeTab === 'reports' ? 'active' : ''}"
          @click=${() => this.activeTab = 'reports'}>Reports</button>
        <button class="tab ${this.activeTab === 'bans' ? 'active' : ''}"
          @click=${() => this.activeTab = 'bans'}>Bans</button>
        <button class="tab ${this.activeTab === 'log' ? 'active' : ''}"
          @click=${() => this.activeTab = 'log'}>Mod Log</button>
      </div>

      ${this.loading ? html`<div class="loading">Loading...</div>` : ''}
      ${this.error ? html`<div class="error">${this.error}</div>` : ''}

      ${!this.loading && !this.error ? this._renderTab() : ''}
    `;
  }

  private _renderTab() {
    switch (this.activeTab) {
      case 'reports': return this._renderReports();
      case 'bans': return this._renderBans();
      case 'log': return this._renderLog();
    }
  }

  private _renderReports() {
    if (this.reports.length === 0) return html`<div class="empty">No reports.</div>`;
    return html`
      <table>
        <thead><tr>
          <th>ID</th><th>Board</th><th>Reason</th><th>Status</th><th>Date</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${this.reports.map(r => html`
            <tr>
              <td>${r.id}</td>
              <td>/${r.boardId}/</td>
              <td>${r.reason}</td>
              <td><span class="status status-${r.status}">${r.status}</span></td>
              <td>${this._formatDate(r.createdAt)}</td>
              <td class="actions">
                ${r.status === 'pending' ? html`
                  <button class="action btn-resolve" @click=${() => this._resolveReport(r.id, 'resolve')}>Resolve</button>
                  <button class="action btn-dismiss" @click=${() => this._resolveReport(r.id, 'dismiss')}>Dismiss</button>
                ` : ''}
              </td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
  }

  private _renderBans() {
    return html`
      <button class="btn-primary" @click=${() => this.showBanForm = !this.showBanForm}>
        ${this.showBanForm ? 'Cancel' : '+ New Ban'}
      </button>

      ${this.showBanForm ? html`
        <div class="ban-form">
          <div class="field">
            <label>IP Address</label>
            <input type="text" .value=${this.banIp}
              @input=${(e: InputEvent) => this.banIp = (e.target as HTMLInputElement).value}>
          </div>
          <div class="field">
            <label>Board (empty = all)</label>
            <input type="text" .value=${this.banBoardId}
              @input=${(e: InputEvent) => this.banBoardId = (e.target as HTMLInputElement).value}
              placeholder="all">
          </div>
          <div class="field">
            <label>Reason</label>
            <input type="text" .value=${this.banReason}
              @input=${(e: InputEvent) => this.banReason = (e.target as HTMLInputElement).value}>
          </div>
          <div class="field">
            <label>Duration (hours)</label>
            <input type="number" .value=${String(this.banDuration)}
              @input=${(e: InputEvent) => this.banDuration = parseInt((e.target as HTMLInputElement).value) || 24}>
          </div>
          <button class="btn-primary" @click=${this._createBan}>Create Ban</button>
        </div>
      ` : ''}

      ${this.bans.length === 0 ? html`<div class="empty" style="margin-top:12px">No bans.</div>` : html`
        <table style="margin-top:12px">
          <thead><tr>
            <th>IP</th><th>Board</th><th>Reason</th><th>Expires</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${this.bans.map(b => html`
              <tr>
                <td>${b.ip}</td>
                <td>${b.boardId === 'all' ? 'All' : `/${b.boardId}/`}</td>
                <td>${b.reason}</td>
                <td>${this._formatDate(b.expires)}</td>
                <td><span class="status status-${b.status}">${b.status}</span></td>
                <td>
                  ${b.status === 'active' ? html`
                    <button class="action btn-lift" @click=${() => this._liftBan(b.id)}>Lift</button>
                  ` : ''}
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      `}
    `;
  }

  private _renderLog() {
    if (this.modLog.length === 0) return html`<div class="empty">No log entries.</div>`;
    return html`
      <table>
        <thead><tr>
          <th>Action</th><th>Board</th><th>By</th><th>Date</th>
        </tr></thead>
        <tbody>
          ${this.modLog.map(e => html`
            <tr>
              <td>${e.action}</td>
              <td>/${e.boardId}/</td>
              <td>${e.performedBy}</td>
              <td>${this._formatDate(e.createdAt)}</td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mod-panel': ModPanel;
  }
}
