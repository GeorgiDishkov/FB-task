export interface PageButtonProps {
  page: number;
  isCurrent: boolean;
  isDisabled: boolean;
  onSelect: (page: number) => void;
}
