import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('auth-form')
export class AuthForm extends LitElement {
  @property({ type: String }) mode: 'login' | 'register' = 'login';
  @property({ type: String, attribute: 'api-base' }) apiBase = '/api/v1';
  @state() private username = '';
  @state() private password = '';
  @state() private confirmPassword = '';
  @state() private error = '';
  @state() private loading = false;

  static styles = css`
    :host {
      display: block;
      font-family: Arial, Helvetica, sans-serif;
      padding: 16px;
      max-width: 400px;
      margin: 0 auto;
    }
    .form-container {
      background: #f0e0d6;
      border: 1px solid #d9bfb7;
      padding: 24px;
    }
    h2 {
      text-align: center;
      color: #800000;
      margin: 0 0 16px;
    }
    .form-group {
      margin-bottom: 12px;
    }
    label {
      display: block;
      margin-bottom: 4px;
      font-weight: bold;
      font-size: 0.85rem;
    }
    input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #aaa;
      font-size: 0.85rem;
      box-sizing: border-box;
    }
    button {
      width: 100%;
      padding: 8px;
      background: #800000;
      color: #fff;
      border: none;
      cursor: pointer;
      font-weight: bold;
      font-size: 0.9rem;
    }
    button:hover { background: #af0a0f; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .toggle {
      text-align: center;
      margin-top: 12px;
      font-size: 0.85rem;
    }
    .toggle a {
      color: #0000ee;
      cursor: pointer;
      text-decoration: underline;
    }
    .error {
      background: #fdecea;
      border: 1px solid #e74c3c;
      color: #c0392b;
      padding: 8px;
      margin-bottom: 12px;
      font-size: 0.85rem;
    }
    .tabs {
      display: flex;
      margin-bottom: 16px;
      border-bottom: 2px solid #d9bfb7;
    }
    .tab {
      flex: 1;
      padding: 8px;
      text-align: center;
      cursor: pointer;
      font-weight: bold;
      font-size: 0.9rem;
      border: none;
      background: transparent;
      color: #666;
    }
    .tab.active {
      color: #800000;
      border-bottom: 2px solid #800000;
      margin-bottom: -2px;
    }
  `;

  render() {
    return html`
      <div class="form-container">
        <div class="tabs">
          <button class="tab ${this.mode === 'login' ? 'active' : ''}"
            @click=${() => { this.mode = 'login'; this.error = ''; }}>
            Login
          </button>
          <button class="tab ${this.mode === 'register' ? 'active' : ''}"
            @click=${() => { this.mode = 'register'; this.error = ''; }}>
            Register
          </button>
        </div>

        ${this.error ? html`<div class="error">${this.error}</div>` : ''}

        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" .value=${this.username}
            @input=${(e: InputEvent) => this.username = (e.target as HTMLInputElement).value}
            autocomplete="username">
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" .value=${this.password}
            @input=${(e: InputEvent) => this.password = (e.target as HTMLInputElement).value}
            autocomplete=${this.mode === 'login' ? 'current-password' : 'new-password'}>
        </div>

        ${this.mode === 'register' ? html`
          <div class="form-group">
            <label for="confirm">Confirm Password</label>
            <input type="password" id="confirm" .value=${this.confirmPassword}
              @input=${(e: InputEvent) => this.confirmPassword = (e.target as HTMLInputElement).value}
              autocomplete="new-password">
          </div>
        ` : ''}

        <button @click=${this._handleSubmit} ?disabled=${this.loading}>
          ${this.loading ? 'Please wait...' : this.mode === 'login' ? 'Login' : 'Register'}
        </button>
      </div>
    `;
  }

  private async _handleSubmit() {
    if (!this.username.trim() || !this.password.trim()) {
      this.error = 'Username and password are required';
      return;
    }
    if (this.mode === 'register' && this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      const endpoint = this.mode === 'login' ? '/auth/login' : '/auth/register';
      const res = await fetch(`${this.apiBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: this.username, password: this.password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();

      this.dispatchEvent(new CustomEvent('auth-submit', {
        detail: { mode: this.mode, ...data },
        bubbles: true,
        composed: true,
      }));

      this.password = '';
      this.confirmPassword = '';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Authentication failed';
    } finally {
      this.loading = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'auth-form': AuthForm;
  }
}
