export interface FileItem {
  Name: string;
  Path: string;
  IsDir: boolean;
  Size?: number;
  ModTime?: string;
  MimeType?: string;
  ID?: string;
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface FileViewMode {
  mode: 'grid' | 'list';
}

export interface RemoteInfo {
  name: string;
  type: string;
  configured: boolean;
}