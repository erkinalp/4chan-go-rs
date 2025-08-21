import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { randomBytes } from 'crypto';

export interface GNAPClientInstance {
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

export interface GNAPAccessTokenRequest {
  access: Array<{
    type: string;
    actions?: string[];
    locations?: string[];
    datatypes?: string[];
  }>;
}

export interface GNAPGrantRequest {
  access_token: GNAPAccessTokenRequest;
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

export interface GNAPAccessToken {
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
}

export interface GNAPGrantResponse {
  continue?: {
    access_token: {
      value: string;
    };
    uri: string;
    wait?: number;
  };
  access_token?: GNAPAccessToken | GNAPAccessToken[];
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

export interface GNAPUserContext {
  sub: string;
  email?: string;
  role?: string;
  permissions?: string[];
}

@Injectable()
export class GNAPService {
  private readonly httpClient: AxiosInstance;
  private readonly serverUrl: string;
  private readonly clientKey: string;
  private readonly clientSecret: string;

  constructor(private configService: ConfigService) {
    this.serverUrl = this.configService.get<string>('GNAP_SERVER_URL', 'http://localhost:8080');
    this.clientKey = this.configService.get<string>('GNAP_CLIENT_KEY', '');
    this.clientSecret = this.configService.get<string>('GNAP_CLIENT_SECRET', '');
    
    this.httpClient = axios.create({
      baseURL: this.serverUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async requestGrant(request: GNAPGrantRequest): Promise<GNAPGrantResponse> {
    try {
      const response = await this.httpClient.post('/gnap', request, {
        headers: {
          Authorization: `Bearer ${this.clientKey}`,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to request GNAP grant: ${error.message}`);
    }
  }

  async validateToken(token: string): Promise<GNAPUserContext> {
    if (!token) {
      throw new UnauthorizedException('Empty token');
    }

    try {
      const response = await this.httpClient.post('/gnap/introspect', null, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status !== 200) {
        throw new UnauthorizedException('Token validation failed');
      }

      return response.data;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async continueGrant(continueToken: string, interactRef?: string): Promise<GNAPGrantResponse> {
    try {
      const payload: any = {};
      if (interactRef) {
        payload.interact_ref = interactRef;
      }

      const response = await this.httpClient.post('/gnap/continue', payload, {
        headers: {
          Authorization: `Bearer ${continueToken}`,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to continue GNAP grant: ${error.message}`);
    }
  }

  generateNonce(): string {
    return randomBytes(32).toString('base64url');
  }

  createClientInstance(name: string, uri?: string): GNAPClientInstance {
    return {
      key: {
        proof: 'httpsig',
      },
      display: {
        name,
        uri,
      },
    };
  }

  createAccessTokenRequest(type: string = 'api', actions?: string[]): GNAPAccessTokenRequest {
    return {
      access: [
        {
          type,
          actions: actions || ['read', 'write'],
        },
      ],
    };
  }
}
