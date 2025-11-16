import React from 'react';

export const ModalWrapper = ({ children, show, className, modalContentClass }: { children?: React.ReactNode; show: boolean; className?: string; modalContentClass?: string; }) => {
    if (!show) return null;
    return (
        <div className={`fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity duration-300 ${className || ''}`}>
            <div className={`modal-content bg-[var(--bg-accent)] text-[var(--text-dark)] p-6 sm:p-10 text-center shadow-2xl max-w-sm w-11/12 transform transition-transform duration-300 scale-100 ${modalContentClass || 'border-4 border-white rounded-3xl'}`}>
                {children}
            </div>
        </div>
    );
};
