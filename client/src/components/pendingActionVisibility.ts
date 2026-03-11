interface PendingActionDialogVisibilityArgs {
  hasPendingAction: boolean;
  isVoting: boolean;
  isChainAction: boolean;
  hasCurrentEvent: boolean;
  optionCount: number;
  maxSelections: number;
  isMovementUiBlocked: boolean;
  isPendingActionLocallyDismissed: boolean;
  mode: 'single' | 'multi';
}

export function shouldShowPendingActionDialog(args: PendingActionDialogVisibilityArgs): boolean {
  if (args.isMovementUiBlocked) return false;
  if (args.isPendingActionLocallyDismissed) return false;
  if (!args.hasPendingAction) return false;
  if (args.isVoting || args.isChainAction || args.hasCurrentEvent) return false;
  if (args.optionCount <= 0) return false;

  if (args.mode === 'multi') {
    return args.maxSelections > 1;
  }

  return args.maxSelections <= 1;
}
