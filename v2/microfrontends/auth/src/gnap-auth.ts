interface AuthEvent {
  type: 'login' | 'logout' | 'register' | 'grant-requested' | 'grant-completed';
  data?: any;
}

interface User {
  id: string;
  username: string;
  email: string;
}

interface GNAPClientInstance {
  key: {
    proof: string;
    jwk?: any;
  };
  class_id?: string;
  display?: {
    name: string;
    uri?: string;
  };
}

interface GNAPGrantRequest {
  access_token: {
    access: Array<{
      type: string;
      actions?: string[];
      locations?: string[];
      datatypes?: string[];
    }>;
  };
  client: GNAPClientInstance;
  user?: {
    sub_ids?: Array<{
      subject_type: string;
      email?: string;
    }>;
  };
  interact?: {
    start: string[];
    finish?: {
      method: string;
      uri: string;
      nonce: string;
    };
  };
}

interface GNAPGrantResponse {
  continue?: {
    access_token: {
      value: string;
    };
    uri: string;
    wait?: number;
  };
  access_token?: {
    value: string;
    label?: string;
    manage?: string;
    access: Array<{
      type: string;
      actions?: string[];
      locations?: string[];
      datatypes?: string[];
    }>;
    expires_in?: number;
    key?: any;
  };
  interact?: {
    redirect?: string;
    app?: string;
    user_code?: string;
    user_code_uri?: string;
    finish?: string;
  };
  subject?: {
    sub_ids: Array<{
      subject_type: string;
      email?: string;
    }>;
    assertions?: any;
  };
  instance_id?: string;
  error?: {
    code: string;
    description?: string;
  };
}

class GNAPAuthMicrofrontend {
  private container: HTMLElement;
  private isAuthenticated: boolean = false;
  private currentUser: User | null = null;
  private accessToken: string | null = null;
  private continueToken: string | null = null;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.render();
  }

  private render() {
    if (this.isAuthenticated) {
      this.renderUserProfile();
    } else {
      this.renderLoginForm();
    }
  }

  private renderLoginForm() {
    this.container.innerHTML = `
      <div class="auth-container">
        <h2>Login with GNAP</h2>
        <form id="loginForm">
          <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required>
          </div>
          <button type="submit">Request Access</button>
        </form>
        <div id="gnapStatus" class="gnap-status"></div>
      </div>
    `;

    this.attachLoginHandlers();
  }

  private renderUserProfile() {
    this.container.innerHTML = `
      <div class="auth-container">
        <h2>Welcome, ${this.currentUser?.username}</h2>
        <p>Email: ${this.currentUser?.email}</p>
        <button id="logoutBtn">Logout</button>
      </div>
    `;

    this.attachLogoutHandlers();
  }

  private attachLoginHandlers() {
    const form = document.getElementById('loginForm') as HTMLFormElement;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const email = formData.get('email') as string;
      
      this.initiateGNAPFlow(email);
    });
  }

  private attachLogoutHandlers() {
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', () => {
      this.logout();
    });
  }

  private async initiateGNAPFlow(email: string) {
    const statusDiv = document.getElementById('gnapStatus')!;
    statusDiv.innerHTML = '<p>Requesting access...</p>';

    try {
      const grantRequest: GNAPGrantRequest = {
        access_token: {
          access: [
            {
              type: 'api',
              actions: ['read', 'write'],
            },
          ],
        },
        client: this.createClientInstance(),
        user: {
          sub_ids: [
            {
              subject_type: 'email',
              email: email,
            },
          ],
        },
        interact: {
          start: ['redirect'],
          finish: {
            method: 'redirect',
            uri: window.location.origin + '/auth/callback',
            nonce: this.generateNonce(),
          },
        },
      };

      const response = await fetch('/api/auth/grant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(grantRequest),
      });

      if (response.ok) {
        const grantResponse: GNAPGrantResponse = await response.json();
        this.handleGrantResponse(grantResponse);
      } else {
        statusDiv.innerHTML = '<p class="error">Access request failed</p>';
      }
    } catch (error) {
      console.error('GNAP flow error:', error);
      statusDiv.innerHTML = '<p class="error">Access request error</p>';
    }
  }

  private handleGrantResponse(response: GNAPGrantResponse) {
    const statusDiv = document.getElementById('gnapStatus')!;

    if (response.error) {
      statusDiv.innerHTML = `<p class="error">Error: ${response.error.description || response.error.code}</p>`;
      return;
    }

    if (response.access_token) {
      this.accessToken = response.access_token.value;
      this.completeAuthentication();
      return;
    }

    if (response.interact?.redirect) {
      statusDiv.innerHTML = '<p>Redirecting for authorization...</p>';
      this.continueToken = response.continue?.access_token.value || null;
      window.location.href = response.interact.redirect;
      return;
    }

    if (response.interact?.user_code) {
      statusDiv.innerHTML = `
        <p>Please visit: <a href="${response.interact.user_code_uri}" target="_blank">${response.interact.user_code_uri}</a></p>
        <p>Enter code: <strong>${response.interact.user_code}</strong></p>
        <button id="checkStatus">Check Status</button>
      `;
      
      document.getElementById('checkStatus')?.addEventListener('click', () => {
        this.checkGrantStatus();
      });
    }

    this.dispatchEvent('grant-requested', response);
  }

  private async checkGrantStatus() {
    if (!this.continueToken) return;

    try {
      const response = await fetch('/api/auth/continue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.continueToken}`,
        },
      });

      if (response.ok) {
        const grantResponse: GNAPGrantResponse = await response.json();
        this.handleGrantResponse(grantResponse);
      }
    } catch (error) {
      console.error('Grant status check error:', error);
    }
  }

  private async completeAuthentication() {
    if (!this.accessToken) return;

    try {
      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `GNAP ${this.accessToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        this.currentUser = userData;
        this.isAuthenticated = true;
        this.render();
        this.dispatchEvent('login', { user: userData, token: this.accessToken });
      }
    } catch (error) {
      console.error('User info error:', error);
    }
  }

  private logout() {
    this.isAuthenticated = false;
    this.currentUser = null;
    this.accessToken = null;
    this.continueToken = null;
    this.render();
    this.dispatchEvent('logout');
  }

  private createClientInstance(): GNAPClientInstance {
    return {
      key: {
        proof: 'httpsig',
      },
      display: {
        name: '4chan v2 Web Client',
        uri: window.location.origin,
      },
    };
  }

  private generateNonce(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private dispatchEvent(type: AuthEvent['type'], data?: any) {
    const event = new CustomEvent('auth-event', {
      detail: { type, data }
    });
    window.dispatchEvent(event);
  }

  public handleAuthCallback(interactRef: string) {
    if (this.continueToken) {
      this.continueGrant(interactRef);
    }
  }

  private async continueGrant(interactRef: string) {
    if (!this.continueToken) return;

    try {
      const response = await fetch('/api/auth/continue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.continueToken}`,
        },
        body: JSON.stringify({ interact_ref: interactRef }),
      });

      if (response.ok) {
        const grantResponse: GNAPGrantResponse = await response.json();
        this.handleGrantResponse(grantResponse);
      }
    } catch (error) {
      console.error('Continue grant error:', error);
    }
  }
}

export default GNAPAuthMicrofrontend;
