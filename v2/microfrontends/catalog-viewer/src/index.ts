import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface CatalogThread {
  id: string;
  subject?: string;
  replyCount: number;
  imageCount: number;
  op: {
    message: string;
    file?: { thumbnailUrl: string };
    isSpoilered?: boolean;
  };
}

@customElement('catalog-viewer')
export class CatalogViewer extends LitElement {
  @property({ type: String }) boardId = '';
  @property({ type: String, attribute: 'api-base' }) apiBase = '/api/v1';
  @state() private threads: CatalogThread[] = [];
  @state() private loading = true;
  @state() private error = '';
  @state() private search = '';

  static styles = css`
    :host {
      display: block;
      font-family: Arial, Helvetica, sans-serif;
      padding: 16px;
    }
    .header {
      text-align: center;
      margin-bottom: 12px;
    }
    .header h2 { color: #800000; margin: 0 0 8px; }
    .search {
      margin-bottom: 12px;
      text-align: center;
    }
    .search input {
      padding: 4px 8px;
      border: 1px solid #aaa;
      width: 250px;
      font-size: 0.85rem;
    }
    .catalog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 8px;
    }
    .thread-card {
      border: 1px solid #d9bfb7;
      background: #f0e0d6;
      overflow: hidden;
      cursor: pointer;
      height: 260px;
      display: flex;
      flex-direction: column;
    }
    .thread-card:hover {
      border-color: #800000;
    }
    .thumb {
      width: 100%;
      height: 150px;
      object-fit: cover;
      display: block;
    }
    .thumb-placeholder {
      width: 100%;
      height: 150px;
      background: #e0d0c6;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      color: #999;
    }
    .card-body { padding: 4px 6px; flex: 1; overflow: hidden; }
    .stats {
      font-size: 0.7rem;
      color: #707070;
      margin-bottom: 2px;
    }
    .subject {
      font-weight: bold;
      font-size: 0.8rem;
      color: #cc1105;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }
    .excerpt {
      font-size: 0.75rem;
      color: #333;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }
    .loading, .error, .empty {
      text-align: center;
      padding: 40px;
    }
    .error { color: #c00; }
    .empty { color: #707070; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._fetchThreads();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('boardId') && this.boardId) {
      this._fetchThreads();
    }
  }

  private async _fetchThreads() {
    if (!this.boardId) return;
    this.loading = true;
    this.error = '';
    try {
      const res = await fetch(`${this.apiBase}/boards/${this.boardId}/threads`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      this.threads = json.data ?? json;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      this.loading = false;
    }
  }

  private _filtered(): CatalogThread[] {
    if (!this.search) return this.threads;
    const q = this.search.toLowerCase();
    return this.threads.filter(
      (t) =>
        (t.subject?.toLowerCase().includes(q)) ||
        t.op.message.toLowerCase().includes(q)
    );
  }

  private _onThreadClick(thread: CatalogThread) {
    this.dispatchEvent(new CustomEvent('thread-selected', {
      detail: { threadId: thread.id, boardId: this.boardId },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (this.loading) return html`<div class="loading">Loading catalog...</div>`;
    if (this.error) return html`<div class="error">${this.error}</div>`;

    const threads = this._filtered();

    return html`
      <div class="header">
        <h2>/${this.boardId}/ - Catalog</h2>
      </div>

      <div class="search">
        <input type="text" placeholder="Search threads..."
          .value=${this.search}
          @input=${(e: InputEvent) => this.search = (e.target as HTMLInputElement).value}>
      </div>

      ${threads.length === 0
        ? html`<div class="empty">No threads found.</div>`
        : html`
          <div class="catalog-grid">
            ${threads.map((t) => html`
              <div class="thread-card" @click=${() => this._onThreadClick(t)}>
                ${t.op.file
                  ? html`<img class="thumb" src=${t.op.file.thumbnailUrl} alt=""
                      style=${t.op.isSpoilered ? 'filter:blur(10px)' : ''}>`
                  : html`<div class="thumb-placeholder">No image</div>`}
                <div class="card-body">
                  <div class="stats">R: ${t.replyCount} / I: ${t.imageCount}</div>
                  ${t.subject ? html`<div class="subject">${t.subject}</div>` : ''}
                  <div class="excerpt">${t.op.message}</div>
                </div>
              </div>
            `)}
          </div>
        `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'catalog-viewer': CatalogViewer;
  }
}
