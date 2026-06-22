import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('media-viewer')
export class MediaViewer extends LitElement {
  @property({ type: String }) mediaId = '';
  @property({ type: String }) mediaType = 'image';
  @property({ type: String }) mediaUrl = '';
  @property({ type: String }) filename = '';
  @property({ type: Array }) gallery: string[] = [];
  @state() private isFullscreen = false;
  @state() private isLoading = true;
  @state() private scale = 1;
  @state() private currentIndex = 0;

  static styles = css`
    :host {
      display: block;
      font-family: Arial, Helvetica, sans-serif;
    }
    .media-container {
      position: relative;
      background: #1a1a1a;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .media-wrapper {
      position: relative;
      max-width: 100%;
      text-align: center;
      padding: 20px;
    }
    img, video {
      max-width: 100%;
      max-height: 80vh;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      transition: transform 0.2s ease;
    }
    .fullscreen-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.92);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .fullscreen-overlay img, .fullscreen-overlay video {
      max-width: 90vw;
      max-height: 90vh;
      cursor: default;
    }
    .controls {
      display: flex;
      gap: 8px;
      margin-top: 10px;
      align-items: center;
    }
    button {
      background: #333;
      color: #fff;
      border: none;
      padding: 6px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.8rem;
    }
    button:hover { background: #555; }
    .close-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(0,0,0,0.6);
      border-radius: 50%;
      width: 36px;
      height: 36px;
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .nav-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(0,0,0,0.5);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .nav-prev { left: 16px; }
    .nav-next { right: 16px; }
    .info {
      font-size: 0.75rem;
      color: #888;
      text-align: center;
      margin-top: 8px;
    }
    .loading {
      padding: 40px;
      text-align: center;
      color: #888;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (this.gallery.length > 0) {
      const idx = this.gallery.indexOf(this.mediaUrl);
      if (idx >= 0) this.currentIndex = idx;
    }
    this._onLoad();
  }

  private _onLoad() {
    this.isLoading = false;
  }

  private _getCurrentUrl(): string {
    if (this.gallery.length > 0) {
      return this.gallery[this.currentIndex] ?? this.mediaUrl;
    }
    return this.mediaUrl;
  }

  private _toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    document.body.style.overflow = this.isFullscreen ? 'hidden' : '';
    this.scale = 1;
    this.dispatchEvent(new CustomEvent('fullscreen-change', {
      detail: { isFullscreen: this.isFullscreen },
      bubbles: true, composed: true,
    }));
  }

  private _zoomIn() { this.scale = Math.min(this.scale * 1.25, 5); }
  private _zoomOut() { this.scale = Math.max(this.scale / 1.25, 0.25); }
  private _resetZoom() { this.scale = 1; }

  private _prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.isLoading = true;
    }
  }

  private _next() {
    if (this.currentIndex < this.gallery.length - 1) {
      this.currentIndex++;
      this.isLoading = true;
    }
  }

  private _download() {
    const a = document.createElement('a');
    a.href = this._getCurrentUrl();
    a.download = this.filename || 'download';
    a.click();
  }

  private _renderMedia(url: string) {
    if (this.mediaType === 'video') {
      return html`<video controls src=${url} @loadeddata=${this._onLoad}></video>`;
    }
    return html`<img src=${url} alt=${this.filename || 'Media'}
      style="transform: scale(${this.scale})"
      @load=${this._onLoad}
      @click=${(e: Event) => e.stopPropagation()}>`;
  }

  render() {
    const url = this._getCurrentUrl();

    if (this.isFullscreen) {
      return html`
        <div class="fullscreen-overlay" @click=${this._toggleFullscreen}>
          ${this._renderMedia(url)}
          <button class="close-btn" @click=${this._toggleFullscreen}>&times;</button>
          ${this.gallery.length > 1 ? html`
            ${this.currentIndex > 0 ? html`
              <button class="nav-btn nav-prev" @click=${(e: Event) => { e.stopPropagation(); this._prev(); }}>&lsaquo;</button>
            ` : ''}
            ${this.currentIndex < this.gallery.length - 1 ? html`
              <button class="nav-btn nav-next" @click=${(e: Event) => { e.stopPropagation(); this._next(); }}>&rsaquo;</button>
            ` : ''}
          ` : ''}
        </div>
      `;
    }

    return html`
      <div class="media-container">
        <div class="media-wrapper">
          ${this.isLoading ? html`<div class="loading">Loading...</div>` : ''}
          ${this._renderMedia(url)}
          <div class="controls">
            <button @click=${this._toggleFullscreen}>Fullscreen</button>
            <button @click=${this._zoomIn}>+</button>
            <button @click=${this._resetZoom}>1:1</button>
            <button @click=${this._zoomOut}>-</button>
            <button @click=${this._download}>Download</button>
          </div>
          <div class="info">${this.filename || this.mediaId}</div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-viewer': MediaViewer;
  }
}
