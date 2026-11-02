import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ActionButton } from '../components/ui/FormFields';
import { useConfirmation } from '../hooks/useConfirmation';

describe('ActionButton processing state and double-click protection', () => {
  it('renders spinner and disables button when loading is true', () => {
    const handleClick = vi.fn();
    render(
      <ActionButton loading={true} onClick={handleClick}>
        Save Product
      </ActionButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.style.cursor).toBe('not-allowed');

    // Click should not fire
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('fires onClick when not loading and not disabled', () => {
    const handleClick = vi.fn();
    render(
      <ActionButton loading={false} onClick={handleClick}>
        Save Product
      </ActionButton>
    );

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe('useConfirmation double-click safeguard', () => {
  function TestConfirmComponent({ onAction }) {
    const { confirm, handleConfirm, ConfirmationModal, modalState } = useConfirmation();

    return (
      <div>
        <button
          onClick={() => {
            confirm({
              title: "Confirm Sale",
              message: "Record transaction?",
              confirmText: "Yes, Record Sale",
              onConfirm: onAction
            });
          }}
        >
          Open Modal
        </button>

        <ConfirmationModal
          show={modalState.show}
          title={modalState.title}
          message={modalState.message}
          confirmText={modalState.confirmText}
          onConfirm={handleConfirm}
          onCancel={() => {}}
          isLoading={modalState.isLoading}
        />
      </div>
    );
  }

  it('prevents multiple rapid confirm clicks from triggering onConfirm multiple times', async () => {
    let resolveAction;
    const actionPromise = new Promise((resolve) => {
      resolveAction = resolve;
    });
    const onAction = vi.fn(() => actionPromise);

    render(<TestConfirmComponent onAction={onAction} />);

    // Open confirmation modal
    fireEvent.click(screen.getByText('Open Modal'));
    expect(screen.getByText('Confirm Sale')).toBeInTheDocument();

    const confirmBtn = screen.getByText('Yes, Record Sale');

    // Rapid double click
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);

    // Only 1 execution should have started
    expect(onAction).toHaveBeenCalledTimes(1);

    // Resolve the async action
    await act(async () => {
      resolveAction();
    });
  });
});
