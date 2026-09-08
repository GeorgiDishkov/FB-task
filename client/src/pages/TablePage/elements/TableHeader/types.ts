export interface TableHeaderProps {
  username: string | undefined;
  totalCount: number | undefined;
  cachedAt: number | null;
  hasData: boolean;
  isRefreshing: boolean;
  isLoggingOut: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}
