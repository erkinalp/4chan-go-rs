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

export interface GNAPContinueRequest {
  interact_ref?: string;
}

export interface GNAPUserContext {
  sub: string;
  email?: string;
  role?: string;
  permissions?: string[];
}
