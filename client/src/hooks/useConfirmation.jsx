import { useState, useCallback, useRef } from "react";
import ConfirmationModal from "../components/ConfirmationModal";

export function useConfirmation() {
  const [modalState, setModalState] = useState({
    show: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    loadingText: undefined,
    onConfirm: null,
    onCancel: null,
    type: "primary",
    isLoading: false
  });
  const isConfirmingRef = useRef(false);

  const confirm = useCallback((options) => {
    isConfirmingRef.current = false;
    return new Promise((resolve) => {
      setModalState({
        show: true,
        title: options.title || "Confirm",
        message: options.message || "Are you sure?",
        confirmText: options.confirmText || "Confirm",
        loadingText: options.loadingText,
        onConfirm: async () => {
          if (options.onConfirm) {
            try {
              await options.onConfirm(options.confirmData);
            } catch (error) {
              console.error("Error in confirmation:", error);
            }
          }
          resolve(true);
          isConfirmingRef.current = false;
          setModalState(prev => ({ ...prev, show: false, isLoading: false }));
        },
        onCancel: () => {
          if (options.onCancel) {
            options.onCancel();
          }
          resolve(false);
          isConfirmingRef.current = false;
          setModalState(prev => ({ ...prev, show: false, isLoading: false }));
        },
        type: options.type || "primary",
        isLoading: false
      });
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (isConfirmingRef.current || modalState.isLoading) return;
    if (modalState.onConfirm) {
      isConfirmingRef.current = true;
      setModalState(prev => ({ ...prev, isLoading: true }));
      try {
        await modalState.onConfirm();
      } finally {
        isConfirmingRef.current = false;
      }
    }
  }, [modalState.isLoading, modalState.onConfirm]);

  const handleCancel = useCallback(() => {
    if (isConfirmingRef.current || modalState.isLoading) return;
    if (modalState.onCancel) {
      modalState.onCancel();
    }
    isConfirmingRef.current = false;
    setModalState(prev => ({ ...prev, show: false, isLoading: false }));
  }, [modalState.isLoading, modalState.onCancel]);

  const hideModal = useCallback(() => {
    isConfirmingRef.current = false;
    setModalState(prev => ({ ...prev, show: false, isLoading: false }));
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