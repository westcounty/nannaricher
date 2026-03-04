import { useEffect, useState, useCallback } from 'react';
import { useFadeAnimation } from '../hooks/useAnimation';
import type { PendingAction } from '@nannaricher/shared';
import './ChoiceDialog.css';

interface ChoiceOption {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface ChoiceDialogProps {
  title: string;
  prompt: string;
  options: ChoiceOption[];
  onSelect: (choice: string) => void;
  onCancel?: () => void;
  timeout?: number;
  timeoutMessage?: string;
}

export function ChoiceDialog({
  title,
  prompt,
  options,
  onSelect,
  onCancel,
  timeout,
  timeoutMessage = '选择超时',
}: ChoiceDialogProps) {
  const { isVisible, opacity, fadeIn } = useFadeAnimation(300);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(
    timeout ? timeout / 1000 : null
  );
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  useEffect(() => {
    fadeIn();
  }, [fadeIn]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || isClosing) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, isClosing]);

  // Handle timeout
  useEffect(() => {
    if (timeRemaining === 0 && options.length > 0) {
      // Auto-select first available option on timeout
      const availableOption = options.find(o => !o.disabled);
      if (availableOption) {
        handleSelect(availableOption.value);
      }
    }
  }, [timeRemaining, options]);

  const handleSelect = useCallback((value: string) => {
    if (isClosing) return;
    setSelectedValue(value);
    setIsClosing(true);
    setTimeout(() => {
      onSelect(value);
    }, 200);
  }, [isClosing, onSelect]);

  const handleCancel = useCallback(() => {
    if (onCancel && !isClosing) {
      setIsClosing(true);
      setTimeout(() => {
        onCancel();
      }, 150);
    }
  }, [onCancel, isClosing]);

  if (!isVisible && !isClosing) return null;

  return (
    <div
      className={`choice-dialog-overlay ${isClosing ? 'closing' : ''}`}
      style={{ opacity: isClosing ? 0 : opacity }}
    >
      <div
        className={`choice-dialog ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 className="dialog-title">{title}</h2>
          {timeRemaining !== null && timeRemaining > 0 && (
            <div className={`timeout-badge ${timeRemaining <= 5 ? 'urgent' : ''}`}>
              {timeRemaining}s
            </div>
          )}
        </div>

        <div className="dialog-body">
          <p className="dialog-prompt">{prompt}</p>

          {timeRemaining === 0 && (
            <div className="timeout-message">
              {timeoutMessage}
            </div>
          )}

          <div className="options-list">
            {options.map((option, index) => (
              <button
                key={option.value}
                className={`option-button ${
                  selectedValue === option.value ? 'selected' : ''
                } ${option.disabled ? 'disabled' : ''} ${
                  hoveredOption === option.value ? 'hovered' : ''
                }`}
                onClick={() => !option.disabled && handleSelect(option.value)}
                onMouseEnter={() => setHoveredOption(option.value)}
                onMouseLeave={() => setHoveredOption(null)}
                disabled={option.disabled || isClosing}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="option-content">
                  <span className="option-label">{option.label}</span>
                  {option.description && (
                    <span className="option-description">{option.description}</span>
                  )}
                </div>
                {!option.disabled && selectedValue === option.value && (
                  <span className="option-checkmark">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {onCancel && (
          <div className="dialog-footer">
            <button
              className="cancel-button"
              onClick={handleCancel}
              disabled={isClosing}
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to convert PendingAction to ChoiceDialog props
export function pendingActionToChoices(pendingAction: PendingAction): {
  title: string;
  prompt: string;
  options: ChoiceOption[];
} {
  return {
    title: '选择行动',
    prompt: pendingAction.prompt,
    options: (pendingAction.options || []).map(opt => ({
      label: opt.label,
      value: opt.value,
    })),
  };
}

// Specific choice dialogs for different use cases

interface PlayerChoiceProps {
  playerName: string;
  targetPlayers: { id: string; name: string }[];
  onSelectPlayer: (playerId: string) => void;
  onCancel?: () => void;
}

export function PlayerChoiceDialog({
  playerName,
  targetPlayers,
  onSelectPlayer,
  onCancel,
}: PlayerChoiceProps) {
  const options: ChoiceOption[] = targetPlayers.map(player => ({
    label: player.name,
    value: player.id,
  }));

  return (
    <ChoiceDialog
      title="选择玩家"
      prompt={`${playerName}，请选择一个目标玩家：`}
      options={options}
      onSelect={onSelectPlayer}
      onCancel={onCancel}
      timeout={30000}
    />
  );
}

interface LineChoiceProps {
  lines: { id: string; name: string; description?: string }[];
  onSelectLine: (lineId: string) => void;
  onCancel?: () => void;
}

export function LineChoiceDialog({
  lines,
  onSelectLine,
  onCancel,
}: LineChoiceProps) {
  const options: ChoiceOption[] = lines.map(line => ({
    label: line.name,
    value: line.id,
    description: line.description,
  }));

  return (
    <ChoiceDialog
      title="选择路线"
      prompt="请选择一条路线："
      options={options}
      onSelect={onSelectLine}
      onCancel={onCancel}
      timeout={60000}
    />
  );
}

export default ChoiceDialog;

// Multi-select dialog for training plan selection
interface MultiSelectOption {
  label: string;
  value: string;
  description?: string;
  selected?: boolean;
}

interface MultiSelectDialogProps {
  title: string;
  prompt: string;
  options: MultiSelectOption[];
  minSelections: number;
  maxSelections: number;
  onConfirm: (selectedValues: string[]) => void;
  onCancel?: () => void;
  timeout?: number;
  timeoutMessage?: string;
}

export function MultiSelectDialog({
  title,
  prompt,
  options,
  minSelections,
  maxSelections,
  onConfirm,
  onCancel,
  timeout,
  timeoutMessage = '选择超时',
}: MultiSelectDialogProps) {
  const { isVisible, opacity, fadeIn } = useFadeAnimation(300);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedValues, setSelectedValues] = useState<Set<string>>(
    new Set(options.filter(o => o.selected).map(o => o.value))
  );
  const [timeRemaining, setTimeRemaining] = useState<number | null>(
    timeout ? timeout / 1000 : null
  );
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  useEffect(() => {
    fadeIn();
  }, [fadeIn]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || isClosing) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, isClosing]);

  // Handle timeout
  useEffect(() => {
    if (timeRemaining === 0) {
      // Auto-confirm current selection on timeout
      handleConfirm();
    }
  }, [timeRemaining]);

  const toggleOption = useCallback((value: string) => {
    setSelectedValues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else if (newSet.size < maxSelections) {
        newSet.add(value);
      }
      return newSet;
    });
  }, [maxSelections]);

  const handleConfirm = useCallback(() => {
    if (isClosing) return;
    if (selectedValues.size < minSelections) return;

    setIsClosing(true);
    setTimeout(() => {
      onConfirm(Array.from(selectedValues));
    }, 200);
  }, [isClosing, selectedValues, minSelections, onConfirm]);

  const handleCancel = useCallback(() => {
    if (onCancel && !isClosing) {
      setIsClosing(true);
      setTimeout(() => {
        onCancel();
      }, 150);
    }
  }, [onCancel, isClosing]);

  if (!isVisible && !isClosing) return null;

  const canConfirm = selectedValues.size >= minSelections && selectedValues.size <= maxSelections;

  return (
    <div
      className={`choice-dialog-overlay ${isClosing ? 'closing' : ''}`}
      style={{ opacity: isClosing ? 0 : opacity }}
    >
      <div
        className={`choice-dialog multi-select ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 className="dialog-title">{title}</h2>
          {timeRemaining !== null && timeRemaining > 0 && (
            <div className={`timeout-badge ${timeRemaining <= 5 ? 'urgent' : ''}`}>
              {timeRemaining}s
            </div>
          )}
        </div>

        <div className="dialog-body">
          <p className="dialog-prompt">{prompt}</p>
          <p className="selection-hint">
            已选择 {selectedValues.size}/{maxSelections} 项
            {selectedValues.size < minSelections && ` (最少选择 ${minSelections} 项)`}
          </p>

          {timeRemaining === 0 && (
            <div className="timeout-message">
              {timeoutMessage}
            </div>
          )}

          <div className="options-list">
            {options.map((option, index) => {
              const isSelected = selectedValues.has(option.value);
              const canSelectMore = selectedValues.size < maxSelections || isSelected;

              return (
                <button
                  key={option.value}
                  className={`option-button ${isSelected ? 'selected' : ''} ${!canSelectMore ? 'disabled' : ''} ${
                    hoveredOption === option.value ? 'hovered' : ''
                  }`}
                  onClick={() => canSelectMore && toggleOption(option.value)}
                  onMouseEnter={() => setHoveredOption(option.value)}
                  onMouseLeave={() => setHoveredOption(null)}
                  disabled={!canSelectMore && !isSelected}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="option-content">
                    <span className="option-checkbox">{isSelected ? '☑' : '☐'}</span>
                    <span className="option-label">{option.label}</span>
                    {option.description && (
                      <span className="option-description">{option.description}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="dialog-footer">
          {onCancel && (
            <button
              className="cancel-button"
              onClick={handleCancel}
              disabled={isClosing}
            >
              取消
            </button>
          )}
          <button
            className="confirm-button"
            onClick={handleConfirm}
            disabled={!canConfirm || isClosing}
          >
            确认选择
          </button>
        </div>
      </div>
    </div>
  );
}
