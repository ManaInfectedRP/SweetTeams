import './ConfirmModal.css';

export default function ConfirmModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText = 'Bekräfta',
    cancelText = 'Avbryt',
    isDangerous = false 
}) {
    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <div className="confirm-modal-overlay" onClick={onClose}>
            <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className={`confirm-modal-header ${isDangerous ? 'dangerous' : ''}`}>
                    <h3>{title}</h3>
                </div>
                <div className="confirm-modal-body">
                    <p>{message}</p>
                </div>
                <div className="confirm-modal-footer">
                    <button 
                        onClick={onClose} 
                        className="btn btn-secondary"
                    >
                        {cancelText}
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        className={`btn ${isDangerous ? 'btn-danger' : 'btn-primary'}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
