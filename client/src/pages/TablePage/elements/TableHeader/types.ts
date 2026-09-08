export interface TableHeaderProps {
  username: string | undefined;
  totalCount: number | undefined;
  isRefreshing: boolean;
  isLoggingOut: boolean;
  onLogout: () => void;
}
