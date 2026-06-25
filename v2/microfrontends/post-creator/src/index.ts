import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('post-creator')
export class PostCreator extends LitElement {
  @property({ type: String }) boardId = '';
  @property({ type: String }) threadId = '';
  @property({ type: String, attribute: 'api-base' }) apiBase = '/api/v1';
  @state() private name = '';
  @state() private subject = '';
  @state() private message = '';
  @state() private captchaInput = '';
  @state() private captchaUrl = '';
  @state() private submitting = false;
  @state() private error = '';

  static styles = css`
    :host {
      display: block;
      font-family: Arial, Helvetica, sans-serif;
      padding: 16px;
    }
    .post-form {
      background: #f0e0d6;
      border: 1px solid #d9bfb7;
      padding: 16px;
      max-width: 500px;
    }
    h2 {
      margin: 0 0 12px;
      color: #800000;
      font-size: 1.1rem;
    }
    table { border-collapse: collapse; }
    td { padding: 2px 4px; }
    td:first-child {
      font-size: 0.85rem;
      font-weight: bold;
      white-space: nowrap;
    }
    input[type="text"], textarea {
      width: 100%;
      padding: 4px 6px;
      border: 1px solid #aaa;
      font-family: inherit;
      font-size: 0.85rem;
    }
    textarea { resize: vertical; height: 100px; }
    input[type="file"] { font-size: 0.85rem; }
    .captcha-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .captcha-img {
      border: 1px solid #aaa;
      cursor: pointer;
    }
    button[type="submit"] {
      padding: 4px 16px;
      cursor: pointer;
      font-weight: bold;
    }
    button[type="submit"]:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    .error {
      color: #c00;
      font-size: 0.85rem;
      margin-bottom: 8px;
    }
    .subject-row {
      display: flex;
      gap: 4px;
    }
    .subject-row input { flex: 1; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadCaptcha();
  }

  private async _loadCaptcha() {
    this.captchaUrl = `${this.apiBase}/captcha?t=${Date.now()}`;
  }

  private _handleFileChange(_e: Event) {
    this.error = '';
  }

  private async _handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.message.trim()) {
      this.error = 'Comment is required';
      return;
    }

    this.submitting = true;
    this.error = '';

    const form = this.shadowRoot?.querySelector('form') as HTMLFormElement;
    const fileInput = this.shadowRoot?.querySelector('#file') as HTMLInputElement;
    const formData = new FormData();
    formData.append('boardId', this.boardId);
    if (this.threadId) formData.append('threadId', this.threadId);
    if (this.name.trim()) formData.append('name', this.name);
    if (this.subject.trim()) formData.append('subject', this.subject);
    formData.append('message', this.message);
    if (this.captchaInput.trim()) formData.append('captcha', this.captchaInput);

    const file = fileInput?.files?.[0];
    if (file) formData.append('file', file);

    try {
      const url = this.threadId
        ? `${this.apiBase}/threads/${this.threadId}/posts`
        : `${this.apiBase}/boards/${this.boardId}/threads`;

      const res = await fetch(url, { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      this.dispatchEvent(new CustomEvent('post-submit', {
        detail: await res.json(),
        bubbles: true,
        composed: true,
      }));

      this.message = '';
      this.subject = '';
      this.captchaInput = '';
      if (fileInput) fileInput.value = '';
      this._loadCaptcha();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Post failed';
    } finally {
      this.submitting = false;
    }
  }

  render() {
    return html`
      <form class="post-form" @submit=${this._handleSubmit}>
        <h2>${this.threadId ? 'Reply to Thread' : 'Create New Thread'}</h2>

        ${this.error ? html`<div class="error">${this.error}</div>` : ''}

        <table>
          <tr>
            <td>Name</td>
            <td>
              <input type="text" .value=${this.name}
                @input=${(e: InputEvent) => this.name = (e.target as HTMLInputElement).value}
                placeholder="Anonymous">
            </td>
          </tr>
          ${!this.threadId ? html`
            <tr>
              <td>Subject</td>
              <td>
                <div class="subject-row">
                  <input type="text" .value=${this.subject}
                    @input=${(e: InputEvent) => this.subject = (e.target as HTMLInputElement).value}>
                  <button type="submit" ?disabled=${this.submitting}>
                    ${this.submitting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </td>
            </tr>
          ` : ''}
          <tr>
            <td>Comment</td>
            <td>
              <textarea .value=${this.message}
                @input=${(e: InputEvent) => this.message = (e.target as HTMLTextAreaElement).value}
              ></textarea>
            </td>
          </tr>
          <tr>
            <td>File</td>
            <td>
              <input type="file" id="file" accept="image/*,video/webm"
                @change=${this._handleFileChange}>
            </td>
          </tr>
          ${this.captchaUrl ? html`
            <tr>
              <td>Captcha</td>
              <td>
                <div class="captcha-container">
                  <img class="captcha-img" src=${this.captchaUrl} alt="captcha"
                    width="200" height="60"
                    @click=${this._loadCaptcha}>
                  <input type="text" .value=${this.captchaInput}
                    @input=${(e: InputEvent) => this.captchaInput = (e.target as HTMLInputElement).value}
                    placeholder="Enter captcha" style="width:120px">
                </div>
              </td>
            </tr>
          ` : ''}
          ${this.threadId ? html`
            <tr>
              <td></td>
              <td>
                <button type="submit" ?disabled=${this.submitting}>
                  ${this.submitting ? 'Posting...' : 'Post Reply'}
                </button>
              </td>
            </tr>
          ` : ''}
        </table>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-creator': PostCreator;
  }
}
