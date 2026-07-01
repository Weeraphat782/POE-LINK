export type Folder = {
  id: string;
  name: string;
  is_locked: boolean;
  created_by: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
};

export type Link = {
  id: string;
  folder_id: string;
  title: string;
  url: string;
  note: string | null;
  created_at: string;
};
