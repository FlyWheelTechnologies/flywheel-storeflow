import { useState, useCallback } from "react";
import ConfirmationModal from "../components/ConfirmationModal";

export function useConfirmation() {
  const [modalState, setModalState] = useState({
    show: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    onConfirm: null,
    onCancel: null,
    type: "primary",
    isLoading: false
  });

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setModalState({
        show: true,
        title: options.title || "Confirm",
        message: options.message || "Are you sure?",
        confirmText: options.confirmText || "Confirm",
        onConfirm: async () => {
          if (options.onConfirm) {
            try {
              await options.onConfirm(options.confirmData);
            } catch (error) {
              console.error("Error in confirmation:", error);
            }
          }
          resolve(true);
          setModalState(prev => ({ ...prev, show: false, isLoading: false }));
        },
        onCancel: () => {
          if (options.onCancel) {
            options.onCancel();
          }
          resolve(false);
          setModalState(prev => ({ ...prev, show: false, isLoading: false }));
        },
        type: options.type || "primary",
        isLoading: false
      });
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (modalState.onConfirm) {
      setModalState(prev => ({ ...prev, isLoading: true }));
      await modalState.onConfirm();
    }
  }, [modalState.onConfirm]);

  const handleCancel = useCallback(() => {
    if (modalState.onCancel) {
      modalState.onCancel();
    }
    setModalState(prev => ({ ...prev, show: false, isLoading: false }));
  }, [modalState.onCancel]);

  const hideModal = useCallback(() => {
    setModalState(prev => ({ ...prev, show: false }));
  }, []);

  return {
    modalState,
    confirm,
    handleConfirm,
    handleCancel,
    hideModal,
    ConfirmationModal
  };
}