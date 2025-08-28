// rclone RC API client
export class RcloneClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:5572') {
    this.baseUrl = baseUrl;
  }

  private async request(endpoint: string, options: any = {}) {
    const url = `${this.baseUrl}/${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error(`rclone API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('rclone API request failed:', error);
      throw error;
    }
  }

  // List all configured remotes
  async listRemotes(): Promise<string[]> {
    try {
      const result = await this.request('config/listremotes');
      return result.remotes || [];
    } catch (error) {
      console.error('Failed to list remotes:', error);
      return [];
    }
  }

  // Get remote info
  async getRemoteInfo(remote: string): Promise<any> {
    try {
      const result = await this.request('config/get', { 
        name: remote 
      });
      return result;
    } catch (error) {
      console.error(`Failed to get remote info for ${remote}:`, error);
      return null;
    }
  }

  // List directory contents
  async listDirectory(remote: string, path: string = ''): Promise<any[]> {
    try {
      const remotePath = path ? `${remote}:${path}` : `${remote}:`;
      const result = await this.request('operations/list', {
        fs: remotePath,
        remote: ''
      });
      return result.list || [];
    } catch (error) {
      console.error(`Failed to list directory ${remote}:${path}:`, error);
      return [];
    }
  }
}

// Default client instance
export const rcloneClient = new RcloneClient();