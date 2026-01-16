import { useLanguage } from '../context/LanguageContext';
import './ConfirmModal.css';

export default function ConfirmModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText,
    cancelText,
    isDangerous = false 
}) {
    const { t } = useLanguage();
    
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
                        {cancelText || t('common.cancel')}
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        className={`btn ${isDangerous ? 'btn-danger' : 'btn-primary'}`}
                    >
                        {confirmText || t('confirm.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
}
