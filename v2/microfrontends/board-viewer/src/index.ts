import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface ThreadData {
  id: string;
  subject?: string;
  replyCount: number;
  imageCount: number;
  bumpedAt: string;
  op: {
    postNumber: number;
    name: string;
    tripcode?: string;
    message: string;
    createdAt: string;
    file?: { thumbnailUrl: string; originalFilename: string };
  };
  lastReplies?: Array<{
    postNumber: number;
    name: string;
    message: string;
    createdAt: string;
  }>;
}

@customElement('board-viewer')
export class BoardViewer extends LitElement {
  @property({ type: String }) boardId = '';
  @property({ type: String, attribute: 'api-base' }) apiBase = '/api/v1';
  @state() private threads: ThreadData[] = [];
  @state() private loading = true;
  @state() private error = '';

  static styles = css`
    :host {
      display: block;
      font-family: Arial, Helvetica, sans-serif;
      padding: 16px;
    }
    .board-header {
      text-align: center;
      margin-bottom: 16px;
    }
    .board-header h2 {
      color: #800000;
      margin: 0 0 4px;
    }
    .thread {
      margin-bottom: 24px;
    }
    .post {
      background: #f0e0d6;
      border: 1px solid #d9bfb7;
      padding: 8px 12px;
      margin-bottom: 4px;
      display: inline-block;
      max-width: 100%;
    }
    .post.reply {
      margin-left: 20px;
    }
    .post-header {
      font-size: 0.8rem;
      margin-bottom: 4px;
    }
    .post-name {
      color: #117743;
      font-weight: bold;
    }
    .post-trip {
      color: #228854;
    }
    .post-date {
      color: #666;
      margin-left: 8px;
    }
    .post-no {
      color: #666;
      margin-left: 8px;
    }
    .post-subject {
      color: #cc1105;
      font-weight: bold;
      margin-right: 6px;
    }
    .post-message {
      font-size: 0.85rem;
      word-break: break-word;
    }
    .post-message .greentext {
      color: #789922;
    }
    .post-thumb {
      max-height: 250px;
      cursor: pointer;
      margin-bottom: 8px;
      display: block;
    }
    .omitted {
      font-size: 0.8rem;
      color: #707070;
      margin: 4px 0 4px 20px;
    }
    .separator {
      border: none;
      border-top: 1px solid #d9bfb7;
      margin-top: 12px;
    }
    .loading, .error {
      text-align: center;
      padding: 40px;
      color: #666;
    }
    .error { color: #c00; }
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

  private _formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  private _renderMessage(msg: string) {
    return msg.split('\n').map((line) => {
      if (line.startsWith('>') && !line.startsWith('>>')) {
        return html`<span class="greentext">${line}</span><br>`;
      }
      return html`${line}<br>`;
    });
  }

  render() {
    if (this.loading) return html`<div class="loading">Loading threads...</div>`;
    if (this.error) return html`<div class="error">${this.error}</div>`;

    return html`
      <div class="board-header">
        <h2>/${this.boardId}/</h2>
      </div>

      ${this.threads.map((thread) => html`
        <div class="thread">
          <div class="post">
            <div class="post-header">
              ${thread.subject ? html`<span class="post-subject">${thread.subject}</span>` : ''}
              <span class="post-name">${thread.op.name || 'Anonymous'}</span>
              ${thread.op.tripcode ? html`<span class="post-trip">!${thread.op.tripcode}</span>` : ''}
              <span class="post-date">${this._formatDate(thread.op.createdAt)}</span>
              <span class="post-no">No.${thread.op.postNumber}</span>
            </div>
            ${thread.op.file ? html`
              <img class="post-thumb" src="${thread.op.file.thumbnailUrl}" alt="${thread.op.file.originalFilename}">
            ` : ''}
            <div class="post-message">${this._renderMessage(thread.op.message)}</div>
          </div>

          ${thread.replyCount > (thread.lastReplies?.length ?? 0)
            ? html`<div class="omitted">${thread.replyCount - (thread.lastReplies?.length ?? 0)} post(s) omitted. Click to view.</div>`
            : ''}

          ${(thread.lastReplies ?? []).map((reply) => html`
            <div class="post reply">
              <div class="post-header">
                <span class="post-name">${reply.name || 'Anonymous'}</span>
                <span class="post-date">${this._formatDate(reply.createdAt)}</span>
                <span class="post-no">No.${reply.postNumber}</span>
              </div>
              <div class="post-message">${this._renderMessage(reply.message)}</div>
            </div>
          `)}

          <hr class="separator">
        </div>
      `)}

      ${this.threads.length === 0 ? html`<div class="loading">No threads.</div>` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'board-viewer': BoardViewer;
  }
}
